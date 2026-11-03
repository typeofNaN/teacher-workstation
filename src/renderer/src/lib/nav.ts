import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  Home,
  ListChecks,
  MonitorPlay,
  Settings,
  Sparkles,
  Users
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** 用于顶栏展示的简短描述 */
  hint: string
  /** 课堂页等全屏场景下隐藏侧边栏入口 */
  primary?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: '工作台', icon: Home, hint: '今日概览', primary: true },
  { to: '/classroom', label: '课堂', icon: MonitorPlay, hint: '座位 · 点名 · 点评', primary: true },
  { to: '/timetable', label: '课表', icon: CalendarDays, hint: '排课与调课', primary: true },
  { to: '/progress', label: '教学进度', icon: ListChecks, hint: '课题与各班进度', primary: true },
  { to: '/assignments', label: '作业', icon: ClipboardList, hint: '布置与登记', primary: true },
  { to: '/grades', label: '成绩', icon: BarChart3, hint: '录入与分析', primary: true },
  { to: '/students', label: '学生名单', icon: Users, hint: '花名册', primary: true },
  { to: '/ai', label: 'AI 助手', icon: Sparkles, hint: '备课 · 分析 · 评语', primary: true }
]

export const SETTINGS_ITEM: NavItem = {
  to: '/settings',
  label: '设置',
  icon: Settings,
  hint: '个人信息与数据',
  primary: true
}
