import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import { useAppStore } from '@/store/app-store'
import OnboardingPage from '@/pages/onboarding'
import DashboardPage from '@/pages/dashboard'
import ClassroomPage from '@/pages/classroom'
import TimetablePage from '@/pages/timetable'
import ProgressPage from '@/pages/progress'
import AssignmentsPage from '@/pages/assignments'
import GradesPage from '@/pages/grades'
import StudentsPage from '@/pages/students'
import AiPage from '@/pages/ai'
import SettingsPage from '@/pages/settings'

function Splash(): JSX.Element {
  return (
    <div className="flex h-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-lg font-semibold text-primary-foreground shadow-lg shadow-primary/25">
          师
        </div>
        <p className="text-sm text-muted-foreground">正在载入本地数据…</p>
      </div>
    </div>
  )
}

export default function App(): JSX.Element {
  const ready = useAppStore((state) => state.ready)
  const hydrate = useAppStore((state) => state.hydrate)
  const onboarded = useAppStore((state) => state.data.teacher.onboarded)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  if (!ready) return <Splash />

  // 首次使用：先走欢迎向导
  if (!onboarded) return <OnboardingPage />

  return (
    <>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="classroom" element={<ClassroomPage />} />
          <Route path="timetable" element={<TimetablePage />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="assignments" element={<AssignmentsPage />} />
          <Route path="grades" element={<GradesPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="ai" element={<AiPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster position="bottom-right" richColors closeButton toastOptions={{ duration: 2400 }} />
    </>
  )
}
