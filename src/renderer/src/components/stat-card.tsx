import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: ReactNode
  suffix?: string
  hint?: string
  icon: LucideIcon
  tone?: 'primary' | 'sky' | 'emerald' | 'amber' | 'rose'
  className?: string
}

const TONE_STYLES: Record<NonNullable<StatCardProps['tone']>, string> = {
  primary: 'bg-primary/10 text-primary',
  sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
}

export function StatCard({
  label,
  value,
  suffix,
  hint,
  icon: Icon,
  tone = 'primary',
  className
}: StatCardProps): JSX.Element {
  return (
    <div className={cn('rounded-xl border border-border/80 bg-card p-4 shadow-card', className)}>
      <div className="flex items-start justify-between">
        <p className="text-[12.5px] font-medium text-muted-foreground">{label}</p>
        <div className={cn('flex size-7 items-center justify-center rounded-lg', TONE_STYLES[tone])}>
          <Icon className="size-[15px]" />
        </div>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="tabular text-[26px] font-semibold leading-none tracking-tight">{value}</span>
        {suffix && <span className="text-[12px] text-muted-foreground">{suffix}</span>}
      </div>
      {hint && <p className="mt-1.5 truncate text-[11.5px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
