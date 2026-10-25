import { useEffect, useState } from 'react'
import { FileCheck2, Send } from 'lucide-react'
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
    <PageHeading eyebrow="ROLE REQUEST" title="Apply to become a coordinator" description="Tell your organization why you need coordination access. An administrator reviews each request before changing your account permissions."/>
    <ErrorNotice error={error}/><SuccessNotice>{message}</SuccessNotice>
    {!loading && canApply && <Card className="inline-form-card"><form className="form-stack" onSubmit={submit}>
      <Field label="Why do you want coordinator access?"><textarea required minLength="30" maxLength="3000" rows="5" value={motivation} onChange={e=>setMotivation(e.target.value)} placeholder="Describe the response coordination work you will be responsible for."/></Field>
      <Field label="Relevant experience (optional)"><textarea maxLength="3000" rows="4" value={experience} onChange={e=>setExperience(e.target.value)} placeholder="Relevant training, team experience, or organization role."/></Field>
      <p className="form-hint">Submitting this request does not change your access. You remain a reporter until an administrator approves it.</p>
      <Button disabled={busy}><Send size={16}/>{busy ? 'Sending…' : 'Send application'}</Button>
    </form></Card>}
    {loading ? <Loading/> : applications.map(application => <Card className="table-card" key={application.id}><div className="section-head"><div><h3>Coordinator application</h3><p>Submitted {new Date(application.submitted_at).toLocaleString()}</p></div><StatusPill value={application.status}/></div><p>{application.motivation}</p>{application.experience && <p><b>Experience:</b> {application.experience}</p>}{application.review_reason && <p><b>Administrator response:</b> {application.review_reason}</p>}{application.status === 'approved' && <p><FileCheck2 size={16}/> Your account has coordinator access. Sign out and sign in again to refresh your workspace permissions.</p>}</Card>)}
    {!loading && pending && <p className="form-hint">Your request is waiting for an administrator. You can submit another application if this one is declined.</p>}
    {!loading && decided?.status === 'rejected' && <p className="form-hint">You may submit a new request after reviewing the administrator’s feedback above.</p>}
  </>
}
