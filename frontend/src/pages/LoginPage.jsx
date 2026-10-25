import { useState } from 'react'
import { ArrowRight, CheckCircle2, Eye, EyeOff, FilePlus2, LogIn, Radio, ShieldAlert, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { api } from '../services/api'
import { Button, ErrorNotice, Field } from '../components/ui'

const roleLabels = { citizen: 'Reporter', coordinator: 'Coordinator', admin: 'Administrator' }
const roleDetails = {
  admin: { icon: ShieldCheck, description: 'Manage operations' },
  coordinator: { icon: Users, description: 'Coordinate teams' },
  citizen: { icon: FilePlus2, description: 'Submit a report' },
}

export default function LoginPage({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [loginRole, setLoginRole] = useState('citizen')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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

  return <main className="login-screen">
    <section className="login-hero">
      <div className="login-brand"><span className="login-brand-mark"><ShieldAlert size={22}/></span><span><b>ReliefOps</b><small>EMERGENCY COORDINATION</small></span></div>
      <div className="login-hero-content"><div className="login-eyebrow"><Radio size={14}/> RESPONSE WORKSPACE</div><h1>Clarity when every moment matters.</h1><p>Bring incident reports, response teams, and operational decisions together in one coordinated workspace.</p>
        <div className="login-flow"><div><span className="flow-icon report-flow"><FilePlus2 size={17}/></span><span><b>Report</b><small>Capture what’s happening</small></span></div><i/><div><span className="flow-icon verify-flow"><CheckCircle2 size={17}/></span><span><b>Verify</b><small>Review trusted details</small></span></div><i/><div><span className="flow-icon coordinate-flow"><Users size={17}/></span><span><b>Coordinate</b><small>Connect the right teams</small></span></div></div>
      </div>
      <div className="hero-orb hero-orb-one"/><div className="hero-orb hero-orb-two"/>
    </section>
    <section className="login-panel"><form className="login-form" onSubmit={submit}>
      <div className="login-form-heading"><div className="login-form-icon"><ShieldAlert size={19}/></div><div className="eyebrow">SECURE WORKSPACE ACCESS</div><h2>{mode === 'login' ? 'Welcome back' : 'Join as a reporter'}</h2><p>{mode === 'login' ? 'Sign in to continue to your response workspace.' : 'Create an account to submit and follow incident reports.'}</p></div>
      <div className="auth-tabs" role="tablist" aria-label="Account access"><button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}><LogIn size={15}/>Sign in</button><button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}><UserPlus size={15}/>Reporter registration</button></div>
      {mode === 'login' ? <div className="role-picker"><div className="role-picker-heading"><b>Choose your access</b><small>Your account permissions are verified securely.</small></div><div className="role-options" aria-label="Sign-in access type">{['admin', 'coordinator', 'citizen'].map(role => {const Icon=roleDetails[role].icon;return <button type="button" key={role} aria-pressed={loginRole===role} className={loginRole === role ? `selected role-${role}` : ''} onClick={() => setLoginRole(role)}><span className="role-icon"><Icon size={17}/></span><b>{roleLabels[role]}</b><small>{roleDetails[role].description}</small></button>})}</div></div> : <><div className="register-note"><UserPlus size={16}/><span>Reporter accounts can submit reports and track their progress. Coordinator and administrator access is assigned by your organization.</span></div><Field label="Your name"><input required minLength="2" maxLength="120" autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Full name"/></Field></>}
      <div className="login-fields"><ErrorNotice error={error}/><Field label="Email address"><input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></Field><Field label="Password"><span className="login-password-input"><input type={showPassword ? 'text' : 'password'} required minLength={mode === 'register' ? 12 : 1} maxLength="128" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode === 'register' ? 'At least 12 characters' : 'Enter your password'}/><button type="button" className="login-password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></Field>{mode === 'register' && <Field label="Confirm password"><input type="password" required minLength="12" maxLength="128" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Enter your password again"/></Field>}</div>
      <Button disabled={busy} className="login-submit">{busy ? 'Please wait…' : mode === 'register' ? <>Create reporter account <ArrowRight size={16}/></> : <>Sign in as {roleLabels[loginRole]} <ArrowRight size={16}/></>}</Button>
      <div className="login-footnote">{mode === 'register' ? 'Admin and coordinator access is assigned by your organization administrator.' : loginRole === 'admin' ? 'First administrator? Create the initial admin with the private bootstrap command in the setup guide.' : 'Use the email and password associated with your organization account.'}</div>
    </form></section>
  </main>
}
