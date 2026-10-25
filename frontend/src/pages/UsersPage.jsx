import { useEffect, useState } from 'react'
import { CalendarDays, Mail, UserPlus, UserRound } from 'lucide-react'
import { api } from '../services/api'
import { useLiveRefresh } from '../services/useLiveRefresh'
import { Button, Card, ErrorNotice, Field, PageHeading, SuccessNotice } from '../components/ui'

const blank = { name: '', email: '', password: '', role: 'coordinator' }
const roleLabel = { citizen: 'Reporter', coordinator: 'Coordinator', admin: 'Administrator' }

export default function UsersPage({ user }) {
  const [users, setUsers] = useState([])
  const [applications, setApplications] = useState([])
  const [form, setForm] = useState(blank)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '' })
  const [resetting, setResetting] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [reviewing, setReviewing] = useState(null)
  const [reviewReason, setReviewReason] = useState('')
  const [reviewBusy, setReviewBusy] = useState(false)

  async function refresh() {
    try {
      const [accountRows, applicationRows] = await Promise.all([api('/api/users'), api('/api/coordinator-applications')])
      setUsers(accountRows); setApplications(applicationRows); setError('')
    } catch (e) { setError(e.message) }
  }
  useEffect(() => { refresh() }, [])
  useLiveRefresh(refresh)

  async function create(e) {
    e.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      await api('/api/users', { method: 'POST', body: JSON.stringify(form) })
      setForm(blank); setMessage('Team account created. Share its initial password with that teammate through a private channel, and ask them to change it after signing in.'); await refresh()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function saveRole(account, role) {
    setError(''); setMessage('')
    try { await api(`/api/users/${account.id}`, { method: 'PATCH', body: JSON.stringify({ role }) }); setMessage(`Access updated for ${account.email}.`); await refresh() }
    catch (err) { setError(err.message) }
  }

  async function changePassword(e) {
    e.preventDefault(); setError(''); setMessage('')
    try { await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify(passwordForm) }); setPasswordForm({ current_password: '', new_password: '' }); setMessage('Your password has been changed.') }
    catch (err) { setError(err.message) }
  }

  async function resetPassword(e, account) {
    e.preventDefault(); setError(''); setMessage('')
    try { await api(`/api/users/${account.id}`, { method: 'PATCH', body: JSON.stringify({ password: newPassword }) }); setResetting(null); setNewPassword(''); setMessage(`Password reset for ${account.email}. Share the new password privately.`) }
    catch (err) { setError(err.message) }
  }

  function openReview(application, decision) {
    setError(''); setMessage('')
    setReviewReason('')
    setReviewing({ application, decision })
  }

  async function reviewApplication(e) {
    e.preventDefault()
    if (!reviewing || reviewBusy) return
    const { application, decision } = reviewing
    const reason = reviewReason.trim()
    if (decision === 'reject' && !reason) return
    setReviewBusy(true); setError(''); setMessage('')
    try {
      await api(`/api/coordinator-applications/${application.id}/review`, { method: 'PATCH', body: JSON.stringify({ decision, reason: reason || null }) })
      setMessage(decision === 'approve' ? `${application.applicant_name} is now a coordinator. Create and assign a response team to their account.` : `Application from ${application.applicant_name} was declined.`)
      setReviewing(null); setReviewReason('')
      await refresh()
    } catch (e) { setError(e.message) } finally { setReviewBusy(false) }
  }

  return <>
    <PageHeading eyebrow="WORKSPACE ADMINISTRATION" title="Team access" description="Create accounts for your organization and control each person’s access." />
    <ErrorNotice error={error}/><SuccessNotice>{message}</SuccessNotice>
    <Card className="applications-panel"><div className="section-head"><div><h3>Coordinator applications</h3><p>Review each request before granting dispatch access. Approval changes the reporter’s role; it does not create or assign a response team.</p></div><span className="application-count">{applications.filter(application=>application.status==='pending').length} pending</span></div>{applications.filter(application=>application.status==='pending').length ? <div className="application-list">{applications.filter(application=>application.status==='pending').map((application,index)=><article className="coordinator-request-card" key={application.id}>
      <div className="request-card-heading"><div><span className="request-index">REQUEST {String(index+1).padStart(2,'0')}</span><h4>Coordinator access request</h4></div><span className="request-pending">Awaiting review</span></div>
      <div className="request-identity-grid"><div className="request-field"><span><UserRound size={14}/>Applicant name</span><strong>{application.applicant_name}</strong></div><div className="request-field"><span><Mail size={14}/>Email address</span><strong className="request-email">{application.applicant_email}</strong></div><div className="request-field"><span><CalendarDays size={14}/>Submitted</span><strong>{new Date(application.submitted_at).toLocaleString()}</strong></div></div>
      <div className="request-details"><div className="request-detail"><span>Why they want coordinator access</span><p>{application.motivation}</p></div><div className="request-detail"><span>Relevant experience</span><p>{application.experience || 'No experience details provided.'}</p></div></div>
      <div className="request-review"><span>Admin decision</span><div><Button variant="small" onClick={()=>openReview(application,'approve')}>Approve application</Button><Button variant="small" onClick={()=>openReview(application,'reject')}>Decline with reason</Button></div></div>
    </article>)}</div> : <div className="application-empty"><div className="application-empty-icon"><UserRound size={20}/></div><b>No applications waiting</b><p>New coordinator requests will appear here for your review.</p></div>}</Card>
    <Card className="inline-form-card"><div className="section-head"><div><h3>Add a teammate</h3><p>Use a unique email address and an initial password of at least 12 characters.</p></div></div>
      <form className="form-row align-end" onSubmit={create}>
        <Field label="Name"><input required minLength="2" maxLength="120" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field>
        <Field label="Email"><input required type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></Field>
        <Field label="Initial password"><input required type="password" minLength="12" maxLength="128" autoComplete="new-password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></Field>
        <Field label="Access role"><select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="coordinator">Coordinator</option><option value="admin">Administrator</option><option value="citizen">Reporter</option></select></Field>
        <Button disabled={busy}><UserPlus size={16}/>{busy?'Creating…':'Create account'}</Button>
      </form>
    </Card>
    <Card className="table-card"><div className="section-head"><div><h3>Workspace accounts</h3><p>Administrator accounts can manage the workspace and other accounts.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Access</th><th>Update access</th></tr></thead><tbody>{users.map(account=><tr key={account.id}><td>{account.name}{account.id===user.id?' (you)':''}</td><td>{account.email}</td><td><span className="stock-tag healthy">{roleLabel[account.role] || account.role}</span></td><td><select aria-label={`Access for ${account.email}`} value={account.role} onChange={e=>saveRole(account,e.target.value)} disabled={account.id===user.id}><option value="citizen">Reporter</option><option value="coordinator">Coordinator</option><option value="admin">Administrator</option></select>{account.id!==user.id&&<Button variant="small" onClick={()=>{setResetting(resetting===account.id?null:account.id);setNewPassword('')}}>Reset password</Button>}{resetting===account.id&&<form className="form-row" onSubmit={e=>resetPassword(e,account)}><input aria-label={`New password for ${account.email}`} type="password" minLength="12" maxLength="128" required value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="New password (12+ chars)"/><Button variant="small">Save password</Button></form>}</td></tr>)}</tbody></table></div>
    </Card>
    <Card className="inline-form-card"><div className="section-head"><div><h3>Change your password</h3><p>Use a unique password and do not share it with teammates.</p></div></div>
      <form className="form-row align-end" onSubmit={changePassword}>
        <Field label="Current password"><input required type="password" autoComplete="current-password" value={passwordForm.current_password} onChange={e=>setPasswordForm({...passwordForm,current_password:e.target.value})}/></Field>
        <Field label="New password"><input required type="password" minLength="12" maxLength="128" autoComplete="new-password" value={passwordForm.new_password} onChange={e=>setPasswordForm({...passwordForm,new_password:e.target.value})}/></Field>
        <Button>Change password</Button>
      </form>
    </Card>
    {reviewing && <div className="review-dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!reviewBusy)setReviewing(null)}}>
      <section className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="review-dialog-title" aria-describedby="review-dialog-description">
        <div className="review-dialog-heading"><span className={`review-dialog-icon ${reviewing.decision}`}>{reviewing.decision==='approve'?'✓':'!'}</span><div><span className="request-index">ADMIN REVIEW</span><h2 id="review-dialog-title">{reviewing.decision==='approve'?'Approve coordinator request':'Decline coordinator request'}</h2></div></div>
        <p id="review-dialog-description" className="review-dialog-description">{reviewing.decision==='approve'?`${reviewing.application.applicant_name} will receive coordinator access and be able to work on verified incidents.`:'Add a reason so the applicant understands why their coordinator request was declined.'}</p>
        <div className="review-applicant"><span>Applicant</span><strong>{reviewing.application.applicant_name}</strong><small>{reviewing.application.applicant_email}</small></div>
        <form onSubmit={reviewApplication}>
          <Field label={reviewing.decision==='reject'?'Reason for declining':'Note for applicant (optional)'}><textarea autoFocus rows="4" maxLength="1000" required={reviewing.decision==='reject'} value={reviewReason} onChange={e=>setReviewReason(e.target.value)} placeholder={reviewing.decision==='reject'?'Explain what the applicant can improve…':'Add guidance or next steps…'}/></Field>
          {error&&<p className="review-dialog-error" role="alert">{error}</p>}
          <div className="review-dialog-actions"><Button type="button" variant="small" disabled={reviewBusy} onClick={()=>setReviewing(null)}>Cancel</Button><Button variant="small" disabled={reviewBusy||(reviewing.decision==='reject'&&!reviewReason.trim())} className={reviewing.decision==='reject'?'review-confirm-reject':'review-confirm-approve'}>{reviewBusy?'Saving decision…':reviewing.decision==='approve'?'Approve request':'Decline request'}</Button></div>
        </form>
      </section>
    </div>}
  </>
}
