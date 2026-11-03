import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, GraduationCap } from 'lucide-react'
import type { AvatarKind } from '@shared/types'
import { createSeedData } from '@shared/defaults'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { SUBJECT_OPTIONS } from '@/lib/constants'

/**
 * 首次使用向导：
 * 选形象 → 称呼 → 任教学科 → 示例数据 / 直接开始。
 */
export default function OnboardingPage(): JSX.Element {
  const replaceData = useAppStore((state) => state.replaceData)
  const mutate = useAppStore((state) => state.mutate)
  const [avatar, setAvatar] = useState<AvatarKind>('female')
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('数学')

  const finish = (withDemo: boolean): void => {
    if (!name.trim()) {
      toast.error('先填一个称呼吧，比如「李老师」')
      return
    }
    if (withDemo) {
      const seed = createSeedData()
      void replaceData({
        ...seed,
        teacher: { ...seed.teacher, name: name.trim(), subject, avatar, onboarded: true }
      })
      toast.success('已载入示例数据，随时可以在设置中清空')
      return
    }
    mutate((draft) => {
      draft.teacher.name = name.trim()
      draft.teacher.subject = subject
      draft.teacher.avatar = avatar
      draft.teacher.onboarded = true
    })
    toast.success('工作台已就绪，先去「设置」建立任教班级')
  }

  return (
    <div className="flex h-full items-center justify-center bg-background px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-xl font-semibold text-primary-foreground shadow-lg shadow-primary/25">
            <GraduationCap className="size-7" />
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">你好，我是你的任课教师工作台</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">先选一个你的形象，它会出现在每个班的讲台上</p>
        </div>

        <div className="space-y-5 rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { kind: 'female', label: '女老师', emoji: '👩‍🏫' },
                { kind: 'male', label: '男老师', emoji: '👨‍🏫' }
              ] as const
            ).map((option) => (
              <button
                key={option.kind}
                type="button"
                onClick={() => setAvatar(option.kind)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl border px-4 py-4 text-[13px] font-medium transition-all',
                  avatar === option.kind
                    ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/30'
                    : 'border-border hover:border-border hover:bg-secondary/40'
                )}
              >
                <span className="text-2xl">{option.emoji}</span>
                {option.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="onboard-name">怎么称呼你</Label>
            <Input
              id="onboard-name"
              placeholder="如：李老师"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>任教学科</Label>
            <div className="flex flex-wrap gap-1.5">
              {SUBJECT_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSubject(option)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-[12.5px] transition-colors',
                    subject === option
                      ? 'border-primary/50 bg-primary/10 font-medium text-primary'
                      : 'border-border text-muted-foreground hover:bg-secondary/50'
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-2.5">
          <Button size="lg" className="w-full" onClick={() => finish(true)}>
            先看看示例数据
            <span className="ml-1 text-[12px] opacity-70">3 个班、课表、进度、作业和考试，随时可清空</span>
            <ArrowRight className="size-4" />
          </Button>
          <Button size="lg" variant="outline" className="w-full" onClick={() => finish(false)}>
            直接用我的班级
          </Button>
        </div>

        <p className="mt-6 text-center text-[11.5px] leading-relaxed text-muted-foreground">
          所有数据只保存在这台电脑里，支持导出备份与迁移
        </p>
      </div>
    </div>
  )
}
