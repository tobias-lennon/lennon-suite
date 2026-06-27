import { useEffect, useState } from 'react'
import api from '../lib/api'
import Spinner from '../components/Spinner'

interface HoursEntry {
  id: number
  date: string
  job_title: string | null
  customer_name: string | null
  billable_hours: number
}

interface MyHoursData {
  employee: { id: number; name: string } | null
  entries: HoursEntry[]
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function formatHours(h: number): string {
  const days  = Math.floor(h / 6)
  const hours = h % 6
  if (days > 0 && hours > 0) return `${days}d ${hours}h`
  if (days > 0) return `${days}d`
  return `${h}h`
}

export default function MyHours() {
  const [data, setData]     = useState<MyHoursData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  useEffect(() => {
    api.get('/my-hours')
      .then(r => setData(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  const totalHours = data?.entries.reduce((sum, e) => sum + (e.billable_hours ?? 0), 0) ?? 0

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-brand-dark mb-1">My Hours</h1>
      {data?.employee && (
        <p className="text-sm text-gray-400 mb-6">{data.employee.name}</p>
      )}

      {loading && <div className="flex justify-center py-12"><Spinner className="w-6 h-6 text-brand-lime" /></div>}
      {error   && <p className="text-center text-sm text-gray-400 py-12">Could not load hours. Please try again.</p>}

      {!loading && !error && data && (
        <>
          {!data.employee ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-400">No employee record linked to your account.</p>
              <p className="text-xs text-gray-300 mt-1">Ask your manager to set this up.</p>
            </div>
          ) : data.entries.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-12">No hours logged yet.</p>
          ) : (
            <>
              {/* Summary */}
              <div className="card p-4 mb-4 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(15,55,20,0.4)' }}>Total hours logged</p>
                <p className="text-lg font-bold text-brand-dark">{formatHours(totalHours)} <span className="text-sm font-normal text-gray-400">({totalHours} hrs)</span></p>
              </div>

              {/* Entry list */}
              <div className="card divide-y divide-black/5">
                {data.entries.map(entry => (
                  <div key={entry.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-brand-dark leading-snug truncate">
                        {entry.job_title ?? 'Unknown job'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {entry.customer_name && (
                          <p className="text-xs text-gray-400 truncate">{entry.customer_name}</p>
                        )}
                        {entry.date && (
                          <p className="text-xs text-gray-300">{formatDate(entry.date)}</p>
                        )}
                      </div>
                    </div>
                    <p className="text-sm font-bold text-brand-dark flex-shrink-0">
                      {entry.billable_hours}h
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
