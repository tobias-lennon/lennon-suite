import { useRegisterSW } from 'virtual:pwa-register/react'

export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, r) {
      // Check for updates every 60 minutes while the app is open
      if (r) {
        setInterval(() => r.update(), 60 * 60 * 1000)
      }
    },
  })

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
