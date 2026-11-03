import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/** 生成短 ID，仅用于本地数据主键 */
export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

/** 返回 YYYY-MM-DD（本地时区，避免 toISOString 的时差偏移） */
export function toDateKey(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

/** 当前是第几周（周一为一周起点），可传开学日期计算教学周 */
export function weekOfSemester(startDate?: string): number {
  if (!startDate) return 1
  const start = parseDateKey(startDate)
  const diff = Date.now() - start.getTime()
  return Math.max(1, Math.floor(diff / (7 * 86400000)) + 1)
}

/** 把 Date.getDay() 转成 1-7（周一=1，周日=7） */
export function weekdayIndex(date: Date = new Date()): number {
  const day = date.getDay()
  return day === 0 ? 7 : day
}

export const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const
export const WEEKDAY_SHORT = ['一', '二', '三', '四', '五', '六', '日'] as const

/** 稳定的字符串哈希，用于给姓名/科目分配固定色 */
export function hashColor(seed: string, palette: string[] = SUBJECT_PALETTE): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100000
  }
  return palette[hash % palette.length]
}

export const SUBJECT_PALETTE = [
  '#6366f1',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#14b8a6',
  '#f97316'
]

export function classColor(seed: string): string {
  return hashColor(seed)
}

/** 分数 → 语义色，遵循国内习惯：高分不出红，仅用于分段图表 */
export function scoreTone(score: number, fullScore: number): string {
  const rate = score / fullScore
  if (rate >= 0.85) return 'text-emerald-600 dark:text-emerald-400'
  if (rate >= 0.6) return 'text-sky-600 dark:text-sky-400'
  if (rate >= 0.4) return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-600 dark:text-rose-400'
}

/**
 * 根据背景色亮度返回可读的文字颜色（深字或白字）。
 * 班级主题色可能偏浅（如黄色、浅绿），固定白字会看不清，这里按 WCERT 亮度计算。
 */
export function contrastText(bg: string | undefined): string {
  const hex = bg?.trim() ?? ''
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return '#ffffff'
  const lin = (c: number): number => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const r = lin(parseInt(hex.slice(1, 3), 16) / 255)
  const g = lin(parseInt(hex.slice(3, 5), 16) / 255)
  const b = lin(parseInt(hex.slice(5, 7), 16) / 255)
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.45 ? '#1e293b' : '#ffffff'
}

export function initials(name: string): string {
  if (!name) return '?'
  return name.trim().slice(-2)
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
}

/** 相对今天的自然语言描述 */
export function relativeDay(dateKey: string): string {
  const target = parseDateKey(dateKey)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return '今天'
  if (diff === 1) return '明天'
  if (diff === 2) return '后天'
  if (diff === -1) return '昨天'
  if (diff < 0) return `逾期 ${Math.abs(diff)} 天`
  return `${diff} 天后`
}
