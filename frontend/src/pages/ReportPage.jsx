import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Send } from 'lucide-react'
import { api } from '../services/api'
import { Button, Card, ErrorNotice, Field, PageHeading, SuccessNotice } from '../components/ui'
import LocationPicker from '../components/LocationPicker'

const initial = {
  disaster_type: '', description: '', location_label: '', latitude: '', longitude: '',
  severity: 'medium', people_affected: '',
}

export default function ReportPage({ user }) {
  const [form, setForm] = useState(initial)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  function change(e) { setForm(current => ({ ...current, [e.target.name]: e.target.value })) }

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError(''); setSuccess('')
    const payload = {
      disaster_type: form.disaster_type.trim(), description: form.description.trim(),
      location_label: form.location_label.trim() || null,
      latitude: Number(form.latitude), longitude: Number(form.longitude), severity: form.severity,
      people_affected: form.people_affected.trim() ? Number(form.people_affected) : null,
    }
    try {
      const item = await api('/api/incidents', { method: 'POST', body: JSON.stringify(payload) })
      setSuccess(`Incident INC-${String(item.id).padStart(4, '0')} recorded and awaiting review.`)
      setForm(initial)
      setTimeout(() => navigate(user.role === 'citizen' ? '/my-reports' : '/'), 1100)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return <>
    <PageHeading eyebrow="INCIDENT INTAKE" title="Record an incident" description="Enter the information your team has received and submit it for review."/>
    <div className="form-layout">
      <Card>
        <form className="form-stack" onSubmit={submit}>
          <ErrorNotice error={error}/><SuccessNotice>{success}</SuccessNotice>
          <div className="form-section-title"><span>01</span><div><b>Incident details</b><small>Incident type and description are required. Add an affected-person estimate if known.</small></div></div>
          <div className="form-row">
            <Field label={<>Incident type <span className="required-mark" aria-hidden="true">*</span></>}><input name="disaster_type" required minLength="2" maxLength="60" value={form.disaster_type} onChange={change} placeholder="Flood, power outage, road closure…"/></Field>
            <Field label="Reported severity"><select name="severity" value={form.severity} onChange={change}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></Field>
          </div>
          <Field label={<>Incident details <span className="required-mark" aria-hidden="true">*</span></>}><textarea name="description" minLength="10" maxLength="5000" rows="5" required value={form.description} onChange={change} placeholder="Describe what is happening and any visible hazards…"/></Field>
          <Field label="Expected people affected (optional)"><input type="number" min="0" max="1000000" step="1" name="people_affected" value={form.people_affected} onChange={change} placeholder="Leave blank if unknown"/></Field>
          <div className="form-section-title space-top"><span>02</span><div><b>Current location</b><small>Search for a place, choose a match, then adjust the pin on the map.</small></div></div>
          <LocationPicker enableCurrentLocation label={form.location_label} latitude={form.latitude} longitude={form.longitude} onChange={location=>setForm(current=>({...current,...location}))}/>
          <div className="form-actions"><span><MapPin size={15}/> Location will be shown to authorized coordinators.</span><Button disabled={busy || !form.latitude || !form.longitude}><Send size={16}/>{busy?'Submitting…':'Submit report'}</Button></div>
        </form>
      </Card>
      <aside className="report-aside">
        <Card className="guidance-card"><div className="guidance-icon"><MapPin/></div><h3>Help responders understand</h3><p>Clear location details, visible hazards, and an estimate of people affected can help coordinators review a report.</p><ul><li>Share only what you know</li><li>Use a safe, approximate location</li><li>Do not include sensitive personal details</li></ul></Card>
        <div className="prototype-note"><b>Coordination workspace</b><p>This workspace does not contact emergency services. If you are in immediate danger, use your local emergency number.</p></div>
      </aside>
    </div>
  </>
}
