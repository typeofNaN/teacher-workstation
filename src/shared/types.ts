/**
 * 全局数据模型定义。
 * 主进程与渲染进程共享，保证本地 JSON 文件与 UI 状态严格同构。
 *
 * 领域概念（对应赛博老爸《任课教师工作台》）：
 * - 固定课表 + 单日调课（custom / swap / cancel）
 * - 课题清单（教学进度），各班独立标记完成情况
 * - 作业：一份作业布置给多个班，分班登记 已交/优秀/需订正/未交
 * - 考试：多个平行班同场，支持总分制或按大题录分
 * - 课堂：座位表、随机点名、课堂点评、课堂之星
 */

/** 一周中的星期：1 = 周一 … 7 = 周日 */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

/** 课的类型：正课与各类事务 */
export type LessonType =
  | 'regular' // 正课
  | 'morning' // 早读
  | 'tutoring' // 辅导
  | 'evening' // 晚自习
  | 'afterSchool' // 课后服务
  | 'research' // 教研
  | 'duty' // 值班
  | 'other' // 其他

export const LESSON_TYPE_LABELS: Record<LessonType, string> = {
  regular: '正课',
  morning: '早读',
  tutoring: '辅导',
  evening: '晚自习',
  afterSchool: '课后服务',
  research: '教研',
  duty: '值班',
  other: '其他'
}

/** 老师形象（首次使用向导中选择） */
export type AvatarKind = 'female' | 'male'

export interface TeacherProfile {
  /** 称呼，如「李老师」 */
  name: string
  avatar: AvatarKind
  /** 任教学科，如「数学」 */
  subject: string
  school: string
  /** 学段，如「初中」「高中」 */
  stage: string
  /** 学期第一天（ISO 日期），用于计算教学周 */
  semesterStart: string
  /** 是否已完成首次使用向导 */
  onboarded: boolean
}

/** 节次（可自定义作息时间） */
export interface Period {
  id: string
  label: string
  start: string
  end: string
}

/** 教学进度清单中的一条课题 */
export interface Topic {
  id: string
  name: string
  /** 课时数 */
  hours: number
}

export interface Student {
  id: string
  name: string
  no: string
  gender: 'male' | 'female' | 'unknown'
  /** 个人备注，仅教师可见（投屏模式不展示） */
  note?: string
}

/** 座位排列 */
export interface SeatLayout {
  rows: number
  cols: number
}

export interface ClassRoom {
  id: string
  /** 如「初二(3)班」 */
  name: string
  grade: string
  /** 班级主题色，用于课表块与徽标 */
  color: string
  /** 上课教室，如「博学楼203」 */
  room: string
  students: Student[]
  layout: SeatLayout
  /** 座位表：按下标（行优先）存放学生 id，空位为 ''；缺省时按学生顺序排 */
  seats?: string[]
}

/** 固定课表项（每周都这样） */
export interface ScheduleItem {
  id: string
  classId: string
  day: Weekday
  periodId: string
  room: string
  type: LessonType
}

/** 单日安排：只改某一天的那一节 */
export type OverrideKind = 'custom' | 'swap' | 'cancel'

export interface DayOverride {
  id: string
  /** 生效日期（ISO 日期） */
  date: string
  periodId: string
  kind: OverrideKind
  /** custom：当天该节改为的内容（代课 / 教研 / 值班…） */
  title?: string
  classId?: string
  room?: string
  type?: LessonType
  /** swap：与另一天某一节对调 */
  swapWithDate?: string
  swapWithPeriodId?: string
}

/** 作业登记状态：未登记 = 无记录 */
export type SubmissionState = 'submitted' | 'excellent' | 'correct' | 'missing'

export const SUBMISSION_LABELS: Record<SubmissionState, string> = {
  submitted: '已交',
  excellent: '优秀',
  correct: '需订正',
  missing: '未交'
}

export interface Assignment {
  id: string
  title: string
  subject: string
  /** 布置日期（ISO） */
  assignedAt: string
  /** 截止日期（ISO） */
  dueAt: string
  /** 一份作业可同时布置给多个班 */
  classIds: string[]
  /** classId -> studentId -> 登记状态 */
  records: Record<string, Record<string, SubmissionState>>
}

/** 考试大题（sections 为空数组时不存在；长度 1 且 name=总分 即总分制） */
export interface ExamSection {
  name: string
  fullScore: number
}

export interface Exam {
  id: string
  name: string
  subject: string
  date: string
  /** 多个平行班放进同一场考试，便于对照 */
  classIds: string[]
  sections: ExamSection[]
  /** classId -> studentId -> 各大题得分（与 sections 对齐；null = 缺考） */
  scores: Record<string, Record<string, number[] | null>>
}

/** 课堂点评类型 */
export type FeedbackKind = 'praise' | 'warn' | 'star'

export const FEEDBACK_LABELS: Record<FeedbackKind, string> = {
  praise: '表扬',
  warn: '提醒',
  star: '课堂之星'
}

export interface ClassroomFeedback {
  id: string
  classId: string
  date: string
  studentId: string
  kind: FeedbackKind
  text: string
}

/** AI 接口配置（可选；未配置时仅复制提示词） */
export interface AiConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export type ThemeMode = 'light' | 'dark' | 'system'

export interface Preferences {
  theme: ThemeMode
}

export interface AppData {
  /** 数据格式版本，便于后续迁移 */
  version: number
  teacher: TeacherProfile
  periods: Period[]
  /** 课题清单：一份清单，各班分别标记进度 */
  topics: Topic[]
  /** 班级 -> 已完成课题 id（按授课顺序推进） */
  progress: Record<string, string[]>
  classes: ClassRoom[]
  schedule: ScheduleItem[]
  overrides: DayOverride[]
  assignments: Assignment[]
  exams: Exam[]
  feedback: ClassroomFeedback[]
  ai: AiConfig
  preferences: Preferences
}

export interface AppMeta {
  appVersion: string
  electron: string
  chrome: string
  node: string
  /** 'darwin' | 'win32' | 'linux' … 用字符串避免渲染层依赖 Node 类型 */
  platform: string
  dataFilePath: string
}

export type ImportResult =
  | { ok: true; data: AppData; filePath: string }
  | { ok: false; error: string }
