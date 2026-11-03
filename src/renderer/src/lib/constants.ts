/** 班级主题色：与设计系统的语义色保持协调 */
export const CLASS_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316']

/** 作业登记状态样式 */
export const SUBMISSION_STYLES: Record<string, { label: string; short: string; className: string }> = {
  submitted: { label: '已交', short: '交', className: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  excellent: { label: '优秀', short: '优', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  correct: { label: '需订正', short: '订', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  missing: { label: '未交', short: '缺', className: 'bg-rose-500/15 text-rose-700 dark:text-rose-300' }
}

/** 课堂点评样式 */
export const FEEDBACK_STYLES: Record<string, { label: string; className: string }> = {
  praise: { label: '表扬', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  warn: { label: '提醒', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  star: { label: '课堂之星', className: 'bg-violet-500/15 text-violet-700 dark:text-violet-300' }
}

/** 学段与学科常用选项 */
export const STAGE_OPTIONS = ['小学', '初中', '高中'] as const
export const SUBJECT_OPTIONS = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治'] as const
