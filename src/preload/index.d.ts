import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI,
    api: {
      lerEmails:() => Promise<Email[]>,
      openExternal: (url: string) => Promise<boolean>,
    }
  }
}
