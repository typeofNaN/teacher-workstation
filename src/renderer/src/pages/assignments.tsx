import { useMemo, useState } from 'react'
import { Copy, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useData, useAppStore } from '@/store/app-store'
import { toDateKey, cn, uid, contrastText } from '@/lib/utils'
import { SUBMISSION_LABELS } from '@shared/types'
import type { SubmissionState } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/confirm-dialog'

const STATE_CYCLE: Array<SubmissionState | undefined> = [undefined, 'submitted', 'excellent', 'correct', 'missing']

/** 作业页：一份作业布置给多个班，分班登记 已交/优秀/需订正/未交 */
export default function AssignmentsPage(): JSX.Element {
  const data = useData()
  const mutate = useAppStore((state) => state.mutate)
  const today = toDateKey()

  const [activeId, setActiveId] = useState(data.assignments[0]?.id ?? '')
  const [activeClassId, setActiveClassId] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [form, setForm] = useState({
    title: '',
    subject: data.teacher.subject || '数学',
    dueAt: toDateKey(new Date(Date.now() + 3 * 86400000)),
    classIds: [] as string[]
  })
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const assignment = data.assignments.find((a) => a.id === activeId) ?? data.assignments[0]
  const classId = assignment?.classIds.includes(activeClassId) ? activeClassId : assignment?.classIds[0] ?? ''

  const stats = useMemo(() => {
    if (!assignment || !classId) return null
    const cls = data.classes.find((c) => c.id === classId)
    const records = assignment.records[classId] ?? {}
    const counts = { submitted: 0, excellent: 0, correct: 0, missing: 0, unregistered: 0 }
    for (const student of cls?.students ?? []) {
      const state = records[student.id]
      if (!state) counts.unregistered += 1
      else counts[state] += 1
    }
    return { cls, records, counts }
  }, [assignment, classId, data.classes])

  const openNew = (): void => {
    setForm({
      title: '',
      subject: data.teacher.subject || '数学',
      dueAt: toDateKey(new Date(Date.now() + 3 * 86400000)),
      classIds: data.classes.length === 1 ? [data.classes[0].id] : []
    })
    setNewOpen(true)
  }

  const submitNew = (): void => {
    if (!form.title.trim()) {
      toast.error('请填写作业标题')
      return
    }
    if (form.classIds.length === 0) {
      toast.error('至少选择一个班级')
      return
    }
    mutate((draft) => {
      draft.assignments.unshift({
        id: uid('asg'),
        title: form.title.trim(),
        subject: form.subject,
        assignedAt: today,
        dueAt: form.dueAt,
        classIds: [...form.classIds],
        records: {}
      })
    })
    toast.success('作业已布置')
    setNewOpen(false)
  }

  const cycleState = (studentId: string): void => {
    if (!assignment || !classId) return
    mutate((draft) => {
      const target = draft.assignments.find((a) => a.id === assignment.id)
      if (!target) return
      const records = target.records[classId] ?? (target.records[classId] = {})
      const current = records[studentId]
      const next = STATE_CYCLE[(STATE_CYCLE.indexOf(current) + 1) % STATE_CYCLE.length]
      if (next) records[studentId] = next
      else delete records[studentId]
    })
  }

  const batchSet = (state: SubmissionState | undefined): void => {
    if (!assignment || !classId) return
    mutate((draft) => {
      const target = draft.assignments.find((a) => a.id === assignment.id)
      if (!target) return
      const records = target.records[classId] ?? (target.records[classId] = {})
      const cls = draft.classes.find((c) => c.id === classId)
      for (const student of cls?.students ?? []) {
        if (state) records[student.id] = state
        else delete records[student.id]
      }
    })
    toast.success(state ? `已全部标记为「${SUBMISSION_LABELS[state]}」` : '已清空登记')
  }

  const restSubmitted = (): void => {
    if (!assignment || !classId || !stats) return
    mutate((draft) => {
      const target = draft.assignments.find((a) => a.id === assignment.id)
      if (!target) return
      const records = target.records[classId] ?? (target.records[classId] = {})
      for (const student of stats.cls?.students ?? []) {
        if (!records[student.id]) records[student.id] = 'submitted'
      }
    })
    toast.success('其余都已登记为已交')
  }

  const copyMissing = async (): Promise<void> => {
    if (!assignment || !classId || !stats) return
    const missing = (stats.cls?.students ?? []).filter((student) => stats.records[student.id] === 'missing')
    const unregistered = (stats.cls?.students ?? []).filter((student) => !stats.records[student.id])
    const lines = [
      `【${assignment.title}】${stats.cls?.name ?? ''} 未交名单（${missing.length} 人）：`,
      ...missing.map((student) => student.name),
      unregistered.length > 0 ? `\n未登记（${unregistered.length} 人）：${unregistered.map((s) => s.name).join('、')}` : ''
    ].filter(Boolean)
    await navigator.clipboard.writeText(lines.join('\n'))
    toast.success('未交名单已复制，可直接发给课代表')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight">作业</h1>
          <p className="text-[12.5px] text-muted-foreground">一份作业可以同时布置给几个班，分班登记</p>
        </div>
        <Button size="sm" className="ml-auto" onClick={openNew}>
          <Plus className="size-3.5" />
          布置作业
        </Button>
      </div>

      {data.assignments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
          <p className="text-[13.5px] font-medium">还没有布置作业</p>
          <Button size="sm" className="mt-4" onClick={openNew}>
            <Plus className="size-3.5" />
            布置第一份作业
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          {/* 作业列表 */}
          <div className="space-y-2">
            {data.assignments.map((item) => {
              const overdue = item.dueAt < today
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveId(item.id)
                    setActiveClassId('')
                  }}
                  className={cn(
                    'w-full rounded-xl border px-4 py-3 text-left transition-colors',
                    assignment?.id === item.id
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border/70 bg-card hover:border-border'
                  )}
                >
                  <p className="truncate text-[13.5px] font-medium">{item.title}</p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {item.classIds.map((id) => data.classes.find((c) => c.id === id)?.name).filter(Boolean).join('、')}
                  </p>
                  <p className={cn('mt-1 text-[11.5px]', overdue ? 'text-rose-500' : 'text-muted-foreground')}>
                    {item.assignedAt} 布置 · {item.dueAt} 交{overdue ? ' · 已截止' : ''}
                  </p>
                </button>
              )
            })}
          </div>

          {/* 登记面板 */}
          {assignment && stats?.cls && (
            <Card>
              <CardContent className="p-5">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  {assignment.classIds.map((id) => {
                    const cls = data.classes.find((c) => c.id === id)
                    if (!cls) return null
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setActiveClassId(id)}
                        className={cn(
                          'rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors',
                          id === classId ? 'shadow-sm' : 'border border-border text-muted-foreground hover:bg-secondary'
                        )}
                        style={id === classId ? { backgroundColor: cls.color, color: contrastText(cls.color) } : undefined}
                      >
                        {cls.name}
                      </button>
                    )
                  })}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto text-rose-500 hover:text-rose-600"
                    onClick={() => setDeleteId(assignment.id)}
                  >
                    <Trash2 className="size-3.5" />
                    删除
                  </Button>
                </div>

                {/* 统计 */}
                <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px]">
                  <Badge>共 {stats.cls.students.length} 人</Badge>
                  <Badge variant="info">已交 {stats.counts.submitted + stats.counts.excellent}</Badge>
                  <Badge variant="success">优秀 {stats.counts.excellent}</Badge>
                  <Badge variant="warning">需订正 {stats.counts.correct}</Badge>
                  <Badge variant="danger">未交 {stats.counts.missing}</Badge>
                  {stats.counts.unregistered > 0 && (
                    <Badge variant="secondary">未登记 {stats.counts.unregistered}</Badge>
                  )}
                  <span className="ml-auto text-[11.5px] text-muted-foreground">未登记不等于未交，检查完再看统计</span>
                </div>

                {/* 学生网格 */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {stats.cls.students.map((student) => {
                    const state = stats.records[student.id]
                    return (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => cycleState(student.id)}
                        className={cn(
                          'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors',
                          state
                            ? state === 'excellent'
                              ? 'border-emerald-500/40 bg-emerald-500/10'
                              : state === 'submitted'
                                ? 'border-sky-500/40 bg-sky-500/10'
                                : state === 'correct'
                                  ? 'border-amber-500/40 bg-amber-500/10'
                                  : 'border-rose-500/40 bg-rose-500/10'
                            : 'border-border/70 hover:border-border'
                        )}
                      >
                        <span className="truncate text-[13px] font-medium">{student.name}</span>
                        <span
                          className={cn(
                            'ml-auto shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px]',
                            state
                              ? state === 'excellent'
                                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                : state === 'submitted'
                                  ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300'
                                  : state === 'correct'
                                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                    : 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                              : 'text-muted-foreground/60'
                          )}
                        >
                          {state ? SUBMISSION_LABELS[state] : '未登记'}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* 批量操作 */}
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
                  <span className="text-[12px] text-muted-foreground">批量：</span>
                  <Button size="sm" variant="outline" onClick={() => batchSet('submitted')}>
                    全部已交
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => batchSet('excellent')}>
                    全部优秀
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => batchSet('missing')}>
                    全部未交
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => batchSet(undefined)}>
                    全部清空
                  </Button>
                  <Button size="sm" variant="secondary" onClick={restSubmitted}>
                    其余都已交
                  </Button>
                  <Button size="sm" variant="outline" className="ml-auto" onClick={() => void copyMissing()}>
                    <Copy className="size-3.5" />
                    复制未交名单
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* 布置作业 */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>布置作业</DialogTitle>
            <DialogDescription>可同时布置给多个班，登记时按班分开</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="asg-title">作业标题</Label>
              <Input
                id="asg-title"
                placeholder="如：课本习题 14.3"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asg-due">截止日期</Label>
              <Input
                id="asg-due"
                type="date"
                value={form.dueAt}
                onChange={(event) => setForm((prev) => ({ ...prev, dueAt: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>布置给哪些班</Label>
              <div className="flex flex-wrap gap-1.5">
                {data.classes.map((cls) => {
                  const active = form.classIds.includes(cls.id)
                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          classIds: active
                            ? prev.classIds.filter((id) => id !== cls.id)
                            : [...prev.classIds, cls.id]
                        }))
                      }
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-[12.5px] transition-colors',
                        active
                          ? 'border-primary/50 bg-primary/10 font-medium text-primary'
                          : 'border-border text-muted-foreground hover:bg-secondary/50'
                      )}
                    >
                      {cls.name}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setNewOpen(false)}>
              取消
            </Button>
            <Button size="sm" onClick={submitNew}>
              布置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        title="删除作业"
        description="删除后各班的登记记录也会一并清除，确定删除吗？"
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => {
          mutate((draft) => {
            draft.assignments = draft.assignments.filter((item) => item.id !== deleteId)
          })
          setDeleteId(null)
          toast.success('作业已删除')
        }}
      />
    </div>
  )
}
