import type { IpcResult } from '../../../shared/infrastructure/ipc/contracts.js'

export const windowService = {
  async minimize(): Promise<IpcResult<void>> {
    if (window.api?.window?.minimize) {
      return await window.api.window.minimize()
    }
    return { success: true, data: undefined }
  },

  async maximize(): Promise<IpcResult<boolean>> {
    if (window.api?.window?.maximize) {
      return await window.api.window.maximize()
    }
    return { success: true, data: false }
  },

  async close(): Promise<IpcResult<void>> {
    if (window.api?.window?.close) {
      return await window.api.window.close()
    }
    return { success: true, data: undefined }
  },

  async isMaximized(): Promise<IpcResult<boolean>> {
    if (window.api?.window?.isMaximized) {
      return await window.api.window.isMaximized()
    }
    return { success: true, data: false }
  }
}
