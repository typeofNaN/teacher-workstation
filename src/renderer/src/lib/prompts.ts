/**
 * AI 助手：四类备课模板 + 班情上下文组装。
 * 学生姓名一律先替换成「学生1/学生2…」编号，生成后由教师自行核对使用。
 */
import type { AppData } from '@shared/types'
import { classStats, examTotal } from '@/lib/analytics'
import { toDateKey } from '@/lib/utils'

export interface AiTemplate {
  id: string
  title: string
  description: string
  /** 表单需要哪些字段 */
  fields: Array<'topic' | 'hours' | 'lessonType'>
}

export const AI_TEMPLATES: AiTemplate[] = [
  { id: 'lesson-plan', title: '备课教案', description: '生成一份结构完整的教案草稿', fields: ['topic', 'hours', 'lessonType'] },
  { id: 'tiered-homework', title: '分层作业', description: '按基础 / 提高 / 挑战三层出题', fields: ['topic'] },
  { id: 'exam-review', title: '试卷分析', description: '基于成绩数据定位讲评重点', fields: [] },
  { id: 'student-remarks', title: '学科评语', description: '为每位学生生成个性化评语', fields: [] }
]

export interface PromptContext {
  /** 课题名称 */
  topic: string
  hours: string
  lessonType: string
  classId: string
  /** 其他要求（选填） */
  extra?: string
}

/** 收集班级学情（隐去姓名）：进度、最近成绩、作业情况 */
export function classContext(data: AppData, classId: string): string {
  const cls = data.classes.find((c) => c.id === classId)
  if (!cls) return ''
  const lines: string[] = [`班级：${cls.name}（共 ${cls.students.length} 人）`]

  const done = data.progress[classId]?.length ?? 0
  const current = data.topics[done]
  lines.push(`教学进度：已完成 ${done}/${data.topics.length} 个课题${current ? `，当前讲到「${current.name}」` : ''}`)

  const recentExams = [...data.exams]
    .filter((exam) => exam.classIds.includes(classId))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 2)
  for (const exam of recentExams) {
    const fullScore = exam.sections.reduce((sum, s) => sum + s.fullScore, 0)
    const stats = classStats(exam, classId, fullScore)
    lines.push(
      `考试「${exam.name}」（${exam.date}）：平均分 ${stats.average}/${fullScore}，及格率 ${(stats.passRate * 100).toFixed(0)}%，优秀率 ${(stats.excellentRate * 100).toFixed(0)}%`
    )
  }

  const today = toDateKey()
  for (const assignment of data.assignments) {
    if (!assignment.classIds.includes(classId)) continue
    const records = assignment.records[classId] ?? {}
    const submitted = Object.values(records).filter((state) => state === 'submitted' || state === 'excellent').length
    const missing = Object.values(records).filter((state) => state === 'missing').length
    lines.push(
      `作业「${assignment.title}」（截止 ${assignment.dueAt}${assignment.dueAt <= today ? '，已截止' : ''}）：已交 ${submitted} 人${missing > 0 ? `，未交 ${missing} 人` : ''}`
    )
  }
  return lines.join('\n')
}

/** 学生名单（匿名编号），供评语模板使用 */
function anonymizedStudents(data: AppData, classId: string): string {
  const cls = data.classes.find((c) => c.id === classId)
  if (!cls) return ''
  return cls.students.map((_, i) => `学生${i + 1}`).join('、')
}

/** 组装完整提示词 */
export function buildPrompt(data: AppData, templateId: string, ctx: PromptContext): string {
  const subject = data.teacher.subject || '本学科'
  const stage = data.teacher.stage || '初中'
  const classInfo = ctx.classId ? classContext(data, ctx.classId) : ''
  const lessonDesc = ctx.lessonType ? `课型：${ctx.lessonType}。` : ''
  const hoursDesc = ctx.hours ? `课时：${ctx.hours}。` : ''
  const extra = ctx.extra?.trim() ? `其他要求：${ctx.extra.trim()}。` : ''

  switch (templateId) {
    case 'lesson-plan':
      return [
        `你是一位经验丰富的${stage}${subject}教师，请为以下课题撰写一份${ctx.hours || '1'}课时的教案草稿。`,
        '',
        `课题：${ctx.topic || data.topics[0]?.name || '未指定'}`,
        lessonDesc,
        hoursDesc,
        classInfo ? `班级学情（学生姓名已隐去）：\n${classInfo}` : '',
        extra,
        '',
        '要求：包含教学目标、重难点、教学过程（导入 / 新授 / 练习 / 小结）、板书设计与作业布置；语言简洁，可直接编辑使用。'
      ]
        .filter(Boolean)
        .join('\n')
    case 'tiered-homework':
      return [
        `你是一位经验丰富的${stage}${subject}教师，请围绕课题「${ctx.topic || data.topics[0]?.name || '未指定'}」设计一套分层作业。`,
        '',
        hoursDesc,
        classInfo ? `班级学情（学生姓名已隐去）：\n${classInfo}` : '',
        extra,
        '',
        '要求：分为「基础巩固 / 能力提高 / 思维挑战」三档，每档 3~5 题，注明考查知识点与预计用时，附参考答案。'
      ]
        .filter(Boolean)
        .join('\n')
    case 'exam-review': {
      const exam = [...data.exams].sort((a, b) => b.date.localeCompare(a.date))[0]
      if (!exam) return '还没有考试成绩，请先在「成绩」中录入一次考试。'
      const fullScore = exam.sections.reduce((sum, s) => sum + s.fullScore, 0)
      const rates = exam.sections.map((section, i) => {
        const records = exam.scores[ctx.classId] ?? {}
        let got = 0
        let full = 0
        for (const scores of Object.values(records)) {
          if (!Array.isArray(scores)) continue
          const value = scores[i]
          if (typeof value === 'number') {
            got += value
            full += section.fullScore
          }
        }
        return `${section.name}（满分 ${section.fullScore}）得分率 ${full > 0 ? Math.round((got / full) * 100) : 0}%`
      })
      const stats = ctx.classId ? classStats(exam, ctx.classId, fullScore) : null
      return [
        `你是一位经验丰富的${stage}${subject}教师。以下是班级「${exam.name}」的考试情况，请为下节试卷讲评课准备分析要点。`,
        '',
        `考试：${exam.name}（${exam.date}，满分 ${fullScore}）`,
        stats ? `平均分 ${stats.average}，中位数 ${stats.median}，及格率 ${(stats.passRate * 100).toFixed(0)}%，优秀率 ${(stats.excellentRate * 100).toFixed(0)}%` : '',
        `各大题得分率：${rates.join('；')}`,
        classInfo ? `\n班级学情（学生姓名已隐去）：\n${classInfo}` : '',
        '',
        '要求：1) 指出 2~3 个失分最集中的知识块；2) 每个知识块给出讲评顺序与典型变式题；3) 给出课后跟进建议。'
      ]
        .filter(Boolean)
        .join('\n')
    }
    case 'student-remarks': {
      const cls = data.classes.find((c) => c.id === ctx.classId)
      if (!cls) return '请先选择一个班级。'
      const exam = [...data.exams].filter((e) => e.classIds.includes(cls.id)).sort((a, b) => b.date.localeCompare(a.date))[0]
      const fullScore = exam ? exam.sections.reduce((sum, s) => sum + s.fullScore, 0) : 0
      const lines = cls.students.map((student, i) => {
        const total = exam ? examTotal(exam, exam.scores[cls.id]?.[student.id]) : null
        return `学生${i + 1}${total !== null ? `（最近考试 ${total}/${fullScore}）` : ''}`
      })
      return [
        `你是一位经验丰富的${stage}${subject}教师，请为以下学生各写一段 50 字左右的学科评语。`,
        '',
        `学生名单（已匿名）：${anonymizedStudents(data, cls.id)}`,
        lines.join('\n'),
        '',
        '要求：以「学生1：……」的格式逐条输出；先肯定优点，再指出一个具体可改进点；语气亲切，避免空话。'
      ].join('\n')
    }
    default:
      return ''
  }
}

/** 调用自定义 OpenAI 兼容接口生成（未配置时返回 null） */
export async function generateViaApi(
  config: AppData['ai'],
  prompt: string
): Promise<string | null> {
  if (!config.baseUrl || !config.apiKey) return null
  const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '你是一位中国中小学任课教师的备课助手。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    })
  })
  if (!response.ok) throw new Error(`接口返回 ${response.status}`)
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
  return payload.choices?.[0]?.message?.content ?? null
}
