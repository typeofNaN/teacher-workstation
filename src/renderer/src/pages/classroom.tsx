import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Armchair,
  BarChart3,
  Check,
  ClipboardCheck,
  ClipboardList,
  Copy,
  Grid3X3,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  Scan,
  Search,
  Shuffle,
  Star,
  ThumbsUp,
  Timer,
  Trophy,
  UserRound,
  Users,
  X
} from 'lucide-react'
import { useData, useAppStore } from '@/store/app-store'
import { classLessonsForDate, lessonsForDate } from '@/lib/schedule'
import { cn, contrastText, toDateKey, uid } from '@/lib/utils'
import { SUBMISSION_STYLES, FEEDBACK_STYLES } from '@/lib/constants'
import { FEEDBACK_LABELS, SUBMISSION_LABELS } from '@shared/types'
import type { ClassroomFeedback, FeedbackKind, Student, SubmissionState } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { StudentDetailDialog } from '@/components/student-detail-dialog'

/** 底部课堂模式，对应原版「上课 / 课堂点评 / 作业检查 / 成绩 / 学生 / 调座位」 */
type ClassroomMode = 'class' | 'feedback' | 'homework' | 'grades' | 'students' | 'seats'

const MODES: Array<{ id: ClassroomMode; label: string; icon: typeof Grid3X3 }> = [
  { id: 'class', label: '上课', icon: Grid3X3 },
  { id: 'feedback', label: '课堂点评', icon: ThumbsUp },
  { id: 'homework', label: '作业检查', icon: ClipboardCheck },
  { id: 'grades', label: '成绩', icon: BarChart3 },
  { id: 'students', label: '学生', icon: Users },
  { id: 'seats', label: '调座位', icon: Armchair }
]

const STATE_CYCLE: Array<SubmissionState | undefined> = [undefined, 'submitted', 'excellent', 'correct', 'missing']

/** 舞台上每个座位的固定像素尺寸，「适应」缩放以此为基准 */
const CELL_W = 104
const CELL_H = 84
const STAGE_GAP = 10
const PODIUM_H = 26

const minutesOf = (time: string): number => {
  const [h, m] = time.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/**
 * 课堂页：一间可视化教室。
 * 顶部切班 + 班级与桌椅 + 下次上课；工具条提供随机点名 / 计时 / 适应 / 全屏 / 搜索学生；
 * 底部在 上课 / 课堂点评 / 作业检查 / 成绩 / 学生 / 调座位 六种课堂模式间切换。
 */
export default function ClassroomPage(): JSX.Element {
  const data = useData()
  const mutate = useAppStore((state) => state.mutate)
  const navigate = useNavigate()
  const location = useLocation()
  const today = toDateKey()

  const initialClassId = (location.state as { classId?: string } | null)?.classId
  const [activeClassId, setActiveClassId] = useState(initialClassId ?? data.classes[0]?.id ?? '')
  const [mode, setMode] = useState<ClassroomMode>('class')
  const cls = data.classes.find((c) => c.id === activeClassId)

  /* ---------------- 调座位（仅在「调座位」模式生效） ---------------- */
  const [dragging, setDragging] = useState<string | null>(null)
  const [selectedForMove, setSelectedForMove] = useState<string | null>(null)

  /* ---------------- 随机点名 ---------------- */
  const [picking, setPicking] = useState(false)
  const [pickName, setPickName] = useState('')
  const [picked, setPicked] = useState<Student | null>(null)
  const pickTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  /* ---------------- 课堂计时 ---------------- */
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)

  /* ---------------- 课堂点评 ---------------- */
  const [feedbackStudent, setFeedbackStudent] = useState<Student | null>(null)
  const [feedbackKind, setFeedbackKind] = useState<FeedbackKind>('praise')
  const [feedbackText, setFeedbackText] = useState('')

  /* ---------------- 搜索学生 / 定位 ---------------- */
  const [query, setQuery] = useState('')
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ---------------- 适应缩放 ---------------- */
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(false)
  const [stageBox, setStageBox] = useState({ w: 0, h: 0 })
  const [isFullscreen, setFullscreen] = useState(false)

  /* ---------------- 作业检查 / 成绩 模式选中的对象 ---------------- */
  const [homeworkId, setHomeworkId] = useState('')
  const [examId, setExamId] = useState('')

  /* ---------------- 班级与桌椅 ---------------- */
  const [detailStudentId, setDetailStudentId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [layoutOpen, setLayoutOpen] = useState(false)
  const [layoutForm, setLayoutForm] = useState({ rows: '4', cols: '4', room: '' })

  useEffect(() => {
    if (!cls && data.classes.length > 0) setActiveClassId(data.classes[0].id)
  }, [cls, data.classes])

  const seats = useMemo(() => {
    if (!cls) return []
    const capacity = cls.layout.rows * cls.layout.cols
    if (cls.seats && cls.seats.length === capacity) return cls.seats
    return cls.students.map((student) => student.id)
  }, [cls])

  const studentById = useMemo(() => new Map(cls?.students.map((s) => [s.id, s]) ?? []), [cls])

  /* ---------------- 本节 / 下节课题 ---------------- */
  const doneCount = data.progress[cls?.id ?? '']?.length ?? 0
  const currentTopic = data.topics[doneCount]
  const nextTopic = data.topics[doneCount + 1]

  /* ---------------- 下次上课（跨天往后找，跳过停课） ---------------- */
  const nextLessonInfo = useMemo(() => {
    if (!cls) return null
    const now = new Date()
    for (let offset = 0; offset <= 10; offset += 1) {
      const day = new Date(now)
      day.setDate(day.getDate() + offset)
      const key = toDateKey(day)
      const lesson = lessonsForDate(data, key).get(cls.id)
      if (!lesson || lesson.cancelled) continue
      const period = data.periods.find((p) => p.id === lesson.periodId)
      if (!period) continue
      if (offset === 0 && minutesOf(now.toTimeString().slice(0, 5)) >= minutesOf(period.end)) continue
      const periodIndex = data.periods.findIndex((p) => p.id === period.id)
      const dayLabel = offset === 0 ? '今天' : offset === 1 ? '明天' : `${day.getMonth() + 1}月${day.getDate()}日`
      return { offset, dayLabel, period, periodIndex, lesson }
    }
    return null
  }, [data, cls])

  const todayLessons = useMemo(
    () => (cls ? classLessonsForDate(data, cls.id, today) : []),
    [data, cls, today]
  )
  const todayLesson = todayLessons[0]

  const todayFeedback = useMemo(
    () => data.feedback.filter((item) => item.classId === cls?.id && item.date === today),
    [data, cls, today]
  )
  const todayStars = todayFeedback.filter((item) => item.kind === 'star')

  /* ---------------- 作业检查模式的数据 ---------------- */
  const classAssignments = useMemo(
    () => data.assignments.filter((a) => a.classIds.includes(cls?.id ?? '')),
    [data.assignments, cls]
  )
  const activeAssignment =
    classAssignments.find((a) => a.id === homeworkId) ?? classAssignments[0]

  const homeworkStats = useMemo(() => {
    if (!activeAssignment || !cls) return null
    const records = activeAssignment.records[cls.id] ?? {}
    const counts = { submitted: 0, excellent: 0, correct: 0, missing: 0, unregistered: 0 }
    for (const student of cls.students) {
      const state = records[student.id]
      if (!state) counts.unregistered += 1
      else counts[state] += 1
    }
    return { records, counts }
  }, [activeAssignment, cls])

  /* ---------------- 成绩模式的数据 ---------------- */
  const classExams = useMemo(
    () =>
      data.exams
        .filter((exam) => exam.classIds.includes(cls?.id ?? ''))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [data.exams, cls]
  )
  const activeExam = classExams.find((exam) => exam.id === examId) ?? classExams[0]

  const gradeRows = useMemo(() => {
    if (!activeExam || !cls) return []
    const records = activeExam.scores[cls.id] ?? {}
    const rows = cls.students.map((student) => {
      const scores = records[student.id]
      const total =
        Array.isArray(scores) && activeExam.sections.length > 0
          ? scores.reduce((sum, value, i) => sum + (typeof value === 'number' ? Math.min(value, activeExam.sections[i]?.fullScore ?? 0) : 0), 0)
          : null
      return { student, scores: Array.isArray(scores) ? scores : null, total, absent: scores === null }
    })
    const ranked = [...rows].filter((row) => row.total !== null).sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
    const rankMap = new Map(ranked.map((row, i) => [row.student.id, i + 1]))
    return rows
      .map((row) => ({ ...row, rank: rankMap.get(row.student.id) }))
      .sort((a, b) => (b.total ?? -1) - (a.total ?? -1))
  }, [activeExam, cls])

  const examStats = useMemo(() => {
    if (!activeExam || !cls) return null
    const totals = gradeRows.filter((row) => row.total !== null).map((row) => row.total as number)
    if (totals.length === 0) return null
    const fullScore = activeExam.sections.reduce((sum, s) => sum + s.fullScore, 0)
    const average = totals.reduce((a, b) => a + b, 0) / totals.length
    return {
      average: Math.round(average * 10) / 10,
      max: Math.max(...totals),
      min: Math.min(...totals),
      passRate: Math.round((totals.filter((t) => t >= fullScore * 0.6).length / totals.length) * 100)
    }
  }, [activeExam, cls, gradeRows])

  /* ---------------- 座位操作 ---------------- */

  const setSeatAt = useCallback(
    (index: number, studentId: string) => {
      if (!cls) return
      mutate((draft) => {
        const target = draft.classes.find((c) => c.id === cls.id)
        if (!target) return
        const capacity = target.layout.rows * target.layout.cols
        const current =
          target.seats && target.seats.length === capacity
            ? [...target.seats]
            : target.students.map((s) => s.id)
        const fromIndex = current.indexOf(studentId)
        if (fromIndex >= 0) current[fromIndex] = current[index] ?? ''
        current[index] = studentId
        target.seats = current
      })
    },
    [cls, mutate]
  )

  const handleSeatClick = (index: number, studentId: string | undefined): void => {
    if (!studentId) return
    if (mode === 'feedback') {
      const student = studentById.get(studentId)
      if (student) openFeedback(student)
      return
    }
    if (mode === 'students') {
      setDetailStudentId(studentId)
      setDetailOpen(true)
      return
    }
    if (mode !== 'seats') {
      locateStudent(studentId)
      return
    }
    // 调座位：拖动 or 先点学生再点目标座位（触屏友好）
    if (dragging) {
      if (dragging === studentId) {
        setDragging(null)
        return
      }
      setSeatAt(index, dragging)
      setDragging(null)
      return
    }
    if (selectedForMove) {
      if (selectedForMove === studentId) {
        setSelectedForMove(null)
        return
      }
      setSeatAt(index, selectedForMove)
      setSelectedForMove(null)
      toast.success('座位已调整')
      return
    }
    setDragging(studentId)
  }

  /* ---------------- 搜索学生 ---------------- */

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || !cls) return []
    return cls.students
      .filter((s) => s.name.toLowerCase().includes(q) || s.no.toLowerCase().includes(q))
      .slice(0, 6)
  }, [query, cls])

  const locateStudent = (studentId: string): void => {
    setHighlightId(studentId)
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
    highlightTimer.current = setTimeout(() => setHighlightId(null), 4000)
    requestAnimationFrame(() => {
      document.querySelector(`[data-seat="${studentId}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  }

  /* ---------------- 随机点名 ---------------- */

  const startPick = (): void => {
    if (!cls || cls.students.length === 0) return
    setPicked(null)
    setPicking(true)
    let ticks = 0
    pickTimer.current = setInterval(() => {
      ticks += 1
      const student = cls.students[Math.floor(Math.random() * cls.students.length)]
      setPickName(student.name)
      if (ticks > 18) {
        if (pickTimer.current) clearInterval(pickTimer.current)
        setPickName(student.name)
        setPicked(student)
        setPicking(false)
      }
    }, 80)
  }

  useEffect(
    () => () => {
      if (pickTimer.current) clearInterval(pickTimer.current)
      if (highlightTimer.current) clearTimeout(highlightTimer.current)
    },
    []
  )

  /* ---------------- 课堂计时 ---------------- */

  useEffect(() => {
    if (!timerRunning) return
    const timer = setInterval(() => setTimerSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [timerRunning])

  const timerLabel = `${String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:${String(timerSeconds % 60).padStart(2, '0')}`

  /* ---------------- 课堂点评 ---------------- */

  const openFeedback = (student: Student): void => {
    setFeedbackStudent(student)
    setFeedbackKind('praise')
    setFeedbackText('')
  }

  const submitFeedback = (): void => {
    if (!cls || !feedbackStudent) return
    mutate((draft) => {
      draft.feedback.push({
        id: uid('fb'),
        classId: cls.id,
        date: today,
        studentId: feedbackStudent.id,
        kind: feedbackKind,
        text: feedbackText.trim() || FEEDBACK_LABELS[feedbackKind]
      })
    })
    toast.success(`已记录：${feedbackStudent.name} · ${FEEDBACK_LABELS[feedbackKind]}`)
    setFeedbackStudent(null)
    setFeedbackText('')
  }

  const feedbackTally = useMemo(() => {
    const map = new Map<string, { praise: number; warn: number; star: number }>()
    for (const item of todayFeedback) {
      const entry = map.get(item.studentId) ?? { praise: 0, warn: 0, star: 0 }
      entry[item.kind] += 1
      map.set(item.studentId, entry)
    }
    return [...map.entries()]
      .map(([studentId, counts]) => ({ student: studentById.get(studentId), counts }))
      .filter((row) => row.student)
      .sort((a, b) => b.counts.star * 3 + b.counts.praise - (a.counts.star * 3 + a.counts.praise))
  }, [todayFeedback, studentById])

  /* ---------------- 作业检查 ---------------- */

  const cycleState = (studentId: string): void => {
    if (!activeAssignment || !cls) return
    mutate((draft) => {
      const target = draft.assignments.find((a) => a.id === activeAssignment.id)
      if (!target) return
      const records = target.records[cls.id] ?? (target.records[cls.id] = {})
      const current = records[studentId]
      const next = STATE_CYCLE[(STATE_CYCLE.indexOf(current) + 1) % STATE_CYCLE.length]
      if (next) records[studentId] = next
      else delete records[studentId]
    })
  }

  const batchSet = (state: SubmissionState | undefined): void => {
    if (!activeAssignment || !cls) return
    mutate((draft) => {
      const target = draft.assignments.find((a) => a.id === activeAssignment.id)
      if (!target) return
      const records = target.records[cls.id] ?? (target.records[cls.id] = {})
      for (const student of cls.students) {
        if (state) records[student.id] = state
        else delete records[student.id]
      }
    })
    toast.success(state ? `已全部标记为「${SUBMISSION_LABELS[state]}」` : '已清空登记')
  }

  const restSubmitted = (): void => {
    if (!activeAssignment || !cls) return
    mutate((draft) => {
      const target = draft.assignments.find((a) => a.id === activeAssignment.id)
      if (!target) return
      const records = target.records[cls.id] ?? (target.records[cls.id] = {})
      for (const student of cls.students) {
        if (!records[student.id]) records[student.id] = 'submitted'
      }
    })
    toast.success('其余未登记的同学已标记为已交')
  }

  const copyMissing = async (): Promise<void> => {
    if (!activeAssignment || !cls || !homeworkStats) return
    const missing = cls.students.filter((s) => homeworkStats.records[s.id] === 'missing')
    if (missing.length === 0) {
      toast.info('没有未交的同学')
      return
    }
    const text = `未交名单（${cls.name} · ${activeAssignment.title}）：${missing.map((s) => s.name).join('、')}`
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`已复制 ${missing.length} 人未交名单`)
    } catch {
      toast.error('复制失败，请手动复制')
    }
  }

  /* ---------------- 课题完成 ---------------- */

  const markCurrentTopicDone = (): void => {
    if (!cls || !currentTopic) return
    mutate((draft) => {
      const list = draft.progress[cls.id] ?? (draft.progress[cls.id] = [])
      if (!list.includes(currentTopic.id)) list.push(currentTopic.id)
    })
    toast.success(`「${currentTopic.name}」已标记完成`)
  }

  /* ---------------- 班级与桌椅 ---------------- */

  const openLayoutDialog = (): void => {
    if (!cls) return
    setLayoutForm({
      rows: String(cls.layout.rows),
      cols: String(cls.layout.cols),
      room: cls.room
    })
    setLayoutOpen(true)
  }

  const saveLayout = (): void => {
    if (!cls) return
    const rows = Number(layoutForm.rows)
    const cols = Number(layoutForm.cols)
    if (!Number.isInteger(rows) || rows < 1 || rows > 12 || !Number.isInteger(cols) || cols < 1 || cols > 10) {
      toast.error('行数 1-12、列数 1-10')
      return
    }
    if (rows * cols < cls.students.length) {
      toast.error(`座位数（${rows * cols}）少于学生数（${cls.students.length}）`)
      return
    }
    mutate((draft) => {
      const target = draft.classes.find((c) => c.id === cls.id)
      if (!target) return
      target.layout = { rows, cols }
      if (layoutForm.room.trim()) target.room = layoutForm.room.trim()
      const kept = (target.seats ?? target.students.map((s) => s.id)).filter((id) => id)
      const seated = new Set(kept)
      const rest = target.students.filter((s) => !seated.has(s.id)).map((s) => s.id)
      const next: string[] = []
      for (let i = 0; i < rows * cols; i += 1) next.push(kept[i] ?? rest.shift() ?? '')
      target.seats = next
    })
    toast.success('桌椅排列已更新')
    setLayoutOpen(false)
  }

  /* ---------------- 全屏 ---------------- */

  const toggleFullscreen = async (): Promise<void> => {
    if (!containerRef.current) return
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        setFullscreen(false)
      } else {
        await containerRef.current.requestFullscreen()
        setFullscreen(true)
      }
    } catch {
      toast.error('当前环境不支持全屏')
    }
  }

  useEffect(() => {
    const handler = (): void => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  /* ---------------- 舞台尺寸与「适应」缩放 ---------------- */

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = (): void => setStageBox({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [mode, cls?.id])

  const naturalW = (cls?.layout.cols ?? 1) * CELL_W + ((cls?.layout.cols ?? 1) - 1) * STAGE_GAP
  const naturalH = PODIUM_H + 14 + (cls?.layout.rows ?? 1) * CELL_H + ((cls?.layout.rows ?? 1) - 1) * STAGE_GAP
  const scale =
    fit && stageBox.w > 0
      ? Math.min(1, stageBox.w / naturalW, stageBox.h > 0 ? stageBox.h / naturalH : 1)
      : 1

  /* ---------------- 渲染 ---------------- */

  if (!cls) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-muted-foreground">
        还没有班级，先到「设置」建立任教班级
      </div>
    )
  }

  const seatCells = Array.from({ length: cls.layout.rows * cls.layout.cols }, (_, i) => ({
    index: i,
    studentId: seats[i] || undefined
  }))

  const renderStage = (): JSX.Element => (
    <div ref={stageRef} className="relative flex min-h-[320px] flex-1 items-center justify-center overflow-hidden">
      <div
        className="mx-auto"
        style={{
          width: naturalW * scale,
          height: naturalH * scale
        }}
      >
        <div
          className="flex flex-col items-center"
          style={{
            width: naturalW,
            transform: `scale(${scale})`,
            transformOrigin: 'top left'
          }}
        >
          {/* 讲台 */}
          <div className="mb-3 flex h-[26px] w-3/5 items-center justify-center rounded-lg bg-primary/15">
            <span className="text-[10.5px] font-medium tracking-widest text-primary/80">讲 台</span>
          </div>
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${cls.layout.cols}, ${CELL_W}px)`,
              gap: STAGE_GAP
            }}
          >
            {seatCells.map(({ index, studentId }) => {
              const student = studentId ? studentById.get(studentId) : undefined
              const isDragging = studentId && studentId === dragging
              const isSelected = studentId && studentId === selectedForMove
              const isHighlighted = studentId && studentId === highlightId
              const feedbackOf = student ? todayFeedback.filter((f) => f.studentId === student.id) : []
              return (
                <div
                  key={index}
                  data-seat={studentId || undefined}
                  draggable={mode === 'seats' && Boolean(student)}
                  onDragStart={() => studentId && setDragging(studentId)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragging && studentId !== dragging) setSeatAt(index, dragging)
                    setDragging(null)
                  }}
                  onDoubleClick={() => {
                    if (!student || mode === 'seats') return
                    openFeedback(student)
                  }}
                  onClick={() => handleSeatClick(index, studentId)}
                  className={cn(
                    'flex cursor-pointer select-none flex-col items-center justify-center rounded-xl border px-1.5 transition-all',
                    student
                      ? 'border-border/70 bg-card shadow-sm hover:border-primary/40'
                      : 'border-dashed border-border/50 bg-secondary/20',
                    isDragging && 'opacity-50 ring-2 ring-primary/40',
                    isSelected && 'ring-2 ring-primary/50',
                    isHighlighted && 'ring-2 ring-amber-400 ring-offset-1'
                  )}
                  style={{ width: CELL_W, height: CELL_H }}
                >
                  {student ? (
                    <>
                      <span className="max-w-full truncate text-[13px] font-medium">{student.name}</span>
                      <span className="text-[10.5px] text-muted-foreground">{student.no}</span>
                      {feedbackOf.length > 0 && (
                        <span className="mt-0.5 flex items-center gap-0.5">
                          {feedbackOf.some((f) => f.kind === 'star') && (
                            <Star className="size-3 fill-amber-400 text-amber-400" />
                          )}
                          {feedbackOf.some((f) => f.kind === 'praise') && (
                            <ThumbsUp className="size-3 text-emerald-500" />
                          )}
                          {feedbackOf.some((f) => f.kind === 'warn') && (
                            <span className="text-[10px] font-medium text-amber-500">提醒</span>
                          )}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[11px] text-muted-foreground/50">空位</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )

  const renderHomework = (): JSX.Element => (
    <div className="flex min-h-0 flex-1 flex-col">
      {classAssignments.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-[13px] text-muted-foreground">
          <ClipboardList className="size-8 text-muted-foreground/40" />
          这个班还没有作业，到「作业」页布置一份
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <select
              value={activeAssignment?.id ?? ''}
              onChange={(event) => setHomeworkId(event.target.value)}
              className="h-8 rounded-lg border border-border bg-background px-2.5 text-[12.5px]"
            >
              {classAssignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}（{a.dueAt} 交）
                </option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={restSubmitted}>
              <Check className="size-3.5" />
              其余都已交
            </Button>
            <Button size="sm" variant="outline" onClick={() => batchSet('submitted')}>
              全部已交
            </Button>
            <Button size="sm" variant="outline" onClick={() => batchSet('excellent')}>
              全部优秀
            </Button>
            <Button size="sm" variant="outline" onClick={() => batchSet(undefined)}>
              全部清空
            </Button>
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => void copyMissing()}>
              <Copy className="size-3.5" />
              复制未交名单
            </Button>
          </div>
          <div
            className="grid content-start gap-2 overflow-y-auto pr-1"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))' }}
          >
            {cls.students.map((student) => {
              const state = homeworkStats?.records[student.id]
              return (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => cycleState(student.id)}
                  className={cn(
                    'flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 transition-colors',
                    state
                      ? SUBMISSION_STYLES[state].className
                      : 'border-border/70 bg-card hover:border-primary/40'
                  )}
                >
                  <span className="max-w-full truncate text-[12.5px] font-medium">{student.name}</span>
                  <span className="text-[10.5px] opacity-80">
                    {state ? SUBMISSION_STYLES[state].label : '未登记'}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">点击学生循环切换：未登记 → 已交 → 优秀 → 需订正 → 未交</p>
        </>
      )}
    </div>
  )

  const renderGrades = (): JSX.Element => (
    <div className="flex min-h-0 flex-1 flex-col">
      {classExams.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-[13px] text-muted-foreground">
          <BarChart3 className="size-8 text-muted-foreground/40" />
          这个班还没有考试，到「成绩录入」新建
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2">
            <select
              value={activeExam?.id ?? ''}
              onChange={(event) => setExamId(event.target.value)}
              className="h-8 rounded-lg border border-border bg-background px-2.5 text-[12.5px]"
            >
              {classExams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.name}（{exam.date}）
                </option>
              ))}
            </select>
            {examStats && (
              <span className="text-[12px] text-muted-foreground">
                均分 {examStats.average} · 最高 {examStats.max} · 最低 {examStats.min} · 及格率 {examStats.passRate}%
              </span>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border/70">
            <table className="w-full text-[12.5px]">
              <thead className="sticky top-0 bg-secondary/70 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">名次</th>
                  <th className="px-3 py-2 font-medium">姓名</th>
                  <th className="px-3 py-2 font-medium">学号</th>
                  {activeExam.sections.map((section) => (
                    <th key={section.name} className="px-3 py-2 font-medium">
                      {section.name}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium">总分</th>
                </tr>
              </thead>
              <tbody>
                {gradeRows.map((row) => (
                  <tr key={row.student.id} className="border-t border-border/50">
                    <td className="px-3 py-1.5 text-muted-foreground">{row.rank ?? '—'}</td>
                    <td className="px-3 py-1.5">
                      <button
                        type="button"
                        className="font-medium hover:text-primary hover:underline"
                        onClick={() => {
                          setDetailStudentId(row.student.id)
                          setDetailOpen(true)
                        }}
                      >
                        {row.student.name}
                      </button>
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">{row.student.no}</td>
                    {activeExam.sections.map((section, i) => (
                      <td key={section.name} className="px-3 py-1.5 text-muted-foreground">
                        {row.scores ? row.scores[i] ?? '—' : '—'}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-right font-semibold">
                      {row.absent ? <Badge variant="danger">缺考</Badge> : row.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
            <Trophy className="size-3.5" />
            投屏提示：个人成绩、名次和备注不适合公开展示，投屏前请切换回「上课」模式。
          </p>
        </>
      )}
    </div>
  )

  /** 「学生」模式：点任意学生直接查看详情 */
  const renderStudentRoster = (): JSX.Element => (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="grid content-start gap-2 overflow-y-auto pr-1"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))' }}
      >
        {cls.students.map((student) => {
          const marks = todayFeedback.filter((f) => f.studentId === student.id)
          const star = marks.some((f) => f.kind === 'star')
          const praise = marks.filter((f) => f.kind === 'praise').length
          const warn = marks.filter((f) => f.kind === 'warn').length
          return (
            <button
              key={student.id}
              type="button"
              onClick={() => {
                setDetailStudentId(student.id)
                setDetailOpen(true)
              }}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-border/70 bg-card px-2 py-3 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
            >
              <span
                className="flex size-9 items-center justify-center rounded-full text-[15px] font-semibold"
                style={{ backgroundColor: `${cls.color}22`, color: cls.color }}
              >
                {student.name.slice(0, 1)}
              </span>
              <span className="max-w-full truncate text-[12.5px] font-medium">{student.name}</span>
              <span className="text-[10.5px] text-muted-foreground">{student.no}</span>
              {marks.length > 0 && (
                <span className="flex items-center gap-1 text-[10.5px]">
                  {star && <Star className="size-3 fill-amber-400 text-amber-400" />}
                  {praise > 0 && <ThumbsUp className="size-3 text-emerald-500" />}
                  {warn > 0 && <span className="font-medium text-amber-500">提醒×{warn}</span>}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {cls.students.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-[13px] text-muted-foreground">
          <UserRound className="size-8 text-muted-foreground/40" />
          这个班还没有学生，到「学生」页添加
        </div>
      )}
    </div>
  )

  const renderSidePanel = (): JSX.Element => {
    if (mode === 'homework') {
      return (
        <>
          <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
            <h3 className="mb-2.5 text-[13.5px] font-semibold">登记情况</h3>
            {homeworkStats ? (
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="info">已交 {homeworkStats.counts.submitted}</Badge>
                <Badge variant="warning">优秀 {homeworkStats.counts.excellent}</Badge>
                <Badge variant="warning">需订正 {homeworkStats.counts.correct}</Badge>
                <Badge variant="danger">未交 {homeworkStats.counts.missing}</Badge>
                <Badge variant="secondary">未登记 {homeworkStats.counts.unregistered}</Badge>
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground">还没有作业</p>
            )}
          </div>
          <div className="rounded-2xl border border-border/80 bg-card p-4 text-[12px] leading-relaxed text-muted-foreground shadow-sm">
            未登记不等于未交：检查时先标出少数需要订正或没交的同学，再点「其余都已交」。
          </div>
        </>
      )
    }
    if (mode === 'grades') {
      return (
        <div className="rounded-2xl border border-border/80 bg-card p-4 text-[12px] leading-relaxed text-muted-foreground shadow-sm">
          <h3 className="mb-2 text-[13.5px] font-semibold text-foreground">讲评课怎么用</h3>
          <p>按大题录入后，结合各类题的得分率找出本班短板；对照平行班平均分判断是讲题还是讲习惯。</p>
        </div>
      )
    }
    if (mode === 'students') {
      return (
        <>
          <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
            <h3 className="mb-2.5 flex items-center gap-1.5 text-[13.5px] font-semibold">
              <Users className="size-4 text-primary" />
              学生速览
            </h3>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="info">{cls.students.length} 名学生</Badge>
              {todayFeedback.length > 0 && (
                <Badge variant="warning">今日点评 {todayFeedback.length} 条</Badge>
              )}
              {todayStars.length > 0 && (
                <Badge variant="warning">课堂之星 {todayStars.length} 人</Badge>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-border/80 bg-card p-4 text-[12px] leading-relaxed text-muted-foreground shadow-sm">
            <h3 className="mb-2 text-[13.5px] font-semibold text-foreground">怎么用</h3>
            <p>点击任意学生（左侧卡片或教室座位），即可查看 TA 的历次考试、作业提交和课堂反馈详情。</p>
          </div>
        </>
      )
    }
    if (mode === 'seats') {
      return (
        <>
          <div className="rounded-2xl border border-border/80 bg-card p-4 text-[12px] leading-relaxed text-muted-foreground shadow-sm">
            <h3 className="mb-2 text-[13.5px] font-semibold text-foreground">调座位</h3>
            <p>拖动学生到目标座位即可交换；用触摸屏时，也可以先点学生，再点目标座位。</p>
            <Button size="sm" variant="outline" className="mt-3 w-full" onClick={openLayoutDialog}>
              <Armchair className="size-3.5" />
              班级与桌椅
            </Button>
          </div>
        </>
      )
    }
    if (mode === 'feedback') {
      return (
        <div className="flex-1 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
          <h3 className="mb-2.5 flex items-center gap-1.5 text-[13.5px] font-semibold">
            <ThumbsUp className="size-4 text-primary" />
            今日点评统计
          </h3>
          {feedbackTally.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">还没有点评，点击座位即可记录</p>
          ) : (
            <ul className="space-y-2">
              {feedbackTally.map(({ student, counts }) => (
                <li
                  key={student?.id}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-[12.5px] hover:bg-secondary/60"
                  onClick={() => {
                    if (student) {
                      setDetailStudentId(student.id)
                      setDetailOpen(true)
                    }
                  }}
                >
                  <span className="font-medium">{student?.name}</span>
                  <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                    {counts.praise > 0 && <span className="text-emerald-600 dark:text-emerald-400">表扬×{counts.praise}</span>}
                    {counts.warn > 0 && <span className="text-amber-600 dark:text-amber-400">提醒×{counts.warn}</span>}
                    {counts.star > 0 && <span className="text-violet-600 dark:text-violet-400">星×{counts.star}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )
    }
    // 上课模式
    return (
      <>
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
          <h3 className="mb-2.5 text-[13.5px] font-semibold">本节课</h3>
          {currentTopic ? (
            <>
              <p className="text-[14px] font-semibold text-primary">{currentTopic.name}</p>
              {nextTopic && <p className="mt-1 text-[12px] text-muted-foreground">下节：{nextTopic.name}</p>}
              <Button size="sm" className="mt-3 w-full" onClick={markCurrentTopicDone}>
                <Check className="size-3.5" />
                这个课题讲完了
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="mt-1.5 w-full"
                onClick={() => navigate('/assignments')}
              >
                <ClipboardList className="size-3.5" />
                布置作业
              </Button>
            </>
          ) : (
            <p className="text-[12px] text-muted-foreground">本班课题已全部讲完</p>
          )}
        </div>
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
          <h3 className="mb-2.5 flex items-center gap-1.5 text-[13.5px] font-semibold">
            <Star className="size-4 text-amber-500" />
            课堂之星 · 今天
          </h3>
          {todayStars.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">还没有评选，双击学生座位即可点评 / 评星</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {todayStars.map((item) => (
                <Badge key={item.id} variant="warning">
                  {studentById.get(item.studentId)?.name ?? '—'}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
          <h3 className="mb-2.5 flex items-center gap-1.5 text-[13.5px] font-semibold">今日课堂记录</h3>
          {todayFeedback.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">还没有记录</p>
          ) : (
            <ul className="max-h-52 space-y-2 overflow-y-auto">
              {[...todayFeedback].reverse().map((item: ClassroomFeedback) => (
                <li key={item.id} className="flex items-start gap-2 text-[12.5px]">
                  <span className="shrink-0 rounded px-1 py-0.5 text-[10.5px] font-medium text-white" style={{ backgroundColor: item.kind === 'warn' ? '#f59e0b' : item.kind === 'star' ? '#8b5cf6' : '#10b981' }}>
                    {FEEDBACK_STYLES[item.kind]?.label ?? FEEDBACK_LABELS[item.kind]}
                  </span>
                  <span className="font-medium">{studentById.get(item.studentId)?.name ?? '—'}</span>
                  <span className="truncate text-muted-foreground">{item.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </>
    )
  }

  return (
    <div
      ref={containerRef}
      className="flex min-h-full flex-col gap-3 bg-background pb-2"
    >
      {/* 顶栏：切班 + 班级与桌椅 + 下次上课 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {data.classes.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveClassId(item.id)
                setMode('class')
                setDragging(null)
                setSelectedForMove(null)
              }}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-[12.5px] font-medium shadow-sm transition-all',
                item.id === activeClassId ? 'ring-2 ring-primary/30' : 'border border-border text-muted-foreground hover:bg-secondary'
              )}
              style={
                item.id === activeClassId
                  ? { backgroundColor: item.color, color: contrastText(item.color) }
                  : undefined
              }
            >
              {item.name}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {nextLessonInfo && (
            <span className="hidden items-center gap-1.5 rounded-full bg-secondary/70 px-3 py-1.5 text-[12px] text-secondary-foreground md:flex">
              <Timer className="size-3.5 text-primary" />
              下次上课：{nextLessonInfo.dayLabel} 第{nextLessonInfo.periodIndex + 1}节 {nextLessonInfo.period.start}
            </span>
          )}
          <Button size="sm" variant="outline" onClick={openLayoutDialog}>
            <Armchair className="size-3.5" />
            班级与桌椅
          </Button>
        </div>
      </div>

      {/* 工具条：课程信息 + 随机点名 / 计时 / 适应 / 全屏 / 搜索 */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card px-3.5 py-2">
        <span className="text-[12.5px] font-medium">
          {data.teacher.subject} · {data.classes.length}个班
        </span>
        {todayLesson?.room && <span className="text-[12px] text-muted-foreground">教室：{todayLesson.room || cls.room}</span>}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={startPick} disabled={picking}>
            <Shuffle className="size-3.5" />
            随机点名
          </Button>
          <div className="flex items-center gap-1 rounded-lg border border-border px-1.5 py-1">
            <span
              className={cn(
                'min-w-[52px] text-center font-mono text-[14px] font-semibold tabular-nums',
                timerRunning && 'text-primary'
              )}
            >
              {timerLabel}
            </span>
            <button
              type="button"
              title={timerRunning ? '暂停' : '开始'}
              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              onClick={() => setTimerRunning((running) => !running)}
            >
              {timerRunning ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            </button>
            <button
              type="button"
              title="复位"
              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              onClick={() => {
                setTimerRunning(false)
                setTimerSeconds(0)
              }}
            >
              <RotateCcw className="size-3.5" />
            </button>
          </div>
          <Button
            size="sm"
            variant={fit ? 'default' : 'outline'}
            onClick={() => setFit((value) => !value)}
            title="把教室缩放到适合屏幕"
          >
            <Scan className="size-3.5" />
            适应
          </Button>
          <Button size="sm" variant="outline" onClick={() => void toggleFullscreen()}>
            {isFullscreen ? <Minimize className="size-3.5" /> : <Maximize className="size-3.5" />}
            {isFullscreen ? '退出' : '全屏'}
          </Button>
          {/* 搜索学生 */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索学生姓名/学号"
              className="h-8 w-40 pl-8 text-[12.5px]"
            />
            {searchResults.length > 0 && (
              <div className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
                {searchResults.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-[12.5px] hover:bg-secondary"
                    onClick={() => {
                      setDetailStudentId(student.id)
                      setDetailOpen(true)
                      setQuery('')
                    }}
                  >
                    <span className="font-medium">{student.name}</span>
                    <span className="text-[11px] text-muted-foreground">{student.no}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 主体：教室 + 侧栏 */}
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_280px]">
        <div className="flex min-h-[360px] flex-col rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
          {mode === 'homework'
            ? renderHomework()
            : mode === 'grades'
              ? renderGrades()
              : mode === 'students'
                ? renderStudentRoster()
                : renderStage()}
        </div>
        <div className="flex min-h-0 flex-col gap-3">{renderSidePanel()}</div>
      </div>

      {/* 底部课堂模式切换 */}
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-1 rounded-2xl border border-border/70 bg-card p-1.5 shadow-sm">
          {MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setMode(id)
                setDragging(null)
                setSelectedForMove(null)
              }}
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-medium transition-colors',
                mode === id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 随机点名 */}
      <Dialog open={picking || picked !== null} onOpenChange={(open) => !open && setPicked(null)}>
        <DialogContent className="max-w-xs text-center">
          <DialogHeader>
            <DialogTitle>随机点名</DialogTitle>
          </DialogHeader>
          <p
            className={cn(
              'py-6 text-5xl font-semibold tracking-wider transition-transform',
              picking && 'scale-110 opacity-80'
            )}
          >
            {pickName || '…'}
          </p>
          {!picking && picked && (
            <DialogFooter className="justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFeedbackStudent(picked)
                  setFeedbackKind('praise')
                  setPicked(null)
                }}
              >
                记录点评
              </Button>
              <Button size="sm" onClick={startPick}>
                再来一次
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* 课堂点评 */}
      <Dialog open={feedbackStudent !== null} onOpenChange={(open) => !open && setFeedbackStudent(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              课堂点评 · {feedbackStudent?.name}
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setFeedbackStudent(null)}
              >
                <X className="size-4" />
              </button>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-1.5">
              {(['praise', 'warn', 'star'] as FeedbackKind[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setFeedbackKind(kind)}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2 text-[12.5px] transition-colors',
                    feedbackKind === kind
                      ? 'border-primary/50 bg-primary/10 font-medium text-primary'
                      : 'border-border text-muted-foreground hover:bg-secondary/50'
                  )}
                >
                  {FEEDBACK_LABELS[kind]}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="feedback-text">点评内容</Label>
              <Input
                id="feedback-text"
                placeholder="如：板演思路清晰"
                value={feedbackText}
                onChange={(event) => setFeedbackText(event.target.value)}
              />
            </div>
            {feedbackKind === 'star' && (
              <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <Star className="size-3.5 text-amber-500" />
                评选为课堂之星后会展示在侧栏与座位上
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (feedbackStudent) setDetailStudentId(feedbackStudent.id)
                setDetailOpen(true)
                setFeedbackStudent(null)
              }}
            >
              查看详情
            </Button>
            <Button variant="outline" size="sm" onClick={() => setFeedbackStudent(null)}>
              取消
            </Button>
            <Button size="sm" onClick={submitFeedback}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 班级与桌椅 */}
      <Dialog open={layoutOpen} onOpenChange={setLayoutOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>班级与桌椅 · {cls.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="layout-rows">排数（行）</Label>
                <Input
                  id="layout-rows"
                  type="number"
                  min={1}
                  max={12}
                  value={layoutForm.rows}
                  onChange={(event) => setLayoutForm((prev) => ({ ...prev, rows: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="layout-cols">列数</Label>
                <Input
                  id="layout-cols"
                  type="number"
                  min={1}
                  max={10}
                  value={layoutForm.cols}
                  onChange={(event) => setLayoutForm((prev) => ({ ...prev, cols: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="layout-room">教室 / 地点</Label>
              <Input
                id="layout-room"
                placeholder="如：博学楼203"
                value={layoutForm.room}
                onChange={(event) => setLayoutForm((prev) => ({ ...prev, room: event.target.value }))}
              />
            </div>
            <p className="text-[11.5px] text-muted-foreground">
              共 {cls.students.length} 名学生，需要至少同样多的座位；调整后学生按原顺序重新入座。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setLayoutOpen(false)}>
              取消
            </Button>
            <Button size="sm" onClick={saveLayout}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
