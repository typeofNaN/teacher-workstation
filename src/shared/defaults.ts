/**
 * 默认数据：空数据 + 内置虚拟示例。
 * 示例数据为确定性的（不用 Math.random），保证每次生成一致、可测试。
 */
import type {
  AppData,
  Assignment,
  ClassRoom,
  ClassroomFeedback,
  DayOverride,
  Exam,
  Period,
  ScheduleItem,
  Student,
  SubmissionState,
  Topic
} from './types'

export const DATA_VERSION = 2

/** 默认作息节次 */
export function defaultPeriods(): Period[] {
  return [
    { id: 'p1', label: '第 1 节', start: '08:00', end: '08:45' },
    { id: 'p2', label: '第 2 节', start: '08:55', end: '09:40' },
    { id: 'p3', label: '第 3 节', start: '10:00', end: '10:45' },
    { id: 'p4', label: '第 4 节', start: '11:00', end: '11:45' },
    { id: 'p5', label: '第 5 节', start: '14:00', end: '14:45' },
    { id: 'p6', label: '第 6 节', start: '14:55', end: '15:40' },
    { id: 'p7', label: '第 7 节', start: '16:00', end: '16:45' },
    { id: 'p8', label: '第 8 节', start: '18:30', end: '19:15' }
  ]
}

export function createEmptyData(): AppData {
  return {
    version: DATA_VERSION,
    teacher: {
      name: '',
      avatar: 'female',
      subject: '',
      school: '',
      stage: '',
      semesterStart: new Date().toISOString().slice(0, 10),
      onboarded: false
    },
    periods: defaultPeriods(),
    topics: [],
    progress: {},
    classes: [],
    schedule: [],
    overrides: [],
    assignments: [],
    exams: [],
    feedback: [],
    ai: { baseUrl: '', apiKey: '', model: '' },
    preferences: { theme: 'light' }
  }
}

/* ------------------------------------------------------------------ */
/* 示例数据（确定性生成）                                              */
/* ------------------------------------------------------------------ */

const DEMO_TOPICS: Array<[string, number]> = [
  ['与三角形有关的线段', 3],
  ['与三角形有关的角', 3],
  ['多边形及其内角和', 2],
  ['全等三角形的概念', 1],
  ['三角形全等的判定（一）SSS', 2],
  ['三角形全等的判定（二）SAS', 2],
  ['三角形全等的判定（三）ASA / AAS', 2],
  ['角的平分线的性质', 2],
  ['轴对称', 2],
  ['画轴对称图形', 2],
  ['等腰三角形', 3],
  ['最短路径问题', 1],
  ['整式的乘法（同底数幂）', 3],
  ['整式的乘法（乘法法则）', 3],
  ['乘法公式', 2],
  ['因式分解（提公因式法）', 2],
  ['因式分解（公式法）', 2],
  ['分式及其基本性质', 3],
  ['分式的运算', 4],
  ['整数指数幂', 2],
  ['分式方程', 3],
  ['章末复习·三角形与全等', 2],
  ['章末复习·分式', 2]
]

const DEMO_NAMES = [
  '王子涵', '李思远', '张雨桐', '陈嘉懿', '刘一诺', '杨梓萱', '赵子墨', '黄诗涵',
  '周致远', '吴欣然', '徐浩然', '孙艺菲', '马俊杰', '朱梦琪', '胡博文', '郭语嫣',
  '林子豪', '何静怡', '高晨曦', '罗天佑'
]

const CLASSES: Array<{ name: string; grade: string; color: string; room: string; doneCount: number }> = [
  { name: '初二(3)班', grade: '初二', color: '#0ea5e9', room: '博学楼203', doneCount: 15 },
  { name: '初二(4)班', grade: '初二', color: '#8b5cf6', room: '博学楼204', doneCount: 16 },
  { name: '初二(7)班', grade: '初二', color: '#10b981', room: '博学楼301', doneCount: 14 }
]

/** 确定性伪随机（0 ~ 1），保证示例数据稳定 */
function seededRandom(seed: string): number {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) % 10000) / 10000
}

function isoDate(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

function buildStudents(classIndex: number, count: number): Student[] {
  return Array.from({ length: count }, (_, i) => {
    const name = DEMO_NAMES[(classIndex * 7 + i) % DEMO_NAMES.length]
    const gender = seededRandom(`g-${classIndex}-${i}`) > 0.5 ? 'male' : 'female'
    return {
      id: `s${classIndex + 1}-${i + 1}`,
      name,
      no: String(20260100 + classIndex * 100 + i + 1),
      gender
    }
  })
}

function buildSchedule(): ScheduleItem[] {
  const items: Array<[number, number, number, string]> = [
    // [星期, 节次序号, 班级序号, 教室]
    [1, 0, 0, '博学楼203'], [1, 4, 1, '博学楼204'], [1, 6, 2, '博学楼301'],
    [2, 1, 0, '博学楼203'], [2, 5, 2, '博学楼301'],
    [3, 2, 1, '博学楼204'], [3, 5, 0, '博学楼203'],
    [4, 1, 2, '博学楼301'], [4, 4, 0, '博学楼203'], [4, 6, 1, '博学楼204'],
    [5, 2, 0, '博学楼203'], [5, 4, 2, '博学楼301']
  ]
  return items.map(([day, periodIndex, classIndex, room], i) => ({
    id: `sc-${i + 1}`,
    classId: `c${classIndex + 1}`,
    day: day as ScheduleItem['day'],
    periodId: `p${periodIndex + 1}`,
    room,
    type: 'regular' as const
  }))
}

function buildAssignments(): Assignment[] {
  const a1: Assignment = {
    id: 'asg-1',
    title: '课本习题 14.1',
    subject: '数学',
    assignedAt: isoDate(-4),
    dueAt: isoDate(-1),
    classIds: ['c1', 'c2'],
    records: {}
  }
  const a2: Assignment = {
    id: 'asg-2',
    title: '课本习题 14.2',
    subject: '数学',
    assignedAt: isoDate(-2),
    dueAt: isoDate(1),
    classIds: ['c1'],
    records: {}
  }
  for (const [assignment, classIds] of [
    [a1, ['c1', 'c2']],
    [a2, ['c1']]
  ] as const) {
    for (const classId of classIds) {
      const records: Record<string, SubmissionState> = {}
      const classIndex = Number(classId.slice(1)) - 1
      for (const student of buildStudents(classIndex, 15)) {
        const roll = seededRandom(`${assignment.id}-${classId}-${student.id}`)
        if (roll < 0.72) {
          records[student.id] = student.no.endsWith('6') ? 'excellent' : 'submitted'
        } else if (roll < 0.86) {
          records[student.id] = 'correct'
        } else if (roll < 0.93) {
          records[student.id] = 'missing'
        }
        // 剩下少数人未登记
      }
      assignment.records[classId] = records
    }
  }
  return [a1, a2]
}

function buildExams(): Exam[] {
  const sections = [
    { name: '选择题', fullScore: 30 },
    { name: '填空题', fullScore: 30 },
    { name: '解答题', fullScore: 40 }
  ]
  const makeExam = (id: string, name: string, dateOffset: number): Exam => ({
    id,
    name,
    subject: '数学',
    date: isoDate(dateOffset),
    classIds: ['c1', 'c2', 'c3'],
    sections,
    scores: {}
  })
  const exams = [
    makeExam('exam-1', '第一次月考', -35),
    makeExam('exam-2', '期中考试', -12),
    makeExam('exam-3', '第 10 周周测', -3)
  ]
  for (const exam of exams) {
    for (const classId of exam.classIds) {
      const records: Record<string, number[] | null> = {}
      const classIndex = Number(classId.slice(1)) - 1
      for (const student of buildStudents(classIndex, 15)) {
        const roll = seededRandom(`${exam.id}-${classId}-${student.id}`)
        if (roll < 0.04) {
          records[student.id] = null // 缺考
          continue
        }
        // 基础分 + 抖动，让三个班略有差距
        const base = 58 + classIndex * 3 + roll * 36
        records[student.id] = sections.map((section, i) => {
          const ratio = 0.55 + seededRandom(`${exam.id}-${classId}-${student.id}-${i}`) * 0.42
          return Math.min(section.fullScore, Math.round((base * ratio * section.fullScore) / 100))
        })
      }
      exam.scores[classId] = records
    }
  }
  return exams
}

function buildFeedback(): ClassroomFeedback[] {
  const items: Array<[number, number, number, ClassroomFeedback['kind'], string]> = [
    [0, 0, 1, 'praise', '板演思路清晰'],
    [0, 0, 5, 'star', '主动帮同学讲题'],
    [0, 0, 8, 'warn', '上课走神'],
    [0, 1, 2, 'praise', '订正及时认真'],
    [0, 1, 3, 'star', '一题多解'],
    [0, 2, 4, 'praise', '课堂笔记工整'],
    [0, 2, 9, 'warn', '作业未交']
  ]
  return items.map(([classIndex, dayOffset, studentIndex, kind, text], i) => ({
    id: `fb-${i + 1}`,
    classId: `c${classIndex + 1}`,
    date: isoDate(-dayOffset),
    studentId: `s${classIndex + 1}-${studentIndex + 1}`,
    kind,
    text
  }))
}

function buildOverrides(): DayOverride[] {
  return [
    {
      id: 'ov-1',
      date: isoDate(1),
      periodId: 'p3',
      kind: 'custom',
      title: '教研活动',
      type: 'research'
    },
    { id: 'ov-2', date: isoDate(2), periodId: 'p5', kind: 'cancel' }
  ]
}

/** 内置虚拟示例：3 个班、课表、课题进度、作业与 3 次考试 */
export function createSeedData(): AppData {
  const topics: Topic[] = DEMO_TOPICS.map(([name, hours], i) => ({ id: `t${i + 1}`, name, hours }))
  const classes: ClassRoom[] = CLASSES.map((meta, index) => ({
    id: `c${index + 1}`,
    name: meta.name,
    grade: meta.grade,
    color: meta.color,
    room: meta.room,
    students: buildStudents(index, 15),
    layout: { rows: 4, cols: 4 }
  }))
  const progress: Record<string, string[]> = {}
  CLASSES.forEach((meta, index) => {
    progress[`c${index + 1}`] = topics.slice(0, meta.doneCount).map((topic) => topic.id)
  })

  return {
    version: DATA_VERSION,
    teacher: {
      name: '李老师',
      avatar: 'female',
      subject: '数学',
      school: '示范中学',
      stage: '初中',
      semesterStart: isoDate(-64),
      onboarded: true
    },
    periods: defaultPeriods(),
    topics,
    progress,
    classes,
    schedule: buildSchedule(),
    overrides: buildOverrides(),
    assignments: buildAssignments(),
    exams: buildExams(),
    feedback: buildFeedback(),
    ai: { baseUrl: '', apiKey: '', model: '' },
    preferences: { theme: 'light' }
  }
}
