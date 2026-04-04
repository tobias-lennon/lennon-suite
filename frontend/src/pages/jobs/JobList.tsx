import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../../lib/api'
import { toTitleCase } from '../../lib/formatters'
import Spinner from '../../components/Spinner'

interface Job {
  id: number
  title: string
  type: 'standard' | 'maintenance' | 'site_visit'
  status: 'backlog' | 'scheduled' | 'in_progress' | 'complete'
  priority: 'normal' | 'high' | 'urgent'
  scheduled_date: string | null
  work_logs_count: number
  customer: { id: number; name: string; address?: { postcode: string | null } | null }
}

interface Paginated {
  data: Job[]
  current_page: number
  last_page: number
  total: number
}

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'backlog', label: 'Backlog' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'complete', label: 'Complete' },
]

const TYPE_LABELS: Record<string, string> = {
  standard: 'Standard',
  maintenance: 'Maintenance',
  site_visit: 'Site Visit',
  internal: 'Internal',
}

const PRIORITY_COLOURS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-800',
  high: 'bg-yellow-100 text-yellow-800',
  normal: 'bg-gray-100 text-gray-600',
}

const STATUS_COLOURS: Record<string, string> = {
  backlog: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  complete: 'bg-green-100 text-green-800',
}

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  complete: 'Complete',
}

export default function JobList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [result, setResult] = useState<Paginated | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const status = searchParams.get('status') ?? ''
  const search = searchParams.get('search') ?? ''
  const page = Number(searchParams.get('page') ?? 1)
  const sort = searchParams.get('sort') ?? 'created_at_desc'

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    const params: Record<string, string> = { page: String(page), sort }
    if (status) params.status = status
    if (search) params.search = search

    api.get('/jobs', { params }).then(res => {
      if (!cancelled) {
        setResult(res.data)
        setIsLoading(false)
      }
    })

    return () => { cancelled = true }
  }, [status, search, page, sort])

  function setParam(key: string, value: string) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      if (key !== 'page') next.delete('page')
      return next
    })
  }

  function toggleSort(field: string) {
    const asc = `${field}_asc`
    const desc = `${field}_desc`
    setParam('sort', sort === asc ? desc : asc)
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Jobs</h1>
        <Link
          to="/jobs/new"
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: '#97B545' }}
        >
          + Add job
        </Link>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="search"
          placeholder="Search by job title or customer name…"
          value={search}
          onChange={e => setParam('search', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545]"
        />
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setParam('status', tab.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              status === tab.value
                ? 'text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            style={status === tab.value ? { backgroundColor: '#0F3714' } : {}}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sort row */}
      <div className="flex gap-3 text-xs text-gray-500 mb-3">
        <button onClick={() => toggleSort('scheduled_date')} className="hover:text-gray-800">
          Date {sort.startsWith('scheduled_date') ? (sort.endsWith('asc') ? '↑' : '↓') : '↕'}
        </button>
        <button onClick={() => toggleSort('priority')} className="hover:text-gray-800">
          Priority {sort === 'priority_desc' ? '↓' : '↕'}
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}

      {/* Empty */}
      {!isLoading && result?.data.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No jobs found.{' '}
          <Link to="/jobs/new" className="underline" style={{ color: '#97B545' }}>
            Add one?
          </Link>
        </div>
      )}

      {/* Desktop table */}
      {!isLoading && (result?.data.length ?? 0) > 0 && (
        <>
          <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Job</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Priority</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Logs</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {result?.data.map(job => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {toTitleCase(job.customer?.name)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{job.title}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500">{TYPE_LABELS[job.type]}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOURS[job.status]}`}>
                        {STATUS_LABELS[job.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {job.priority !== 'normal' && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLOURS[job.priority]}`}>
                          {job.priority.charAt(0).toUpperCase() + job.priority.slice(1)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString('en-IE') : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{job.work_logs_count}</td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/jobs/${job.id}`}
                        className="text-xs font-medium hover:underline"
                        style={{ color: '#97B545' }}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {result?.data.map(job => (
              <Link key={job.id} to={`/jobs/${job.id}`} className="block bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{job.title}</p>
                    <p className="text-sm text-gray-500 truncate">{toTitleCase(job.customer?.name)}</p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOURS[job.status]}`}>
                    {STATUS_LABELS[job.status]}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                  <span>{TYPE_LABELS[job.type]}</span>
                  {job.priority !== 'normal' && (
                    <span className={`px-1.5 py-0.5 rounded-full ${PRIORITY_COLOURS[job.priority]}`}>
                      {job.priority}
                    </span>
                  )}
                  {job.scheduled_date && (
                    <span>{new Date(job.scheduled_date).toLocaleDateString('en-IE')}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Pagination */}
      {!isLoading && (result?.last_page ?? 1) > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <button
            disabled={page <= 1}
            onClick={() => setParam('page', String(page - 1))}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            ← Prev
          </button>
          <span>Page {page} of {result?.last_page}</span>
          <button
            disabled={page >= (result?.last_page ?? 1)}
            onClick={() => setParam('page', String(page + 1))}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
