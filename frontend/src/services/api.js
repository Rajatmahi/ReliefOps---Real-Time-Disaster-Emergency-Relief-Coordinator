const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

export async function api(path, options = {}) {
  const token = localStorage.getItem('access_token')
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }
  const response = await fetch(`${API_BASE}${path}`, { cache: 'no-store', ...options, headers })
  const data = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(data?.detail || `Request failed (${response.status})`)
    error.status = response.status
    throw error
  }
  return data
}

export const endpoints = {
  incidents: (params = '') => api(`/api/incidents${params}`),
  allIncidents: async () => {
    const pageSize = 100
    const rows = []
    let beforeId = null
    for (;;) {
      const cursor = beforeId ? `&before_id=${beforeId}` : ''
      const page = await api(`/api/incidents?limit=${pageSize}${cursor}`)
      rows.push(...page)
      if (page.length < pageSize) return rows
      beforeId = Math.min(...page.map(item => item.id))
    }
  },
  incident: (id) => api(`/api/incidents/${id}`),
  incidentPhoto: (id) => api(`/api/incidents/${id}/photo`),
  history: (id) => api(`/api/incidents/${id}/history`),
  teams: () => api('/api/teams'),
  assignments: () => api('/api/assignments'),
  inventory: () => api('/api/inventory'),
}
