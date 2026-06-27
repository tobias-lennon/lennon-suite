import { useEffect, useState } from 'react'

interface ChangelogEntry {
  version: string
  date: string
  changes: string[]
}

interface Props {
  forceVisible?: boolean
  onClose?: () => void
}

export default function PatchNotesModal({ forceVisible = false, onClose }: Props) {
  const [entries, setEntries] = useState<ChangelogEntry[]>([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (forceVisible) {
      fetch('/CHANGELOG.json', { cache: 'no-store' })
        .then(r => r.json())
        .then(({ versions }: { versions: ChangelogEntry[] }) => {
          setEntries(versions.slice(0, 5))
          setVisible(true)
        })
        .catch(() => {})
      return
    }

    const seen = localStorage.getItem('patchNotesSeen')
    if (seen === __APP_VERSION__) return

    fetch('/CHANGELOG.json', { cache: 'no-store' })
      .then(r => r.json())
      .then(({ versions }: { versions: ChangelogEntry[] }) => {
        const newEntries = seen
          ? versions.filter(v => v.version > seen)
          : versions.slice(0, 1)

        if (newEntries.length > 0) {
          setEntries(newEntries)
          setVisible(true)
        } else {
          localStorage.setItem('patchNotesSeen', __APP_VERSION__)
        }
      })
      .catch(() => {
        localStorage.setItem('patchNotesSeen', __APP_VERSION__)
      })
  }, [forceVisible])

  function dismiss() {
    if (forceVisible) {
      onClose?.()
    } else {
      localStorage.setItem('patchNotesSeen', __APP_VERSION__)
    }
    setVisible(false)
  }

  if (!visible || entries.length === 0) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,55,20,0.6)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-md rounded-3xl overflow-hidden"
        style={{ background: '#FDFAF5', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}
      >
        {/* Header */}
        <div
          className="px-6 pt-6 pb-5"
          style={{ background: 'linear-gradient(135deg, #0F3714 0%, #1D5823 100%)' }}
        >
          <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: 'rgba(151,181,69,0.8)' }}>
            What's New
          </p>
          <h2 className="text-2xl font-black text-white">v{__APP_VERSION__}</h2>
        </div>

        {/* Change list */}
        <div className="px-6 py-5 max-h-80 overflow-y-auto">
          {entries.map(entry => (
            <div key={entry.version} className={entries.length > 1 ? 'mb-5' : ''}>
              {entries.length > 1 && (
                <p className="text-xs font-bold text-gray-400 mb-2">v{entry.version}</p>
              )}
              <ul className="flex flex-col gap-2.5">
                {entry.changes.map((change, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span
                      className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(151,181,69,0.15)' }}
                    >
                      <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2 2 4-4" stroke="#97B545" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span className="text-sm text-brand-dark leading-snug">{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={dismiss}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all cursor-pointer hover:brightness-95"
            style={{ background: '#97B545', color: '#0F3714' }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
