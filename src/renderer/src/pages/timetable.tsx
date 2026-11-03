import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { CalendarDays, MapPin, Plus, X } from 'lucide-react'
import { useData, useAppStore } from '@/store/app-store'
import { lessonsForDate } from '@/lib/schedule'
import { toDateKey, weekdayIndex, WEEKDAY_LABELS, contrastText } from '@/lib/utils'
import { LESSON_TYPE_LABELS } from '@shared/types'
import type { DayOverride, LessonType, ScheduleItem, Weekday } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn, uid, WEEKDAY_SHORT } from '@/lib/utils'

/** 课表页：固定课表 + 单日调课 / 对调 / 停课 */
export default function TimetablePage(): JSX.Element {
  const data = useData()
  const mutate = useAppStore((state) => state.mutate)
  const navigate = useNavigate()
  const location = useLocation()

  const today = toDateKey()
  const todayLessons = useMemo(() => lessonsForDate(data, today), [data, today])

  /** 新增固定课表 */
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ classId: '', day: '1', periodId: '', room: '', type: 'regular' })

  /** 新增单日安排 */
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [overrideForm, setOverrideForm] = useState({
    date: today,
    periodId: '',
    kind: 'custom' as DayOverride['kind'],
    classId: '',
    title: '',
    room: '',
    type: 'research' as LessonType,
    swapWithDate: today,
    swapWithPeriodId: ''
  })

  const [cellDialog, setCellDialog] = useState<{
    day: Weekday
    periodId: string
    item?: ScheduleItem
    lesson?: { cancelled?: boolean; swapped?: boolean; overrideId?: string; title?: string }
  } | null>(null)

  // 从其他页面带 classId 跳转时直接打开新增对话框
  useMemo(() => {
    const state = location.state as { addLesson?: { classId?: string } } | null
    if (state?.addLesson) {
      setForm((prev) => ({ ...prev, classId: state.addLesson?.classId ?? prev.classId }))
      setAddOpen(true)
      navigate('.', { replace: true, state: null })
    }
  }, [location.state, navigate])

  const resetForm = (): void => {
    setForm({
      classId: data.classes[0]?.id ?? '',
      day: String(weekdayIndex()),
      periodId: data.periods[0]?.id ?? '',
      room: '',
      type: 'regular'
    })
  }

  const submitAdd = (): void => {
    if (!form.classId || !form.periodId) {
      toast.error('请选择班级和节次')
      return
    }
    const cls = data.classes.find((c) => c.id === form.classId)
    const conflict = data.schedule.find(
      (item) => item.day === (Number(form.day) as Weekday) && item.periodId === form.periodId
    )
    if (conflict) {
      const other = data.classes.find((c) => c.id === conflict.classId)
      toast.error(`该节次已有 ${other?.name ?? '其他班级'} 的课，可改用「单日调课」处理`)
      return
    }
    mutate((draft) => {
      draft.schedule.push({
        id: uid('sc'),
        classId: form.classId,
        day: Number(form.day) as Weekday,
        periodId: form.periodId,
        room: form.room.trim() || cls?.room || '',
        type: form.type as LessonType
      })
    })
    toast.success('已加入固定课表')
    setAddOpen(false)
    resetForm()
  }

  const submitOverride = (): void => {
    const target = overrideForm.periodId
    if (!target) {
      toast.error('请选择要调整的节次')
      return
    }
    if (overrideForm.kind === 'custom' && !overrideForm.classId && !overrideForm.title.trim()) {
      toast.error('请选择代课班级或填写事务内容')
      return
    }
    if (overrideForm.kind === 'swap' && !overrideForm.swapWithPeriodId) {
      toast.error('请选择对调的目标节次')
      return
    }
    mutate((draft) => {
      draft.overrides.push({
        id: uid('ov'),
        date: overrideForm.date,
        periodId: target,
        kind: overrideForm.kind,
        classId: overrideForm.kind === 'custom' && overrideForm.classId ? overrideForm.classId : undefined,
        title: overrideForm.kind === 'custom' && overrideForm.title.trim() ? overrideForm.title.trim() : undefined,
        room: overrideForm.room.trim() || undefined,
        type: overrideForm.kind === 'custom' ? overrideForm.type : undefined,
        swapWithDate: overrideForm.kind === 'swap' ? overrideForm.swapWithDate : undefined,
        swapWithPeriodId:
          overrideForm.kind === 'swap' && overrideForm.swapWithPeriodId ? overrideForm.swapWithPeriodId : undefined
      })
    })
    toast.success('已记录单日安排')
    setOverrideOpen(false)
  }

  const removeSchedule = (id: string): void => {
    mutate((draft) => {
      draft.schedule = draft.schedule.filter((item) => item.id !== id)
    })
    toast.success('已从固定课表移除')
    setCellDialog(null)
  }

  const removeOverride = (id: string): void => {
    mutate((draft) => {
      draft.overrides = draft.overrides.filter((item) => item.id !== id)
    })
    toast.success('已取消这条单日安排')
    setCellDialog(null)
  }

  const activeClass = (classId?: string): { name: string; color: string } | null => {
    const cls = data.classes.find((c) => c.id === classId)
    return cls ? { name: cls.name, color: cls.color } : null
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight">课表</h1>
          <p className="text-[12.5px] text-muted-foreground">固定安排选「每周都这样」，临时调课只改某一天</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setOverrideOpen(true)}>
            <CalendarDays className="size-3.5" />
            单日调课 / 停课
          </Button>
          <Button
            size="sm"
            onClick={() => {
              resetForm()
              setAddOpen(true)
            }}
          >
            <Plus className="size-3.5" />
            排课
          </Button>
        </div>
      </div>

      {/* 周课表 */}
      <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card shadow-sm">
        <div className="grid min-w-[860px]" style={{ gridTemplateColumns: '72px repeat(5, 1fr)' }}>
          {/* 表头 */}
          <div className="border-b border-border/60 px-2 py-2.5 text-center text-[11.5px] text-muted-foreground">
            节次
          </div>
          {WEEKDAY_LABELS.slice(0, 5).map((label, i) => (
            <div
              key={label}
              className={cn(
                'border-b border-l border-border/60 px-2 py-2.5 text-center text-[12.5px] font-medium',
                weekdayIndex() === i + 1 && 'bg-primary/5 text-primary'
              )}
            >
              {label}
            </div>
          ))}

          {/* 每一节 */}
          {data.periods.map((period) => {
            const active = todayLessons.get(period.id)
            const inProgress = active?.classId && active
            return (
              <div key={period.id} className="contents">
                <div className="border-b border-border/60 px-2 py-3 text-center">
                  <p className="text-[12px] font-medium">{period.label}</p>
                  <p className="text-[10.5px] text-muted-foreground">{period.start}</p>
                </div>
                {([1, 2, 3, 4, 5] as Weekday[]).map((day) => {
                  const item = data.schedule.find((s) => s.day === day && s.periodId === period.id)
                  const cls = activeClass(item?.classId)
                  const override = data.overrides.find((o) => o.date === today && o.periodId === period.id)
                  const isToday = weekdayIndex() === day
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setCellDialog({ day, periodId: period.id, item, lesson: todayLessons.get(period.id) })}
                      className={cn(
                        'group relative border-b border-l border-border/60 px-2 py-2 text-left transition-colors',
                        isToday ? 'bg-primary/[0.03]' : '',
                        item ? 'hover:brightness-95' : 'hover:bg-secondary/40'
                      )}
                    >
                      {item && cls ? (
                        <div
                          className="rounded-lg px-2.5 py-2 shadow-sm"
                          style={{ backgroundColor: cls.color, color: contrastText(cls.color) }}
                        >
                          <p className="truncate text-[12.5px] font-medium">{cls.name}</p>
                          <p className="flex items-center gap-1 truncate text-[10.5px] opacity-85">
                            {item.room && <MapPin className="size-2.5" />}
                            {item.room || LESSON_TYPE_LABELS[item.type]}
                            {item.type !== 'regular' && ` · ${LESSON_TYPE_LABELS[item.type]}`}
                          </p>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/50 group-hover:text-muted-foreground">
                          空闲
                        </span>
                      )}
                      {isToday && override && (
                        <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-amber-500" title="今天有单日安排" />
                      )}
                      {isToday && inProgress && <span className="absolute inset-0 rounded-lg ring-1 ring-primary/40" />}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* 单日安排预览（未来 7 天） */}
      {data.overrides.length > 0 && (
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-[14.5px] font-semibold">已记录的单日安排</h2>
          <ul className="space-y-2">
            {[...data.overrides]
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((override) => (
                <li
                  key={override.id}
                  className="flex items-center gap-3 rounded-xl border border-border/60 px-3.5 py-2.5 text-[12.5px]"
                >
                  <span className="font-medium">{override.date}</span>
                  <span className="text-muted-foreground">
                    {data.periods.find((p) => p.id === override.periodId)?.label}
                  </span>
                  <Badge variant="secondary">
                    {override.kind === 'cancel' ? '停课' : override.kind === 'swap' ? '对调' : '调整'}
                  </Badge>
                  <span className="truncate text-muted-foreground">
                    {override.kind === 'custom'
                      ? override.classId
                        ? data.classes.find((c) => c.id === override.classId)?.name
                        : override.title
                      : override.kind === 'swap'
                        ? `与 ${override.swapWithDate} ${data.periods.find((p) => p.id === (override.swapWithPeriodId ?? override.periodId))?.label} 对调`
                        : '当天该节停课'}
                  </span>
                  <button
                    type="button"
                    className="ml-auto text-muted-foreground hover:text-rose-500"
                    onClick={() => removeOverride(override.id)}
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* 新增固定课表 */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>排入固定课表</DialogTitle>
            <DialogDescription>「每周都这样」的固定安排；临时调整请用单日调课</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>班级</Label>
              <Select value={form.classId} onValueChange={(value) => setForm((prev) => ({ ...prev, classId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="选择班级" />
                </SelectTrigger>
                <SelectContent>
                  {data.classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>星期</Label>
              <Select value={form.day} onValueChange={(value) => setForm((prev) => ({ ...prev, day: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAY_SHORT.slice(0, 5).map((label, i) => (
                    <SelectItem key={label} value={String(i + 1)}>
                      周{label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>节次</Label>
              <Select value={form.periodId} onValueChange={(value) => setForm((prev) => ({ ...prev, periodId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="选择节次" />
                </SelectTrigger>
                <SelectContent>
                  {data.periods.map((period) => (
                    <SelectItem key={period.id} value={period.id}>
                      {period.label}（{period.start}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>类型</Label>
              <Select value={form.type} onValueChange={(value) => setForm((prev) => ({ ...prev, type: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LESSON_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="lesson-room">教室 / 地点</Label>
              <Input
                id="lesson-room"
                placeholder="如：博学楼203"
                value={form.room}
                onChange={(event) => setForm((prev) => ({ ...prev, room: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>
              取消
            </Button>
            <Button size="sm" onClick={submitAdd}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 单日调课 */}
      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>单日安排</DialogTitle>
            <DialogDescription>调课、对调或停课只改当天那一次，不影响固定课表</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>日期</Label>
              <Input
                type="date"
                value={overrideForm.date}
                onChange={(event) => setOverrideForm((prev) => ({ ...prev, date: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>要调整的节次</Label>
              <Select
                value={overrideForm.periodId}
                onValueChange={(value) => setOverrideForm((prev) => ({ ...prev, periodId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择节次" />
                </SelectTrigger>
                <SelectContent>
                  {data.periods.map((period) => (
                    <SelectItem key={period.id} value={period.id}>
                      {period.label}（{period.start}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>调整方式</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { kind: 'custom', label: '改为…' },
                    { kind: 'swap', label: '与另一节对调' },
                    { kind: 'cancel', label: '停课' }
                  ] as const
                ).map((option) => (
                  <button
                    key={option.kind}
                    type="button"
                    onClick={() => setOverrideForm((prev) => ({ ...prev, kind: option.kind }))}
                    className={cn(
                      'rounded-lg border px-2 py-2 text-[12px] transition-colors',
                      overrideForm.kind === option.kind
                        ? 'border-primary/50 bg-primary/10 font-medium text-primary'
                        : 'border-border text-muted-foreground hover:bg-secondary/50'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {overrideForm.kind === 'custom' && (
              <>
                <div className="space-y-1.5">
                  <Label>代课班级（可选）</Label>
                  <Select
                    value={overrideForm.classId}
                    onValueChange={(value) => setOverrideForm((prev) => ({ ...prev, classId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="无" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">无</SelectItem>
                      {data.classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>事务类型</Label>
                  <Select
                    value={overrideForm.type}
                    onValueChange={(value) => setOverrideForm((prev) => ({ ...prev, type: value as LessonType }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(LESSON_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>内容说明</Label>
                  <Input
                    placeholder="如：教研活动 / 代王老师上课"
                    value={overrideForm.title}
                    onChange={(event) => setOverrideForm((prev) => ({ ...prev, title: event.target.value }))}
                  />
                </div>
              </>
            )}

            {overrideForm.kind === 'swap' && (
              <>
                <div className="space-y-1.5">
                  <Label>对调到哪一天</Label>
                  <Input
                    type="date"
                    value={overrideForm.swapWithDate}
                    onChange={(event) => setOverrideForm((prev) => ({ ...prev, swapWithDate: event.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>对调哪一节</Label>
                  <Select
                    value={overrideForm.swapWithPeriodId}
                    onValueChange={(value) => setOverrideForm((prev) => ({ ...prev, swapWithPeriodId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择节次" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.periods.map((period) => (
                        <SelectItem key={period.id} value={period.id}>
                          {period.label}（{period.start}）
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOverrideOpen(false)}>
              取消
            </Button>
            <Button size="sm" onClick={submitOverride}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 单元格详情 */}
      <Dialog open={cellDialog !== null} onOpenChange={(open) => !open && setCellDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {cellDialog && `周${WEEKDAY_SHORT[cellDialog.day - 1]} · ${data.periods.find((p) => p.id === cellDialog.periodId)?.label}`}
            </DialogTitle>
          </DialogHeader>
          {cellDialog?.item && (
            <div className="space-y-1.5 text-[13px]">
              <p>
                班级：{activeClass(cellDialog.item.classId)?.name ?? '—'}
              </p>
              <p className="text-muted-foreground">
                类型：{LESSON_TYPE_LABELS[cellDialog.item.type]} · 教室：{cellDialog.item.room || '未填写'}
              </p>
            </div>
          )}
          {cellDialog?.lesson?.cancelled && (
            <p className="text-[13px] text-amber-600 dark:text-amber-400">今天这节已停课</p>
          )}
          {cellDialog?.lesson?.swapped && (
            <p className="text-[13px] text-amber-600 dark:text-amber-400">今天这节来自调课</p>
          )}
          <DialogFooter>
            {cellDialog?.lesson?.overrideId && (
              <Button variant="outline" size="sm" onClick={() => removeOverride(cellDialog.lesson!.overrideId!)}>
                取消这条单日安排
              </Button>
            )}
            {cellDialog?.item && !cellDialog.lesson?.overrideId && (
              <Button variant="destructive" size="sm" onClick={() => removeSchedule(cellDialog.item!.id)}>
                从固定课表移除
              </Button>
            )}
            {!cellDialog?.item && (
              <Button
                size="sm"
                onClick={() => {
                  resetForm()
                  setForm((prev) => ({
                    ...prev,
                    day: String(cellDialog?.day ?? 1),
                    periodId: cellDialog?.periodId ?? ''
                  }))
                  setCellDialog(null)
                  setAddOpen(true)
                }}
              >
                排入固定课表
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
