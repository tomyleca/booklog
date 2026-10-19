import type {
  CommitKindleImportRequestDTO,
  IpcResult,
  KindleImportReport,
  KindlePreviewResultDTO
} from '../../../shared/infrastructure/ipc/contracts.js'

export const kindleService = {
  /** Busca el Kindle conectado (MTP), copia My Clippings.txt y devuelve la vista previa. */
  async previewFromDevice(): Promise<IpcResult<KindlePreviewResultDTO>> {
    return await window.api.kindle.previewFromDevice()
  },

  /** Abre el selector de archivos .txt; `data` es `null` si el usuario cancela. */
  async previewFromFile(): Promise<IpcResult<KindlePreviewResultDTO | null>> {
    return await window.api.kindle.previewFromFile()
  },

  async commit(dto: CommitKindleImportRequestDTO): Promise<IpcResult<KindleImportReport>> {
    return await window.api.kindle.commit(dto)
  }
}
