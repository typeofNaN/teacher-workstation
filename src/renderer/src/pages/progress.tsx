import { useState } from 'react'
import { toast } from 'sonner'
import { Check, ListChecks, Plus, Trash2 } from 'lucide-react'
import { useData, useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { cn, uid } from '@/lib/utils'

/** 教学进度：一份课题清单，各班分别标记完成情况 */
export default function ProgressPage(): JSX.Element {
  const data = useData()
  const mutate = useAppStore((state) => state.mutate)

  const [topicOpen, setTopicOpen] = useState(false)
  const [topicForm, setTopicForm] = useState({ id: '', name: '', hours: '1' })
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const openNewTopic = (): void => {
    setTopicForm({ id: '', name: '', hours: '1' })
    setTopicOpen(true)
  }

  const submitTopic = (): void => {
    const name = topicForm.name.trim()
    if (!name) {
      toast.error('请填写课题名称')
      return
    }
    const hours = Math.max(1, Number(topicForm.hours) || 1)
    mutate((draft) => {
      if (topicForm.id) {
        const topic = draft.topics.find((t) => t.id === topicForm.id)
        if (topic) {
          topic.name = name
          topic.hours = hours
        }
      } else {
        draft.topics.push({ id: uid('t'), name, hours })
      }
    })
    toast.success(topicForm.id ? '课题已更新' : '课题已添加')
    setTopicOpen(false)
  }

  /** 把某班的进度精确推进到「下一个未完成课题」的索引 */
  const markTopicDone = (classId: string): void => {
    const done = data.progress[classId]?.length ?? 0
    const topic = data.topics[done]
    if (!topic) return
    mutate((draft) => {
      const list = draft.progress[classId] ?? (draft.progress[classId] = [])
      if (!list.includes(topic.id)) list.push(topic.id)
    })
    toast.success(`${data.classes.find((c) => c.id === classId)?.name}：「${topic.name}」已标记完成`)
  }

  const undoTopic = (classId: string): void => {
    const list = data.progress[classId] ?? []
    const last = data.topics[list.length - 1]
    if (!last) return
    mutate((draft) => {
      draft.progress[classId] = (draft.progress[classId] ?? []).filter((id) => id !== last.id)
    })
    toast.success(`已撤回「${last.name}」`)
  }

  const totalHours = data.topics.reduce((sum, topic) => sum + topic.hours, 0)
  const doneHours = (classId: string): number => {
    const ids = data.progress[classId] ?? []
    return data.topics.filter((topic) => ids.includes(topic.id)).reduce((sum, topic) => sum + topic.hours, 0)
  }

  // 以第一个班为基准，给各班标注快慢
  const baseDone = data.classes[0] ? (data.progress[data.classes[0].id]?.length ?? 0) : 0

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight">教学进度</h1>
          <p className="text-[12.5px] text-muted-foreground">
            {data.topics.length > 0
              ? `${data.topics.length} 个课题 · 共 ${totalHours} 课时`
              : '把教学计划中的课题与课时贴进来，各班分别标记'}
          </p>
        </div>
        <Button size="sm" className="ml-auto" onClick={openNewTopic}>
          <Plus className="size-3.5" />
          添加课题
        </Button>
      </div>

      {data.topics.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
          <ListChecks className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-3 text-[13.5px] font-medium">还没有课题清单</p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">添加后，每个班可以独立标记讲到哪里</p>
          <Button size="sm" className="mt-4" onClick={openNewTopic}>
            <Plus className="size-3.5" />
            添加第一个课题
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card shadow-sm">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="border-b border-border/60 text-left text-[12px] text-muted-foreground">
                <th className="px-5 py-3 font-medium">课题</th>
                <th className="w-16 px-3 py-3 font-medium">课时</th>
                {data.classes.map((cls) => (
                  <th key={cls.id} className="px-4 py-3 font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full" style={{ backgroundColor: cls.color }} />
                      {cls.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.topics.map((topic, index) => (
                <tr key={topic.id} className="border-b border-border/40 last:border-0 hover:bg-secondary/30">
                  <td className="px-5 py-2.5">
                    <span className="mr-2 text-[11px] text-muted-foreground/60">{index + 1}</span>
                    <button
                      type="button"
                      className="hover:text-primary hover:underline"
                      onClick={() => {
                        setTopicForm({ id: topic.id, name: topic.name, hours: String(topic.hours) })
                        setTopicOpen(true)
                      }}
                    >
                      {topic.name}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{topic.hours}</td>
                  {data.classes.map((cls) => {
                    const done = data.progress[cls.id]?.includes(topic.id) ?? false
                    const isCurrent = !done && (data.progress[cls.id]?.length ?? 0) === index
                    return (
                      <td key={cls.id} className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              mutate((draft) => {
                                const list = draft.progress[cls.id] ?? (draft.progress[cls.id] = [])
                                if (done) {
                                  draft.progress[cls.id] = list.filter((id) => id !== topic.id)
                                } else {
                                  if (!list.includes(topic.id)) list.push(topic.id)
                                }
                              })
                            }}
                            className={cn(
                              'flex size-5 items-center justify-center rounded-md border transition-colors',
                              done
                                ? 'border-transparent bg-emerald-500 text-white'
                                : isCurrent
                                  ? 'border-primary/50 ring-1 ring-primary/30'
                                  : 'border-border hover:border-primary/40'
                            )}
                            title={done ? '点击撤回' : '标记完成'}
                          >
                            {done && <Check className="size-3" />}
                          </button>
                          {isCurrent && <span className="text-[11px] text-primary">当前</span>}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border/60 bg-secondary/30 text-[12px]">
                <td className="px-5 py-3 font-medium">进度概览</td>
                <td className="px-3 py-3 text-muted-foreground">{totalHours} 课时</td>
                {data.classes.map((cls) => {
                  const done = data.progress[cls.id]?.length ?? 0
                  const diff = done - baseDone
                  return (
                    <td key={cls.id} className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {done}/{data.topics.length}
                        </span>
                        <Badge variant={diff === 0 ? 'secondary' : diff > 0 ? 'success' : 'warning'}>
                          {diff === 0 ? '进度正常' : diff > 0 ? `快 ${diff} 个课题` : `慢 ${Math.abs(diff)} 个课题`}
                        </Badge>
                        {done < data.topics.length && (
                          <button
                            type="button"
                            className="text-primary hover:underline"
                            onClick={() => markTopicDone(cls.id)}
                          >
                            标记当前
                          </button>
                        )}
                        {done > 0 && (
                          <button type="button" className="text-muted-foreground hover:underline" onClick={() => undoTopic(cls.id)}>
                            撤回
                          </button>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        已完成 {doneHours(cls.id)} 课时
                      </p>
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* 添加 / 编辑课题 */}
      <Dialog open={topicOpen} onOpenChange={setTopicOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{topicForm.id ? '编辑课题' : '添加课题'}</DialogTitle>
            <DialogDescription>课题按清单顺序推进，各班独立标记</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="topic-name">课题名称</Label>
              <Input
                id="topic-name"
                placeholder="如：14.2 乘法公式"
                value={topicForm.name}
                onChange={(event) => setTopicForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="topic-hours">课时数</Label>
              <Input
                id="topic-hours"
                type="number"
                min={1}
                value={topicForm.hours}
                onChange={(event) => setTopicForm((prev) => ({ ...prev, hours: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            {topicForm.id && (
              <Button variant="destructive" size="sm" onClick={() => setDeleteId(topicForm.id)}>
                <Trash2 className="size-3.5" />
                删除课题
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setTopicOpen(false)}>
              取消
            </Button>
            <Button size="sm" onClick={submitTopic}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        title="删除课题"
        description="删除后各班的进度标记会同步清除，已登记的课时统计会重新计算。确定删除吗？"
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => {
          mutate((draft) => {
            draft.topics = draft.topics.filter((topic) => topic.id !== deleteId)
            for (const classId of Object.keys(draft.progress)) {
              draft.progress[classId] = (draft.progress[classId] ?? []).filter((id) => id !== deleteId)
            }
          })
          setDeleteId(null)
          setTopicOpen(false)
          toast.success('课题已删除')
        }}
      />
    </div>
  )
}
