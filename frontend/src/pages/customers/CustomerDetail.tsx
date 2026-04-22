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
  default_callout_fee: number | null
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
  return <p className="section-label">{children}</p>
}

function typeStyle(type: string) {
  switch (type) {
    case 'maintenance': return 'badge-maintenance'
    case 'site_visit':  return 'badge-site-visit'
    case 'internal':    return 'badge-internal'
    default:            return 'badge-standard'
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
    case 'complete':    return 'badge-complete'
    case 'in_progress': return 'badge-in-progress'
    case 'scheduled':   return 'badge-scheduled'
    default:            return 'badge-backlog'
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
  const [editingCallout, setEditingCallout] = useState(false)
  const [calloutInput, setCalloutInput] = useState('')
  const [savingCallout, setSavingCallout] = useState(false)

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

  async function saveCallout() {
    if (!customer) return
    setSavingCallout(true)
    const fee = calloutInput.trim() === '' ? null : parseFloat(calloutInput)
    const res = await api.patch(`/customers/${id}/rates`, { default_callout_fee: fee })
    setCustomer(prev => prev ? { ...prev, default_callout_fee: res.data.default_callout_fee } : prev)
    setEditingCallout(false)
    setSavingCallout(false)
  }

  async function handleDelete() {
    if (!confirm(`Permanently delete ${customer?.name}? This cannot be undone — all their data will be removed.`)) return
    await api.delete(`/customers/${id}`)
    navigate('/customers')
  }

  if (isLoading) return (
    <div className="p-8 flex justify-center">
      <Spinner className="w-6 h-6 text-brand-lime" />
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
      <button onClick={() => navigate(-1)} className="text-sm flex items-center gap-1 mb-6 transition-colors hover:text-brand-dark" style={{ color: 'rgba(15,55,20,0.45)' }}>
        ← Back
      </button>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-brand-dark">{toTitleCase(customer.name)}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {customer.type && (
                <span className={`inline-flex text-xs font-semibold px-2.5 py-1 rounded-full ${
                  customer.type === 'commercial'
                    ? 'bg-[#DDB01D]/15 text-[#a07f00]'
                    : 'bg-[#97B545]/15 text-[#5a7020]'
                }`}>
                  {customer.type.charAt(0).toUpperCase() + customer.type.slice(1)}
                </span>
              )}
              {stats && (
                <span className={`badge ${
                  stats.is_returning
                    ? 'badge-complete'
                    : stats.total_jobs > 0
                      ? 'badge-backlog'
                      : 'bg-gray-100 text-gray-400'
                }`}>
                  {stats.total_jobs === 0 ? 'No jobs yet' : stats.is_returning ? 'Returning' : 'One-off'}
                </span>
              )}
            </div>
          </div>
          <Link
            to={`/customers/${id}/edit`}
            className="text-sm font-semibold px-4 py-2 rounded-lg border border-black/8 hover:bg-white/70 text-brand-dark transition-colors"
          >
            Edit
          </Link>
        </div>
      </div>

      {/* Details card */}
      <div className="card grid grid-cols-1 md:grid-cols-2 gap-5 p-5 md:p-6 mb-4">

        <div>
          <FieldLabel>Phone</FieldLabel>
          {customer.phone ? (
            <a href={`tel:${phoneHref(customer.phone)}`} className="text-sm text-brand-lime hover:underline font-medium">
              {formatPhone(customer.phone)}
            </a>
          ) : (
            <p className="text-sm" style={{ color: 'rgba(0,0,0,0.25)' }}>—</p>
          )}
        </div>

        <div>
          <FieldLabel>Email</FieldLabel>
          {customer.email ? (
            <a href={`mailto:${customer.email}`} className="text-sm text-brand-lime hover:underline break-all font-medium">
              {customer.email.toLowerCase()}
            </a>
          ) : (
            <p className="text-sm" style={{ color: 'rgba(0,0,0,0.25)' }}>—</p>
          )}
        </div>

        <div>
          <FieldLabel>Address</FieldLabel>
          {addressLines.length > 0 ? (
            <p className="text-sm text-brand-dark leading-relaxed">
              {addressLines.map((line, i) => (
                <span key={i}>{line}{i < addressLines.length - 1 && <br />}</span>
              ))}
            </p>
          ) : (
            <p className="text-sm" style={{ color: 'rgba(0,0,0,0.25)' }}>—</p>
          )}
        </div>

        <div>
          <FieldLabel>Eircode</FieldLabel>
          {addr?.postcode ? (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(addr.postcode)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-lime hover:underline font-semibold tracking-wide"
            >
              {addr.postcode.toUpperCase()}
            </a>
          ) : (
            <p className="text-sm" style={{ color: 'rgba(0,0,0,0.25)' }}>—</p>
          )}
        </div>

        <div>
          <FieldLabel>Rating</FieldLabel>
          <p className="text-sm text-brand-dark">{customer.rating ? `${customer.rating} / 5` : '—'}</p>
        </div>

        <div>
          <FieldLabel>Loyalty Balance</FieldLabel>
          <p className="text-sm">
            {customer.maintenance_hours_balance > 0
              ? <span className="text-brand-lime font-semibold">{customer.maintenance_hours_balance.toFixed(1)} hrs</span>
              : <span style={{ color: 'rgba(0,0,0,0.25)' }}>—</span>
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
                  className="w-20 field-input py-1.5 px-2 pr-6 text-center"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'rgba(15,55,20,0.4)' }}>%</span>
              </div>
              <button
                onClick={saveDiscount}
                disabled={savingDiscount}
                className="flex items-center gap-1 text-xs font-semibold text-brand-lime hover:text-brand-forest disabled:opacity-50"
              >
                {savingDiscount && <Spinner className="w-3 h-3 text-brand-lime" />}
                Save
              </button>
              <button onClick={() => setEditingDiscount(false)} className="text-xs" style={{ color: 'rgba(15,55,20,0.4)' }}>
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-sm">
                {customer.discount_pct > 0
                  ? <span className="font-semibold" style={{ color: '#DDB01D' }}>{customer.discount_pct}% off</span>
                  : <span style={{ color: 'rgba(0,0,0,0.25)' }}>None</span>
                }
              </p>
              <button
                onClick={() => { setDiscountInput(String(customer.discount_pct ?? 0)); setEditingDiscount(true) }}
                className="text-xs transition-colors"
                style={{ color: 'rgba(15,55,20,0.35)' }}
                title="Edit discount"
              >
                ✏
              </button>
            </div>
          )}
        </div>

        <div>
          <FieldLabel>Default Callout Fee</FieldLabel>
          {editingCallout ? (
            <div className="flex items-center gap-2 mt-1">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'rgba(15,55,20,0.4)' }}>€</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={calloutInput}
                  onChange={e => setCalloutInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveCallout(); if (e.key === 'Escape') setEditingCallout(false) }}
                  placeholder="0.00"
                  autoFocus
                  className="w-24 field-input py-1.5 pl-6 pr-2 text-center"
                />
              </div>
              <span className="text-xs" style={{ color: 'rgba(15,55,20,0.4)' }}>ex-VAT</span>
              <button
                onClick={saveCallout}
                disabled={savingCallout}
                className="flex items-center gap-1 text-xs font-semibold text-brand-lime hover:text-brand-forest disabled:opacity-50"
              >
                {savingCallout && <Spinner className="w-3 h-3 text-brand-lime" />}
                Save
              </button>
              <button onClick={() => setEditingCallout(false)} className="text-xs" style={{ color: 'rgba(15,55,20,0.4)' }}>
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-sm">
                {customer.default_callout_fee && customer.default_callout_fee > 0
                  ? <span className="text-brand-dark font-semibold">€{customer.default_callout_fee.toFixed(2)} ex-VAT</span>
                  : <span style={{ color: 'rgba(0,0,0,0.25)' }}>None</span>
                }
              </p>
              <button
                onClick={() => { setCalloutInput(customer.default_callout_fee ? String(customer.default_callout_fee) : ''); setEditingCallout(true) }}
                className="text-xs transition-colors"
                style={{ color: 'rgba(15,55,20,0.35)' }}
                title="Edit callout fee"
              >
                ✏
              </button>
            </div>
          )}
        </div>

      </div>

      {customer.notes && (
        <div className="card p-5 md:p-6 mb-4">
          <p className="section-label">Notes</p>
          <p className="text-sm text-brand-dark whitespace-pre-wrap">{customer.notes}</p>
        </div>
      )}

      {/* Job History */}
      <div className="card p-5 md:p-6 mb-4">
        <p className="section-label">Job History</p>

        {historyLoading ? (
          <div className="flex justify-center py-6">
            <Spinner className="w-5 h-5 text-brand-lime" />
          </div>
        ) : !stats || stats.total_jobs === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'rgba(15,55,20,0.4)' }}>No jobs recorded yet.</p>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5 pb-5 border-b border-black/5">
              <div>
                <p className="text-xs mb-0.5" style={{ color: 'rgba(15,55,20,0.4)' }}>Total Jobs</p>
                <p className="text-lg font-bold text-brand-dark">{stats.total_jobs}</p>
              </div>
              <div>
                <p className="text-xs mb-0.5" style={{ color: 'rgba(15,55,20,0.4)' }}>Total Visits</p>
                <p className="text-lg font-bold text-brand-dark">{stats.total_visits}</p>
              </div>
              <div>
                <p className="text-xs mb-0.5" style={{ color: 'rgba(15,55,20,0.4)' }}>First Job</p>
                <p className="text-sm font-semibold text-brand-dark">{formatDate(stats.first_job_date)}</p>
              </div>
              <div>
                <p className="text-xs mb-0.5" style={{ color: 'rgba(15,55,20,0.4)' }}>Last Job</p>
                <p className="text-sm font-semibold text-brand-dark">{formatDate(stats.last_job_date)}</p>
              </div>
            </div>

            {/* Job list */}
            <div className="divide-y divide-black/5">
              {history!.jobs.map(job => (
                <div
                  key={job.id}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  className="flex items-center justify-between py-3 cursor-pointer rounded-lg -mx-2 px-2 transition-colors hover:bg-black/3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-brand-dark truncate">{job.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`badge ${typeStyle(job.type)}`}>
                          {typeLabel(job.type)}
                        </span>
                        <span className={`badge ${jobStatusStyle(job.status)}`}>
                          {jobStatusLabel(job.status)}
                        </span>
                        {job.scheduled_date && (
                          <span className="text-xs" style={{ color: 'rgba(15,55,20,0.45)' }}>{formatDate(job.scheduled_date)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right ml-4">
                    {job.total_charged > 0 && (
                      <p className="text-sm font-semibold text-brand-dark">
                        €{job.total_charged.toFixed(2)}
                      </p>
                    )}
                    {job.work_logs_count > 0 && (
                      <p className="text-xs" style={{ color: 'rgba(15,55,20,0.4)' }}>{job.work_logs_count} {job.work_logs_count === 1 ? 'visit' : 'visits'}</p>
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
          className="text-sm transition-colors cursor-pointer"
          style={{ color: 'rgba(15,55,20,0.4)' }}
        >
          Archive customer
        </button>
        <button
          onClick={handleDelete}
          className="text-sm text-danger transition-colors cursor-pointer"
        >
          Delete customer
        </button>
      </div>

    </div>
  )
}
