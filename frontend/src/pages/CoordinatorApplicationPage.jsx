import { useEffect, useState } from 'react'
import { BadgeCheck, ClipboardCheck, Clock3, FileCheck2, LockKeyhole, Send, ShieldCheck, UserRoundCheck } from 'lucide-react'
import { api } from '../services/api'
import { useLiveRefresh } from '../services/useLiveRefresh'
import { Button, Card, ErrorNotice, Field, Loading, PageHeading, SuccessNotice, StatusPill } from '../components/ui'

export default function CoordinatorApplicationPage() {
  const [applications, setApplications] = useState([])
  const [motivation, setMotivation] = useState('')
  const [experience, setExperience] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function refresh() {
    try { setApplications(await api('/api/coordinator-applications/mine')); setError('') }
    catch (e) { setError(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])
  useLiveRefresh(refresh)

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      await api('/api/coordinator-applications', { method: 'POST', body: JSON.stringify({ motivation, experience: experience || null }) })
      setMotivation(''); setExperience(''); setMessage('Your application was sent to the administrators for review.'); await refresh()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const pending = applications.some(application => application.status === 'pending')
  const canApply = !pending && !applications.some(application => application.status === 'approved')
  const decided = applications.find(application => ['approved', 'rejected'].includes(application.status))
  return <>
    <PageHeading eyebrow="ROLE REQUEST" title="Coordinator access" description="Request permission to coordinate response teams and verified incidents in your organization."/>
    <ErrorNotice error={error}/><SuccessNotice>{message}</SuccessNotice>
    <section className={`application-process-card${pending ? ' is-pending' : decided?.status === 'approved' ? ' is-approved' : ''}`} aria-label="Coordinator access request steps">
      <div className="application-process-intro"><span className="application-shield"><ShieldCheck size={22}/></span><div><span className="eyebrow">CLEAR REVIEW PROCESS</span><h2>{pending ? 'Your request is with the administrator' : decided?.status === 'approved' ? 'Coordinator access approved' : 'How coordinator access works'}</h2><p>{pending ? 'Your application is in the review queue. Your current account permissions stay the same until a decision is made.' : decided?.status === 'approved' ? 'Your organization approved the request. Refresh your sign-in to load coordinator permissions.' : 'Send a short application, wait for an administrator’s decision, then use coordinator tools if approved.'}</p></div></div>
      <ol className="application-steps">
        <li className={!pending && decided?.status !== 'approved' ? 'current' : 'complete'}><span>{!pending && decided?.status !== 'approved' ? <ClipboardCheck size={15}/> : <BadgeCheck size={15}/>}</span><div><b>1. Apply</b><small>Share your responsibilities</small></div></li>
        <li className={pending ? 'current' : decided?.status === 'approved' ? 'complete' : ''}><span>{pending ? <Clock3 size={15}/> : <ShieldCheck size={15}/>}</span><div><b>2. Admin review</b><small>Access is reviewed by your organization</small></div></li>
        <li className={decided?.status === 'approved' ? 'complete' : ''}><span><UserRoundCheck size={15}/></span><div><b>3. Coordinator access</b><small>Granted after approval</small></div></li>
      </ol>
    </section>
    {!loading && canApply && <Card className="application-form-card"><div className="application-form-heading"><div><span className="eyebrow">YOUR APPLICATION</span><h2>Tell us about your role</h2><p>Give the administrator enough context to understand your responsibilities and experience.</p></div><span className="application-private"><LockKeyhole size={14}/> Organization review</span></div><form className="form-stack application-form" onSubmit={submit}>
      <Field label="What coordination work will you handle? *"><textarea required minLength="30" maxLength="3000" rows="5" value={motivation} onChange={e=>setMotivation(e.target.value)} placeholder="For example: coordinate local rescue teams, review verified incidents, and keep response progress up to date."/><small className={`application-character-count${motivation.length > 0 && motivation.trim().length < 30 ? ' needs-more' : ''}`}>{motivation.trim().length} / 30 minimum · Up to 3,000 characters</small></Field>
      <Field label="Relevant experience or training · Optional"><textarea maxLength="3000" rows="4" value={experience} onChange={e=>setExperience(e.target.value)} placeholder="Add relevant training, team experience, certifications, or your role in the organization."/><small className="application-character-count">This helps the administrator review your request.</small></Field>
      <div className="application-submit-row"><p><ShieldCheck size={16}/> Sending this request does not change your current access. Only an administrator can approve it.</p><Button disabled={busy || motivation.trim().length < 30}><Send size={16}/>{busy ? 'Sending request…' : 'Submit for review'}</Button></div>
    </form></Card>}
    {loading ? <Loading/> : applications.map(application => <Card className="application-status-card" key={application.id}><div className="section-head"><div><span className="eyebrow">YOUR REQUEST</span><h3>Coordinator application</h3><p>Submitted {new Date(application.submitted_at).toLocaleString()}</p></div><StatusPill value={application.status}/></div><div className="application-status-copy"><div><span>Coordination responsibilities</span><p>{application.motivation}</p></div>{application.experience && <div><span>Relevant experience</span><p>{application.experience}</p></div>}{application.review_reason && <div className="application-admin-feedback"><span>Administrator feedback</span><p>{application.review_reason}</p></div>}{application.status === 'approved' && <div className="application-approved-note"><FileCheck2 size={17}/><p>Your account has coordinator access. Sign out and sign in again to refresh your workspace permissions.</p></div>}</div></Card>)}
    {!loading && pending && <p className="application-next-step"><Clock3 size={15}/> Your request is waiting for an administrator. You can submit another application if this one is declined.</p>}
    {!loading && decided?.status === 'rejected' && <p className="application-next-step"><ClipboardCheck size={15}/> Review the administrator’s feedback above, then you may submit a new request.</p>}
  </>
}
