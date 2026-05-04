import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export default function UpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_swUrl, r) {
      if (!r) return
      r.update()
      setInterval(() => r.update(), 30 * 60 * 1000)
    },
  })

  useEffect(() => {
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
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
      <div className="bg-[#0F3714] text-white rounded-xl shadow-xl px-4 py-3 flex items-center justify-center gap-3">
        <span className="text-[#97B545] text-lg">↑</span>
        <p className="text-sm font-medium">Update available</p>
        <button
          onClick={() => updateServiceWorker(true)}
          className="bg-[#97B545] hover:bg-[#85a03d] text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
        >
          Reload
        </button>
      </div>
    </div>
  )
}
