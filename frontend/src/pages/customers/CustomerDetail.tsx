import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/api'
import { toTitleCase, formatPhone, phoneHref } from '../../lib/formatters'
import Spinner from '../../components/Spinner'

interface Customer {
  id: number
  name: string
  type: string | null
  phone: string | null
  email: string | null
  notes: string | null
  rating: number | null
  discount_pct: number
  maintenance_hours_balance: number
  address: {
    address_line_1: string | null
    address_line_2: string | null
    city: string | null
    county: string | null
    postcode: string | null
  } | null
}

interface JobHistoryStats {
  total_jobs: number
  total_visits: number
  first_job_date: string | null
  last_job_date: string | null
  is_returning: boolean
}

interface JobHistoryItem {
  id: number
  title: string
  type: string
  status: string
  scheduled_date: string | null
  work_logs_count: number
  total_charged: number
}

interface JobHistory {
  stats: JobHistoryStats
  jobs: JobHistoryItem[]
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">{children}</p>
}

function typeStyle(type: string) {
  switch (type) {
    case 'maintenance': return 'bg-blue-100 text-blue-700'
    case 'site_visit':  return 'bg-purple-100 text-purple-700'
    case 'internal':    return 'bg-gray-100 text-gray-600'
    default:            return 'bg-[#97B545]/15 text-[#5a7020]'
  }
}

function typeLabel(type: string) {
  switch (type) {
    case 'maintenance': return 'Maintenance'
    case 'site_visit':  return 'Site Visit'
    case 'internal':    return 'Internal'
    default:            return 'Standard'
  }
}

function jobStatusStyle(status: string) {
  switch (status) {
    case 'complete':    return 'bg-green-100 text-green-700'
    case 'in_progress': return 'bg-amber-100 text-amber-700'
    case 'scheduled':   return 'bg-blue-100 text-blue-700'
    default:            return 'bg-gray-100 text-gray-500'
  }
}

function jobStatusLabel(status: string) {
  switch (status) {
    case 'complete':    return 'Complete'
    case 'in_progress': return 'In Progress'
    case 'scheduled':   return 'Scheduled'
    default:            return 'Backlog'
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [history, setHistory] = useState<JobHistory | null>(null)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [editingDiscount, setEditingDiscount] = useState(false)
  const [discountInput, setDiscountInput] = useState('')
  const [savingDiscount, setSavingDiscount] = useState(false)

  useEffect(() => {
    api.get(`/customers/${id}`)
      .then(r => setCustomer(r.data))
      .catch(() => navigate('/customers'))
      .finally(() => setIsLoading(false))

    api.get(`/customers/${id}/history`)
      .then(r => setHistory(r.data))
      .finally(() => setHistoryLoading(false))
  }, [id])

  async function handleArchive() {
    if (!confirm(`Archive ${customer?.name}? They'll be hidden from your customer list but their data is kept.`)) return
    await api.patch(`/customers/${id}/archive`)
    navigate('/customers')
  }

  async function saveDiscount() {
    if (!customer) return
    setSavingDiscount(true)
    const res = await api.patch(`/customers/${id}/discount`, { discount_pct: parseFloat(discountInput) || 0 })
    setCustomer(prev => prev ? { ...prev, discount_pct: res.data.discount_pct } : prev)
    setEditingDiscount(false)
    setSavingDiscount(false)
  }

  async function handleDelete() {
    if (!confirm(`Permanently delete ${customer?.name}? This cannot be undone — all their data will be removed.`)) return
    await api.delete(`/customers/${id}`)
    navigate('/customers')
  }

  if (isLoading) return (
    <div className="p-8 flex justify-center">
      <Spinner className="w-6 h-6 text-[#97B545]" />
    </div>
  )
  if (!customer) return null

  const addr = customer.address
  const addressLines = [
    toTitleCase(addr?.address_line_1 ?? null),
    toTitleCase(addr?.address_line_2 ?? null),
    toTitleCase(addr?.city ?? null),
    toTitleCase(addr?.county ?? null),
  ].filter(Boolean)

  const stats = history?.stats

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">

      {/* Back */}
      <button onClick={() => navigate(-1)} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-6">
        ← Back
      </button>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#0F3714]">{toTitleCase(customer.name)}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {customer.type && (
                <span className={`inline-flex text-xs font-medium px-2 py-1 rounded-full ${
                  customer.type === 'commercial'
                    ? 'bg-[#DDB01D]/15 text-[#a07f00]'
                    : 'bg-[#97B545]/15 text-[#5a7020]'
                }`}>
                  {customer.type.charAt(0).toUpperCase() + customer.type.slice(1)}
                </span>
              )}
              {stats && (
                <span className={`inline-flex text-xs font-medium px-2 py-1 rounded-full ${
                  stats.is_returning
                    ? 'bg-green-100 text-green-700'
                    : stats.total_jobs > 0
                      ? 'bg-gray-100 text-gray-500'
                      : 'bg-gray-50 text-gray-400'
                }`}>
                  {stats.total_jobs === 0 ? 'No jobs yet' : stats.is_returning ? 'Returning' : 'One-off'}
                </span>
              )}
            </div>
          </div>
          <div className="flex-shrink-0">
            <Link
              to={`/customers/${id}/edit`}
              className="text-sm font-medium px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-300 text-gray-700 transition-colors"
            >
              Edit
            </Link>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white rounded-xl border border-gray-100 p-5 md:p-6 mb-5">

        <div>
          <FieldLabel>Phone</FieldLabel>
          {customer.phone ? (
            <a href={`tel:${phoneHref(customer.phone)}`} className="text-sm text-[#97B545] hover:underline">
              {formatPhone(customer.phone)}
            </a>
          ) : (
            <p className="text-sm text-gray-400">—</p>
          )}
        </div>

        <div>
          <FieldLabel>Email</FieldLabel>
          {customer.email ? (
            <a href={`mailto:${customer.email}`} className="text-sm text-[#97B545] hover:underline break-all">
              {customer.email.toLowerCase()}
            </a>
          ) : (
            <p className="text-sm text-gray-400">—</p>
          )}
        </div>

        <div>
          <FieldLabel>Address</FieldLabel>
          {addressLines.length > 0 ? (
            <p className="text-sm text-gray-800 leading-relaxed">
              {addressLines.map((line, i) => (
                <span key={i}>{line}{i < addressLines.length - 1 && <br />}</span>
              ))}
            </p>
          ) : (
            <p className="text-sm text-gray-400">—</p>
          )}
        </div>

        <div>
          <FieldLabel>Eircode</FieldLabel>
          {addr?.postcode ? (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(addr.postcode)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#97B545] hover:underline font-medium tracking-wide"
            >
              {addr.postcode.toUpperCase()}
            </a>
          ) : (
            <p className="text-sm text-gray-400">—</p>
          )}
        </div>

        <div>
          <FieldLabel>Rating</FieldLabel>
          <p className="text-sm text-gray-800">{customer.rating ? `${customer.rating} / 5` : '—'}</p>
        </div>

        <div>
          <FieldLabel>Loyalty Balance</FieldLabel>
          <p className="text-sm text-gray-800">
            {customer.maintenance_hours_balance > 0
              ? <span className="text-[#97B545] font-medium">{customer.maintenance_hours_balance.toFixed(1)} hrs</span>
              : '—'
            }
          </p>
        </div>

        <div>
          <FieldLabel>Standing Discount</FieldLabel>
          {editingDiscount ? (
            <div className="flex items-center gap-2 mt-1">
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={discountInput}
                  onChange={e => setDiscountInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveDiscount(); if (e.key === 'Escape') setEditingDiscount(false) }}
                  autoFocus
                  className="w-20 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#97B545]"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
              </div>
              <button
                onClick={saveDiscount}
                disabled={savingDiscount}
                className="text-xs font-medium text-[#97B545] hover:text-[#5a7020] disabled:opacity-50"
              >
                {savingDiscount ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditingDiscount(false)} className="text-xs text-gray-400 hover:text-gray-600">
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-800">
                {customer.discount_pct > 0
                  ? <span className="text-amber-700 font-medium">{customer.discount_pct}% off</span>
                  : <span className="text-gray-400">None</span>
                }
              </p>
              <button
                onClick={() => { setDiscountInput(String(customer.discount_pct ?? 0)); setEditingDiscount(true) }}
                className="text-xs text-gray-400 hover:text-gray-600"
                title="Edit discount"
              >
                ✏
              </button>
            </div>
          )}
        </div>

      </div>

      {customer.notes && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 md:p-6 mb-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2">Notes</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{customer.notes}</p>
        </div>
      )}

      {/* Job History */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 md:p-6 mb-5">
        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-4">Job History</p>

        {historyLoading ? (
          <div className="flex justify-center py-6">
            <Spinner className="w-5 h-5 text-[#97B545]" />
          </div>
        ) : !stats || stats.total_jobs === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No jobs recorded yet.</p>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5 pb-5 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Total Jobs</p>
                <p className="text-lg font-semibold text-[#0F3714]">{stats.total_jobs}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Total Visits</p>
                <p className="text-lg font-semibold text-[#0F3714]">{stats.total_visits}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">First Job</p>
                <p className="text-sm font-medium text-gray-700">{formatDate(stats.first_job_date)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Last Job</p>
                <p className="text-sm font-medium text-gray-700">{formatDate(stats.last_job_date)}</p>
              </div>
            </div>

            {/* Job list */}
            <div className="divide-y divide-gray-50">
              {history!.jobs.map(job => (
                <div
                  key={job.id}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  className="flex items-center justify-between py-3 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{job.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${typeStyle(job.type)}`}>
                          {typeLabel(job.type)}
                        </span>
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${jobStatusStyle(job.status)}`}>
                          {jobStatusLabel(job.status)}
                        </span>
                        {job.scheduled_date && (
                          <span className="text-xs text-gray-400">{formatDate(job.scheduled_date)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right ml-4">
                    {job.total_charged > 0 && (
                      <p className="text-sm font-medium text-gray-800">
                        €{job.total_charged.toFixed(2)}
                      </p>
                    )}
                    {job.work_logs_count > 0 && (
                      <p className="text-xs text-gray-400">{job.work_logs_count} {job.work_logs_count === 1 ? 'visit' : 'visits'}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Archive / Delete */}
      <div className="flex items-center gap-6 pt-2 pb-4">
        <button
          onClick={handleArchive}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
        >
          Archive customer
        </button>
        <button
          onClick={handleDelete}
          className="text-sm text-red-400 hover:text-red-600 transition-colors cursor-pointer"
        >
          Delete customer
        </button>
      </div>

    </div>
  )
}
