import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Plus, Search, Trash2, Upload, UserPlus, FileText } from 'lucide-react'
import { useData, useAppStore } from '@/store/app-store'
import { cn, uid, contrastText } from '@/lib/utils'
import type { Student } from '@shared/types'
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
import { StudentDetailDialog } from '@/components/student-detail-dialog'

const GENDER_LABELS: Record<Student['gender'], string> = {
  male: '男',
  female: '女',
  unknown: '未填写'
}

interface StudentFormState {
  id?: string
  name: string
  no: string
  gender: Student['gender']
}

/** 学生名单：花名册、搜索、批量粘贴导入（姓名,学号,性别） */
export default function StudentsPage(): JSX.Element {
  const data = useData()
  const mutate = useAppStore((state) => state.mutate)

  const [activeClassId, setActiveClassId] = useState(data.classes[0]?.id ?? '')
  const [keyword, setKeyword] = useState('')
  const [form, setForm] = useState<StudentFormState | null>(null)
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchText, setBatchText] = useState('')
  const [deleteStudentId, setDeleteStudentId] = useState<string | null>(null)
  const [detailStudentId, setDetailStudentId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const cls = data.classes.find((c) => c.id === activeClassId) ?? data.classes[0]

  const filtered = useMemo(() => {
    if (!cls) return []
    const query = keyword.trim()
    if (!query) return cls.students
    return cls.students.filter((s) => s.name.includes(query) || s.no.includes(query))
  }, [cls, keyword])

  if (!cls) {
    return (
      <div className="space-y-5">
        <h1 className="text-[17px] font-semibold tracking-tight">学生名单</h1>
        <div className="rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
          <p className="text-[13.5px] font-medium">还没有班级</p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">先到「设置 → 班级管理」建立任教班级</p>
        </div>
      </div>
    )
  }

  const submitForm = (): void => {
    if (!form) return
    const name = form.name.trim()
    if (!name) {
      toast.error('请填写学生姓名')
      return
    }
    mutate((draft) => {
      const target = draft.classes.find((c) => c.id === cls.id)
      if (!target) return
      if (form.id) {
        const existing = target.students.find((s) => s.id === form.id)
        if (existing) {
          existing.name = name
          existing.no = form.no.trim()
          existing.gender = form.gender
        }
      } else {
        target.students.push({
          id: uid('s'),
          name,
          no: form.no.trim() || String(target.students.length + 1),
          gender: form.gender
        })
      }
    })
    toast.success(form.id ? '学生信息已更新' : `已添加 ${name}`)
    setForm(null)
  }

  const submitBatch = (): void => {
    const lines = batchText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    let added = 0
    mutate((draft) => {
      const target = draft.classes.find((c) => c.id === cls.id)
      if (!target) return
      for (const line of lines) {
        const cells = line.split(/[,，\t]/).map((cell) => cell.trim())
        const name = cells[0]
        if (!name || name === '姓名') continue
        const genderRaw = cells[2] ?? ''
        target.students.push({
          id: uid('s'),
          name,
          no: cells[1] || String(target.students.length + 1),
          gender: genderRaw.startsWith('男') ? 'male' : genderRaw.startsWith('女') ? 'female' : 'unknown'
        })
        added += 1
      }
    })
    toast.success(`已导入 ${added} 名学生`)
    setBatchOpen(false)
    setBatchText('')
  }

  const removeStudent = (studentId: string): void => {
    mutate((draft) => {
      const target = draft.classes.find((c) => c.id === cls.id)
      if (!target) return
      target.students = target.students.filter((s) => s.id !== studentId)
      // 级联清理成绩与作业登记
      for (const exam of draft.exams) {
        if (exam.scores[cls.id]) delete exam.scores[cls.id][studentId]
      }
      for (const assignment of draft.assignments) {
        if (assignment.records[cls.id]) delete assignment.records[cls.id][studentId]
      }
      draft.feedback = draft.feedback.filter(
        (item) => !(item.classId === cls.id && item.studentId === studentId)
      )
    })
    setDeleteStudentId(null)
    toast.success('已删除，相关成绩与登记记录已同步清理')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight">学生名单</h1>
          <p className="text-[12.5px] text-muted-foreground">支持从 Excel 复制「姓名,学号,性别」整列粘贴导入</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setBatchOpen(true)}>
            <Upload className="size-3.5" />
            批量导入
          </Button>
          <Button size="sm" onClick={() => setForm({ name: '', no: '', gender: 'unknown' })}>
            <UserPlus className="size-3.5" />
            添加学生
          </Button>
        </div>
      </div>

      {/* 班级切换 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {data.classes.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveClassId(item.id)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors',
                item.id === cls.id ? 'shadow-sm' : 'border border-border text-muted-foreground hover:bg-secondary'
              )}
              style={item.id === cls.id ? { backgroundColor: item.color, color: contrastText(item.color) } : undefined}
            >
              {item.name}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-56">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-8"
            placeholder="搜索学生姓名 / 学号"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border/60 text-left text-[12px] text-muted-foreground">
                <th className="w-14 px-5 py-3 font-medium">序号</th>
                <th className="px-3 py-3 font-medium">姓名</th>
                <th className="w-28 px-3 py-3 font-medium">学号</th>
                <th className="w-20 px-3 py-3 font-medium">性别</th>
                <th className="w-24 px-3 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student, index) => (
                <tr key={student.id} className="border-b border-border/40 last:border-0 hover:bg-secondary/30">
                  <td className="px-5 py-2.5 text-muted-foreground">{index + 1}</td>
                  <td className="px-3 py-2.5 font-medium">
                    <button
                      type="button"
                      className="rounded font-medium hover:text-primary hover:underline"
                      onClick={() => {
                        setDetailStudentId(student.id)
                        setDetailOpen(true)
                      }}
                    >
                      {student.name}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{student.no}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={student.gender === 'male' ? 'info' : student.gender === 'female' ? 'warning' : 'secondary'}>
                      {GENDER_LABELS[student.gender]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        title="查看详情"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        onClick={() => {
                          setDetailStudentId(student.id)
                          setDetailOpen(true)
                        }}
                      >
                        <FileText className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        onClick={() =>
                          setForm({ id: student.id, name: student.name, no: student.no, gender: student.gender })
                        }
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500"
                        onClick={() => setDeleteStudentId(student.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-[12.5px] text-muted-foreground">
                    {keyword ? '没有匹配的学生' : '这个班还没有学生，试试批量导入'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <p className="text-[11.5px] text-muted-foreground">
        {cls.name} · 共 {cls.students.length} 人 · 教室 {cls.room || '未设置'}
      </p>

      {/* 添加 / 编辑学生 */}
      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{form?.id ? '编辑学生' : '添加学生'}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="student-name">姓名</Label>
                <Input
                  id="student-name"
                  value={form.name}
                  onChange={(event) => setForm((prev) => (prev ? { ...prev, name: event.target.value } : prev))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="student-no">学号</Label>
                  <Input
                    id="student-no"
                    value={form.no}
                    onChange={(event) => setForm((prev) => (prev ? { ...prev, no: event.target.value } : prev))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>性别</Label>
                  <div className="flex gap-1.5">
                    {(['male', 'female', 'unknown'] as const).map((gender) => (
                      <button
                        key={gender}
                        type="button"
                        onClick={() => setForm((prev) => (prev ? { ...prev, gender } : prev))}
                        className={cn(
                          'flex-1 rounded-lg border px-2 py-1.5 text-[12.5px] transition-colors',
                          form.gender === gender
                            ? 'border-primary/50 bg-primary/10 font-medium text-primary'
                            : 'border-border text-muted-foreground hover:bg-secondary/50'
                        )}
                      >
                        {GENDER_LABELS[gender]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setForm(null)}>
              取消
            </Button>
            <Button size="sm" onClick={submitForm}>
              <Plus className="size-3.5" />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量导入 */}
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>批量导入学生</DialogTitle>
            <DialogDescription>从 Excel 复制后直接粘贴，每行：姓名,学号,性别（性别可省略）</DialogDescription>
          </DialogHeader>
          <textarea
            className="h-40 w-full resize-none rounded-lg border border-border bg-transparent p-3 text-[13px] outline-none focus:ring-1 focus:ring-primary/40"
            placeholder={'张三,20260101,男\n李四,20260102,女'}
            value={batchText}
            onChange={(event) => setBatchText(event.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setBatchOpen(false)}>
              取消
            </Button>
            <Button size="sm" onClick={submitBatch}>
              导入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteStudentId !== null}
        title="删除学生"
        description="该学生的成绩、作业登记与课堂记录会一并删除，确定删除吗？"
        onOpenChange={(open) => !open && setDeleteStudentId(null)}
        onConfirm={() => deleteStudentId && removeStudent(deleteStudentId)}
      />

      {/* 学生详情：历次考试 / 作业提交 / 课堂反馈 */}
      <StudentDetailDialog
        classId={cls.id}
        studentId={detailStudentId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  )
}
