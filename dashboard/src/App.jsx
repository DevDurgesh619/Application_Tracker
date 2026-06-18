import { Routes, Route } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { AuthProvider, useAuth } from './auth/AuthContext'
import Login from './auth/Login'
import { DataProvider } from './data/DataContext'
import Sidebar from './components/Sidebar'
import Overview from './pages/Overview'
import Universities from './pages/Universities'
import UniversityDetail from './pages/UniversityDetail'
import Essays from './pages/Essays'
import Interviews from './pages/Interviews'
import CostAnalysis from './pages/CostAnalysis'
import Activities from './pages/Activities'
import Calendar from './pages/Calendar'
import Compare from './pages/Compare'
import Verification from './pages/Verification'

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}

function Gate() {
  const { session, ready } = useAuth()
  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-50">
        <div className="grid h-12 w-12 animate-pulse place-items-center rounded-2xl bg-brand-600 text-white">
          <GraduationCap size={26} />
        </div>
      </div>
    )
  }
  if (!session) return <Login />

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
              <Route path="/interviews" element={<Interviews />} />
              <Route path="/cost" element={<CostAnalysis />} />
              <Route path="/activities" element={<Activities />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/verification" element={<Verification />} />
            </Routes>
          </div>
        </main>
      </div>
    </DataProvider>
  )
}
