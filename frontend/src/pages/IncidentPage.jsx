import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, MapPin, Users } from 'lucide-react'
import { api, endpoints } from '../services/api'
import { useLiveRefresh } from '../services/useLiveRefresh'
import { Button, Card, Empty, ErrorNotice, Loading, PageHeading, SeverityPill, StatusPill, SuccessNotice } from '../components/ui'

export default function IncidentPage({ user }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [incident, setIncident] = useState(null)
  const [history, setHistory] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [priority, setPriority] = useState('')
  const [actionDialog, setActionDialog] = useState(null)
  const [actionReason, setActionReason] = useState('')
  const [savingAction, setSavingAction] = useState(false)
  const outcomeNote = [...history].reverse().find(event => event.new_status === 'awaiting_verification')?.reason
  const refresh = useCallback(async () => {
    try { const [item, events] = await Promise.all([endpoints.incident(id), endpoints.history(id)]); setIncident(item); setHistory(events); setError('') }
    catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [id])
  useEffect(() => { refresh() }, [refresh])
  useLiveRefresh(refresh)

  async function verify() {
    setError(''); setMessage('')
    try {
      await api(`/api/incidents/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'verified' }) })
      navigate(`/assignments?incident=${id}`)
    }
    catch (e) { setError(e.message) }
  }

  function openActionDialog(type) {
    setError(''); setMessage(''); setActionReason(''); setActionDialog(type)
  }
  async function submitAction(e) {
    e.preventDefault()
    const reason = actionReason.trim()
    if (!actionDialog || !reason || savingAction || (actionDialog === 'priority' && reason.length < 8)) return
    setSavingAction(true); setError(''); setMessage('')
    try {
      if (actionDialog === 'resolve') {
        await api(`/api/incidents/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'resolved', reason }) })
        setMessage('Outcome verified and incident resolved.')
      } else {
        await api(`/api/incidents/${id}/priority`, { method: 'POST', body: JSON.stringify({ severity: priority || incident.severity, reason }) })
        setMessage('Operational priority updated with reason.')
      }
      setActionDialog(null); setActionReason(''); await refresh()
    } catch (e) { setError(e.message) } finally { setSavingAction(false) }
  }

  if (loading) return <Loading/>
  return <>
    <PageHeading eyebrow={`INCIDENT · INC-${String(id).padStart(4, '0')}`} title={incident?.disaster_type || 'Incident details'} description="Review the submitted information, confirm it with your team, and record status changes." action={<Link className="back-link" to="/"><ArrowLeft size={16}/> Back to overview</Link>}/>
    <ErrorNotice error={error}/><SuccessNotice>{message}</SuccessNotice>
    {incident && <div className="detail-grid">
      <Card><div className="detail-top"><div><span className="eyebrow">CURRENT STATUS</span><div className="detail-pills"><StatusPill value={incident.status}/><SeverityPill value={incident.severity}/></div></div><span className="detail-id">INC-{String(incident.id).padStart(4, '0')}</span></div><h2 className="detail-title">{incident.disaster_type}</h2><p className="detail-description">{incident.description}</p><div className="detail-facts"><span><MapPin size={16}/>{incident.location_label ? `${incident.location_label} · ` : ''}{Number(incident.latitude).toFixed(4)}, {Number(incident.longitude).toFixed(4)}</span><span><Users size={16}/>{incident.people_affected == null ? 'People affected not estimated' : `${incident.people_affected} people affected`}{incident.people_trapped ? ` · ${incident.people_trapped} trapped` : ''}</span><span>Reported {new Date(incident.created_at).toLocaleString()}</span></div><p><b>Priority recommendation:</b> {incident.suggested_severity || 'not available'} · {incident.priority_reasons?.join('; ')}</p>{incident.priority_override_reason && <p><b>Operator override:</b> {incident.priority_override_reason}</p>}{user.role === 'admin' && <div className="form-row"><select aria-label="Operational priority" value={priority || incident.severity} onChange={e=>setPriority(e.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select><Button variant="small" onClick={()=>openActionDialog('priority')}>Set operational priority</Button></div>}{incident.urgent_medical && <p><b>Urgent medical assistance reported</b></p>}{incident.immediate_needs?.length > 0 && <p><b>Immediate needs:</b> {incident.immediate_needs.join(', ')}</p>}{incident.resolution_notes && <p><b>Verified resolution:</b> {incident.resolution_notes}</p>}{user.role === 'admin' && incident.status === 'reported' && <Button onClick={verify}><CheckCircle2 size={16}/>Verify and continue to assignment</Button>}{user.role === 'admin' && incident.status === 'verified' && <Link className="text-link" to={`/assignments?incident=${incident.id}`}>Continue to assignment <ArrowRight size={15}/></Link>}{user.role === 'admin' && incident.status === 'awaiting_verification' && <Button onClick={()=>openActionDialog('resolve')}><CheckCircle2 size={16}/>Verify outcome and resolve</Button>}</Card>
      <Card><div className="section-head"><div><h3>Status history</h3><p>Recorded updates for this report</p></div></div>{history.length ? <div className="timeline">{history.map(event=><div className="timeline-item" key={event.id}><span className="timeline-dot"/><div><b>{event.new_status.replaceAll('_', ' ')}</b><small>{event.old_status ? `${event.old_status.replaceAll('_', ' ')} → ` : ''}{new Date(event.changed_at).toLocaleString()}{event.reason ? ` · ${event.reason}` : ''}</small></div></div>)}</div> : <Empty>No status changes recorded.</Empty>}</Card>
    </div>}
    {actionDialog && <div className="review-dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!savingAction)setActionDialog(null)}}>
      <section className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="incident-action-title" aria-describedby="incident-action-description">
        <div className="review-dialog-heading"><span className={`review-dialog-icon ${actionDialog==='priority'?'priority':'approve'}`}>{actionDialog==='priority'?'↗':'✓'}</span><div><span className="request-index">INCIDENT · INC-{String(id).padStart(4,'0')}</span><h2 id="incident-action-title">{actionDialog==='priority'?'Set operational priority':'Verify outcome and resolve'}</h2></div></div>
        <p id="incident-action-description" className="review-dialog-description">{actionDialog==='priority'?'Record why the operational priority should differ from the system recommendation.':`Review the team's outcome notes${incident.resolution_notes?' and confirm resolution.':' before resolving this incident.'}`}</p>
        {actionDialog==='priority' && <div className="review-applicant"><span>Selected priority</span><strong className="incident-priority-selected">{priority || incident.severity}</strong><small>Recommendation: {incident.suggested_severity || 'not available'}</small></div>}
        {actionDialog==='resolve' && <div className="review-applicant"><span>Team outcome notes</span><strong>{outcomeNote || incident.resolution_notes || 'No team outcome note was recorded.'}</strong></div>}
        <form onSubmit={submitAction}>
          <label className="field"><span>{actionDialog==='priority'?'Reason for priority override':'Resolution verification notes'}</span><textarea autoFocus rows="4" maxLength="2000" minLength={actionDialog==='priority'?8:1} required value={actionReason} onChange={e=>setActionReason(e.target.value)} placeholder={actionDialog==='priority'?'Explain the operational factors supporting this priority…':'Confirm what was verified and any remaining follow-up…'}/></label>
          {error&&<p className="review-dialog-error" role="alert">{error}</p>}
          <div className="review-dialog-actions"><Button type="button" variant="small" disabled={savingAction} onClick={()=>setActionDialog(null)}>Cancel</Button><Button variant="small" disabled={savingAction||!actionReason.trim()||(actionDialog==='priority'&&actionReason.trim().length<8)} className="review-confirm-approve">{savingAction?'Saving…':actionDialog==='priority'?'Save priority':'Resolve incident'}</Button></div>
        </form>
      </section>
    </div>}
  </>
}
