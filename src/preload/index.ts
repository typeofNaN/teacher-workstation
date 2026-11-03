import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopApi } from '../shared/api'

/** 渲染进程唯一可用的桌面能力，全部通过白名单方法暴露 */
const api: DesktopApi = {
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (data) => ipcRenderer.invoke('data:save', data),
  exportData: (data) => ipcRenderer.invoke('data:export', data),
  importData: () => ipcRenderer.invoke('data:import'),
  resetData: () => ipcRenderer.invoke('data:reset'),
  revealDataFile: () => ipcRenderer.invoke('data:reveal'),
  getMeta: () => ipcRenderer.invoke('app:meta'),
  setNativeTheme: (theme) => ipcRenderer.send('window:toggle-theme', theme)
}

contextBridge.exposeInMainWorld('desktop', api)
