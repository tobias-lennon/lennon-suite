import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, r) {
      if (!r) return
      // Check immediately in case an update was already waiting
      r.update()
      // Then re-check every 30 minutes
      setInterval(() => r.update(), 30 * 60 * 1000)
    },
  })

  useEffect(() => {
    // Also check when the tab regains focus (e.g. brother switches back to app)
    function onVisible() {
      if (document.visibilityState === 'visible') {
        navigator.serviceWorker?.getRegistration().then(r => r?.update())
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
      <div className="bg-[#0F3714] text-white rounded-xl shadow-xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[#97B545] text-lg shrink-0">↑</span>
          <p className="text-sm font-medium truncate">Update available</p>
        </div>
        <button
          onClick={() => updateServiceWorker(true)}
          className="shrink-0 bg-[#97B545] hover:bg-[#85a03d] text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
        >
          Reload
        </button>
      </div>
    </div>
  )
}
