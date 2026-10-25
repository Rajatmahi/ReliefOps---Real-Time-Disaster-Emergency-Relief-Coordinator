import { useState } from 'react'
import { ShieldAlert, UserPlus, LogIn } from 'lucide-react'
import { api } from '../services/api'
import { Button, ErrorNotice, Field } from '../components/ui'

const roleLabels = { citizen: 'Reporter', coordinator: 'Coordinator', admin: 'Administrator' }

export default function LoginPage({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [loginRole, setLoginRole] = useState('citizen')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function switchMode(next) {
    setMode(next); setError('')
  }

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      if (mode === 'register') {
        if (password !== confirmPassword) throw new Error('The passwords do not match.')
        await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) })
      }
      const result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      if (mode === 'login' && result.user.role !== loginRole) {
        throw new Error(`This account has ${roleLabels[result.user.role] || result.user.role} access. Choose the matching sign-in option.`)
      }
      localStorage.setItem('access_token', result.access_token)
      onLogin(result.user)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return <div className="login-screen"><div className="login-art"><div className="login-brand"><ShieldAlert/><b>ReliefOps</b></div><div className="art-copy"><div className="eyebrow light">TEAM COORDINATION</div><h1>A shared workspace for your response team.</h1><p>Record incidents, verify information, coordinate teams, and track relief supplies in one place.</p></div><div className="art-footer">Your organization’s coordination workspace</div></div><div className="login-main"><form className="login-form" onSubmit={submit}>
    <div className="eyebrow">WORKSPACE ACCESS</div>
    <div className="auth-tabs" role="tablist" aria-label="Account access"><button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}><LogIn size={15}/>Sign in</button><button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}><UserPlus size={15}/>Reporter registration</button></div>
    {mode === 'login' ? <><h2>Sign in to your workspace</h2><p>Choose your access type. Your account permissions are checked by the server.</p><div className="role-options" aria-label="Sign-in access type">{['admin', 'coordinator', 'citizen'].map(role => <button type="button" key={role} className={loginRole === role ? 'selected' : ''} onClick={() => setLoginRole(role)}>{roleLabels[role]}</button>)}</div></> : <><h2>Create a reporter account</h2><p>New accounts can submit reports and view their own report history. An administrator creates coordinator and admin accounts.</p><Field label="Your name"><input required minLength="2" maxLength="120" autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Full name"/></Field></>}
    <ErrorNotice error={error}/><Field label="Email"><input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></Field><Field label="Password"><input type="password" required minLength={mode === 'register' ? 12 : 1} maxLength="128" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode === 'register' ? 'At least 12 characters' : 'Enter your password'}/></Field>
    {mode === 'register' && <Field label="Confirm password"><input type="password" required minLength="12" maxLength="128" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Enter your password again"/></Field>}
    <Button disabled={busy}>{busy ? 'Please wait…' : mode === 'register' ? 'Create reporter account' : `Sign in as ${roleLabels[loginRole]}`}</Button><div className="login-footnote">{mode === 'register' ? 'Admin and coordinator access is assigned by your organization administrator.' : loginRole === 'admin' ? 'First administrator? Create the initial admin with the private bootstrap command in the setup guide.' : 'Use the email and password associated with your organization account.'}</div>
  </form></div></div>
}
