import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Activity, ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, CircleX, Image, MapPin, ShieldCheck, Users } from 'lucide-react'
import { api, endpoints } from '../services/api'
import { useLiveRefresh } from '../services/useLiveRefresh'
import { Button, Card, ErrorNotice, Loading, SeverityPill, StatusPill, SuccessNotice } from '../components/ui'

export default function IncidentPage({ user }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [incident, setIncident] = useState(null)
  const [photosData, setPhotosData] = useState([])
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
    try { const [item, events, photos] = await Promise.all([endpoints.incident(id), endpoints.history(id), endpoints.incidentPhoto(id).catch(() => null)]); setIncident(item); setHistory(events); setPhotosData(photos?.photos_data || []); setError('') }
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
      } else if (actionDialog === 'reject') {
        await api(`/api/incidents/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'invalid', reason }) })
        setMessage('Report declined and marked invalid. It is no longer available for assignment.')
      } else {
        await api(`/api/incidents/${id}/priority`, { method: 'POST', body: JSON.stringify({ severity: priority || incident.severity, reason }) })
        setMessage('Operational priority updated with reason.')
      }
      setActionDialog(null); setActionReason(''); await refresh()
    } catch (e) { setError(e.message) } finally { setSavingAction(false) }
  }

  if (loading) return <Loading/>
  return <>
    {incident&&<div className="incident-page-heading"><div className="eyebrow">INCIDENT REVIEW <span>·</span> INC-{String(incident.id).padStart(4,'0')}</div><div className="incident-heading-row"><div><h1>{incident.disaster_type}</h1><p>Review the report, assess the response priority, and track the next action.</p></div><Link className="incident-back-link" to="/"><ArrowLeft size={17}/> Overview</Link></div></div>}
    <ErrorNotice error={error}/><SuccessNotice>{message}</SuccessNotice>
    {incident&&<div className="incident-layout">
      <Card className="incident-overview-card">
        <section className="incident-description-block"><span className="incident-kicker">REPORT DESCRIPTION</span><p>{incident.description}</p><div className="reporter-chip"><span className="reporter-avatar">{incident.reporter_name?.slice(0,1).toUpperCase()||'R'}</span><span><small>Reported by</small><b>{incident.reporter_name || 'Unknown reporter'}</b></span></div></section>
        {photosData.length>0&&<section className="incident-evidence"><div className="incident-section-heading"><span className="incident-icon-tile photo-tile"><Image size={18}/></span><div><h3>Incident photos</h3><p>{photosData.length} {photosData.length===1?'image':'images'} attached to this report</p></div></div><div className="incident-photo-grid">{photosData.map((photo,index)=><a key={index} href={photo} target="_blank" rel="noreferrer" aria-label={`Open incident photo ${index+1}`}><img className="incident-photo" src={photo} alt={`Photo ${index+1} attached to ${incident.disaster_type} incident`}/></a>)}</div></section>}
        <section className="incident-facts-grid">
          <div className="incident-fact-card location-fact"><span className="incident-icon-tile location-tile"><MapPin size={18}/></span><div><small>LOCATION</small><b>{incident.location_label || 'Pinned location'}</b><span>{Number(incident.latitude).toFixed(4)}, {Number(incident.longitude).toFixed(4)}</span></div></div>
          <div className="incident-fact-card impact-fact"><span className="incident-icon-tile impact-tile"><Users size={18}/></span><div><small>PEOPLE AFFECTED</small><b>{incident.people_affected == null ? 'Not estimated' : incident.people_affected.toLocaleString()}</b><span>{incident.people_trapped ? `${incident.people_trapped} reported trapped` : 'No trapped-person estimate'}</span></div></div>
          <div className="incident-fact-card date-fact"><span className="incident-icon-tile date-tile"><CalendarDays size={18}/></span><div><small>REPORTED</small><b>{new Date(incident.created_at).toLocaleDateString()}</b><span>{new Date(incident.created_at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</span></div></div>
        </section>
        <section className={`priority-panel priority-${incident.suggested_severity||incident.severity}`}><div className="priority-panel-heading"><span className="incident-icon-tile priority-tile"><ShieldCheck size={18}/></span><div><small>SYSTEM PRIORITY RECOMMENDATION</small><b>{incident.suggested_severity || incident.severity}</b></div><span className={`priority-indicator priority-indicator-${incident.suggested_severity||incident.severity}`}/></div><p>{incident.priority_reasons?.join(' · ') || 'No elevated urgency indicators were reported.'}</p>{incident.priority_override_reason&&<div className="priority-override"><b>Operator adjustment:</b> {incident.priority_override_reason}</div>}</section>
        {(incident.urgent_medical||incident.immediate_needs?.length>0||incident.resolution_notes)&&<section className="incident-extra-notes">{incident.urgent_medical&&<span className="incident-note-tag urgent-note">Urgent medical assistance</span>}{incident.immediate_needs?.map(need=><span className="incident-note-tag" key={need}>{need.replaceAll('_',' ')}</span>)}{incident.resolution_notes&&<p><b>Verified resolution:</b> {incident.resolution_notes}</p>}</section>}
        {user.role==='admin'&&<section className="incident-admin-panel"><div className="incident-section-heading"><span className="incident-icon-tile admin-tile"><Activity size={18}/></span><div><h3>Admin actions</h3><p>Manage priority and incident review</p></div></div>{incident.status==='reported'&&<div className="incident-review-actions"><Button className="incident-primary-action" onClick={verify}><CheckCircle2 size={17}/>Verify and continue to assignment</Button><Button className="incident-decline-action" onClick={()=>openActionDialog('reject')}><CircleX size={17}/>Decline report</Button></div>}{incident.status==='verified'&&<Link className="incident-primary-action" to={`/assignments?incident=${incident.id}`}>Continue to assignment <ArrowRight size={17}/></Link>}{incident.status==='awaiting_verification'&&<Button className="incident-primary-action" onClick={()=>openActionDialog('resolve')}><CheckCircle2 size={17}/>Verify outcome and resolve</Button>}{!['reported','verified','awaiting_verification'].includes(incident.status)&&<p className="incident-action-complete">No admin action is pending for this incident.</p>}<div className="priority-control"><label htmlFor="operational-priority">Operational priority</label><div className="priority-control-row"><select id="operational-priority" value={priority||incident.severity} onChange={e=>setPriority(e.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select><Button variant="small" onClick={()=>openActionDialog('priority')}>Set priority</Button></div></div></section>}
        <div className="incident-status-footer"><div><small>INCIDENT STATUS</small><span><StatusPill value={incident.status}/><SeverityPill value={incident.severity}/></span></div><span className="incident-number">INC-{String(incident.id).padStart(4,'0')}</span></div>
      </Card>
      <Card className="incident-history-card"><div className="history-card-heading"><span className="incident-icon-tile history-tile"><Activity size={18}/></span><div><h2>Status history</h2><p>Every recorded workflow update</p></div></div>{history.length?<div className="incident-history-list">{history.map((event,index)=><div className="incident-history-item" key={event.id}><span className={`history-node ${index===history.length-1?'history-node-current':''}`}/><div className="history-event"><div><b>{event.new_status.replaceAll('_',' ')}</b><time>{new Date(event.changed_at).toLocaleString()}</time></div>{event.old_status&&<small>Moved from {event.old_status.replaceAll('_',' ')}</small>}{event.reason&&<p>{event.reason}</p>}</div></div>)}</div>:<div className="history-empty"><Activity size={22}/><b>No updates yet</b><p>Status changes will appear here as the incident is reviewed.</p></div>}</Card>
    </div>}
    {actionDialog && <div className="review-dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!savingAction)setActionDialog(null)}}>
      <section className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="incident-action-title" aria-describedby="incident-action-description">
        <div className="review-dialog-heading"><span className={`review-dialog-icon ${actionDialog==='priority'?'priority':actionDialog==='reject'?'reject':'approve'}`}>{actionDialog==='priority'?'↗':actionDialog==='reject'?<CircleX size={21}/>: '✓'}</span><div><span className="request-index">INCIDENT · INC-{String(id).padStart(4,'0')}</span><h2 id="incident-action-title">{actionDialog==='priority'?'Set operational priority':actionDialog==='reject'?'Decline incident report':'Verify outcome and resolve'}</h2></div></div>
        <p id="incident-action-description" className="review-dialog-description">{actionDialog==='priority'?'Record why the operational priority should differ from the system recommendation.':actionDialog==='reject'?'Mark this report invalid so it cannot be assigned. Record a clear reason for the audit history.':`Review the team's outcome notes${incident.resolution_notes?' and confirm resolution.':' before resolving this incident.'}`}</p>
        {actionDialog==='priority' && <div className="review-applicant"><span>Selected priority</span><strong className="incident-priority-selected">{priority || incident.severity}</strong><small>Recommendation: {incident.suggested_severity || 'not available'}</small></div>}
        {actionDialog==='reject' && <div className="review-applicant"><span>Incident to decline</span><strong>{incident.disaster_type} · INC-{String(id).padStart(4,'0')}</strong><small>This action removes it from the verification and assignment queues.</small></div>}
        {actionDialog==='resolve' && <div className="review-applicant"><span>Team outcome notes</span><strong>{outcomeNote || incident.resolution_notes || 'No team outcome note was recorded.'}</strong></div>}
        <form onSubmit={submitAction}>
          <label className="field"><span>{actionDialog==='priority'?'Reason for priority override':actionDialog==='reject'?'Reason for declining this report':'Resolution verification notes'}</span><textarea autoFocus rows="4" maxLength="2000" minLength={actionDialog==='priority'||actionDialog==='reject'?8:1} required value={actionReason} onChange={e=>setActionReason(e.target.value)} placeholder={actionDialog==='priority'?'Explain the operational factors supporting this priority…':actionDialog==='reject'?'For example: duplicate report, incorrect information, or outside service area…':'Confirm what was verified and any remaining follow-up…'}/></label>
          {error&&<p className="review-dialog-error" role="alert">{error}</p>}
          <div className="review-dialog-actions"><Button type="button" variant="small" disabled={savingAction} onClick={()=>setActionDialog(null)}>Cancel</Button><Button variant="small" disabled={savingAction||!actionReason.trim()||(['priority','reject'].includes(actionDialog)&&actionReason.trim().length<8)} className={actionDialog==='reject'?'review-confirm-reject':'review-confirm-approve'}>{savingAction?'Saving…':actionDialog==='priority'?'Save priority':actionDialog==='reject'?'Decline report':'Resolve incident'}</Button></div>
        </form>
      </section>
    </div>}
  </>
}
