import { useState } from 'react'
import { Copy, KeyRound, Sparkles, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { useData, useAppStore } from '@/store/app-store'
import { AI_TEMPLATES, buildPrompt, generateViaApi } from '@/lib/prompts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/** AI 助手：备课模板 → 组装提示词（复制给常用 AI，或配置接口直接生成） */
export default function AiPage(): JSX.Element {
  const data = useData()
  const mutate = useAppStore((state) => state.mutate)

  const [templateId, setTemplateId] = useState(AI_TEMPLATES[0].id)
  const [classId, setClassId] = useState(data.classes[0]?.id ?? '')
  const [topic, setTopic] = useState('')
  const [hours, setHours] = useState('1')
  const [lessonType, setLessonType] = useState('新授课')
  const [extra, setExtra] = useState('')
  const [result, setResult] = useState('')
  const [generating, setGenerating] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [configForm, setConfigForm] = useState(data.ai)

  const template = AI_TEMPLATES.find((t) => t.id === templateId) ?? AI_TEMPLATES[0]
  const prompt = buildPrompt(data, templateId, {
    topic,
    hours,
    lessonType,
    classId,
    extra
  })

  const copyPrompt = async (): Promise<void> => {
    if (!prompt.trim()) return
    await navigator.clipboard.writeText(prompt)
    toast.success('提示词已复制，粘贴给常用的 AI 即可')
  }

  const generate = async (): Promise<void> => {
    if (!data.ai.baseUrl || !data.ai.apiKey) {
      toast.error('先在「接口配置」里填写 API 地址与密钥，或直接复制提示词')
      setConfigOpen(true)
      return
    }
    setGenerating(true)
    try {
      const text = await generateViaApi(data.ai, prompt)
      if (text) {
        setResult(text)
        toast.success('已生成，请核对后再使用')
      } else {
        toast.error('接口没有返回内容')
      }
    } catch (error) {
      toast.error(`生成失败：${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setGenerating(false)
    }
  }

  const saveConfig = (): void => {
    mutate((draft) => {
      draft.ai = { ...configForm }
    })
    toast.success('接口配置已保存（密钥仅保存在本机）')
    setConfigOpen(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight">AI 助手</h1>
          <p className="text-[12.5px] text-muted-foreground">
            备课教案、分层作业、试卷分析、学科评语——生成结果需教师核对，不直接当定稿
          </p>
        </div>
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => setConfigOpen(true)}>
          <KeyRound className="size-3.5" />
          接口配置
        </Button>
      </div>

      {/* 模板选择 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {AI_TEMPLATES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTemplateId(item.id)
              setResult('')
            }}
            className={cn(
              'rounded-2xl border p-4 text-left transition-all',
              templateId === item.id
                ? 'border-primary/50 bg-primary/5 shadow-sm'
                : 'border-border/80 bg-card hover:border-border hover:shadow-sm'
            )}
          >
            <p className="flex items-center gap-1.5 text-[13.5px] font-semibold">
              <Sparkles className={cn('size-4', templateId === item.id ? 'text-primary' : 'text-muted-foreground')} />
              {item.title}
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{item.description}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        {/* 参数 */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-[14px] font-semibold">选择任务参数</h2>
          <div className="space-y-4">
            {(template.fields.includes('topic') || template.id === 'lesson-plan') && (
              <div className="space-y-1.5">
                <Label htmlFor="ai-topic">课题</Label>
                <Input
                  id="ai-topic"
                  placeholder="如：14.2 乘法公式"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                />
              </div>
            )}
            {template.fields.includes('hours') && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>课时</Label>
                  <div className="flex gap-1.5">
                    {['1', '2'].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setHours(value)}
                        className={cn(
                          'flex-1 rounded-lg border px-2 py-1.5 text-[12.5px] transition-colors',
                          hours === value
                            ? 'border-primary/50 bg-primary/10 font-medium text-primary'
                            : 'border-border text-muted-foreground hover:bg-secondary/50'
                        )}
                      >
                        {value} 课时
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>课型</Label>
                  <div className="flex gap-1.5">
                    {['新授课', '复习课'].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setLessonType(value)}
                        className={cn(
                          'flex-1 rounded-lg border px-2 py-1.5 text-[12px] transition-colors',
                          lessonType === value
                            ? 'border-primary/50 bg-primary/10 font-medium text-primary'
                            : 'border-border text-muted-foreground hover:bg-secondary/50'
                        )}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>参考哪个班的学情</Label>
              <div className="flex flex-wrap gap-1.5">
                {data.classes.map((cls) => (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => setClassId(cls.id)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-[12.5px] transition-colors',
                      classId === cls.id
                        ? 'border-primary/50 bg-primary/10 font-medium text-primary'
                        : 'border-border text-muted-foreground hover:bg-secondary/50'
                    )}
                  >
                    {cls.name}
                  </button>
                ))}
                {data.classes.length === 0 && (
                  <p className="text-[12px] text-muted-foreground">还没有班级，提示词将不包含班级学情</p>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                会把这个班的进度、成绩、作业情况一起发给 AI（学生姓名自动替换为编号）
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ai-extra">其他要求</Label>
              <Input
                id="ai-extra"
                placeholder="选填：比如要有小组合作环节"
                value={extra}
                onChange={(event) => setExtra(event.target.value)}
              />
            </div>
          </div>
        </div>

        {/* 提示词 / 结果 */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[14px] font-semibold">{result ? '生成结果' : '提示词预览'}</h2>
            <div className="flex gap-1.5">
              {!result && (
                <Button size="sm" variant="outline" onClick={() => void copyPrompt()}>
                  <Copy className="size-3.5" />
                  复制提示词
                </Button>
              )}
              <Button size="sm" onClick={() => void generate()} disabled={generating}>
                <Wand2 className="size-3.5" />
                {generating ? '生成中…' : data.ai.baseUrl ? '生成' : '配置接口后可生成'}
              </Button>
            </div>
          </div>
          <textarea
            className="h-72 w-full resize-none rounded-lg border border-border bg-secondary/30 p-3.5 text-[12.5px] leading-relaxed text-foreground/90 outline-none"
            value={result || prompt}
            readOnly={Boolean(result)}
            onChange={() => undefined}
          />
          {result && (
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setResult('')
                }}
              >
                返回提示词
              </Button>
              <Button size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(result)}>
                <Copy className="size-3.5" />
                复制结果
              </Button>
            </div>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            教案、题目和评语都需要老师核对；发送前请检查是否包含敏感信息，隐去姓名并不等于完全匿名。
          </p>
        </div>
      </div>

      {/* 接口配置 */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>AI 接口配置</DialogTitle>
            <DialogDescription>
              可选。配置 OpenAI 兼容接口后可直接在工作台生成；不配置也随时可以复制提示词
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ai-url">API 地址</Label>
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
            <p className="text-[11px] text-muted-foreground">密钥只保存在本机数据文件中，不会上传</p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfigOpen(false)}>
              取消
            </Button>
            <Button size="sm" onClick={saveConfig}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
