import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/infrastructure/ipc/channels.js'
import {
  ipcSuccess,
  ipcError,
  formatIpcError,
  IPC_ERROR_CODES
} from '../../shared/infrastructure/ipc/contracts.js'
import type {
  CommitKindleImportRequestDTO,
  IpcResult,
  KindleImportSource,
  KindlePreviewResultDTO
} from '../../shared/infrastructure/ipc/contracts.js'
import type { BookRepository } from '../../shared/domain/ports/BookRepository.js'
import type { HighlightRepository } from '../../shared/domain/ports/HighlightRepository.js'
import type { NoteRepository } from '../../shared/domain/ports/NoteRepository.js'
import { PreviewKindleImport } from '../../shared/application/use-cases/PreviewKindleImport.js'
import { CommitKindleImport } from '../../shared/application/use-cases/CommitKindleImport.js'
import { KindleDeviceError, KindleFileError } from '../services/KindleDeviceService.js'
import type { KindleDeviceService, KindleFileContents } from '../services/KindleDeviceService.js'
import { KindleImportSessionStore } from '../services/KindleImportSessionStore.js'

/** Abre el selector nativo de archivos `.txt`; devuelve `null` si el usuario cancela. */
export type ChooseClippingsFile = () => Promise<string | null>

export interface KindleHandlerDependencies {
  bookRepository: BookRepository
  highlightRepository: HighlightRepository
  noteRepository: NoteRepository
  deviceService: KindleDeviceService
  chooseFile: ChooseClippingsFile
  sessions?: KindleImportSessionStore
}

const DEVICE_ERROR_CODES = {
  NOT_FOUND: IPC_ERROR_CODES.KINDLE_NOT_FOUND,
  TIMEOUT: IPC_ERROR_CODES.KINDLE_COPY_TIMEOUT,
  UNSUPPORTED: IPC_ERROR_CODES.KINDLE_UNSUPPORTED,
  FAILED: IPC_ERROR_CODES.KINDLE_DEVICE_ERROR
} as const

function formatKindleError<T>(error: unknown): IpcResult<T> {
  if (error instanceof KindleDeviceError) {
    return ipcError(error.message, DEVICE_ERROR_CODES[error.reason])
  }
  if (error instanceof KindleFileError) {
    return ipcError(error.message, IPC_ERROR_CODES.KINDLE_FILE_ERROR)
  }
  return formatIpcError(error)
}

export function registerKindleHandlers(deps: KindleHandlerDependencies): void {
  const sessions = deps.sessions ?? new KindleImportSessionStore()

  const preview = async (
    contents: KindleFileContents,
    source: KindleImportSource
  ): Promise<KindlePreviewResultDTO> => {
    const result = await new PreviewKindleImport(deps.bookRepository).execute({
      text: contents.text
    })
    const sourceId = sessions.put({ text: contents.text, label: contents.label })
    return { sourceId, source, sourceLabel: contents.label, preview: result }
  }

  ipcMain.handle(IPC_CHANNELS.KINDLE.PREVIEW_FROM_DEVICE, async () => {
    try {
      const contents = await deps.deviceService.readFromDevice()
      return ipcSuccess(await preview(contents, 'DEVICE'))
    } catch (error) {
      return formatKindleError(error)
    }
  })

  ipcMain.handle(IPC_CHANNELS.KINDLE.PREVIEW_FROM_FILE, async () => {
    try {
      const filePath = await deps.chooseFile()
      if (!filePath) {
        return ipcSuccess<KindlePreviewResultDTO | null>(null)
      }
      const contents = await deps.deviceService.readFromFile(filePath)
      return ipcSuccess<KindlePreviewResultDTO | null>(await preview(contents, 'FILE'))
    } catch (error) {
      return formatKindleError(error)
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.KINDLE.COMMIT,
    async (_, args: CommitKindleImportRequestDTO | undefined) => {
      try {
        if (!args || typeof args.sourceId !== 'string' || !Array.isArray(args.assignments)) {
          return ipcError('Datos de importación inválidos', IPC_ERROR_CODES.VALIDATION_ERROR)
        }
        const session = sessions.get(args.sourceId)
        if (!session) {
          return ipcError(
            'La vista previa expiró. Volvé a leer el archivo del Kindle.',
            IPC_ERROR_CODES.KINDLE_SESSION_EXPIRED
          )
        }
        const useCase = new CommitKindleImport(
          deps.bookRepository,
          deps.highlightRepository,
          deps.noteRepository
        )
        const report = await useCase.execute({
          text: session.text,
          assignments: args.assignments
        })
        sessions.delete(args.sourceId)
        return ipcSuccess(report)
      } catch (error) {
        return formatKindleError(error)
      }
    }
  )
}
