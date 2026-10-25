import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDownToLine, ArrowRight, ClipboardCheck, MapPin, Plus, Users } from 'lucide-react'
import { CircleMarker, MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { api, endpoints } from '../services/api'
import { useLiveRefresh } from '../services/useLiveRefresh'
import { Button, Card, Empty, ErrorNotice, Field, Loading, PageHeading, StatusPill, SuccessNotice } from '../components/ui'

function distanceKm(from, to) {
  const coordinates = [from?.latitude, from?.longitude, to?.current_latitude, to?.current_longitude]
  if (coordinates.some(value => value == null || value === '' || !Number.isFinite(Number(value)))) return null
  const radians = degrees => degrees * Math.PI / 180
  const dLat = radians(Number(to.current_latitude) - Number(from.latitude))
  const dLon = radians(Number(to.current_longitude) - Number(from.longitude))
  const lat1 = radians(Number(from.latitude))
  const lat2 = radians(Number(to.current_latitude))
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(distance) {
  if (distance < 1) return `${Math.round(distance * 1000)} m`
  return `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(distance)} km`
}

function IncidentDispatchPreview({ incident }) {
  if (!incident) return null
  const latitude = Number(incident.latitude)
  const longitude = Number(incident.longitude)
  const location = incident.location_label || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
  const mapUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=14/${latitude}/${longitude}`

  return <section className="assignment-incident-preview" aria-label="Selected incident dispatch details">
    <div className="assignment-incident-summary">
      <div className="assignment-incident-heading"><div><span className="eyebrow">INCIDENT · INC-{String(incident.id).padStart(4, '0')}</span><h4>{incident.disaster_type}</h4></div><span className={`severity severity-${incident.severity}`}><i/>{incident.severity}</span></div>
      <p className="assignment-incident-description">{incident.description}</p>
      <div className="assignment-incident-facts">
        <div><MapPin size={15}/><span><b>Location</b>{location}<small>{latitude.toFixed(6)}, {longitude.toFixed(6)}</small></span></div>
        <div><Users size={15}/><span><b>Expected people affected</b>{incident.people_affected == null ? 'Not estimated' : incident.people_affected}</span></div>
        <div><span className="severity-dot"/><span><b>Priority recommendation</b>{incident.suggested_severity || incident.severity}{incident.priority_reasons?.length ? ` · ${incident.priority_reasons.join('; ')}` : ''}</span></div>
      </div>
      <a className="text-link" href={mapUrl} target="_blank" rel="noreferrer">Open incident location in OpenStreetMap <ArrowRight size={14}/></a>
    </div>
    <div className="assignment-incident-map" aria-label="Map preview of incident location">
      <MapContainer key={incident.id} center={[latitude, longitude]} zoom={13} scrollWheelZoom={false} zoomControl={false} className="assignment-mini-map">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"/>
        <CircleMarker center={[latitude, longitude]} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#d9574b', fillOpacity: 1 }}/>
      </MapContainer>
    </div>
  </section>
}

export default function AssignmentsPage({ user }) {
  const [searchParams] = useSearchParams()
  const requestedIncident = searchParams.get('incident')
  const [assignments, setAssignments] = useState([])
  const [incidents, setIncidents] = useState([])
  const [teams, setTeams] = useState([])
  const [recommendedTeams, setRecommendedTeams] = useState(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ incident_id: '', team_id: '' })
  const [preselected, setPreselected] = useState(false)
  const [completion, setCompletion] = useState(null)
  const [outcomeNotes, setOutcomeNotes] = useState('')
  const [savingAssignmentId, setSavingAssignmentId] = useState(null)

  async function refresh({ quiet = false } = {}) {
    if (!quiet) setBusy(true)
    try {
      const [a, i, t] = await Promise.all([endpoints.assignments(), endpoints.allIncidents(), endpoints.teams()])
      setAssignments(a); setIncidents(i); setTeams(t); setError('')
    } catch (e) { setError(e.message) } finally { if (!quiet) setBusy(false) }
  }
  useEffect(() => { refresh() }, [])
  useLiveRefresh(refresh)
  useEffect(() => {
    if (!['admin', 'coordinator'].includes(user.role) || !requestedIncident || !incidents.length || busy || preselected) return
    const item = incidents.find(incident => incident.id === Number(requestedIncident))
    if (item?.status === 'verified') setForm({ incident_id: String(item.id), team_id: '' })
    setPreselected(true)
  }, [user.role, requestedIncident, incidents, busy, preselected])

  async function assign(e) {
    e.preventDefault(); setError(''); setMessage('')
    try {
      await api('/api/assignments', { method: 'POST', body: JSON.stringify({ incident_id: Number(form.incident_id), team_id: Number(form.team_id) }) })
      setMessage('Team assigned to incident.'); setForm({ incident_id: '', team_id: '' }); await refresh()
    } catch (e) { setError(e.message) }
  }
  async function update(id, status, reason = null) {
    if (savingAssignmentId !== null) return
    setSavingAssignmentId(id); setError(''); setMessage('')
    try {
      const updated = await api(`/api/assignments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, reason }) })
      setAssignments(rows => rows.map(row => row.id === updated.id ? updated : row))
      if (status === 'completed') { setCompletion(null); setOutcomeNotes('') }
      setMessage(status === 'arrived' ? 'Team marked as arrived at the incident.' : status === 'completed' ? 'Response recorded. The incident is now waiting for administrator outcome review.' : `Assignment updated: ${status.replace('_', ' ')}.`)
      await refresh({ quiet: true })
    } catch (e) { setError(e.message) } finally { setSavingAssignmentId(null) }
  }

  async function completeAssignment(e) {
    e.preventDefault()
    if (!completion || !outcomeNotes.trim()) return
    await update(completion.id, 'completed', outcomeNotes.trim())
  }

  const reported = incidents.filter(x => x.status === 'reported')
  const assignable = incidents.filter(x => x.status === 'verified')
  const awaitingOutcome = incidents.filter(x => x.status === 'awaiting_verification')
  const available = teams.filter(x => x.availability === 'available')
  const selectedIncident = assignable.find(x => x.id === Number(form.incident_id))
  useEffect(() => {
    if (user.role !== 'coordinator' || !selectedIncident) {
      setRecommendedTeams(null)
      return
    }
    let current = true
    setRecommendedTeams(null)
    api(`/api/assignments/recommended-teams?incident_id=${selectedIncident.id}`)
      .then(result => { if (current) setRecommendedTeams({ incidentId: selectedIncident.id, teams: result.teams, topK: result.top_k }) })
      .catch(() => { if (current) setRecommendedTeams({ incidentId: selectedIncident.id, teams: [], topK: null }) })
    return () => { current = false }
  }, [user.role, selectedIncident?.id])
  const coordinatorTeamsReady = user.role !== 'coordinator' || !selectedIncident || recommendedTeams?.incidentId === selectedIncident.id
  const teamCandidates = user.role === 'coordinator' && selectedIncident
    ? (coordinatorTeamsReady ? recommendedTeams?.teams || [] : [])
    : selectedIncident ? available.filter(team => selectedIncident.people_affected == null || team.capacity >= selectedIncident.people_affected) : available
  const capacitySuitableTeams = selectedIncident ? teamCandidates.filter(team => selectedIncident.people_affected == null || team.capacity >= selectedIncident.people_affected) : teamCandidates
  const teamsMissingCoordinates = selectedIncident ? capacitySuitableTeams.filter(team => team.current_latitude == null || team.current_longitude == null || team.current_latitude === '' || team.current_longitude === '') : []
  const suitableTeams = (selectedIncident ? capacitySuitableTeams.filter(team => distanceKm(selectedIncident, team) != null) : teamCandidates)
    .map(team => ({ team, distance: selectedIncident ? distanceKm(selectedIncident, team) : null }))
    .sort((a, b) => {
      if (a.distance != null && b.distance != null && a.distance !== b.distance) return a.distance - b.distance
      if (a.distance != null && b.distance == null) return -1
      if (a.distance == null && b.distance != null) return 1
      const aSurplus = selectedIncident?.people_affected == null ? a.team.capacity : a.team.capacity - selectedIncident.people_affected
      const bSurplus = selectedIncident?.people_affected == null ? b.team.capacity : b.team.capacity - selectedIncident.people_affected
      return aSurplus - bSurplus || a.team.team_name.localeCompare(b.team.team_name)
    })
  const incidentTitle = x => `INC-${String(x.id).padStart(4, '0')} · ${x.disaster_type} · ${x.severity} · ${x.location_label || `${Number(x.latitude).toFixed(4)}, ${Number(x.longitude).toFixed(4)}`}`

  return <>
    <PageHeading eyebrow="FIELD COORDINATION" title="Assignments" description={user.role === 'coordinator' ? 'Verified incidents are routed to the nearest eligible coordinators, ranked by each coordinator’s closest team. Assign one of your available teams and record its field progress.' : 'Administrators verify incoming reports and oversee dispatch and outcome review.'}/>
    <ErrorNotice error={error}/><SuccessNotice>{message}</SuccessNotice>
    {requestedIncident && selectedIncident && <div className="workflow-notice"><b>Incident INC-{String(selectedIncident.id).padStart(4, '0')} is ready</b><span>Choose an available team below to complete the assignment.</span></div>}

    {['admin', 'coordinator'].includes(user.role) && <Card className="assignment-create">
      <div className="section-head"><div><h3>Assign a response team</h3><p>{user.role === 'coordinator' ? 'Assign verified incidents to teams coordinated by your account.' : 'Admins can oversee assignments and assign a verified incident when needed.'} Teams must be available and have enough capacity.</p></div><Plus size={18}/></div>
      {user.role === 'admin' && reported.length > 0 && <div className="workflow-notice"><b>{reported.length} report{reported.length === 1 ? '' : 's'} waiting for verification</b><span>Open a report below, review its details, and choose “Verify report”. It will then appear in the incident selector here.</span></div>}
      <form className="form-row align-end assignment-dispatch-form" onSubmit={assign}>
        <Field label="Verified incident"><select required value={form.incident_id} onChange={e => setForm({ incident_id: e.target.value, team_id: '' })}><option value="">Select an incident</option>{assignable.map(x => <option key={x.id} value={x.id}>{incidentTitle(x)}</option>)}</select></Field>
        <div className="field team-choice-field"><span>{selectedIncident ? (user.role === 'coordinator' ? 'Your eligible teams · nearest first' : 'Available teams · nearest first') : (user.role === 'coordinator' ? 'Your eligible teams' : 'Available teams')}</span>
          {!selectedIncident ? <div className="team-choice-placeholder">Select an incident to compare eligible teams by distance.</div> : suitableTeams.length ? <div className="team-choice-list" role="radiogroup" aria-label="Select a response team">{suitableTeams.map(({ team, distance }, index) => <button key={team.id} type="button" role="radio" aria-checked={form.team_id === String(team.id)} className={`team-choice${form.team_id === String(team.id) ? ' selected' : ''}`} onClick={() => setForm({ ...form, team_id: String(team.id) })}>
            <span className="team-choice-main"><strong>{team.team_name}</strong><small><MapPin size={12}/>{team.location_label || 'Base location not named'}<i>·</i>Capacity {team.capacity}</small></span>
            <span className="team-choice-distance">{index === 0 && <em>NEAREST</em>}<b>{formatDistance(distance)}</b><small>straight-line</small></span>
          </button>)}</div> : <div className="team-choice-placeholder">No eligible teams with saved base coordinates are available for this incident.</div>}
        </div>
        <Button disabled={!selectedIncident || !form.team_id || !suitableTeams.length}><ArrowDownToLine size={16}/>Assign team</Button>
      </form>
      <IncidentDispatchPreview incident={selectedIncident}/>
      {selectedIncident && suitableTeams.length > 0 && <p className="form-hint">{user.role === 'coordinator' ? `Incidents are routed to the nearest ${recommendedTeams?.topK ?? 'eligible'} distinct coordinators. You can choose any of your available teams with enough capacity. ` : ''}Teams are ranked by straight-line distance from their base, then capacity fit and team name. Actual road travel may differ.</p>}
      {selectedIncident && teamsMissingCoordinates.length > 0 && <p className="form-hint">{teamsMissingCoordinates.length} capacity-suitable team{teamsMissingCoordinates.length === 1 ? ' is' : 's are'} missing base map coordinates and can’t be ranked by distance. Ask an administrator to edit the team on the Teams page and set its base location pin.</p>}
      {selectedIncident && user.role === 'coordinator' && coordinatorTeamsReady && suitableTeams.length === 0 && <p className="form-hint">Your coordinator account is not currently in the nearest eligible group for this incident, or no owned team has enough capacity. Teams need accurate base coordinates, availability, and sufficient capacity to be considered.</p>}
      {selectedIncident && user.role === 'coordinator' && !coordinatorTeamsReady && <p className="form-hint">Finding your eligible teams…</p>}
      {selectedIncident && user.role === 'admin' && available.length > 0 && suitableTeams.length === 0 && <p className="form-hint">No available team has capacity for {selectedIncident.people_affected} affected people. Update the team capacity or register another team.</p>}
      {selectedIncident && selectedIncident.people_affected == null && suitableTeams.length > 0 && <p className="form-hint">No affected-person estimate was provided. Confirm the team capacity is suitable before assigning it.</p>}
      {!available.length && <p className="form-hint">No teams are available. <Link to="/teams">Review team availability <ArrowRight size={14}/></Link></p>}
    </Card>}

    {user.role === 'admin' && <Card className="table-card">
      <div className="section-head"><div><h3>Reports awaiting verification</h3><p>Verification is the step that makes a report eligible for assignment.</p></div></div>
      {busy ? <Loading/> : reported.length ? <div className="table-wrap"><table><thead><tr><th>Incident</th><th>Type</th><th>Severity</th><th>Reporter</th><th>Location</th><th>Reported</th><th>Next step</th></tr></thead><tbody>{reported.map(x => <tr key={x.id}><td><Link className="table-title" to={`/incidents/${x.id}`}>INC-{String(x.id).padStart(4, '0')}</Link></td><td>{x.disaster_type}</td><td>{x.severity}</td><td>{x.reporter_name || "—"}</td><td>{x.location_label || `${Number(x.latitude).toFixed(3)}, ${Number(x.longitude).toFixed(3)}`}</td><td>{new Date(x.created_at).toLocaleString()}</td><td><Link className="text-link" to={`/incidents/${x.id}`}>Review and verify <ArrowRight size={15}/></Link></td></tr>)}</tbody></table></div> : <Empty>No reports are waiting for verification.</Empty>}
    </Card>}

    {user.role === 'admin' && <Card className="table-card"><div className="section-head"><div><h3>Field outcomes awaiting review</h3><p>Teams have completed their response. Verify the recorded outcome before resolving each incident.</p></div></div>{busy ? <Loading/> : awaitingOutcome.length ? <div className="table-wrap"><table><thead><tr><th>Incident</th><th>Type</th><th>Priority</th><th>Reporter</th><th>Reported</th><th>Next step</th></tr></thead><tbody>{awaitingOutcome.map(x=><tr key={x.id}><td><Link className="table-title" to={`/incidents/${x.id}`}>INC-{String(x.id).padStart(4,'0')}</Link></td><td>{x.disaster_type}</td><td>{x.severity}</td><td>{x.reporter_name || "—"}</td><td>{new Date(x.created_at).toLocaleString()}</td><td><Link className="text-link" to={`/incidents/${x.id}`}>Review outcome <ArrowRight size={15}/></Link></td></tr>)}</tbody></table></div> : <Empty>No team outcomes are waiting for review.</Empty>}</Card>}

    <Card className="table-card"><div className="section-head"><div><h3>Response assignments</h3><p>Track teams after they have been assigned to an incident.</p></div></div>{busy ? <Loading/> : assignments.length ? <div className="table-wrap"><table><thead><tr><th>Assignment</th><th>Incident</th><th>Team</th><th>Status</th><th>Assigned</th><th>Action</th></tr></thead><tbody>{assignments.map(a => { const incident = incidents.find(i => i.id === a.incident_id); const team = teams.find(t => t.id === a.team_id); const label = a.status === 'active_in_progress' ? 'in progress' : a.status; const saving = savingAssignmentId === a.id; return <tr key={a.id}><td>ASN-{String(a.id).padStart(4, '0')}</td><td>{incident ? `INC-${String(incident.id).padStart(4, '0')} · ${incident.disaster_type}` : `Incident ${a.incident_id}`}</td><td>{team?.team_name || `Team ${a.team_id}`}</td><td><StatusPill value={label}/>{a.arrived_at && <small className="assignment-arrival">Arrived {new Date(a.arrived_at).toLocaleString()}</small>}</td><td>{new Date(a.assigned_at).toLocaleString()}</td><td>{a.status === 'active' && <Button variant="small" disabled={savingAssignmentId!==null} onClick={() => update(a.id, 'in_progress')}><ClipboardCheck size={14}/>{saving?'Starting…':'Start'}</Button>}{a.status === 'active_in_progress' && !a.arrived_at && <Button variant="small" disabled={savingAssignmentId!==null} onClick={() => update(a.id, 'arrived')}>{saving?'Saving…':'Mark arrived'}</Button>}{a.status === 'active_in_progress' && a.arrived_at && <Button variant="small" disabled={savingAssignmentId!==null} onClick={() => { setError(''); setMessage(''); setOutcomeNotes(''); setCompletion(a) }}>{saving?'Saving…':'Complete'}</Button>}</td></tr> })}</tbody></table></div> : <Empty>{user.role === 'coordinator' ? (assignable.length ? 'No assignments yet. Choose a verified incident and one of your available teams above.' : 'No verified incidents are ready for dispatch. An administrator must review and verify incoming reports.') : reported.length ? 'No teams have been assigned yet. Verify a report above, then assign an available team.' : assignable.length ? 'No teams have been assigned yet. Choose a verified incident and available team above.' : 'No assignments yet. New reports appear above for verification before they can be assigned.'}</Empty>}</Card>
    {completion && <div className="review-dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&savingAssignmentId===null)setCompletion(null)}}>
      <section className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="completion-dialog-title" aria-describedby="completion-dialog-description">
        <div className="review-dialog-heading"><span className="review-dialog-icon approve">✓</span><div><span className="request-index">FIELD OUTCOME</span><h2 id="completion-dialog-title">Complete response assignment</h2></div></div>
        <p id="completion-dialog-description" className="review-dialog-description">Record what the team did and any needs that remain. An administrator will review this report before resolving the incident.</p>
        <div className="review-applicant"><span>Assignment</span><strong>ASN-{String(completion.id).padStart(4,'0')}</strong><small>{incidentTitle(incidents.find(i=>i.id===completion.incident_id) || {id:completion.incident_id,disaster_type:'Incident',severity:'unknown'})}</small></div>
        <form onSubmit={completeAssignment}>
          <Field label="Response outcome and remaining needs"><textarea autoFocus rows="5" maxLength="2000" required value={outcomeNotes} onChange={e=>setOutcomeNotes(e.target.value)} placeholder="Describe the response, people assisted, supplies used, and any follow-up needed…"/></Field>
          {error&&<p className="review-dialog-error" role="alert">{error}</p>}
          <div className="review-dialog-actions"><Button type="button" variant="small" disabled={savingAssignmentId!==null} onClick={()=>setCompletion(null)}>Cancel</Button><Button variant="small" disabled={savingAssignmentId!==null||!outcomeNotes.trim()} className="review-confirm-approve">{savingAssignmentId===completion.id?'Saving outcome…':'Complete response'}</Button></div>
        </form>
      </section>
    </div>}
  </>
}
