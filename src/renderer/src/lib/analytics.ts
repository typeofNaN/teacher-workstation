/**
 * 成绩统计：总分 / 平均分 / 及格率 / 优秀率 / 分数段 / 大题得分率 / 历次趋势。
 * 所有函数都要求传入与考试 sections 对齐的得分数组。
 */
import type { Exam } from '@shared/types'

/** 学生的卷面总分；缺考返回 null */
export function examTotal(exam: Exam, scores: number[] | null | undefined): number | null {
  if (!Array.isArray(scores)) return null
  if (exam.sections.length === 0) return null
  return scores.reduce((sum, value, i) => {
    const full = exam.sections[i]?.fullScore ?? 0
    return sum + (typeof value === 'number' ? Math.min(value, full) : 0)
  }, 0)
}

export interface ClassStats {
  classId: string
  count: number
  average: number
  median: number
  max: number
  min: number
  passRate: number
  excellentRate: number
}

function medianOf(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export function classStats(exam: Exam, classId: string, fullScore: number): ClassStats {
  const totals: number[] = []
  const records = exam.scores[classId] ?? {}
  for (const scores of Object.values(records)) {
    const total = examTotal(exam, scores)
    if (total !== null) totals.push(total)
  }
  const count = totals.length
  const average = count ? totals.reduce((a, b) => a + b, 0) / count : 0
  return {
    classId,
    count,
    average: Math.round(average * 10) / 10,
    median: Math.round(medianOf(totals) * 10) / 10,
    max: count ? Math.max(...totals) : 0,
    min: count ? Math.min(...totals) : 0,
    passRate: count ? totals.filter((t) => t >= fullScore * 0.6).length / count : 0,
    excellentRate: count ? totals.filter((t) => t >= fullScore * 0.85).length / count : 0
  }
}

/** 分数段分布（默认 10 分一段，最后一段兜底到满分） */
export function scoreBuckets(
  totals: number[],
  fullScore: number,
  step = 10
): Array<{ label: string; from: number; to: number; count: number }> {
  const buckets: Array<{ label: string; from: number; to: number; count: number }> = []
  for (let from = 0; from < fullScore; from += step) {
    const to = Math.min(from + step, fullScore)
    buckets.push({ label: `${from}~${to}`, from, to, count: 0 })
  }
  for (const total of totals) {
    const bucket = buckets.find((b) => total >= b.from && (total < b.to || (b.to === fullScore && total <= b.to)))
    if (bucket) bucket.count += 1
  }
  return buckets
}

/** 各大题得分率（0~1），用于讲评课找短板 */
export function sectionRates(exam: Exam, classId: string): Array<{ name: string; rate: number; fullScore: number }> {
  const records = exam.scores[classId] ?? {}
  const sums = exam.sections.map(() => ({ got: 0, full: 0, n: 0 }))
  for (const scores of Object.values(records)) {
    if (!Array.isArray(scores)) continue
    scores.forEach((value, i) => {
      const bucket = sums[i]
      if (!bucket || typeof value !== 'number') return
      bucket.got += value
      bucket.full += exam.sections[i].fullScore
      bucket.n += 1
    })
  }
  return sums.map((bucket, i) => ({
    name: exam.sections[i].name,
    fullScore: exam.sections[i].fullScore,
    rate: bucket.full > 0 ? bucket.got / bucket.full : 0
  }))
}

/** 历次趋势：按日期排序的每班平均分 */
export function examTrend(
  exams: Exam[],
  classIds: string[]
): Array<{ name: string; date: string; values: Record<string, number | null> }> {
  return [...exams]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((exam) => {
      const fullScore = exam.sections.reduce((sum, s) => sum + s.fullScore, 0)
      const values: Record<string, number | null> = {}
      for (const classId of classIds) {
        const stats = classStats(exam, classId, fullScore)
        values[classId] = stats.count > 0 ? stats.average : null
      }
      return { name: exam.name, date: exam.date, values }
    })
}
