import type {
  CommitKindleImportRequestDTO,
  IpcResult,
  KindleImportReport,
  KindleNotebookFolderDTO,
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
  },

  /** Busca las exportaciones del Cuaderno de la app en la carpeta configurada (#26). */
  async previewNotebooks(): Promise<IpcResult<KindlePreviewResultDTO>> {
    return await window.api.kindle.previewNotebooks()
  },

  async getNotebookFolder(): Promise<IpcResult<KindleNotebookFolderDTO>> {
    return await window.api.kindle.getNotebookFolder()
  },

  /** Abre el selector de carpetas; `data` es `null` si el usuario cancela. */
  async chooseNotebookFolder(): Promise<IpcResult<KindleNotebookFolderDTO | null>> {
    return await window.api.kindle.chooseNotebookFolder()
  },

  /** Vuelve a la carpeta Documentos. */
  async resetNotebookFolder(): Promise<IpcResult<KindleNotebookFolderDTO>> {
    return await window.api.kindle.resetNotebookFolder()
  }
}
