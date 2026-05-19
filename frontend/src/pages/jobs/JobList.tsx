import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../lib/api'
import { toTitleCase, formatEstimation } from '../../lib/formatters'
import Spinner from '../../components/Spinner'

function InvoiceTag({ job }: { job: Job }) {
  const navigate = useNavigate()
  if (job.type === 'internal' || job.status !== 'complete') return null
  if (job.invoice) {
    const mod = job.invoice.status === 'paid' ? 'badge-paid' : job.invoice.status === 'sent' ? 'badge-sent' : 'badge-draft'
    const label = job.invoice.status === 'paid' ? 'Paid' : job.invoice.status === 'sent' ? 'Sent' : 'Not Sent'
    return (
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); navigate(`/invoices/${job.invoice!.id}`) }}
        className={`badge ${mod}`}
        title={job.invoice.invoice_number}
      >
        {label}
      </button>
    )
  }
  return <span className="badge badge-warning" style={{ background: 'rgba(221,176,29,0.18)', color: '#0F3714' }}>Invoice needed</span>
}

interface InvoiceSummary {
  id: number
  invoice_number: string
  status: string
}

interface Job {
  id: number
  title: string
  type: 'standard' | 'maintenance' | 'site_visit' | 'internal'
  status: 'backlog' | 'scheduled' | 'in_progress' | 'complete'
  priority: 'normal' | 'high' | 'urgent'
  scheduled_date: string | null
  due_by: string | null
  estimated_hours: number | null
  work_logs_count: number
  customer: { id: number; name: string; address?: { postcode: string | null } | null } | null
  invoice: InvoiceSummary | null
}

interface Paginated {
  data: Job[]
  current_page: number
  last_page: number
  total: number
  estimated_hours_total: number
}

const STATUS_TABS = [
  { value: '', label: 'Active' },
  { value: 'backlog', label: 'Backlog' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'complete', label: 'Completed' },
]

const TYPE_LABELS: Record<string, string> = {
  standard: 'Standard',
  maintenance: 'Maintenance',
  site_visit: 'Site Visit',
  internal: 'Internal',
}

const PRIORITY_COLOURS: Record<string, string> = {
  urgent: 'badge-urgent',
  high:   'badge-high',
  normal: 'badge-normal',
}

const STATUS_COLOURS: Record<string, string> = {
  backlog:     'badge-backlog',
  scheduled:   'badge-scheduled',
  in_progress: 'badge-in-progress',
  complete:    'badge-complete',
}

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  complete: 'Complete',
}

function dueBadge(dueBy: string | null, status: string) {
  if (!dueBy || status === 'complete') return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(dueBy + 'T12:00:00')
  const diff = Math.floor((due.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return <span style={{ color: '#B84A2A', fontWeight: 600 }} className="text-xs">Due {due.toLocaleDateString('en-IE')} · Overdue</span>
  const countdown = diff === 0 ? 'Today' : diff < 14 ? `${diff}d` : `${Math.round(diff / 7)}w`
  const color = diff === 0 ? '#B84A2A' : diff <= 7 ? '#DDB01D' : 'rgba(15,55,20,0.5)'
  return <span style={{ color, fontWeight: diff <= 7 ? 600 : 400 }} className="text-xs">Due {due.toLocaleDateString('en-IE')} · {countdown}</span>
}

export default function JobList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [result, setResult] = useState<Paginated | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const status = searchParams.get('status') ?? ''
  const search = searchParams.get('search') ?? ''
  const page = Number(searchParams.get('page') ?? 1)
  const sort = searchParams.get('sort') ?? 'created_at_desc'

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setLoadError(false)

    const params: Record<string, string> = { page: String(page), sort }
    if (status) params.status = status
    if (search) params.search = search

    api.get('/jobs', { params })
      .then(res => { if (!cancelled) setResult(res.data) })
      .catch(() => { if (!cancelled) setLoadError(true) })
      .finally(() => { if (!cancelled) setIsLoading(false) })

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
        <h1 className="text-2xl font-bold text-brand-dark">Jobs</h1>
        <Link
          to="/jobs/new"
          className="px-4 py-2.5 rounded-lg text-sm font-bold transition-all hover:brightness-95"
          style={{ background: '#97B545', color: '#0F3714' }}
        >
          + Add job
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(15,55,20,0.35)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          placeholder="Search by job title or customer name…"
          value={search}
          onChange={e => setParam('search', e.target.value)}
          className="field-input pl-10"
        />
      </div>

      {/* Backlog total — only shown on Active tab */}
      {!isLoading && !loadError && !status && (result?.estimated_hours_total ?? 0) > 0 && (
        <div
          className="mb-4 px-4 py-3 rounded-xl flex items-center justify-between"
          style={{ background: 'rgba(151,181,69,0.12)', border: '1px solid rgba(151,181,69,0.3)' }}
        >
          <span className="text-sm font-semibold" style={{ color: '#0F3714' }}>
            Active backlog
          </span>
          <span className="text-sm font-bold" style={{ color: '#3a6e0f' }}>
            {formatEstimation(result!.estimated_hours_total)} of work
          </span>
        </div>
      )}

      {/* Status tabs */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto scrollbar-none pb-0.5 flex-nowrap">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setParam('status', tab.value)}
            className="shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all"
            style={status === tab.value
              ? { background: '#0F3714', color: 'white' }
              : { background: 'rgba(255,255,255,0.7)', color: 'rgba(15,55,20,0.6)' }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sort row */}
      <div className="flex gap-3 text-xs mb-3" style={{ color: 'rgba(15,55,20,0.45)' }}>
        <button onClick={() => toggleSort('scheduled_date')} className="hover:text-brand-dark transition-colors">
          Date {sort.startsWith('scheduled_date') ? (sort.endsWith('asc') ? '↑' : '↓') : '↕'}
        </button>
        <button onClick={() => toggleSort('priority')} className="hover:text-brand-dark transition-colors">
          Priority {sort === 'priority_desc' ? '↓' : '↕'}
        </button>
        <button onClick={() => setParam('sort', sort === 'due_by_asc' ? 'created_at_desc' : 'due_by_asc')} className="hover:text-brand-dark transition-colors">
          Due By {sort === 'due_by_asc' ? '↑' : '↕'}
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner className="w-6 h-6 text-brand-lime" />
        </div>
      )}

      {/* Error */}
      {!isLoading && loadError && (
        <div className="text-center py-12 text-sm" style={{ color: 'rgba(185,74,42,0.8)' }}>
          Could not load jobs. Please try again.
        </div>
      )}

      {/* Empty */}
      {!isLoading && !loadError && result?.data.length === 0 && (
        <div className="text-center py-12" style={{ color: 'rgba(15,55,20,0.4)' }}>
          No jobs found.{' '}
          <Link to="/jobs/new" className="underline text-brand-lime">Add one?</Link>
        </div>
      )}

      {!isLoading && !loadError && (result?.data.length ?? 0) > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block table-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="thead-dark text-left">
                  <th>Customer</th>
                  <th>Job</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Est.</th>
                  <th>Date</th>
                  <th>Due By</th>
                  <th>Logs</th>
                  <th>Invoice</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-black/4">
                {result?.data.map(job => (
                  <tr key={job.id} onClick={() => navigate(`/jobs/${job.id}`)} className="tr-hover cursor-pointer transition-colors">
                    <td className="px-4 py-3 font-semibold text-brand-dark">
                      {toTitleCase(job.customer?.name ?? null)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{job.title}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs" style={{ color: 'rgba(15,55,20,0.5)' }}>{TYPE_LABELS[job.type]}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${STATUS_COLOURS[job.status]}`}>
                        {STATUS_LABELS[job.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {job.priority !== 'normal' && (
                        <span className={`badge ${PRIORITY_COLOURS[job.priority]}`}>
                          {job.priority.charAt(0).toUpperCase() + job.priority.slice(1)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'rgba(15,55,20,0.5)' }}>
                      {formatEstimation(job.estimated_hours) ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'rgba(15,55,20,0.5)' }}>
                      {job.scheduled_date && job.status !== 'backlog' ? new Date(job.scheduled_date + 'T12:00:00').toLocaleDateString('en-IE') : '—'}
                    </td>
                    <td className="px-4 py-3">{dueBadge(job.due_by, job.status) ?? <span className="text-xs" style={{ color: 'rgba(15,55,20,0.3)' }}>—</span>}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'rgba(15,55,20,0.5)' }}>{job.work_logs_count}</td>
                    <td className="px-4 py-3">
                      <InvoiceTag job={job} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold text-brand-lime">View →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {result?.data.map(job => (
              <div key={job.id} onClick={() => navigate(`/jobs/${job.id}`)} className="row-card cursor-pointer active:opacity-80 transition-opacity">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-brand-dark truncate">{job.title}</p>
                    <p className="text-sm mt-0.5 truncate" style={{ color: 'rgba(15,55,20,0.55)' }}>
                      {toTitleCase(job.customer?.name ?? null)}
                    </p>
                  </div>
                  <span className={`badge ${STATUS_COLOURS[job.status]}`}>
                    {STATUS_LABELS[job.status]}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2.5 flex-wrap text-xs" style={{ color: 'rgba(15,55,20,0.45)' }}>
                  <span>{TYPE_LABELS[job.type]}</span>
                  {job.priority !== 'normal' && (
                    <span className={`badge ${PRIORITY_COLOURS[job.priority]}`}>
                      {job.priority.charAt(0).toUpperCase() + job.priority.slice(1)}
                    </span>
                  )}
                  {job.estimated_hours != null && (
                    <span>{formatEstimation(job.estimated_hours)}</span>
                  )}
                  {job.scheduled_date && job.status !== 'backlog' && (
                    <span>{new Date(job.scheduled_date + 'T12:00:00').toLocaleDateString('en-IE')}</span>
                  )}
                  {dueBadge(job.due_by, job.status)}
                  <InvoiceTag job={job} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Pagination */}
      {!isLoading && (result?.last_page ?? 1) > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm" style={{ color: 'rgba(15,55,20,0.5)' }}>
          <button
            disabled={page <= 1}
            onClick={() => setParam('page', String(page - 1))}
            className="px-3 py-1.5 rounded-lg border border-black/8 disabled:opacity-40 hover:bg-white/60 transition-colors"
          >
            ← Prev
          </button>
          <span>Page {page} of {result?.last_page}</span>
          <button
            disabled={page >= (result?.last_page ?? 1)}
            onClick={() => setParam('page', String(page + 1))}
            className="px-3 py-1.5 rounded-lg border border-black/8 disabled:opacity-40 hover:bg-white/60 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
