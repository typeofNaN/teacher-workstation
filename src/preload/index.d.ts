import type { DesktopApi } from '../shared/api'

declare global {
  interface Window {
    /** Electron 环境注入；浏览器预览时为 undefined，由 storage 层降级到 localStorage */
    desktop?: DesktopApi
  }
}

export {}
