import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const colors = { low: '#36a77b', medium: '#e3a63d', high: '#e06b37', critical: '#d94747' }
function markerIcon(severity) {
  const color = colors[String(severity).toLowerCase()] || '#52718f'
  return L.divIcon({ className: '', html: `<span class="map-marker" style="--marker:${color}"></span>`, iconSize: [18, 18], iconAnchor: [9, 9] })
}

export default function IncidentMap({ incidents = [] }) {
  const positioned = incidents.filter((i) => Number.isFinite(Number(i.latitude)) && Number.isFinite(Number(i.longitude)))
  const center = positioned.length ? [Number(positioned[0].latitude), Number(positioned[0].longitude)] : [20.5937,78.9629]
  return <div className="map-frame"><MapContainer center={center} zoom={positioned.length ? 9 : 4} scrollWheelZoom className="map"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"/>{positioned.map((incident)=><Marker key={incident.id} position={[Number(incident.latitude),Number(incident.longitude)]} icon={markerIcon(incident.severity)}><Popup><b>{incident.disaster_type}</b><br/>{incident.location_label&&<>{incident.location_label}<br/></>}{incident.severity} severity · {incident.status}<br/>{incident.people_affected == null ? 'Affected count not estimated' : `${incident.people_affected} people affected`}</Popup></Marker>)}</MapContainer>{!positioned.length&&<div className="map-empty">Incident locations will appear here</div>}</div>
}
