import type { AppData, AppMeta, ImportResult, ThemeMode } from './types'

/**
 * 渲染进程可用的桌面能力白名单。
 * 放在 shared 中，preload 实现、renderer 只声明类型，避免渲染层耦合 Electron 类型。
 */
export interface DesktopApi {
  loadData: () => Promise<AppData>
  saveData: (data: AppData) => Promise<boolean>
  exportData: (data: AppData) => Promise<{ ok: boolean; filePath?: string; error?: string }>
  importData: () => Promise<ImportResult>
  resetData: () => Promise<AppData>
  revealDataFile: () => Promise<void>
  getMeta: () => Promise<AppMeta>
  setNativeTheme: (theme: ThemeMode) => void
}
