import { useEffect, useState } from 'react'
import { Pencil, Plus, Users, X } from 'lucide-react'
import { api, endpoints } from '../services/api'
import { useLiveRefresh } from '../services/useLiveRefresh'
import { Button, Card, Empty, ErrorNotice, Field, Loading, PageHeading, StatusPill, SuccessNotice } from '../components/ui'
import LocationPicker from '../components/LocationPicker'

const emptyForm = { team_name: '', capacity: '6', coordinator_id: '', location_label: '', current_latitude: '', current_longitude: '' }

export default function TeamsPage({ user }) {
  const [teams, setTeams] = useState([])
  const [coordinators, setCoordinators] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [show, setShow] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editingTeam, setEditingTeam] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)

  async function refresh() {
    try {
      const data = await endpoints.teams(); setTeams(data)
      if (user.role === 'admin') setCoordinators((await api('/api/users')).filter(x => x.role === 'coordinator'))
      setError('')
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])
  useLiveRefresh(refresh)

  const orderedTeams = [...teams].sort((a, b) => a.team_name.localeCompare(b.team_name, undefined, { sensitivity: 'base', numeric: true }))

  async function create(e) {
    e.preventDefault(); setError(''); setMessage('')
    try {
      await api('/api/teams', { method: 'POST', body: JSON.stringify({
        ...form, capacity: Number(form.capacity), coordinator_id: form.coordinator_id ? Number(form.coordinator_id) : null,
        current_latitude: form.current_latitude ? Number(form.current_latitude) : null,
        current_longitude: form.current_longitude ? Number(form.current_longitude) : null,
      }) })
      setMessage('Response team created.'); setForm(emptyForm); setShow(false); await refresh()
    } catch (err) { setError(err.message) }
  }

  async function toggleAvailability(team) {
    setError(''); setMessage('')
    try { await api(`/api/teams/${team.id}`, { method: 'PATCH', body: JSON.stringify({ availability: team.availability === 'available' ? 'offline' : 'available' }) }); await refresh() }
    catch (e) { setError(e.message) }
  }

  function beginEdit(team) {
    setError(''); setMessage(''); setEditingTeam(team)
    setEditForm({
      capacity: String(team.capacity), coordinator_id: team.coordinator_id ? String(team.coordinator_id) : '',
      location_label: team.location_label || '',
      current_latitude: team.current_latitude == null ? '' : String(team.current_latitude),
      current_longitude: team.current_longitude == null ? '' : String(team.current_longitude),
    })
  }

  async function updateTeam(e) {
    e.preventDefault()
    if (!editingTeam || !editForm || savingEdit) return
    setSavingEdit(true); setError(''); setMessage('')
    try {
      await api(`/api/teams/${editingTeam.id}`, { method: 'PATCH', body: JSON.stringify({
        capacity: Number(editForm.capacity),
        coordinator_id: editForm.coordinator_id ? Number(editForm.coordinator_id) : null,
        location_label: editForm.location_label.trim() || null,
        current_latitude: editForm.current_latitude === '' ? null : Number(editForm.current_latitude),
        current_longitude: editForm.current_longitude === '' ? null : Number(editForm.current_longitude),
      }) })
      setMessage(`${editingTeam.team_name} details updated.`); setEditingTeam(null); setEditForm(null); await refresh()
    } catch (e) { setError(e.message) } finally { setSavingEdit(false) }
  }

  return <>
    <PageHeading eyebrow="RESPONSE CAPACITY" title="Rescue teams" description={user.role === 'admin' ? 'Set up response units, assign team leads, and manage operational availability.' : 'View the response units assigned to you and their availability.'} action={user.role === 'admin' && <Button onClick={() => setShow(!show)}><Plus size={16}/>{show ? 'Close' : 'Add team'}</Button>}/>
    <ErrorNotice error={error}/><SuccessNotice>{message}</SuccessNotice>
    {show && <Card className="inline-form-card"><form className="form-row align-end" onSubmit={create}>
      <Field label="Team name"><input required minLength="2" value={form.team_name} onChange={e=>setForm({...form,team_name:e.target.value})} placeholder="North response team"/></Field>
      <Field label="Capacity"><input required type="number" min="1" value={form.capacity} onChange={e=>setForm({...form,capacity:e.target.value})}/></Field>
      <Field label="Coordinator"><select value={form.coordinator_id} onChange={e=>setForm({...form,coordinator_id:e.target.value})}><option value="">Select a coordinator</option>{coordinators.map(c=><option key={c.id} value={c.id}>{c.name} · {c.email}</option>)}</select></Field>
      <Button>Save team</Button>
    </form></Card>}
    {show && <Card className="inline-form-card"><div className="section-head"><div><h3>Team base location</h3><p>Search a place, choose a result, then place or drag the map pin.</p></div></div><LocationPicker label={form.location_label} latitude={form.current_latitude} longitude={form.current_longitude} onChange={location=>setForm(current=>({...current,location_label:location.location_label,current_latitude:location.latitude,current_longitude:location.longitude}))}/></Card>}
    {editingTeam && editForm && <Card className="inline-form-card team-edit-panel"><div className="section-head"><div><h3>Edit {editingTeam.team_name}</h3><p>Update the coordinator, people capacity, or team base location. Active incident capacity requirements are checked when you save.</p></div><Button type="button" variant="small" disabled={savingEdit} onClick={()=>{setEditingTeam(null);setEditForm(null)}}><X size={14}/>Close</Button></div>
      <form onSubmit={updateTeam}>
        <div className="form-row align-end team-edit-fields">
          <Field label="People capacity"><input required type="number" min="1" max="10000" value={editForm.capacity} onChange={e=>setEditForm({...editForm,capacity:e.target.value})}/></Field>
          <Field label="Coordinator"><select value={editForm.coordinator_id} onChange={e=>setEditForm({...editForm,coordinator_id:e.target.value})}><option value="">Unassigned</option>{coordinators.map(c=><option key={c.id} value={c.id}>{c.name} · {c.email}</option>)}</select></Field>
        </div>
        <div className="section-head team-edit-location-heading"><div><h3>Team base location</h3><p>Search for a place or move the pin on the map.</p></div></div>
        <LocationPicker label={editForm.location_label} latitude={editForm.current_latitude} longitude={editForm.current_longitude} onChange={location=>setEditForm(current=>({...current,location_label:location.location_label,current_latitude:location.latitude,current_longitude:location.longitude}))}/>
        <div className="form-actions team-edit-actions"><span>Team availability is managed separately.</span><Button disabled={savingEdit}>{savingEdit?'Saving…':'Save team details'}</Button></div>
      </form>
    </Card>}
    {loading ? <Loading/> : orderedTeams.length ? <div className="team-grid">{orderedTeams.map(team => {
      const coordinator = coordinators.find(c => c.id === team.coordinator_id) || (team.coordinator_id === user.id ? user : null)
      return <Card className="team-card" key={team.id}><div className="team-top"><div className="team-emblem"><Users size={19}/></div><StatusPill value={team.availability}/></div><h3>{team.team_name}</h3><p>Response unit · Capacity {team.capacity} people</p><div className="team-location">{coordinator ? `Coordinator: ${coordinator.name}` : 'No coordinator assigned'}{team.location_label ? ` · ${team.location_label}` : ''}{team.current_latitude != null ? ` · ${Number(team.current_latitude).toFixed(3)}, ${Number(team.current_longitude).toFixed(3)}` : ''}</div>{user.role === 'admin' && <div className="team-admin-actions"><Button variant="small" onClick={()=>beginEdit(team)}><Pencil size={13}/>Edit details</Button><button className="subtle-button" onClick={()=>toggleAvailability(team)}>{team.availability === 'available' ? 'Mark offline' : 'Mark available'}</button></div>}</Card>
    })}</div> : <Card><Empty>No response teams yet. Add your first team to begin assigning incidents.</Empty></Card>}
  </>
}
