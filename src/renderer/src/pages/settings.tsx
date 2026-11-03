import { useState } from 'react'
import { toast } from 'sonner'
import {
  Database,
  Download,
  FolderOpen,
  GraduationCap,
  Monitor,
  Moon,
  Palette,
  Plus,
  RotateCcw,
  Sun,
  Trash2,
  Upload,
  User,
  Wand2
} from 'lucide-react'
import { createEmptyData } from '@shared/defaults'
import type { AvatarKind, ClassRoom, ThemeMode } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { PageHeader } from '@/components/page-header'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { useAppStore, useData } from '@/store/app-store'
import { exportData, importData, isDesktop } from '@/lib/storage'
import { CLASS_COLORS, STAGE_OPTIONS, SUBJECT_OPTIONS } from '@/lib/constants'
import { cn, uid } from '@/lib/utils'

const THEME_CARDS: { value: ThemeMode; label: string; description: string; icon: typeof Sun }[] = [
  { value: 'light', label: '浅色', description: '明亮的日间界面', icon: Sun },
  { value: 'dark', label: '深色', description: '夜间备课更护眼', icon: Moon },
  { value: 'system', label: '跟随系统', description: '自动切换外观', icon: Monitor }
]

interface ClassFormState {
  id?: string
  name: string
  grade: string
  color: string
  room: string
  rows: string
  cols: string
}

export default function SettingsPage(): JSX.Element {
  const data = useData()
  const meta = useAppStore((state) => state.meta)
  const mutate = useAppStore((state) => state.mutate)
  const replaceData = useAppStore((state) => state.replaceData)
  const setTheme = useAppStore((state) => state.setTheme)

  const [classOpen, setClassOpen] = useState(false)
  const [classForm, setClassForm] = useState<ClassFormState | null>(null)
  const [deleteClassId, setDeleteClassId] = useState<string | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [configForm, setConfigForm] = useState(data.ai)

  const updateTeacher = (patch: Partial<AppDataTeacherPatch>): void => {
    mutate((draft) => {
      Object.assign(draft.teacher, patch)
    })
  }

  const handleExport = async (): Promise<void> => {
    const result = await exportData(data)
    if (result.ok) toast.success(`已导出到 ${result.filePath ?? '本地文件'}`)
    else if (result.error !== '已取消') toast.error(result.error ?? '导出失败')
  }

  const handleImport = async (): Promise<void> => {
    const result = await importData()
    if (!result.ok) {
      if (result.error !== '已取消') toast.error(result.error)
      return
    }
    await replaceData(result.data)
    setConfigForm(result.data.ai)
    toast.success('数据已导入并覆盖当前内容')
  }

  const handleReset = async (): Promise<void> => {
    const empty = createEmptyData()
    await replaceData(empty)
    toast.success('已清空，可重新开始录入自己的班级')
  }

  const openClassForm = (cls?: ClassRoom): void => {
    setClassForm(
      cls
        ? { id: cls.id, name: cls.name, grade: cls.grade, color: cls.color, room: cls.room, rows: String(cls.layout.rows), cols: String(cls.layout.cols) }
        : {
            name: '',
            grade: data.teacher.stage || '初二',
            color: CLASS_COLORS[data.classes.length % CLASS_COLORS.length],
            room: '',
            rows: '4',
            cols: '4'
          }
    )
    setClassOpen(true)
  }

  const submitClass = (): void => {
    if (!classForm) return
    const name = classForm.name.trim()
    if (!name) {
      toast.error('请填写班级名称')
      return
    }
    const rows = Math.min(10, Math.max(1, Number(classForm.rows) || 4))
    const cols = Math.min(10, Math.max(1, Number(classForm.cols) || 4))
    mutate((draft) => {
      if (classForm.id) {
        const target = draft.classes.find((c) => c.id === classForm.id)
        if (target) {
          target.name = name
          target.grade = classForm.grade.trim()
          target.color = classForm.color
          target.room = classForm.room.trim()
          target.layout = { rows, cols }
        }
      } else {
        draft.classes.push({
          id: uid('c'),
          name,
          grade: classForm.grade.trim(),
          color: classForm.color,
          room: classForm.room.trim(),
          students: [],
          layout: { rows, cols }
        })
      }
    })
    toast.success(classForm.id ? '班级已更新' : `已创建 ${name}`)
    setClassOpen(false)
  }

  const removeClass = (classId: string): void => {
    mutate((draft) => {
      draft.classes = draft.classes.filter((c) => c.id !== classId)
      draft.schedule = draft.schedule.filter((item) => item.classId !== classId)
      draft.assignments = draft.assignments.filter((item) => !item.classIds.includes(classId))
      draft.exams = draft.exams.filter((item) => !item.classIds.includes(classId))
      draft.feedback = draft.feedback.filter((item) => item.classId !== classId)
      delete draft.progress[classId]
    })
    setDeleteClassId(null)
    toast.success('班级已删除，相关课表、作业、成绩已级联清理')
  }

  const addPeriod = (): void => {
    mutate((draft) => {
      const index = draft.periods.length + 1
      draft.periods.push({ id: uid('p'), label: `第 ${index} 节`, start: '08:00', end: '08:45' })
    })
  }

  const removePeriod = (id: string): void => {
    mutate((draft) => {
      draft.periods = draft.periods.filter((item) => item.id !== id)
      draft.schedule = draft.schedule.filter((item) => item.periodId !== id)
    })
    toast.success('节次已删除，相关课程一并移除')
  }

  const saveAiConfig = (): void => {
    mutate((draft) => {
      draft.ai = { ...configForm }
    })
    toast.success('接口配置已保存（密钥仅保存在本机）')
    setConfigOpen(false)
  }

  return (
    <div>
      <PageHeader title="设置" description="个人信息、班级、作息与数据备份。" />

      <div className="space-y-3">
        {/* 个人信息 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="size-4 text-muted-foreground" />
              <CardTitle>个人信息</CardTitle>
            </div>
            <CardDescription>称呼、形象与任教学科会展示在工作台和课堂页。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>形象</Label>
              <div className="flex gap-2">
                {(
                  [
                    { kind: 'female', label: '女老师', emoji: '👩‍🏫' },
                    { kind: 'male', label: '男老师', emoji: '👨‍🏫' }
                  ] as const
                ).map((option) => (
                  <button
                    key={option.kind}
                    type="button"
                    onClick={() => updateTeacher({ avatar: option.kind })}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12.5px] transition-colors',
                      data.teacher.avatar === option.kind
                        ? 'border-primary/50 bg-primary/10 font-medium text-primary'
                        : 'border-border text-muted-foreground hover:bg-secondary/50'
                    )}
                  >
                    <span>{option.emoji}</span>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="teacherName">怎么称呼你</Label>
              <Input
                id="teacherName"
                value={data.teacher.name}
                placeholder="如：李老师"
                onChange={(event) => updateTeacher({ name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>任教学科</Label>
              <div className="flex flex-wrap gap-1.5">
                {SUBJECT_OPTIONS.map((subject) => (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => updateTeacher({ subject })}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-[12.5px] transition-colors',
                      data.teacher.subject === subject
                        ? 'border-primary/50 bg-primary/10 font-medium text-primary'
                        : 'border-border text-muted-foreground hover:bg-secondary/50'
                    )}
                  >
                    {subject}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>学段</Label>
                <div className="flex gap-1.5">
                  {STAGE_OPTIONS.map((stage) => (
                    <button
                      key={stage}
                      type="button"
                      onClick={() => updateTeacher({ stage })}
                      className={cn(
                        'flex-1 rounded-lg border px-2 py-1.5 text-[12.5px] transition-colors',
                        data.teacher.stage === stage
                          ? 'border-primary/50 bg-primary/10 font-medium text-primary'
                          : 'border-border text-muted-foreground hover:bg-secondary/50'
                      )}
                    >
                      {stage}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="semesterStart">学期第一天</Label>
                <Input
                  id="semesterStart"
                  type="date"
                  value={data.teacher.semesterStart}
                  onChange={(event) => updateTeacher({ semesterStart: event.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="school">学校</Label>
              <Input
                id="school"
                value={data.teacher.school}
                placeholder="如：示范中学"
                onChange={(event) => updateTeacher({ school: event.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* 班级管理 */}
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>班级管理</CardTitle>
              <CardDescription className="mt-1">建立任教班级后，再导入学生名单、排课表。</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => openClassForm()}>
              <Plus className="size-3.5" />
              添加班级
            </Button>
          </CardHeader>
          <CardContent>
            {data.classes.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-muted-foreground">还没有班级</p>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {data.classes.map((cls) => (
                  <div key={cls.id} className="rounded-xl border border-border/70 p-4">
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: cls.color }} />
                      <p className="text-[13.5px] font-semibold">{cls.name}</p>
                      <span className="ml-auto text-[11.5px] text-muted-foreground">{cls.students.length} 人</span>
                    </div>
                    <p className="mt-1 text-[11.5px] text-muted-foreground">
                      {cls.grade} · {cls.room || '教室未设置'} · 座位 {cls.layout.rows}×{cls.layout.cols}
                    </p>
                    <div className="mt-3 flex gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 flex-1" onClick={() => openClassForm(cls)}>
                        编辑
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                        onClick={() => setDeleteClassId(cls.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 作息时间 */}
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>作息节次</CardTitle>
              <CardDescription className="mt-1">课表与「进行中」判断都按这里的时间计算。</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={addPeriod}>
              <Plus className="size-3.5" />
              添加节次
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border border-border/70">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border/70 bg-secondary/40 text-[11.5px] text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">节次名称</th>
                    <th className="w-32 px-3 py-2 text-left font-medium">开始</th>
                    <th className="w-32 px-3 py-2 text-left font-medium">结束</th>
                    <th className="w-16 px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {data.periods.map((period, index) => (
                    <tr key={period.id} className="border-b border-border/50 last:border-b-0">
                      <td className="px-3 py-1.5">
                        <Input
                          value={period.label}
                          className="h-8 w-full max-w-[160px]"
                          onChange={(event) =>
                            mutate((draft) => {
                              const target = draft.periods[index]
                              if (target) target.label = event.target.value
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          type="time"
                          value={period.start}
                          className="h-8 w-[112px]"
                          onChange={(event) =>
                            mutate((draft) => {
                              const target = draft.periods[index]
                              if (target) target.start = event.target.value
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          type="time"
                          value={period.end}
                          className="h-8 w-[112px]"
                          onChange={(event) =>
                            mutate((draft) => {
                              const target = draft.periods[index]
                              if (target) target.end = event.target.value
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"
                          onClick={() => removePeriod(period.id)}
                          aria-label="删除节次"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 外观 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="size-4 text-muted-foreground" />
              <CardTitle>外观</CardTitle>
            </div>
            <CardDescription>投屏时建议用浅色；夜间备课可选深色。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-3">
            {THEME_CARDS.map((option) => {
              const active = data.preferences.theme === option.value
              return (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                    active ? 'border-primary/40 bg-primary/[0.04] ring-1 ring-primary/20' : 'border-border hover:bg-secondary/50'
                  }`}
                >
                  <div
                    className={`flex size-8 items-center justify-center rounded-lg ${
                      active ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'
                    }`}
                  >
                    <option.icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium">{option.label}</p>
                    <p className="text-[11px] text-muted-foreground">{option.description}</p>
                  </div>
                </button>
              )
            })}
          </CardContent>
        </Card>

        {/* 数据与备份 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="size-4 text-muted-foreground" />
              <CardTitle>数据与备份</CardTitle>
            </div>
            <CardDescription>
              所有数据只保存在这台电脑里。建议每周导出一份备份；恢复备份会覆盖当前数据。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => void handleExport()}>
                <Download className="size-3.5" />
                导出备份
              </Button>
              <Button variant="outline" size="sm" onClick={() => void handleImport()}>
                <Upload className="size-3.5" />
                恢复备份
              </Button>
              {isDesktop() && (
                <Button variant="outline" size="sm" onClick={() => void window.desktop?.revealDataFile()}>
                  <FolderOpen className="size-3.5" />
                  打开数据目录
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-rose-600 hover:bg-rose-500/10 hover:text-rose-600 dark:text-rose-400"
                onClick={() => setResetOpen(true)}
              >
                <RotateCcw className="size-3.5" />
                开始录入我的班级
              </Button>
            </div>

            <Separator />

            <div className="grid gap-2 text-[12px] sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-md bg-secondary/50 px-3 py-2">
                <span className="text-muted-foreground">存储位置</span>
                <span className="max-w-[60%] truncate font-mono text-[11px]" title={meta?.dataFilePath}>
                  {meta?.dataFilePath ?? '浏览器 localStorage（预览模式）'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-secondary/50 px-3 py-2">
                <span className="text-muted-foreground">数据规模</span>
                <span>
                  {data.classes.length} 班级 · {data.assignments.length} 作业 · {data.exams.length} 考试
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI 接口 */}
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="size-4 text-muted-foreground" />
                AI 接口
              </CardTitle>
              <CardDescription className="mt-1">
                备课教案、试卷分析等可在「AI 助手」中直接生成；不配置也可复制提示词。
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
              <Wand2 className="size-3.5" />
              配置
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-[12px] text-muted-foreground">
              {data.ai.baseUrl
                ? `已配置：${data.ai.baseUrl}（模型 ${data.ai.model || '默认'}）`
                : '未配置接口，AI 助手当前为「复制提示词」模式'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>关于</CardTitle>
            <CardDescription>任课教师工作台 · 本地优先 · Developed with Electron</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4">
            {[
              { label: '应用版本', value: meta?.appVersion ?? '1.0.0' },
              { label: 'Electron', value: meta?.electron ?? '浏览器预览' },
              { label: 'Chromium', value: meta?.chrome ?? '—' },
              { label: 'Node.js', value: meta?.node ?? '—' }
            ].map((item) => (
              <div key={item.label} className="rounded-md bg-secondary/50 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">{item.label}</p>
                <p className="mt-0.5 truncate font-mono text-[11.5px]">{item.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 班级表单 */}
      <Dialog open={classOpen} onOpenChange={setClassOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{classForm?.id ? '编辑班级' : '添加班级'}</DialogTitle>
          </DialogHeader>
          {classForm && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cls-name">班级名称</Label>
                  <Input
                    id="cls-name"
                    placeholder="如：初二(3)班"
                    value={classForm.name}
                    onChange={(event) => setClassForm((prev) => (prev ? { ...prev, name: event.target.value } : prev))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cls-room">教室</Label>
                  <Input
                    id="cls-room"
                    placeholder="如：博学楼203"
                    value={classForm.room}
                    onChange={(event) => setClassForm((prev) => (prev ? { ...prev, room: event.target.value } : prev))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cls-rows">座位行数</Label>
                  <Input
                    id="cls-rows"
                    type="number"
                    min={1}
                    max={10}
                    value={classForm.rows}
                    onChange={(event) => setClassForm((prev) => (prev ? { ...prev, rows: event.target.value } : prev))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cls-cols">座位列数</Label>
                  <Input
                    id="cls-cols"
                    type="number"
                    min={1}
                    max={10}
                    value={classForm.cols}
                    onChange={(event) => setClassForm((prev) => (prev ? { ...prev, cols: event.target.value } : prev))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>班级颜色</Label>
                <div className="flex flex-wrap gap-1.5">
                  {CLASS_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setClassForm((prev) => (prev ? { ...prev, color } : prev))}
                      className={cn(
                        'size-7 rounded-lg transition-transform',
                        classForm.color === color ? 'scale-110 ring-2 ring-offset-2 ring-offset-background' : 'opacity-70'
                      )}
                      style={{ backgroundColor: color, boxShadow: classForm.color === color ? `0 0 0 2px ${color}` : undefined }}
                      aria-label={`选择颜色 ${color}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setClassOpen(false)}>
              取消
            </Button>
            <Button size="sm" onClick={submitClass}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI 接口配置 */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>AI 接口配置</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ai-url">API 地址（OpenAI 兼容）</Label>
              <Input
                id="ai-url"
                placeholder="如：https://api.example.com/v1"
                value={configForm.baseUrl}
                onChange={(event) => setConfigForm((prev) => ({ ...prev, baseUrl: event.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ai-key">API Key</Label>
                <Input
                  id="ai-key"
                  type="password"
                  value={configForm.apiKey}
                  onChange={(event) => setConfigForm((prev) => ({ ...prev, apiKey: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ai-model">模型</Label>
                <Input
                  id="ai-model"
                  placeholder="如：gpt-4o-mini"
                  value={configForm.model}
                  onChange={(event) => setConfigForm((prev) => ({ ...prev, model: event.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfigOpen(false)}>
              取消
            </Button>
            <Button size="sm" onClick={saveAiConfig}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteClassId !== null}
        onOpenChange={(open) => !open && setDeleteClassId(null)}
        title="删除班级"
        description="该班的课表、作业、成绩与课堂记录会一并删除，确定删除吗？"
        confirmText="确认删除"
        onConfirm={() => deleteClassId && removeClass(deleteClassId)}
      />

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="开始录入我的班级？"
        description="示例数据与已有教学记录都会被清空。建议先导出备份。"
        confirmText="清空并开始"
        onConfirm={() => void handleReset()}
      />
    </div>
  )
}

type AppDataTeacherPatch = Partial<{
  name: string
  avatar: AvatarKind
  subject: string
  school: string
  stage: string
  semesterStart: string
}>
