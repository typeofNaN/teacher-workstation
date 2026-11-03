import { create } from 'zustand'
import { createEmptyData } from '@shared/defaults'
import type { AppData, AppMeta, ThemeMode } from '@shared/types'
import { loadData, persistData } from '@/lib/storage'

interface AppState {
  data: AppData
  meta: AppMeta | null
  ready: boolean
  saving: boolean
  lastSavedAt: string | null
  hydrate: () => Promise<void>
  /** 以「可变草稿」的方式修改数据，内部做深拷贝后触发保存 */
  mutate: (recipe: (draft: AppData) => void) => void
  replaceData: (data: AppData) => Promise<void>
  setTheme: (theme: ThemeMode) => void
  flush: () => Promise<void>
}

const THEME_KEY = 'teacher-workstation:theme'

/** 解析实际生效的主题（system 跟随操作系统） */
function resolveTheme(theme: ThemeMode): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

export function applyTheme(theme: ThemeMode): void {
  const effective = resolveTheme(theme)
  document.documentElement.classList.toggle('dark', effective === 'dark')
  document.documentElement.style.colorScheme = effective
  window.desktop?.setNativeTheme(theme)
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

export const useAppStore = create<AppState>((set, get) => ({
  data: createEmptyData(),
  meta: null,
  ready: false,
  saving: false,
  lastSavedAt: null,

  hydrate: async () => {
    const [data, meta] = await Promise.all([loadData(), window.desktop?.getMeta() ?? Promise.resolve(null)])
    const savedTheme = (localStorage.getItem(THEME_KEY) as ThemeMode | null) ?? data.preferences.theme ?? 'light'
    applyTheme(savedTheme)
    set({ data, meta, ready: true })
  },

  mutate: (recipe) => {
    const next = structuredClone(get().data)
    recipe(next)
    set({ data: next, saving: true })

    // 防抖写入，避免连续输入时高频落盘
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      void persistData(next)
        .then(() => set({ saving: false, lastSavedAt: new Date().toISOString() }))
        .catch(() => set({ saving: false }))
    }, 350)
  },

  replaceData: async (data) => {
    set({ data, saving: true })
    await persistData(data)
    applyTheme(data.preferences.theme)
    set({ saving: false, lastSavedAt: new Date().toISOString() })
  },

  setTheme: (theme) => {
    localStorage.setItem(THEME_KEY, theme)
    applyTheme(theme)
    get().mutate((draft) => {
      draft.preferences.theme = theme
    })
  },

  flush: async () => {
    if (saveTimer) clearTimeout(saveTimer)
    await persistData(get().data)
    set({ saving: false, lastSavedAt: new Date().toISOString() })
  }
}))

/** 常用选择器：拿到当前数据对象 */
export const useData = (): AppData => useAppStore((state) => state.data)
