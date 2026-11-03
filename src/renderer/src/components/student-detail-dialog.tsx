import { useMemo } from 'react'
import { BarChart3, ClipboardList, ThumbsUp } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { useData } from '@/store/app-store'
import { cn } from '@/lib/utils'
import { FEEDBACK_LABELS, SUBMISSION_LABELS } from '@shared/types'
import type { SubmissionState } from '@shared/types'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const GENDER_LABELS: Record<string, string> = { male: '男', female: '女', unknown: '未填写' }

const STATE_BADGE: Record<SubmissionState, 'success' | 'warning' | 'info' | 'danger'> = {
  submitted: 'info',
  excellent: 'success',
  correct: 'warning',
  missing: 'danger'
}

interface StudentDetailDialogProps {
  classId: string
  studentId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * 学生详情：某个学生的历次考试、作业提交情况与课堂反馈记录。
 * 从学生名单页、课堂页的点评/搜索入口都可以打开。
 */
export function StudentDetailDialog({ classId, studentId, open, onOpenChange }: StudentDetailDialogProps): JSX.Element {
  const data = useData()

  const cls = data.classes.find((c) => c.id === classId)
  const student = cls?.students.find((s) => s.id === studentId)

  /** 历次考试：总分、班级排名、与均分差 */
  const examRows = useMemo(() => {
    if (!cls || !student) return []
    return data.exams
      .filter((exam) => exam.classIds.includes(cls.id))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((exam) => {
        const fullScore = exam.sections.reduce((sum, s) => sum + s.fullScore, 0)
        const records = exam.scores[cls.id] ?? {}
        const ownScores = records[student.id]
        const ownTotal =
          Array.isArray(ownScores) && exam.sections.length > 0
            ? ownScores.reduce(
                (sum, value, i) => sum + (typeof value === 'number' ? Math.min(value, exam.sections[i]?.fullScore ?? 0) : 0),
                0
              )
            : null
        const totals = Object.values(records)
          .map((scores) =>
            Array.isArray(scores) && exam.sections.length > 0
              ? scores.reduce(
                  (sum, value, i) => sum + (typeof value === 'number' ? Math.min(value, exam.sections[i]?.fullScore ?? 0) : 0),
                  0
                )
              : null
          )
          .filter((total): total is number => total !== null)
        const ranked = [...totals].sort((a, b) => b - a)
        const rank = ownTotal !== null ? ranked.indexOf(ownTotal) + 1 : null
        const average = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0
        return {
          exam,
          ownScores: Array.isArray(ownScores) ? ownScores : null,
          ownTotal,
          absent: ownScores === null,
          rank,
          classSize: ranked.length,
          average: Math.round(average * 10) / 10,
          diff: ownTotal !== null && totals.length ? Math.round((ownTotal - average) * 10) / 10 : null,
          fullScore
        }
      })
  }, [data.exams, cls, student])

  /** 考试趋势（按时间正序） */
  const trendData = useMemo(
    () =>
      [...examRows]
        .reverse()
        .filter((row) => row.ownTotal !== null)
        .map((row) => ({ name: row.exam.name.slice(0, 6), total: row.ownTotal as number, average: row.average })),
    [examRows]
  )

  /** 作业提交情况 */
  const homeworkRows = useMemo(() => {
    if (!cls || !student) return []
    return data.assignments
      .filter((a) => a.classIds.includes(cls.id))
      .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt))
      .map((assignment) => ({ assignment, state: assignment.records[cls.id]?.[student.id] }))
  }, [data.assignments, cls, student])

  const homeworkSummary = useMemo(() => {
    const counts = { submitted: 0, excellent: 0, correct: 0, missing: 0, unregistered: 0 }
    for (const row of homeworkRows) {
      if (row.state) counts[row.state] += 1
      else counts.unregistered += 1
    }
    return counts
  }, [homeworkRows])

  /** 课堂反馈记录 */
  const feedbackRows = useMemo(() => {
    if (!cls || !student) return []
    return data.feedback
      .filter((item) => item.classId === cls.id && item.studentId === student.id)
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [data.feedback, cls, student])

  const feedbackSummary = useMemo(() => {
    const counts = { praise: 0, warn: 0, star: 0 }
    for (const item of feedbackRows) counts[item.kind] += 1
    return counts
  }, [feedbackRows])

  if (!student || !cls) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>学生详情</DialogTitle>
          </DialogHeader>
          <p className="py-8 text-center text-[13px] text-muted-foreground">没有找到该学生</p>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {student.name}
            <span className="text-[12.5px] font-normal text-muted-foreground">
              {cls.name} · 学号 {student.no} · {GENDER_LABELS[student.gender]}
            </span>
            {student.note && (
              <Badge variant="secondary" className="max-w-[200px] truncate">
                {student.note}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="exams" className="flex min-h-0 flex-1 flex-col gap-3">
          <TabsList>
            <TabsTrigger value="exams" className="gap-1.5">
              <BarChart3 className="size-3.5" />
              历次考试（{examRows.length}）
            </TabsTrigger>
            <TabsTrigger value="homework" className="gap-1.5">
              <ClipboardList className="size-3.5" />
              作业提交（{homeworkRows.length}）
            </TabsTrigger>
            <TabsTrigger value="feedback" className="gap-1.5">
              <ThumbsUp className="size-3.5" />
              课堂反馈（{feedbackRows.length}）
            </TabsTrigger>
          </TabsList>

          {/* 历次考试 */}
          <TabsContent value="exams" className="min-h-0 flex-1 overflow-y-auto pr-1">
            {examRows.length === 0 ? (
              <p className="py-10 text-center text-[12.5px] text-muted-foreground">这个班还没有考试记录</p>
            ) : (
              <div className="space-y-3">
                {trendData.length >= 2 && (
                  <div className="h-36 rounded-xl border border-border/70 bg-card p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trendData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                        <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                        <Tooltip
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                          formatter={(value: number, name: string) => [value, name === 'total' ? '总分' : '班级均分']}
                        />
                        <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                          {trendData.map((entry, index) => (
                            <Cell key={index} fill={entry.total >= entry.average ? '#f43f5e' : '#10b981'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <table className="w-full text-[12.5px]">
                  <thead className="text-left text-muted-foreground">
                    <tr className="border-b border-border/60">
                      <th className="px-2 py-2 font-medium">考试</th>
                      <th className="px-2 py-2 font-medium">日期</th>
                      {examRows[0]?.exam.sections.map((section) => (
                        <th key={section.name} className="px-2 py-2 font-medium">
                          {section.name}
                        </th>
                      ))}
                      <th className="px-2 py-2 text-right font-medium">总分</th>
                      <th className="px-2 py-2 text-right font-medium">排名</th>
                      <th className="px-2 py-2 text-right font-medium">与均分差</th>
                    </tr>
                  </thead>
                  <tbody>
                    {examRows.map((row) => (
                      <tr key={row.exam.id} className="border-b border-border/40 last:border-0">
                        <td className="px-2 py-2 font-medium">{row.exam.name}</td>
                        <td className="px-2 py-2 text-muted-foreground">{row.exam.date}</td>
                        {row.exam.sections.map((section, i) => (
                          <td key={section.name} className="px-2 py-2 text-muted-foreground">
                            {row.ownScores ? row.ownScores[i] ?? '—' : '—'}
                          </td>
                        ))}
                        <td className="px-2 py-2 text-right font-semibold">
                          {row.absent ? <Badge variant="danger">缺考</Badge> : row.ownTotal}
                        </td>
                        <td className="px-2 py-2 text-right text-muted-foreground">
                          {row.rank ? `${row.rank}/${row.classSize}` : '—'}
                        </td>
                        <td
                          className={cn(
                            'px-2 py-2 text-right font-medium tabular-nums',
                            row.diff === null
                              ? 'text-muted-foreground'
                              : row.diff >= 0
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                          )}
                        >
                          {row.diff === null ? '—' : row.diff > 0 ? `+${row.diff}` : row.diff}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[11px] text-muted-foreground">
                  红色柱/正数 = 高于班级均分，绿色/负数 = 低于均分（沿用国内红高绿低习惯）。
                </p>
              </div>
            )}
          </TabsContent>

          {/* 作业提交 */}
          <TabsContent value="homework" className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="mb-3 flex flex-wrap gap-1.5">
              <Badge variant="info">已交 {homeworkSummary.submitted}</Badge>
              <Badge variant="success">优秀 {homeworkSummary.excellent}</Badge>
              <Badge variant="warning">需订正 {homeworkSummary.correct}</Badge>
              <Badge variant="danger">未交 {homeworkSummary.missing}</Badge>
              <Badge variant="secondary">未登记 {homeworkSummary.unregistered}</Badge>
            </div>
            {homeworkRows.length === 0 ? (
              <p className="py-10 text-center text-[12.5px] text-muted-foreground">这个班还没有作业记录</p>
            ) : (
              <ul className="space-y-1.5">
                {homeworkRows.map(({ assignment, state }) => (
                  <li
                    key={assignment.id}
                    className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-[12.5px]"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{assignment.title}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {assignment.assignedAt} 布置 · {assignment.dueAt} 交
                    </span>
                    {state ? (
                      <Badge variant={STATE_BADGE[state]}>{SUBMISSION_LABELS[state]}</Badge>
                    ) : (
                      <Badge variant="secondary">未登记</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          {/* 课堂反馈 */}
          <TabsContent value="feedback" className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="mb-3 flex flex-wrap gap-1.5">
              <Badge variant="success">表扬 {feedbackSummary.praise}</Badge>
              <Badge variant="warning">提醒 {feedbackSummary.warn}</Badge>
              <Badge variant="info">课堂之星 {feedbackSummary.star}</Badge>
            </div>
            {feedbackRows.length === 0 ? (
              <p className="py-10 text-center text-[12.5px] text-muted-foreground">还没有课堂反馈记录</p>
            ) : (
              <ul className="space-y-1.5">
                {feedbackRows.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-[12.5px]"
                  >
                    <span className="shrink-0 text-[11px] text-muted-foreground">{item.date}</span>
                    <Badge variant={item.kind === 'praise' ? 'success' : item.kind === 'warn' ? 'warning' : 'info'}>
                      {FEEDBACK_LABELS[item.kind]}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate">{item.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
