import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

declare const __APP_VERSION__: string

const CHECK_INTERVAL_MS  = 30 * 60 * 1000
const THROTTLE_MS        =  5 * 60 * 1000

export default function UpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [isUpdating,  setIsUpdating]  = useState(false)
  const lastCheckAt = useRef(0)

  // Keep SW registered. We intentionally ignore the library's needRefresh state
  // because it uses registration.waiting as its signal, which produces false
  // positives when a stale waiting SW lingers from a previous update cycle.
  const { updateServiceWorker } = useRegisterSW()

  async function checkForUpdate() {
    const now = Date.now()
    if (now - lastCheckAt.current < THROTTLE_MS) return
    lastCheckAt.current = now
    try {
      const res = await fetch(`/version.json?t=${now}`, { cache: 'no-store' })
      if (!res.ok) return
      const { version } = await res.json()
      if (version !== __APP_VERSION__) setNeedRefresh(true)
    } catch { /* offline */ }
  }

  // Periodic background check
  useEffect(() => {
    const id = setInterval(checkForUpdate, CHECK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  // Check whenever the tab becomes visible again
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') checkForUpdate()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  function handleUpdate() {
    setIsUpdating(true)
    // Send SKIP_WAITING to any waiting SW, then reload via controllerchange.
    // The 3s fallback covers the case where there is no waiting SW (autoUpdate
    // already activated it) — a plain reload is sufficient in that case too.
    updateServiceWorker(true)
    setTimeout(() => window.location.reload(), 3000)
  }

  if (!needRefresh) return null

  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
      <div className="bg-[#0F3714] text-white rounded-xl shadow-xl px-4 py-3 flex items-center justify-center gap-3">
        <span className="text-[#97B545] text-lg">↑</span>
        <p className="text-sm font-medium">Update available</p>
        <button
          onClick={handleUpdate}
          disabled={isUpdating}
          className="bg-[#97B545] hover:bg-[#85a03d] disabled:opacity-60 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-2"
        >
          {isUpdating ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Updating…
            </>
          ) : 'Reload'}
        </button>
      </div>
    </div>
  )
}
