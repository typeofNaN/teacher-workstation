import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  MapPin,
  MonitorPlay
} from 'lucide-react'
import { useData, useAppStore } from '@/store/app-store'
import { classLessonsForDate, currentPeriod, lessonsForDate, nextLessonDay } from '@/lib/schedule'
import { toDateKey, weekdayIndex, WEEKDAY_LABELS } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/page-header'

/** 工作台首页：顺着一天的教学安排往下做 */
export default function DashboardPage(): JSX.Element {
  const data = useData()
  const mutate = useAppStore((state) => state.mutate)
  const navigate = useNavigate()

  const today = toDateKey()
  const todayLessons = useMemo(() => lessonsForDate(data, today), [data, today])
  const activePeriod = useMemo(() => currentPeriod(data.periods, new Date()), [data.periods])
  const upcoming = useMemo(() => nextLessonDay(data, today), [data, today])
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes()

  const todayCourses = data.periods
    .map((period) => ({ period, lesson: todayLessons.get(period.id) }))
    .filter((entry) => entry.lesson && (entry.lesson.classId || entry.lesson.title))

  const nextCourse = todayCourses.find(({ period }) => {
    const [sh, sm] = period.start.split(':').map(Number)
    return sh * 60 + sm >= nowMinutes - 45
  })

  // 待检查作业（已到截止日期且还有未登记的同学）
  const pendingAssignments = data.assignments
    .filter((assignment) => {
      const hasUnregistered = assignment.classIds.some((classId) => {
        const cls = data.classes.find((c) => c.id === classId)
        if (!cls) return false
        const records = assignment.records[classId] ?? {}
        return cls.students.some((student) => !records[student.id])
      })
      return assignment.dueAt <= today && hasUnregistered
    })
    .slice(0, 3)

  // 每班的当前课题
  const currentTopics = data.classes.map((cls) => {
    const done = data.progress[cls.id]?.length ?? 0
    return { cls, done, topic: data.topics[done] }
  })

  const weekDay = WEEKDAY_LABELS[weekdayIndex() - 1]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? '上午好' : hour < 18 ? '下午好' : '晚上好'
  const teachingWeek = Math.max(
    1,
    Math.ceil((Date.now() - new Date(`${data.teacher.semesterStart}T00:00:00`).getTime()) / (7 * 86400000))
  )

  const markTopicDone = (classId: string, topicIndex: number): void => {
    const topic = data.topics[topicIndex]
    if (!topic) return
    mutate((draft) => {
      const list = draft.progress[classId] ?? (draft.progress[classId] = [])
      if (!list.includes(topic.id)) list.push(topic.id)
    })
    toast.success(`「${topic.name}」已标记完成`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting}，${data.teacher.name || '老师'}`}
        description={`${data.teacher.school || ''} · ${data.teacher.subject || ''} · ${data.classes.length} 个班 · 第 ${teachingWeek} 教学周`.trim()}
      />

      {/* 今日课程 + 教学进度 */}
      <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold">
              <CalendarClock className="size-4 text-primary" />
              今日课程
            </h2>
            <span className="text-[12px] text-muted-foreground">
              {weekDay} · 共 {todayCourses.length} 节
            </span>
          </div>

          {todayCourses.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-muted-foreground">今天没有课，休息一下 ☕</p>
          ) : (
            <ol className="space-y-2.5">
              {todayCourses.map(({ period, lesson }) => {
                const cls = data.classes.find((c) => c.id === lesson?.classId)
                const [eh, em] = period.end.split(':').map(Number)
                const isCurrent = activePeriod?.id === period.id
                const isPast = eh * 60 + em < nowMinutes
                return (
                  <li
                    key={period.id}
                    className={`flex items-center gap-4 rounded-xl border px-4 py-3 transition-colors ${
                      isCurrent
                        ? 'border-primary/40 bg-primary/5'
                        : isPast
                          ? 'border-border/60 opacity-60'
                          : 'border-border/60'
                    }`}
                  >
                    <div className="w-12 shrink-0 text-center">
                      <p className="text-[13px] font-semibold">{period.start}</p>
                      <p className="text-[11px] text-muted-foreground">{period.end}</p>
                    </div>
                    <div
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: cls ? cls.color : '#94a3b8' }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium">
                        {lesson?.cancelled
                          ? '停课'
                          : cls
                            ? `${cls.name} ${data.teacher.subject}`
                            : lesson?.title || '事务'}
                      </p>
                      <p className="flex items-center gap-2 truncate text-[11.5px] text-muted-foreground">
                        {lesson?.room && (
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3" />
                            {lesson.room}
                          </span>
                        )}
                        {lesson?.swapped && <span className="text-amber-600 dark:text-amber-400">已调课</span>}
                      </p>
                    </div>
                    {isCurrent ? (
                      <Badge className="shrink-0">进行中</Badge>
                    ) : isPast ? (
                      <span className="shrink-0 text-[11.5px] text-muted-foreground">已结束</span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={() =>
                          lesson?.classId && navigate('/classroom', { state: { classId: lesson.classId } })
                        }
                      >
                        <MonitorPlay className="size-3.5" />
                        上课
                      </Button>
                    )}
                  </li>
                )
              })}
            </ol>
          )}

          {upcoming && !nextCourse && (
            <p className="mt-3 text-[12px] text-muted-foreground">
              下次上课：{upcoming.date === today ? '今天' : WEEKDAY_LABELS[weekdayIndex(new Date(`${upcoming.date}T00:00:00`)) - 1]}{' '}
              {upcoming.period.label} {upcoming.period.start}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">教学进度</h2>
            <Link to="/progress" className="flex items-center gap-0.5 text-[12px] text-primary hover:underline">
              查看
              <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="space-y-3.5">
            {currentTopics.length === 0 && (
              <p className="py-6 text-center text-[13px] text-muted-foreground">
                还没有班级，先到「设置」里建立任教班级
              </p>
            )}
            {currentTopics.map(({ cls, done, topic }) => (
              <div key={cls.id}>
                <div className="mb-1 flex items-center justify-between text-[12.5px]">
                  <span className="font-medium">{cls.name}</span>
                  <span className="text-muted-foreground">
                    {done}/{data.topics.length} 课题
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${data.topics.length ? (done / data.topics.length) * 100 : 0}%`,
                      backgroundColor: cls.color
                    }}
                  />
                </div>
                {topic ? (
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <p className="truncate text-[11.5px] text-muted-foreground">当前：{topic.name}</p>
                    <button
                      type="button"
                      onClick={() => markTopicDone(cls.id, done)}
                      className="flex shrink-0 items-center gap-0.5 text-[11.5px] text-primary hover:underline"
                    >
                      <CheckCircle2 className="size-3.5" />
                      讲完了
                    </button>
                  </div>
                ) : (
                  <p className="mt-1.5 text-[11.5px] text-emerald-600 dark:text-emerald-400">全部课题已完成 🎉</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 作业跟进 + 最近登记 */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold">
              <ClipboardList className="size-4 text-primary" />
              作业检查
            </h2>
            <Link to="/assignments" className="text-[12px] text-primary hover:underline">
              全部作业
            </Link>
          </div>
          {pendingAssignments.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-muted-foreground">暂无需要跟进的作业</p>
          ) : (
            <ul className="space-y-2">
              {pendingAssignments.map((assignment) => (
                <li
                  key={assignment.id}
                  className="flex items-center justify-between rounded-xl border border-border/60 px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{assignment.title}</p>
                    <p className="text-[11.5px] text-muted-foreground">
                      {assignment.classIds
                        .map((id) => data.classes.find((c) => c.id === id)?.name)
                        .filter(Boolean)
                        .join('、')}{' '}
                      · {assignment.dueAt <= today ? '已到截止' : `截止 ${assignment.dueAt}`}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate('/assignments')}>
                    去检查
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-[15px] font-semibold">最近课堂记录</h2>
          <ul className="space-y-2">
            {[...data.feedback]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 5)
              .map((item) => {
                const cls = data.classes.find((c) => c.id === item.classId)
                const student = cls?.students.find((s) => s.id === item.studentId)
                return (
                  <li key={item.id} className="flex items-center gap-2.5 text-[13px]">
                    <span className="shrink-0 font-medium">{student?.name ?? '—'}</span>
                    <span className="truncate text-muted-foreground">{item.text}</span>
                    <span className="ml-auto shrink-0 text-[11.5px] text-muted-foreground">{item.date}</span>
                  </li>
                )
              })}
            {data.feedback.length === 0 && (
              <p className="py-6 text-center text-[13px] text-muted-foreground">
                到「课堂」页面点名、点评后，记录会出现在这里
              </p>
            )}
          </ul>
        </div>
      </section>

      {/* 班级卡片 */}
      <section>
        <h2 className="mb-3 text-[15px] font-semibold">我的班级</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.classes.map((cls) => {
            const lessonsToday = classLessonsForDate(data, cls.id, today)
            return (
              <Link
                key={cls.id}
                to="/classroom"
                state={{ classId: cls.id }}
                className="group rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
              >
                <div className="flex items-center gap-2.5">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: cls.color }} />
                  <p className="text-[14px] font-semibold">{cls.name}</p>
                  <span className="ml-auto text-[11.5px] text-muted-foreground">{cls.students.length} 人</span>
                </div>
                <p className="mt-1.5 text-[12px] text-muted-foreground">
                  {cls.room} · 今天 {lessonsToday.length} 节课
                </p>
                <p className="mt-3 flex items-center gap-1 text-[12px] text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  <MonitorPlay className="size-3.5" />
                  进入课堂
                </p>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
