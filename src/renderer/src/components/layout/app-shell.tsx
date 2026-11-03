import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { CloudOff, Monitor, Moon, Sun } from 'lucide-react'
import { NAV_ITEMS, SETTINGS_ITEM } from '@/lib/nav'
import { cn, initials } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'
import type { ThemeMode } from '@shared/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor }
]

function NavRow({ to, label, icon: Icon, hint }: (typeof NAV_ITEMS)[number]): JSX.Element {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      title={hint}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors',
          isActive
            ? 'bg-sidebar-accent text-primary'
            : 'text-sidebar-foreground hover:bg-secondary hover:text-foreground'
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn('size-[17px] shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
          <span className="truncate">{label}</span>
          {isActive && <span className="ml-auto size-1.5 rounded-full bg-primary" />}
        </>
      )}
    </NavLink>
  )
}

export function AppShell(): JSX.Element {
  const data = useAppStore((state) => state.data)
  const saving = useAppStore((state) => state.saving)
  const lastSavedAt = useAppStore((state) => state.lastSavedAt)
  const meta = useAppStore((state) => state.meta)
  const theme = data.preferences.theme
  const setTheme = useAppStore((state) => state.setTheme)
  const location = useLocation()

  const isMac = (meta?.platform ?? (navigator.userAgent.includes('Mac') ? 'darwin' : 'other')) === 'darwin'
  const activeItem = [...NAV_ITEMS, SETTINGS_ITEM].find((item) =>
    item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
  )

  const savedLabel = saving ? '保存中…' : lastSavedAt ? `已保存 ${lastSavedAt.slice(11, 16)}` : '本地存储'
  const CurrentThemeIcon = THEME_OPTIONS.find((option) => option.value === theme)?.icon ?? Sun

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* 顶栏同时承担窗口拖拽区，左侧为 macOS 红绿灯预留空间 */}
      <header className="drag-region flex h-11 shrink-0 items-center gap-3 border-b border-border/70 bg-background/80 pl-4 pr-3 backdrop-blur">
        <div className={cn('flex items-center gap-2', isMac && 'pl-[84px]')}>
          <div className="flex size-5 items-center justify-center rounded-[5px] bg-primary text-[11px] font-semibold text-primary-foreground">
            师
          </div>
          <span className="text-[13px] font-semibold tracking-tight">任课老师工作台</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <span className="text-[12.5px] text-muted-foreground">{activeItem?.hint ?? '工作台'}</span>

        <div className="no-drag ml-auto flex items-center gap-1">
          <span className="mr-1 text-[12px] text-muted-foreground">{savedLabel}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="切换主题"
              >
                <CurrentThemeIcon className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {THEME_OPTIONS.map((option) => (
                <DropdownMenuItem key={option.value} onSelect={() => setTheme(option.value)}>
                  <option.icon className="size-4" />
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[216px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
          <div className="px-3 pb-3 pt-4">
            <div className="flex items-center gap-2.5 rounded-xl bg-secondary/70 p-2.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[13px] font-semibold text-primary">
                {initials(data.teacher.name) === '?' ? '师' : initials(data.teacher.name)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold">{data.teacher.name || '未设置姓名'}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {[data.teacher.school, data.teacher.subject].filter(Boolean).join(' · ') || '在设置中完善信息'}
                </p>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 pb-2">
            <p className="px-3 pb-1 pt-1 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground/70">
              教学
            </p>
            {NAV_ITEMS.slice(0, 6).map((item) => (
              <NavRow key={item.to} {...item} />
            ))}
            <p className="px-3 pb-1 pt-3 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground/70">
              个人
            </p>
            {NAV_ITEMS.slice(6).map((item) => (
              <NavRow key={item.to} {...item} />
            ))}
          </nav>

          <div className="border-t border-sidebar-border p-2.5">
            <NavRow {...SETTINGS_ITEM} />
            <div className="mt-1 flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-muted-foreground">
              <CloudOff className="size-3.5" />
              <span>数据仅存本机</span>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto">
          {location.pathname.startsWith('/classroom') ? (
            // 课堂页面向投屏优化：去除外边距容器，铺满整个窗口
            <div className="page-enter h-full px-5 pb-5 pt-4">
              <Outlet />
            </div>
          ) : (
            <div className="page-enter mx-auto w-full max-w-[1180px] px-7 pb-12 pt-6">
              <Outlet />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
