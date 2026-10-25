import { useEffect, useRef } from 'react'

// Keep open workspaces in sync when another signed-in teammate changes records.
export function useLiveRefresh(refresh, interval = 15000) {
  const refreshRef = useRef(refresh)
  const inFlight = useRef(false)
  refreshRef.current = refresh

  useEffect(() => {
    let active = true
    const run = async () => {
      if (!active || document.visibilityState === 'hidden' || inFlight.current) return
      inFlight.current = true
      try { await refreshRef.current({ quiet: true }) } catch {} finally { inFlight.current = false }
    }
    const timer = window.setInterval(run, interval)
    const onVisibility = () => { if (document.visibilityState === 'visible') run() }
    window.addEventListener('focus', run)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', run)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [interval])
}
