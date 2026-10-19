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
  KindleImportReport,
  KindleImportSource,
  KindleNotebookFolderDTO,
  KindlePreviewResultDTO
} from '../../shared/infrastructure/ipc/contracts.js'
import type { BookRepository } from '../../shared/domain/ports/BookRepository.js'
import type { HighlightRepository } from '../../shared/domain/ports/HighlightRepository.js'
import type { NoteRepository } from '../../shared/domain/ports/NoteRepository.js'
import type { ImportedNotebookFileRepository } from '../../shared/domain/ports/ImportedNotebookFileRepository.js'
import { PreviewKindleImport } from '../../shared/application/use-cases/PreviewKindleImport.js'
import { CommitKindleImport } from '../../shared/application/use-cases/CommitKindleImport.js'
import { PreviewKindleNotebookImport } from '../../shared/application/use-cases/PreviewKindleNotebookImport.js'
import { CommitKindleNotebookImport } from '../../shared/application/use-cases/CommitKindleNotebookImport.js'
import type { KindleNotebookScanner } from '../services/KindleNotebookScanner.js'
import { KindleDeviceError, KindleFileError } from '../services/KindleDeviceService.js'
import type { KindleDeviceService, KindleFileContents } from '../services/KindleDeviceService.js'
import { KindleImportSessionStore } from '../services/KindleImportSessionStore.js'

/** Abre el selector nativo de archivos `.txt`; devuelve `null` si el usuario cancela. */
export type ChooseClippingsFile = () => Promise<string | null>

/** Abre el selector nativo de carpetas; devuelve `null` si el usuario cancela. */
export type ChooseNotebookFolder = () => Promise<string | null>

/** Dependencias de la importación de exportaciones del Cuaderno (feature #26). */
export interface KindleNotebookHandlerDependencies {
  scanner: KindleNotebookScanner
  importedFiles: ImportedNotebookFileRepository
  chooseFolder: ChooseNotebookFolder
  /** Persiste la carpeta elegida (`''` = volver a Documentos). */
  saveFolder: (folder: string) => Promise<unknown>
}

export interface KindleHandlerDependencies {
  bookRepository: BookRepository
  highlightRepository: HighlightRepository
  noteRepository: NoteRepository
  deviceService: KindleDeviceService
  chooseFile: ChooseClippingsFile
  sessions?: KindleImportSessionStore
  /** Sin esto no se registran los canales `kindleNotebook:*` (tests de #23). */
  notebook?: KindleNotebookHandlerDependencies
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
        let report: KindleImportReport
        if (session.kind === 'NOTEBOOK') {
          if (!deps.notebook) {
            return ipcError('Importación no disponible.', IPC_ERROR_CODES.VALIDATION_ERROR)
          }
          report = await new CommitKindleNotebookImport(
            deps.bookRepository,
            deps.highlightRepository,
            deps.noteRepository,
            deps.notebook.importedFiles
          ).execute({ files: session.files, assignments: args.assignments })
        } else {
          report = await new CommitKindleImport(
            deps.bookRepository,
            deps.highlightRepository,
            deps.noteRepository
          ).execute({ text: session.text, assignments: args.assignments })
        }
        sessions.delete(args.sourceId)
        return ipcSuccess(report)
      } catch (error) {
        return formatKindleError(error)
      }
    }
  )

  if (deps.notebook) {
    registerKindleNotebookHandlers(deps, deps.notebook, sessions)
  }
}

/**
 * Canales de las exportaciones del Cuaderno (feature #26). Como en #23, el renderer nunca
 * manda rutas: la carpeta se elige con el diálogo nativo en el main y los archivos leídos
 * quedan en la sesión hasta el commit (`kindle:commit`).
 */
function registerKindleNotebookHandlers(
  deps: KindleHandlerDependencies,
  notebook: KindleNotebookHandlerDependencies,
  sessions: KindleImportSessionStore
): void {
  ipcMain.handle(IPC_CHANNELS.KINDLE_NOTEBOOK.PREVIEW, async () => {
    try {
      const scan = await notebook.scanner.scan()
      const preview = await new PreviewKindleNotebookImport(
        deps.bookRepository,
        notebook.importedFiles
      ).execute({ files: scan.files })
      const sourceId = sessions.put({ kind: 'NOTEBOOK', files: scan.files, label: scan.folder })
      return ipcSuccess<KindlePreviewResultDTO>({
        sourceId,
        source: 'NOTEBOOK',
        sourceLabel: scan.folder,
        preview
      })
    } catch (error) {
      return formatKindleError(error)
    }
  })

  ipcMain.handle(IPC_CHANNELS.KINDLE_NOTEBOOK.GET_FOLDER, async () => {
    try {
      return ipcSuccess<KindleNotebookFolderDTO>(await notebook.scanner.resolveFolder())
    } catch (error) {
      return formatKindleError(error)
    }
  })

  ipcMain.handle(IPC_CHANNELS.KINDLE_NOTEBOOK.CHOOSE_FOLDER, async () => {
    try {
      const folder = await notebook.chooseFolder()
      if (!folder) {
        return ipcSuccess<KindleNotebookFolderDTO | null>(null)
      }
      await notebook.saveFolder(folder)
      return ipcSuccess<KindleNotebookFolderDTO | null>(await notebook.scanner.resolveFolder())
    } catch (error) {
      return formatKindleError(error)
    }
  })

  ipcMain.handle(IPC_CHANNELS.KINDLE_NOTEBOOK.RESET_FOLDER, async () => {
    try {
      await notebook.saveFolder('')
      return ipcSuccess<KindleNotebookFolderDTO>(await notebook.scanner.resolveFolder())
    } catch (error) {
      return formatKindleError(error)
    }
  })
}
