import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { toast } from 'sonner'
import { ClipboardPaste, Plus, Trash2 } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis
} from 'recharts'
import { useData, useAppStore } from '@/store/app-store'
import { classStats, examTrend, examTotal, scoreBuckets, sectionRates } from '@/lib/analytics'
import { cn, uid, contrastText } from '@/lib/utils'
import type { ExamSection } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/confirm-dialog'

interface ExamFormState {
  name: string
  date: string
  classIds: string[]
  mode: 'total' | 'sections'
  sections: ExamSection[]
}

/** 成绩页：多班同场考试，支持总分制 / 按大题录分 + 分析 */
export default function GradesPage(): JSX.Element {
  const data = useData()
  const mutate = useAppStore((state) => state.mutate)

  const [tab, setTab] = useState<'entry' | 'analysis'>('entry')
  const [activeId, setActiveId] = useState(data.exams[0]?.id ?? '')
  const [activeClassId, setActiveClassId] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState<ExamFormState>({
    name: '',
    date: new Date().toISOString().slice(0, 10),
    classIds: [] as string[],
    mode: 'total',
    sections: [
      { name: '选择题', fullScore: 30 },
      { name: '填空题', fullScore: 30 },
      { name: '解答题', fullScore: 40 }
    ]
  })

  const exam = data.exams.find((e) => e.id === activeId) ?? data.exams[0]
  const classId = exam?.classIds.includes(activeClassId) ? activeClassId : exam?.classIds[0] ?? ''
  const fullScore = exam ? exam.sections.reduce((sum, s) => sum + s.fullScore, 0) : 100
  const cls = data.classes.find((c) => c.id === classId)

  const ranked = useMemo(() => {
    if (!exam || !cls) return []
    return cls.students
      .map((student) => ({ student, total: examTotal(exam, exam.scores[cls.id]?.[student.id]) }))
      .sort((a, b) => (b.total ?? -1) - (a.total ?? -1))
  }, [exam, cls])

  const openNew = (): void => {
    setForm({
      name: '',
      date: new Date().toISOString().slice(0, 10),
      classIds: data.classes.length === 1 ? [data.classes[0].id] : [],
      mode: 'total',
      sections: [
        { name: '选择题', fullScore: 30 },
        { name: '填空题', fullScore: 30 },
        { name: '解答题', fullScore: 40 }
      ]
    })
    setNewOpen(true)
  }

  const submitNew = (): void => {
    if (!form.name.trim()) {
      toast.error('请填写考试名称')
      return
    }
    if (form.classIds.length === 0) {
      toast.error('至少选择一个班级')
      return
    }
    const sections = form.mode === 'total' ? [{ name: '总分', fullScore: 100 }] : form.sections
    if (sections.some((section) => !section.name.trim() || section.fullScore <= 0)) {
      toast.error('请完整填写各大题名称与满分')
      return
    }
    mutate((draft) => {
      draft.exams.unshift({
        id: uid('exam'),
        name: form.name.trim(),
        subject: draft.teacher.subject || '数学',
        date: form.date,
        classIds: [...form.classIds],
        sections,
        scores: {}
      })
    })
    toast.success('考试已创建，可以开始录分')
    setNewOpen(false)
  }

  const setScore = (studentId: string, sectionIndex: number, raw: string): void => {
    if (!exam || !classId) return
    const value = raw.trim() === '' ? null : Math.max(0, Number(raw) || 0)
    mutate((draft) => {
      const target = draft.exams.find((e) => e.id === exam.id)
      if (!target) return
      const records = target.scores[classId] ?? (target.scores[classId] = {})
      const current = records[studentId]
      if (value === null) {
        delete records[studentId]
        return
      }
      const base = Array.isArray(current) ? [...current] : target.sections.map(() => 0)
      base[sectionIndex] = value
      records[studentId] = base
    })
  }

  const pasteScores = async (): Promise<void> => {
    if (!exam || !cls) return
    try {
      const text = await navigator.clipboard.readText()
      const rows = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
      let applied = 0
      for (const row of rows) {
        const cells = row.split(/\t|,|，/).map((cell) => cell.trim())
        if (cells.length < 2) continue
        // 第一列可能是表头
        if (Number.isNaN(Number(cells[cells.length - 1]))) continue
        const nameOrNo = cells[0]
        const student = cls.students.find(
          (s) => s.name === nameOrNo || s.no === nameOrNo
        )
        if (!student) continue
        const values = cells.slice(1, 1 + exam.sections.length).map((cell) => Number(cell) || 0)
        if (values.length === 0) continue
        mutate((draft) => {
          const target = draft.exams.find((e) => e.id === exam.id)
          if (!target) return
          const records = target.scores[cls.id] ?? (target.scores[cls.id] = {})
          records[student.id] = values
        })
        applied += 1
      }
      toast.success(applied > 0 ? `已从剪贴板导入 ${applied} 条成绩` : '没有匹配到学生，请核对姓名 / 学号')
    } catch {
      toast.error('读取剪贴板失败')
    }
  }

  const distribution = useMemo(() => {
    if (!exam || !classId) return []
    const totals = Object.values(exam.scores[classId] ?? {})
      .map((scores) => examTotal(exam, scores))
      .filter((total): total is number => total !== null)
    return scoreBuckets(totals, fullScore, fullScore > 120 ? 20 : 10)
  }, [exam, classId, fullScore])

  const trend = useMemo(
    () => examTrend(data.exams.filter((e) => e.classIds.includes(classId)), [classId]),
    [data.exams, classId]
  )

  if (data.exams.length === 0) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-[17px] font-semibold tracking-tight">成绩</h1>
            <p className="text-[12.5px] text-muted-foreground">考完试录分，几个平行班放进同一场考试便于对照</p>
          </div>
          <Button size="sm" className="ml-auto" onClick={openNew}>
            <Plus className="size-3.5" />
            新建考试
          </Button>
        </div>
        <div className="rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
          <p className="text-[13.5px] font-medium">还没有考试</p>
          <Button size="sm" className="mt-4" onClick={openNew}>
            <Plus className="size-3.5" />
            新建第一次考试
          </Button>
        </div>

        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <ExamFormDialog
            form={form}
            setForm={setForm}
            classes={data.classes}
            onSubmit={submitNew}
            onCancel={() => setNewOpen(false)}
          />
        </Dialog>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight">成绩</h1>
          <p className="text-[12.5px] text-muted-foreground">从表格粘贴成绩时，先核对姓名、学号和顺序</p>
        </div>
        <Button size="sm" className="ml-auto" onClick={openNew}>
          <Plus className="size-3.5" />
          新建考试
        </Button>
      </div>

      {/* 考试列表 */}
      <div className="flex flex-wrap gap-2">
        {data.exams.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setActiveId(item.id)
              setActiveClassId('')
              setTab('entry')
            }}
            className={cn(
              'rounded-xl border px-4 py-2 text-left transition-colors',
              exam?.id === item.id ? 'border-primary/40 bg-primary/5' : 'border-border/70 bg-card hover:border-border'
            )}
          >
            <p className="text-[13px] font-medium">{item.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {item.date} · {item.sections.length > 1 ? '按大题' : '总分制'}
            </p>
          </button>
        ))}
      </div>

      {exam && (
        <Tabs value={tab} onValueChange={(value) => setTab(value as 'entry' | 'analysis')}>
          <TabsList>
            <TabsTrigger value="entry">成绩录入</TabsTrigger>
            <TabsTrigger value="analysis">成绩分析</TabsTrigger>
          </TabsList>

          {/* 录入 */}
          <TabsContent value="entry" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {exam.classIds.map((id) => {
                const item = data.classes.find((c) => c.id === id)
                if (!item) return null
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveClassId(id)}
                    className={cn(
                      'rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors',
                      id === classId ? 'shadow-sm' : 'border border-border text-muted-foreground hover:bg-secondary'
                    )}
                    style={id === classId ? { backgroundColor: item.color, color: contrastText(item.color) } : undefined}
                  >
                    {item.name}
                  </button>
                )
              })}
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => void pasteScores()}>
                <ClipboardPaste className="size-3.5" />
                从表格粘贴
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-rose-500 hover:text-rose-600"
                onClick={() => setDeleteId(exam.id)}
              >
                <Trash2 className="size-3.5" />
                删除考试
              </Button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border/60 text-left text-[12px] text-muted-foreground">
                    <th className="px-5 py-3 font-medium">姓名</th>
                    <th className="w-24 px-3 py-3 font-medium">学号</th>
                    {exam.sections.map((section) => (
                      <th key={section.name} className="w-28 px-3 py-3 text-right font-medium">
                        {section.name}
                        <span className="ml-1 text-[10.5px] opacity-70">/{section.fullScore}</span>
                      </th>
                    ))}
                    <th className="w-24 px-3 py-3 text-right font-medium">总分</th>
                  </tr>
                </thead>
                <tbody>
                  {(cls?.students ?? []).map((student) => {
                    const scores = exam.scores[cls!.id]?.[student.id]
                    const total = examTotal(exam, scores)
                    return (
                      <tr key={student.id} className="border-b border-border/40 last:border-0">
                        <td className="px-5 py-2 font-medium">{student.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{student.no}</td>
                        {exam.sections.map((section, sectionIndex) => (
                          <td key={section.name} className="px-3 py-1.5 text-right">
                            <Input
                              type="number"
                              min={0}
                              max={section.fullScore}
                              className="ml-auto h-8 w-20 text-right"
                              value={Array.isArray(scores) ? (scores[sectionIndex] ?? '') : ''}
                              onChange={(event) => setScore(student.id, sectionIndex, event.target.value)}
                            />
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right font-semibold">{total ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11.5px] text-muted-foreground">
              录入即保存 · 留空表示缺考 · 粘贴格式：姓名(或学号)、各大题得分，用 Tab / 逗号分隔
            </p>
          </TabsContent>

          {/* 分析 */}
          <TabsContent value="analysis" className="mt-4 space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              {/* 各班对照 */}
              <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm lg:col-span-2">
                <h3 className="mb-3 text-[14px] font-semibold">平行班对照</h3>
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-[12px] text-muted-foreground">
                      <th className="py-2 font-medium">班级</th>
                      <th className="py-2 text-right font-medium">平均分</th>
                      <th className="py-2 text-right font-medium">中位数</th>
                      <th className="py-2 text-right font-medium">最高</th>
                      <th className="py-2 text-right font-medium">及格率</th>
                      <th className="py-2 text-right font-medium">优秀率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exam.classIds.map((id) => {
                      const stats = classStats(exam, id, fullScore)
                      const item = data.classes.find((c) => c.id === id)
                      return (
                        <tr key={id} className="border-b border-border/40 last:border-0">
                          <td className="flex items-center gap-1.5 py-2.5">
                            <span className="size-2 rounded-full" style={{ backgroundColor: item?.color }} />
                            {item?.name ?? id}
                          </td>
                          <td className="py-2.5 text-right font-semibold">{stats.average}</td>
                          <td className="py-2.5 text-right">{stats.median}</td>
                          <td className="py-2.5 text-right">{stats.max}</td>
                          <td className="py-2.5 text-right">{(stats.passRate * 100).toFixed(0)}%</td>
                          <td className="py-2.5 text-right">{(stats.excellentRate * 100).toFixed(0)}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* 分数段 */}
              <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
                <h3 className="mb-3 text-[14px] font-semibold">
                  分数段
                  <span className="ml-2 text-[11.5px] font-normal text-muted-foreground">
                    {data.classes.find((c) => c.id === classId)?.name}
                  </span>
                </h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distribution}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.15)" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-35} textAnchor="end" height={46} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={24} />
                      <ChartTooltip formatter={(value) => [`${value} 人`, '人数']} />
                      <Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* 历次趋势 */}
              <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
                <h3 className="mb-3 text-[14px] font-semibold">历次趋势（平均分）</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.15)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} domain={[0, fullScore]} width={28} />
                      <ChartTooltip />
                      <Line
                        type="monotone"
                        dataKey={`values.${classId}`}
                        name="平均分"
                        stroke={cls?.color ?? '#6366f1'}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 分项得分率 */}
              <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
                <h3 className="mb-1 text-[14px] font-semibold">分项得分率</h3>
                <p className="mb-3 text-[11.5px] text-muted-foreground">每项平均分 ÷ 该项满分；红线为及格线 60%</p>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sectionRates(exam, classId).map((s) => ({ name: s.name, rate: Math.round(s.rate * 100) }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.15)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} unit="%" width={40} />
                      <ChartTooltip formatter={(value) => [`${value}%`, '得分率']} />
                      <ReferenceLine y={60} stroke="#f43f5e" strokeDasharray="4 4" />
                      <Bar dataKey="rate" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* 班级排名 */}
            {cls && (
              <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <h3 className="text-[14px] font-semibold">排名</h3>
                  <Badge variant="secondary">{cls.name}</Badge>
                  <span className="text-[11.5px] text-muted-foreground">个人成绩仅供教师查看，投屏展示时注意选择场合</span>
                </div>
                <div className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
                  {ranked.map(({ student, total }, index) => {
                    const prev = ranked[index - 1]
                    const diff = prev?.total !== undefined && prev.total !== null && total !== null ? prev.total - total : null
                    return (
                      <div
                        key={student.id}
                        className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-[13px] odd:bg-secondary/30"
                      >
                        <span className="w-6 text-right text-[12px] text-muted-foreground">{index + 1}</span>
                        <span className="font-medium">{student.name}</span>
                        <span className="ml-auto font-semibold">{total ?? '缺考'}</span>
                        {diff !== null && diff > 0 && (
                          <span className="w-14 text-right text-[11.5px] text-muted-foreground">
                            距上一名 {diff} 分
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* 新建考试 */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <ExamFormDialog
          form={form}
          setForm={setForm}
          classes={data.classes}
          onSubmit={submitNew}
          onCancel={() => setNewOpen(false)}
        />
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        title="删除考试"
        description="删除后已录入的成绩无法恢复，确定删除吗？"
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => {
          mutate((draft) => {
            draft.exams = draft.exams.filter((item) => item.id !== deleteId)
          })
          setDeleteId(null)
          toast.success('考试已删除')
        }}
      />
    </div>
  )
}

/* ---------------- 新建考试表单 ---------------- */

interface ExamFormProps {
  form: ExamFormState
  setForm: Dispatch<SetStateAction<ExamFormState>>
  classes: Array<{ id: string; name: string; color: string }>
  onSubmit: () => void
  onCancel: () => void
}

function ExamFormDialog({ form, setForm, classes, onSubmit, onCancel }: ExamFormProps): JSX.Element {
  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>新建考试</DialogTitle>
        <DialogDescription>把几个平行班放进同一场考试，就能对照平均分与分数段</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="exam-name">考试名称</Label>
            <Input
              id="exam-name"
              placeholder="如：期中考试"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exam-date">考试日期</Label>
            <Input
              id="exam-date"
              type="date"
              value={form.date}
              onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>参与班级</Label>
          <div className="flex flex-wrap gap-1.5">
            {classes.map((cls) => {
              const active = form.classIds.includes(cls.id)
              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      classIds: active ? prev.classIds.filter((id) => id !== cls.id) : [...prev.classIds, cls.id]
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

        <div className="space-y-1.5">
          <Label>录分方式</Label>
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                { mode: 'total', label: '只填总分' },
                { mode: 'sections', label: '按大题录分' }
              ] as const
            ).map((option) => (
              <button
                key={option.mode}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, mode: option.mode }))}
                className={cn(
                  'rounded-lg border px-3 py-2 text-[12.5px] transition-colors',
                  form.mode === option.mode
                    ? 'border-primary/50 bg-primary/10 font-medium text-primary'
                    : 'border-border text-muted-foreground hover:bg-secondary/50'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {form.mode === 'sections' && (
          <div className="space-y-2">
            {form.sections.map((section, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  className="flex-1"
                  value={section.name}
                  placeholder="大题名称"
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      sections: prev.sections.map((s, i) => (i === index ? { ...s, name: event.target.value } : s))
                    }))
                  }
                />
                <Input
                  className="w-24 text-right"
                  type="number"
                  min={1}
                  value={section.fullScore}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      sections: prev.sections.map((s, i) =>
                        i === index ? { ...s, fullScore: Number(event.target.value) || 0 } : s
                      )
                    }))
                  }
                />
                <button
                  type="button"
                  className="text-muted-foreground hover:text-rose-500"
                  onClick={() => setForm((prev) => ({ ...prev, sections: prev.sections.filter((_, i) => i !== index) }))}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setForm((prev) => ({ ...prev, sections: [...prev.sections, { name: '', fullScore: 20 }] }))
              }
            >
              <Plus className="size-3.5" />
              添加大题
            </Button>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onCancel}>
          取消
        </Button>
        <Button size="sm" onClick={onSubmit}>
          创建
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
