import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { api } from './services/api'
import LoginPage from './pages/LoginPage'
import AppLayout from './layouts/AppLayout'
import DashboardPage from './pages/DashboardPage'
import ReportPage from './pages/ReportPage'
import MyReportsPage from './pages/MyReportsPage'
import IncidentPage from './pages/IncidentPage'
import TeamsPage from './pages/TeamsPage'
import AssignmentsPage from './pages/AssignmentsPage'
import UsersPage from './pages/UsersPage'
import CoordinatorApplicationPage from './pages/CoordinatorApplicationPage'
import AccountPage from './pages/AccountPage'

export default function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(Boolean(localStorage.getItem('access_token')))
  useEffect(() => {
    if (!localStorage.getItem('access_token')) return
    api('/api/auth/me').then(setUser).catch((error) => { if (error.status === 401) localStorage.removeItem('access_token') }).finally(() => setChecking(false))
  }, [])
  useEffect(() => {
    if (!user) return
    let active = true
    let running = false
    const syncAccount = async () => {
      if (running || document.visibilityState === 'hidden') return
      running = true
      try { const fresh = await api('/api/auth/me'); if (active) setUser(fresh) }
      catch (error) { if (active && error.status === 401) { localStorage.removeItem('access_token'); setUser(null) } }
      finally { running = false }
    }
    const timer = window.setInterval(syncAccount, 30000)
    const onVisibility = () => { if (document.visibilityState === 'visible') syncAccount() }
    window.addEventListener('focus', syncAccount)
    document.addEventListener('visibilitychange', onVisibility)
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', syncAccount); document.removeEventListener('visibilitychange', onVisibility) }
  }, [user?.id])
  if (checking) return <div className="screen-center"><span className="spinner"/>Loading your workspace…</div>
  if (!user) return <Routes><Route path="/login" element={<LoginPage onLogin={setUser}/>} /><Route path="*" element={<LoginPage onLogin={setUser}/>} /></Routes>
  return <Routes><Route element={<AppLayout user={user} onLogout={() => { localStorage.removeItem('access_token'); setUser(null) }}/>}>
    <Route index element={<DashboardPage user={user}/>} />
    <Route path="report" element={<ReportPage user={user}/>}/>
    <Route path="my-reports" element={<MyReportsPage/>} />
    <Route path="incidents/:id" element={<IncidentPage user={user}/>} />
    <Route path="teams" element={user.role !== 'citizen' ? <TeamsPage user={user}/> : <Navigate to="/" replace/>} />
    <Route path="assignments" element={user.role !== 'citizen' ? <AssignmentsPage user={user}/> : <Navigate to="/" replace/>} />
    <Route path="team-access" element={user.role === 'admin' ? <UsersPage user={user}/> : <Navigate to="/" replace/>} />
    <Route path="account" element={<AccountPage user={user} onUserChange={setUser}/>}/>
    <Route path="coordinator-application" element={user.role === 'citizen' ? <CoordinatorApplicationPage/> : <Navigate to="/" replace/>} />
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Route></Routes>
}
