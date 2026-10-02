import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/infrastructure/ipc/channels.js'
import {
  ipcSuccess,
  ipcError,
  IPC_ERROR_CODES,
  type IpcResult
} from '../../shared/infrastructure/ipc/contracts.js'

export type WindowGetter = () => BrowserWindow | null

export function registerWindowHandlers(getWindow?: WindowGetter): void {
  const resolveWindow = (sender?: Electron.WebContents): BrowserWindow | null => {
    if (getWindow) {
      const win = getWindow()
      if (win) return win
    }
    if (sender) {
      const win = BrowserWindow.fromWebContents(sender)
      if (win) return win
    }
    return BrowserWindow.getFocusedWindow()
  }

  ipcMain.handle(IPC_CHANNELS.WINDOW.MINIMIZE, (event): IpcResult<void> => {
    const win = resolveWindow(event?.sender)
    if (!win) {
      return ipcError('No hay ventana activa', IPC_ERROR_CODES.INTERNAL_ERROR)
    }
    win.minimize()
    return ipcSuccess<void>(undefined)
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW.MAXIMIZE, (event): IpcResult<boolean> => {
    const win = resolveWindow(event?.sender)
    if (!win) {
      return ipcError('No hay ventana activa', IPC_ERROR_CODES.INTERNAL_ERROR)
    }
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
    return ipcSuccess<boolean>(win.isMaximized())
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW.CLOSE, (event): IpcResult<void> => {
    const win = resolveWindow(event?.sender)
    if (!win) {
      return ipcError('No hay ventana activa', IPC_ERROR_CODES.INTERNAL_ERROR)
    }
    win.close()
    return ipcSuccess<void>(undefined)
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW.IS_MAXIMIZED, (event): IpcResult<boolean> => {
    const win = resolveWindow(event?.sender)
    if (!win) {
      return ipcError('No hay ventana activa', IPC_ERROR_CODES.INTERNAL_ERROR)
    }
    return ipcSuccess<boolean>(win.isMaximized())
  })
}
