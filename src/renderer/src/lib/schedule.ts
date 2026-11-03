/**
 * 课表与调课的核心算法：
 * 固定课表（每周都这样）+ 单日覆盖（自定义 / 对调 / 停课）。
 */
import type { AppData, DayOverride, LessonType, Period, ScheduleItem } from '@shared/types'
import { weekdayIndex } from '@/lib/utils'

export interface DayLesson {
  periodId: string
  /** 来自固定课表的条目（可被覆盖） */
  itemId?: string
  /** custom 覆盖时指向某班（代课） */
  classId?: string
  /** 事务标题：教研 / 值班 / 停课等 */
  title?: string
  room?: string
  type: LessonType
  cancelled?: boolean
  overrideId?: string
  /** 标记该节来源，便于 UI 提示「已调课」 */
  swapped?: boolean
}

function lessonFromItem(item: ScheduleItem | undefined): Partial<DayLesson> {
  if (!item) return {}
  return { itemId: item.id, classId: item.classId, room: item.room, type: item.type }
}

function lessonFromOverride(override: DayOverride): Partial<DayLesson> {
  switch (override.kind) {
    case 'cancel':
      return { cancelled: true, title: '停课', overrideId: override.id }
    case 'custom':
      return {
        classId: override.classId,
        title: override.title,
        room: override.room,
        type: override.type ?? 'other',
        overrideId: override.id
      }
    case 'swap':
      return { swapped: true, overrideId: override.id }
  }
}

/** 某天某个节次在「其他日期」上的课（用于对调的两端） */
function findItemByDate(data: AppData, dateKey: string, periodId: string): ScheduleItem | undefined {
  const [y, m, d] = dateKey.split('-').map(Number)
  const day = weekdayIndex(new Date(y, (m ?? 1) - 1, d ?? 1)) as ScheduleItem['day']
  return data.schedule.find((item) => item.day === day && item.periodId === periodId)
}

/**
 * 计算某一天每一节的最终安排：
 * 1. 以固定课表（按星期）打底；
 * 2. 应用当天 override（cancel / custom / swap 引入）；
 * 3. 处理被其他日期 swap「换进来」的课，以及本日课被换走的情况。
 */
export function lessonsForDate(data: AppData, dateKey: string): Map<string, DayLesson> {
  const day = weekdayIndex(new Date(`${dateKey}T00:00:00`))
  const result = new Map<string, DayLesson>()

  for (const period of data.periods) {
    const item = data.schedule.find((s) => s.day === day && s.periodId === period.id)
    result.set(period.id, { periodId: period.id, type: 'regular', ...lessonFromItem(item) })
  }

  for (const override of data.overrides) {
    if (override.date !== dateKey) continue
    const current = result.get(override.periodId)
    if (override.kind === 'swap') {
      const source = override.swapWithDate
        ? findItemByDate(data, override.swapWithDate, override.swapWithPeriodId ?? override.periodId)
        : undefined
      result.set(override.periodId, {
        periodId: override.periodId,
        type: source?.type ?? 'regular',
        ...lessonFromItem(source),
        swapped: true,
        overrideId: override.id
      })
    } else {
      result.set(override.periodId, {
        ...(current ?? { periodId: override.periodId, type: 'regular' as LessonType }),
        ...lessonFromOverride(override)
      })
    }
  }

  // 本日作为对调的「另一端」：别人的课换进来，本日的课换走
  for (const override of data.overrides) {
    if (override.kind !== 'swap' || override.swapWithDate !== dateKey) continue
    const targetPeriod = override.swapWithPeriodId ?? override.periodId
    const source = findItemByDate(data, override.date, override.periodId)
    result.set(targetPeriod, {
      periodId: targetPeriod,
      type: source?.type ?? 'regular',
      ...lessonFromItem(source),
      swapped: true
    })
  }

  return result
}

/** 找到下一次有课的日期 */
export function nextLessonDay(data: AppData, fromISO: string): { date: string; lesson: DayLesson; period: Period } | null {
  const base = new Date(`${fromISO}T00:00:00`)
  for (let offset = 1; offset <= 14; offset += 1) {
    const d = new Date(base)
    d.setDate(d.getDate() + offset)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const lessons = lessonsForDate(data, key)
    for (const period of data.periods) {
      const lesson = lessons.get(period.id)
      if (lesson && !lesson.cancelled && lesson.classId) return { date: key, lesson, period }
    }
  }
  return null
}

/** 当前时刻所在的节次（用于「进行中」标记） */
export function currentPeriod(periods: Period[], now: Date): Period | null {
  const minutes = now.getHours() * 60 + now.getMinutes()
  for (const period of periods) {
    const [sh, sm] = period.start.split(':').map(Number)
    const [eh, em] = period.end.split(':').map(Number)
    if (minutes >= sh * 60 + sm && minutes <= eh * 60 + em) return period
  }
  return null
}

/** 某班某天的课程（课堂页使用） */
export function classLessonsForDate(data: AppData, classId: string, dateKey: string): DayLesson[] {
  const lessons = lessonsForDate(data, dateKey)
  return [...lessons.values()].filter((lesson) => lesson.classId === classId)
}
