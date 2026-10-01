import { ElectronAPI } from '@electron-toolkit/preload'
import type { BookLogApi } from './index.js'

declare global {
  interface Window {
    electron: ElectronAPI
    api: BookLogApi
  }
}
