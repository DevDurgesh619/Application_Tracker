import { Routes, Route } from 'react-router-dom'
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
  )
}
