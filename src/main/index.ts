import { app, BrowserWindow, dialog, ipcMain, nativeImage, nativeTheme, shell } from 'electron'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createEmptyData, createSeedData, DATA_VERSION } from '../shared/defaults'
import type { AppData, AppMeta, ImportResult } from '../shared/types'

const isDev = !app.isPackaged

/** 数据文件放在 userData 下，卸载应用不会丢，也不会污染项目目录 */
function dataDir(): string {
  return join(app.getPath('userData'), 'data')
}
function dataFile(): string {
  return join(dataDir(), 'teacher-workstation.json')
}

let mainWindow: BrowserWindow | null = null

/**
 * 应用图标路径：打包后 macOS 用 bundle 内置 icns、Windows 用 exe 内置 ico；
 * 仅开发态需要手动指定，否则 Dock 和任务栏显示 Electron 默认图标。
 */
function loadAppIcon(): Electron.NativeImage | undefined {
  if (!isDev) return undefined
  const icon = nativeImage.createFromPath(join(app.getAppPath(), 'build', 'icon.png'))
  return icon.isEmpty() ? undefined : icon
}

/** 原子写入：先写临时文件再 rename，避免进程中断导致 JSON 损坏 */
async function writeDataAtomic(data: AppData): Promise<void> {
  await mkdir(dataDir(), { recursive: true })
  const target = dataFile()
  const tmp = `${target}.tmp`
  await writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8')
  await rename(tmp, target)
}

/**
 * 读取本地数据。
 * 首次启动写入示例数据；文件损坏时备份原文件并回退到空模板，保证应用永远能启动。
 */
async function readData(): Promise<AppData> {
  const target = dataFile()
  if (!existsSync(target)) {
    const seed = createSeedData()
    await writeDataAtomic(seed)
    return seed
  }
  try {
    const raw = await readFile(target, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppData>
    return normalizeData(parsed)
  } catch (error) {
    console.error('[data] 读取失败，已回退到空数据：', error)
    const broken = `${target}.broken-${Date.now()}`
    try {
      await rename(target, broken)
    } catch {
      /* 备份失败不阻塞启动 */
    }
    const empty = createEmptyData()
    await writeDataAtomic(empty)
    return empty
  }
}

/** 兜底班级色：历史版本可能存了 'blue' 这类非法 CSS 色值，读入时统一迁移为 hex */
const COLOR_PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316']

function normalizeClassColor(value: unknown, index: number): string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value
    : COLOR_PALETTE[index % COLOR_PALETTE.length]
}

/** 兼容旧版本 / 缺失字段，避免 UI 读到 undefined 崩溃 */
function normalizeData(input: Partial<AppData>): AppData {
  const base = createEmptyData()
  return {
    ...base,
    ...input,
    version: DATA_VERSION,
    teacher: { ...base.teacher, ...(input.teacher ?? {}) },
    preferences: { ...base.preferences, ...(input.preferences ?? {}) },
    ai: { ...base.ai, ...(input.ai ?? {}) },
    periods: Array.isArray(input.periods) && input.periods.length ? input.periods : base.periods,
    topics: Array.isArray(input.topics) ? input.topics : [],
    progress: input.progress && typeof input.progress === 'object' ? input.progress : {},
    classes: (Array.isArray(input.classes) ? input.classes : []).map((cls, index) => ({
      ...cls,
      color: normalizeClassColor(cls?.color, index)
    })),
    schedule: Array.isArray(input.schedule) ? input.schedule : [],
    overrides: Array.isArray(input.overrides) ? input.overrides : [],
    assignments: Array.isArray(input.assignments) ? input.assignments : [],
    exams: Array.isArray(input.exams) ? input.exams : [],
    feedback: Array.isArray(input.feedback) ? input.feedback : []
  }
}

/** 导入前做最低限度的结构校验，防止脏文件直接覆盖本地数据 */
function validateImport(raw: unknown): raw is AppData {
  if (!raw || typeof raw !== 'object') return false
  const candidate = raw as Record<string, unknown>
  const arrayKeys = ['classes', 'schedule', 'overrides', 'assignments', 'exams', 'feedback', 'topics']
  return (
    typeof candidate.teacher === 'object' &&
    Array.isArray(candidate.periods) &&
    arrayKeys.every((key) => Array.isArray(candidate[key]))
  )
}

function createWindow(): void {
  const icon = loadAppIcon()
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 700,
    show: false,
    ...(icon ? { icon } : {}),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0d1117' : '#f6f7f9',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 18, y: 16 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  // 外部链接交给系统浏览器，避免在应用内打开不可控页面
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('data:load', async () => readData())

  ipcMain.handle('data:save', async (_event, data: AppData) => {
    if (!validateImport(data)) throw new Error('数据结构不合法，已拒绝写入')
    await writeDataAtomic(data)
    return true
  })

  ipcMain.handle('data:export', async (_event, data: AppData) => {
    if (!mainWindow) return { ok: false, error: '窗口未就绪' }
    const stamp = new Date().toISOString().slice(0, 10)
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: '导出工作台数据',
      defaultPath: join(app.getPath('downloads'), `教师工作台-${stamp}.json`),
      filters: [{ name: 'JSON 数据文件', extensions: ['json'] }]
    })
    if (canceled || !filePath) return { ok: false, error: '已取消' }
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
    return { ok: true, filePath }
  })

  ipcMain.handle('data:import', async (): Promise<ImportResult> => {
    if (!mainWindow) return { ok: false, error: '窗口未就绪' }
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: '导入工作台数据',
      properties: ['openFile'],
      filters: [{ name: 'JSON 数据文件', extensions: ['json'] }]
    })
    if (canceled || !filePaths[0]) return { ok: false, error: '已取消' }
    try {
      const raw = await readFile(filePaths[0], 'utf-8')
      const parsed: unknown = JSON.parse(raw)
      if (!validateImport(parsed)) {
        return { ok: false, error: '文件格式不正确：缺少必要的数据字段' }
      }
      const data = normalizeData(parsed)
      await writeDataAtomic(data)
      return { ok: true, data, filePath: filePaths[0] }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '读取文件失败' }
    }
  })

  ipcMain.handle('data:reset', async () => {
    const empty = createEmptyData()
    await writeDataAtomic(empty)
    return empty
  })

  ipcMain.handle('data:reveal', async () => {
    await mkdir(dataDir(), { recursive: true })
    shell.showItemInFolder(dataFile())
  })

  ipcMain.handle(
    'app:meta',
    (): AppMeta => ({
      appVersion: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      platform: process.platform,
      dataFilePath: dataFile()
    })
  )

  ipcMain.on('window:toggle-theme', (_event, theme: 'light' | 'dark' | 'system') => {
    nativeTheme.themeSource = theme
  })
}

app.whenReady().then(() => {
  // 开发态手动设置 Dock 图标（打包后由 bundle 的 icns 接管）
  const icon = loadAppIcon()
  if (process.platform === 'darwin' && icon) app.dock?.setIcon(icon)

  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
