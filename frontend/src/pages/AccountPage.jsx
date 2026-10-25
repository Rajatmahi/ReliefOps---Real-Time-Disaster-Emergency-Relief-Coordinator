import { useEffect, useState } from 'react'
import { KeyRound, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { api } from '../services/api'
import { Button, Card, ErrorNotice, Field, PageHeading, SuccessNotice } from '../components/ui'

const roleLabel = { citizen: 'Reporter', coordinator: 'Coordinator', admin: 'Administrator' }

export default function AccountPage({ user, onUserChange }) {
  const [name, setName] = useState(user.name || '')
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => { setName(user.name || '') }, [user.name])

  async function saveProfile(e) {
    e.preventDefault(); setError(''); setMessage(''); setSavingProfile(true)
    try {
      const updated = await api('/api/auth/me', { method: 'PATCH', body: JSON.stringify({ name: name.trim() }) })
      onUserChange?.(updated); setMessage('Your profile name has been updated.')
    } catch (err) { setError(err.message) } finally { setSavingProfile(false) }
  }

  async function changePassword(e) {
    e.preventDefault(); setError(''); setMessage('')
    if (passwordForm.new_password !== passwordForm.confirm_password) { setError('The new passwords do not match.'); return }
    setSavingPassword(true)
    try {
      await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password: passwordForm.current_password, new_password: passwordForm.new_password }) })
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' }); setMessage('Your password has been changed.')
    } catch (err) { setError(err.message) } finally { setSavingPassword(false) }
  }

  const initials = (user.name || user.email || 'U').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()

  return <div className="account-page">
    <PageHeading eyebrow="YOUR ACCOUNT" title="My account" description="Manage your profile details, sign-in security, and view your workspace access."/>
    <ErrorNotice error={error}/><SuccessNotice>{message}</SuccessNotice>
    <Card className="account-summary-card"><div className="account-avatar" aria-hidden="true">{initials}</div><div className="account-summary"><span className="eyebrow">WORKSPACE PROFILE</span><h2>{user.name}</h2><p><Mail size={14}/>{user.email}</p></div><div className="account-summary-access"><span><ShieldCheck size={15}/>{roleLabel[user.role] || user.role}</span><small>Workspace access</small></div></Card>
    <div className="account-settings-grid"><Card className="account-settings-card account-profile-card"><div className="section-head"><div className="account-section-heading"><span className="account-section-icon profile"><UserRound size={17}/></span><div><span className="eyebrow">PERSONAL DETAILS</span><h3>Profile information</h3></div></div><p>Update the name shown to your team. Your email and role are managed by the workspace.</p></div>
      <form className="account-profile-form" onSubmit={saveProfile}>
        <Field label="Full name"><input required minLength="2" maxLength="120" autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></Field>
        <Field label="Email address"><div className="account-readonly"><Mail size={15}/><span>{user.email}</span><small>Used to sign in</small></div></Field>
        <Field label="Workspace role"><div className="account-readonly"><ShieldCheck size={15}/><span>{roleLabel[user.role] || user.role}</span><small>Contact an administrator to change access</small></div></Field>
        <div className="account-form-actions"><span>Your profile details are visible to your organization.</span><Button disabled={savingProfile || name.trim() === user.name}>{savingProfile ? 'Saving…' : 'Save changes'}</Button></div>
      </form>
    </Card>
    <Card className="account-settings-card account-security-card"><div className="section-head"><div className="account-section-heading"><span className="account-section-icon security"><KeyRound size={17}/></span><div><span className="eyebrow">ACCOUNT PROTECTION</span><h3>Sign-in security</h3></div></div><p>Change your password regularly and never share it with teammates.</p></div>
      <form className="account-password-form" onSubmit={changePassword}>
        <Field label="Current password"><input required type="password" autoComplete="current-password" value={passwordForm.current_password} onChange={e=>setPasswordForm({...passwordForm,current_password:e.target.value})}/></Field>
        <Field label="New password"><input required type="password" minLength="12" maxLength="128" autoComplete="new-password" value={passwordForm.new_password} onChange={e=>setPasswordForm({...passwordForm,new_password:e.target.value})}/></Field>
        <Field label="Confirm new password"><input required type="password" minLength="12" maxLength="128" autoComplete="new-password" value={passwordForm.confirm_password} onChange={e=>setPasswordForm({...passwordForm,confirm_password:e.target.value})}/></Field>
        <div className="account-form-actions"><span>Use at least 12 characters.</span><Button disabled={savingPassword}>{savingPassword ? 'Updating…' : 'Update password'}</Button></div>
      </form>
    </Card></div>
  </div>
}
