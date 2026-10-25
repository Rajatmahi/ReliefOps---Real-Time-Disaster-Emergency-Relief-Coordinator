import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { LocateFixed, MapPin, Search } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import { api } from '../services/api'
import { Button, ErrorNotice } from './ui'

const defaultCenter = [20.5937, 78.9629]
const pinIcon = L.divIcon({ className: '', html: '<span class="map-marker location-pin"></span>', iconSize: [22, 22], iconAnchor: [11, 11] })

function MapClick({ onPick }) {
  useMapEvents({ click: event => onPick(event.latlng.lat, event.latlng.lng) })
  return null
}

function CenterOnSelection({ point }) {
  const map = useMap()
  useEffect(() => {
    if (point) map.flyTo([point.latitude, point.longitude], Math.max(map.getZoom(), 13), { duration: 0.45 })
  }, [map, point?.latitude, point?.longitude])
  return null
}

export default function LocationPicker({ label = '', latitude = '', longitude = '', onChange, enableCurrentLocation = false }) {
  const [query, setQuery] = useState(label)
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const locationRequestRef = useRef(0)
  const point = useMemo(() => {
    const lat = Number(latitude); const lon = Number(longitude)
    return latitude !== '' && longitude !== '' && Number.isFinite(lat) && Number.isFinite(lon) ? { latitude: lat, longitude: lon } : null
  }, [latitude, longitude])

  useEffect(() => { setQuery(label) }, [label])

  async function search(event) {
    event.preventDefault(); locationRequestRef.current += 1; setLocating(false); setError(''); setMessage(''); setResults([])
    if (query.trim().length < 2) return
    setBusy(true)
    try {
      const found = await api(`/api/locations/search?query=${encodeURIComponent(query.trim())}`)
      setResults(found)
      if (!found.length) setMessage('No places found. Try a nearby town, street, or landmark, or click the map to place the pin.')
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  function selectResult(result) {
    locationRequestRef.current += 1; setLocating(false); setError('')
    setQuery(result.display_name); setResults([]); setMessage('Place selected. Click the map or drag the pin to refine the exact location.')
    onChange({ location_label: result.display_name, latitude: String(result.latitude), longitude: String(result.longitude) })
  }

  function pick(lat, lon) {
    locationRequestRef.current += 1; setLocating(false); setError('')
    onChange({ location_label: query.trim() || label, latitude: lat.toFixed(6), longitude: lon.toFixed(6) })
    setMessage('Pin location selected. Drag the marker to adjust it.')
  }

  function dragPin(event) {
    const { lat, lng } = event.target.getLatLng()
    pick(lat, lng)
  }

  function useCurrentLocation() {
    setError(''); setMessage('')
    if (!navigator.geolocation) {
      setError('Current location is not available in this browser. Search for a place or choose a point on the map.')
      return
    }
    const requestId = ++locationRequestRef.current
    setLocating(true)
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      if (requestId !== locationRequestRef.current) return
      const lat = coords.latitude.toFixed(6)
      const lon = coords.longitude.toFixed(6)
      const accuracy = Number.isFinite(coords.accuracy) ? ` (about ${Math.round(coords.accuracy)} m accuracy)` : ''
      let placeName
      try {
        const result = await api(`/api/locations/reverse?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}`)
        placeName = result.display_name
      } catch {
        placeName = `${lat}, ${lon}`
      }
      if (requestId !== locationRequestRef.current) return
      setQuery(placeName)
      setResults([])
      onChange({ location_label: placeName, latitude: lat, longitude: lon })
      setMessage(placeName === `${lat}, ${lon}`
        ? `Exact coordinates selected${accuracy}; place name could not be loaded. Adjust the pin if needed.`
        : `Location set to ${placeName}${accuracy}. Adjust the pin if needed.`)
      setLocating(false)
    }, geolocationError => {
      if (requestId !== locationRequestRef.current) return
      const reason = geolocationError.code === 1
        ? 'Location permission was denied. Allow location access in your browser or choose a place on the map.'
        : geolocationError.code === 3
          ? 'Could not get your location in time. Check that device location is on, then try again or place the pin on the map.'
          : 'Your location could not be determined. Check device location settings or choose a place on the map.'
      setError(reason); setLocating(false)
    }, { enableHighAccuracy: false, timeout: 30000, maximumAge: 300000 })
  }

  return <div className="location-picker">
    <div className="location-search">
      <div className="field"><span>{enableCurrentLocation ? 'Search or use your current location' : 'Search for a place'}</span><div className="location-search-row"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Town, street, landmark, or address" minLength="2" maxLength="120" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();search(e)}}}/><Button type="button" variant="small" onClick={search} disabled={busy || locating || query.trim().length < 2}><Search size={15}/>{busy ? 'Searching…' : 'Search map'}</Button>{enableCurrentLocation && <Button type="button" variant="small" className="current-location-button" onClick={useCurrentLocation} disabled={busy || locating}><LocateFixed size={15}/>{locating ? 'Finding you…' : 'Use my current location'}</Button>}</div></div>
    </div>
    <p className="location-privacy">Search sends the place name to <a href="https://nominatim.openstreetmap.org/" target="_blank" rel="noreferrer">OpenStreetMap Nominatim</a>. Enter a place name only; don’t include incident or personal details.</p>
    {enableCurrentLocation && <p className="location-privacy">Your browser will ask permission to use your location. Coordinates are saved with the report when you submit it.</p>}
    <ErrorNotice error={error}/>
    {results.length > 0 && <div className="location-results" role="listbox" aria-label="Matching places">{results.map((result, index)=><button type="button" role="option" key={`${result.latitude}-${result.longitude}-${index}`} onClick={()=>selectResult(result)}><MapPin size={15}/><span>{result.display_name}</span></button>)}</div>}
    {message && <p className="location-message" role="status">{message}</p>}
    <div className="location-map-wrap"><MapContainer center={point ? [point.latitude, point.longitude] : defaultCenter} zoom={point ? 13 : 5} scrollWheelZoom className="location-map">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"/>
      <MapClick onPick={pick}/><CenterOnSelection point={point}/>
      {point && <Marker position={[point.latitude, point.longitude]} icon={pinIcon} draggable eventHandlers={{ dragend: dragPin}}/>}
    </MapContainer></div>
    <div className="location-selection">{point ? <><MapPin size={15}/><span>{label || 'Selected map point'} · {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}</span></> : <><MapPin size={15}/><span>Search for a place above, then choose a result. You can also click the map to drop a pin.</span></>}</div>
  </div>
}
