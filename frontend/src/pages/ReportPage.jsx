import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ImagePlus, MapPin, Send, X } from 'lucide-react'
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
  const [photosBusy, setPhotosBusy] = useState(false)
  const [photos, setPhotos] = useState([])
  const navigate = useNavigate()

  function change(e) { setForm(current => ({ ...current, [e.target.name]: e.target.value })) }

  async function choosePhotos(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    if (photos.length + files.length > 5) {
      setError('You can attach up to 5 images. Remove an image before adding more.')
      return
    }
    if (files.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
      setError('Choose JPG, PNG, or WebP images.')
      return
    }
    if (files.some(file => file.size > 3 * 1024 * 1024)) {
      setError('Each image must be smaller than 3 MB.')
      return
    }
    setPhotosBusy(true)
    try {
      const loaded = await Promise.all(files.map(file => new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve({ data: String(reader.result), name: file.name })
        reader.onerror = () => reject(new Error('Could not read one of those images. Please choose again.'))
        reader.readAsDataURL(file)
      })))
      setPhotos(current => [...current, ...loaded])
      setError('')
    } catch (err) { setError(err.message) } finally { setPhotosBusy(false) }
  }

  async function submit(e) {
    e.preventDefault(); setError(''); setSuccess('')
    if (!user.name?.trim()) {
      setError('Add your name to your account profile before submitting an incident report.')
      return
    }
    if (photosBusy) {
      setError('Wait for the selected images to finish loading before submitting the report.')
      return
    }
    setBusy(true)
    const payload = {
      disaster_type: form.disaster_type.trim(), description: form.description.trim(),
      photos_data: photos.map(photo => photo.data),
      location_label: form.location_label.trim() || null,
      latitude: Number(form.latitude), longitude: Number(form.longitude), severity: form.severity,
      people_affected: form.people_affected.trim() ? Number(form.people_affected) : null,
    }
    try {
      const item = await api('/api/incidents', { method: 'POST', body: JSON.stringify(payload) })
      setSuccess(`Incident INC-${String(item.id).padStart(4, '0')} recorded and awaiting review.`)
      setForm(initial)
      setPhotos([])
      setTimeout(() => navigate(user.role === 'citizen' ? '/my-reports' : '/'), 1100)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return <>
    <PageHeading eyebrow="INCIDENT INTAKE" title="Record an incident" description="Enter the information your team has received and submit it for review."/>
    <div className="report-form-layout">
      <Card>
        <form className="form-stack" onSubmit={submit}>
          <ErrorNotice error={error}/><SuccessNotice>{success}</SuccessNotice>
          <div className="form-section-title"><span>01</span><div><b>Incident details</b><small>Incident type and description are required. Add an affected-person estimate if known.</small></div></div>
          <Field label={<>Reporter name <span className="required-mark" aria-hidden="true">*</span></>}><input value={user.name || ''} readOnly aria-readonly="true" required autoComplete="name"/><small>Your account name is required and will be included on this report.</small></Field>
          <div className="form-row">
            <Field label={<>Incident type <span className="required-mark" aria-hidden="true">*</span></>}><input name="disaster_type" required minLength="2" maxLength="60" value={form.disaster_type} onChange={change} placeholder="Flood, power outage, road closure…"/></Field>
            <Field label="Reported severity"><select name="severity" value={form.severity} onChange={change}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></Field>
          </div>
          <Field label={<>Incident details <span className="required-mark" aria-hidden="true">*</span></>}><textarea name="description" minLength="10" maxLength="5000" rows="5" required value={form.description} onChange={change} placeholder="Describe what is happening and any visible hazards…"/></Field>
          <div className="field"><span>Photos (optional)</span><label className={`photo-upload ${photos.length>=5||photosBusy?'is-disabled':''}`} htmlFor="incident-photos"><ImagePlus size={18}/><span><b>{photosBusy?'Reading images…':photos.length>=5?'5 images selected · remove one to replace':photos.length?`Add images · ${photos.length}/5 selected`:'Add up to 5 images'}</b><small>JPG, PNG, or WebP · up to 3 MB each</small></span><input id="incident-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={photos.length>=5||photosBusy} onChange={choosePhotos}/></label>{photos.length>0&&<><small className="photo-upload-confirmation">{photos.length} selected {photos.length===1?'image is':'images are'} attached to this report when submitted.</small><div className="photo-preview-grid">{photos.map((photo,index)=><div className="photo-preview" key={`${photo.name}-${index}`}><img src={photo.data} alt={`Selected incident image ${index+1}: ${photo.name}`}/><button type="button" className="photo-remove" aria-label={`Remove ${photo.name}`} onClick={()=>setPhotos(current=>current.filter((_,i)=>i!==index))}><X size={16}/></button><small title={photo.name}>{photo.name}</small></div>)}</div></>}</div>
          <Field label="Expected people affected (optional)"><input type="number" min="0" max="1000000" step="1" name="people_affected" value={form.people_affected} onChange={change} placeholder="Leave blank if unknown"/></Field>
          <div className="form-section-title space-top"><span>02</span><div><b>Location</b><small>Search for a place, choose a match, then adjust the pin on the map.</small></div></div>
          <LocationPicker enableCurrentLocation label={form.location_label} latitude={form.latitude} longitude={form.longitude} onChange={location=>setForm(current=>({...current,...location}))}/>
          <div className="form-actions"><span><MapPin size={15}/> Location will be shown to authorized coordinators.</span><Button disabled={busy || photosBusy || !form.latitude || !form.longitude}><Send size={16}/>{busy?'Submitting…':'Submit report'}</Button></div>
        </form>
      </Card>
    </div>
  </>
}
