import { Routes, Route } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { AuthProvider, useAuth } from './auth/AuthContext'
import Login from './auth/Login'
import { DataProvider } from './data/DataContext'
import { StudentsProvider, useStudents } from './students/StudentsContext'
import StudentsList from './students/StudentsList'
import Onboarding from './students/Onboarding'
import Sidebar from './components/Sidebar'
import Overview from './pages/Overview'
import Universities from './pages/Universities'
import UniversityDetail from './pages/UniversityDetail'
import Essays from './pages/Essays'
import EssayWorkspace from './pages/EssayWorkspace'
import Interviews from './pages/Interviews'
import CostAnalysis from './pages/CostAnalysis'
import Activities from './pages/Activities'
import Calendar from './pages/Calendar'
import Compare from './pages/Compare'
import Verification from './pages/Verification'
import CuratorBoard from './curator/CuratorBoard'
import ReviewDraft from './curator/ReviewDraft'

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}

function Loader() {
  return (
    <div className="grid min-h-screen place-items-center bg-ink-50">
      <div className="grid h-12 w-12 animate-pulse place-items-center rounded-2xl bg-brand-600 text-white">
        <GraduationCap size={26} />
      </div>
    </div>
  )
}

function Gate() {
  const { session, ready } = useAuth()
  if (!ready) return <Loader />
  if (!session) return <Login />
  return (
    <StudentsProvider>
      <AfterAuth />
    </StudentsProvider>
  )
}

function AfterAuth() {
  const { ready, currentId } = useStudents()
  if (!ready) return <Loader />

  // no active student yet → go straight to onboarding
  if (!currentId) {
    return (
      <div className="min-h-screen bg-ink-50">
        <Onboarding standalone />
      </div>
    )
  }

  return (
    <DataProvider>
      <div className="min-h-screen">
        <Sidebar />
        <main className="ml-64 min-h-screen">
          <div className="mx-auto max-w-7xl px-8 py-8">
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/universities" element={<Universities />} />
              <Route path="/university/:id" element={<UniversityDetail />} />
              <Route path="/essays" element={<Essays />} />
              <Route path="/essay/:id" element={<EssayWorkspace />} />
              <Route path="/interviews" element={<Interviews />} />
              <Route path="/cost" element={<CostAnalysis />} />
              <Route path="/activities" element={<Activities />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/verification" element={<Verification />} />
              <Route path="/students" element={<StudentsList />} />
              <Route path="/students/new" element={<Onboarding />} />
              <Route path="/curator" element={<CuratorBoard />} />
              <Route path="/curator/review/:id" element={<ReviewDraft />} />
            </Routes>
          </div>
        </main>
      </div>
    </DataProvider>
  )
}
