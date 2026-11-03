import { createSeedData } from '@shared/defaults'
import type { AppData, ImportResult } from '@shared/types'

const LOCAL_KEY = 'teacher-workstation:data'

export const isDesktop = (): boolean => typeof window !== 'undefined' && Boolean(window.desktop)

function readLocal(): AppData | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AppData
  } catch {
    return null
  }
}

function writeLocal(data: AppData): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data))
}

/**
 * 统一存储入口：
 * - Electron 内运行时走主进程的文件存储（可备份、可迁移）；
 * - 纯浏览器预览时降级到 localStorage，方便调试与截图。
 */
export async function loadData(): Promise<AppData> {
  if (window.desktop) return window.desktop.loadData()
  const cached = readLocal()
  if (cached) return cached
  const seed = createSeedData()
  writeLocal(seed)
  return seed
}

export async function persistData(data: AppData): Promise<void> {
  if (window.desktop) {
    await window.desktop.saveData(data)
    return
  }
  writeLocal(data)
}

export async function exportData(data: AppData): Promise<{ ok: boolean; filePath?: string; error?: string }> {
  if (window.desktop) return window.desktop.exportData(data)

  const stamp = new Date().toISOString().slice(0, 10)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `教师工作台-${stamp}.json`
  link.click()
  URL.revokeObjectURL(url)
  return { ok: true, filePath: link.download }
}

export async function importData(): Promise<ImportResult> {
  if (window.desktop) return window.desktop.importData()

  return new Promise<ImportResult>((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) {
        resolve({ ok: false, error: '已取消' })
        return
      }
      try {
        const parsed = JSON.parse(await file.text()) as AppData
        if (!parsed.teacher || !Array.isArray(parsed.classes) || !Array.isArray(parsed.periods)) {
          resolve({ ok: false, error: '文件格式不正确：缺少必要的数据字段' })
          return
        }
        resolve({ ok: true, data: parsed, filePath: file.name })
      } catch (error) {
        resolve({ ok: false, error: error instanceof Error ? error.message : '读取文件失败' })
      }
    }
    input.click()
  })
}
