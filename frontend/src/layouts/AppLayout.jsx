import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Activity, ClipboardList, FileCheck2, FilePlus2, Gauge, KeyRound, LogOut, ShieldAlert, Users, UserCog } from 'lucide-react'

const links = [
  { to: '/', label: 'Operations overview', icon: Gauge, roles: ['admin','coordinator'] },
  { to: '/report', label: 'Report emergency', icon: FilePlus2, roles: ['citizen','admin','coordinator'] },
  { to: '/my-reports', label: 'My reports', icon: ClipboardList, roles: ['citizen'] },
  { to: '/coordinator-application', label: 'Coordinator application', icon: FileCheck2, roles: ['citizen','coordinator'] },
  { to: '/teams', label: 'Rescue teams', icon: Users, roles: ['admin','coordinator'] },
  { to: '/assignments', label: 'Assignments', icon: Activity, roles: ['admin','coordinator'] },
  { to: '/team-access', label: 'Team access', icon: UserCog, roles: ['admin'] },
  { to: '/account', label: 'My account', icon: KeyRound, roles: ['admin','coordinator','citizen'] },
]

const roleLabel = { citizen: 'reporter', coordinator: 'coordinator', admin: 'administrator' }

export default function AppLayout({ user, onLogout }) {
  const location = useLocation()
  const active = links.find((link) => link.to !== '/' && location.pathname.startsWith(link.to))
  const title = active?.label || (user.role === 'citizen' ? 'Community portal' : user.role === 'coordinator' ? 'Dispatch overview' : 'Control room overview')
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><ShieldAlert size={22}/></div><div><strong>ReliefOps</strong><small>Emergency coordination</small></div></div>
      <div className="side-label">WORKSPACE</div>
      <nav>{links.filter((link) => link.roles.includes(user.role)).map(({to,label,icon:Icon}) => <NavLink end={to === '/'} to={to} className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`} key={to}><Icon size={18}/><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="demo-indicator"><span/> Workspace active <small>Manage your organization’s records</small></div><div className="profile"><div className="avatar">{user.name?.slice(0,1).toUpperCase()}</div><div className="profile-text"><b>{user.name}</b><span>{roleLabel[user.role] || user.role}</span></div><button className="icon-button" title="Sign out" onClick={onLogout}><LogOut size={17}/></button></div></div>
    </aside>
    <main className="main-panel"><header className="topbar"><div className="mobile-brand"><ShieldAlert size={18}/> ReliefOps</div><div className="breadcrumb">Emergency Operations <span>/</span> <b>{title}</b></div><div className="topbar-right"><span className="live-dot"/> Organization workspace</div></header><div className="content-wrap"><Outlet/></div><footer className="footer-note">Coordination workspace · Confirm report details before taking operational action. This app does not contact emergency services.</footer></main>
  </div>
}
