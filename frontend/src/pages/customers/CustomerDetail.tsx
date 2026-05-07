import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/api'
import { toTitleCase, formatPhone, phoneHref } from '../../lib/formatters'
import { usePermissions } from '../../hooks/usePermissions'
import Spinner from '../../components/Spinner'

interface Customer {
  id: number
  name: string
  type: string | null
  phone: string | null
  email: string | null
  notes: string | null
  rating: number | null
  minutes_from_hq: number | null
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
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { canEditCustomer } = usePermissions()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [history, setHistory] = useState<JobHistory | null>(null)
  const [historyLoading, setHistoryLoading] = useState(true)

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

      {/* Back — mobile only */}
      <button onClick={() => navigate(-1)} className="md:hidden text-sm flex items-center gap-1 mb-5 transition-colors hover:text-brand-dark" style={{ color: 'rgba(15,55,20,0.45)' }}>
        ← Back
      </button>

      {/* Profile card */}
      <div className="rounded-3xl overflow-hidden mb-4" style={{ boxShadow: '0 2px 16px rgba(15,55,20,0.08)' }}>

        {/* Zone 1 — Header */}
        <div className="px-6 py-5 flex items-start justify-between gap-4" style={{ background: '#0F3714' }}>
          <div>
            <h1 className="text-2xl font-black text-white leading-tight">{toTitleCase(customer.name)}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {customer.type && (
                <span className={`inline-flex text-xs font-bold px-2.5 py-1 rounded-full ${
                  customer.type === 'commercial'
                    ? 'bg-[#DDB01D]/20 text-[#DDB01D]'
                    : 'bg-[#97B545]/20 text-[#97B545]'
                }`}>
                  {customer.type.charAt(0).toUpperCase() + customer.type.slice(1)}
                </span>
              )}
              {stats && (
                <span className={`inline-flex text-xs font-bold px-2.5 py-1 rounded-full ${
                  stats.total_jobs === 0
                    ? 'bg-white/10 text-white/40'
                    : stats.is_returning
                      ? 'bg-[#97B545]/20 text-[#97B545]'
                      : 'bg-white/10 text-white/60'
                }`}>
                  {stats.total_jobs === 0 ? 'No jobs yet' : stats.is_returning ? 'Returning' : 'One-off'}
                </span>
              )}
            </div>
          </div>
          {canEditCustomer && (
            <Link
              to={`/customers/${id}/edit`}
              className="shrink-0 text-xs font-bold px-3.5 py-2 rounded-xl transition-all hover:brightness-110"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.75)' }}
            >
              Edit
            </Link>
          )}
        </div>

        {/* Zone 2 — Body */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x" style={{ background: 'white', borderColor: 'rgba(15,55,20,0.07)' }}>

          {/* Left — Contact */}
          <div className="p-5 flex flex-col gap-4">

            {/* Phone */}
            {customer.phone ? (
              <a href={`tel:${phoneHref(customer.phone)}`} className="flex items-center gap-3 group">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(151,181,69,0.12)' }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{ color: '#97B545' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(15,55,20,0.4)' }}>Phone</p>
                  <p className="text-sm font-semibold text-brand-lime">{formatPhone(customer.phone)}</p>
                </div>
              </a>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(0,0,0,0.04)' }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{ color: 'rgba(0,0,0,0.2)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(15,55,20,0.4)' }}>Phone</p>
                  <p className="text-sm" style={{ color: 'rgba(0,0,0,0.25)' }}>—</p>
                </div>
              </div>
            )}

            {/* Email */}
            {customer.email ? (
              <a href={`mailto:${customer.email}`} className="flex items-center gap-3 group">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(151,181,69,0.12)' }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{ color: '#97B545' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(15,55,20,0.4)' }}>Email</p>
                  <p className="text-sm font-semibold text-brand-lime truncate">{customer.email.toLowerCase()}</p>
                </div>
              </a>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(0,0,0,0.04)' }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{ color: 'rgba(0,0,0,0.2)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(15,55,20,0.4)' }}>Email</p>
                  <p className="text-sm" style={{ color: 'rgba(0,0,0,0.25)' }}>—</p>
                </div>
              </div>
            )}

            {/* Address + Eircode */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: addressLines.length > 0 ? 'rgba(151,181,69,0.12)' : 'rgba(0,0,0,0.04)' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{ color: addressLines.length > 0 ? '#97B545' : 'rgba(0,0,0,0.2)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(15,55,20,0.4)' }}>Address</p>
                {addressLines.length > 0 ? (
                  <p className="text-sm text-brand-dark leading-relaxed mt-0.5">
                    {addressLines.map((line, i) => (
                      <span key={i}>{line}{i < addressLines.length - 1 && <br />}</span>
                    ))}
                  </p>
                ) : (
                  <p className="text-sm mt-0.5" style={{ color: 'rgba(0,0,0,0.25)' }}>—</p>
                )}
                {addr?.postcode && (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(addr.postcode)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold mt-1.5 transition-colors hover:text-brand-lime"
                    style={{ color: '#97B545' }}
                  >
                    {addr.postcode.toUpperCase()}
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            </div>

          </div>

          {/* Right — Metrics */}
          <div className="p-5 grid grid-cols-2 gap-3 content-start">

            {customer.rating != null && (
              <div className="rounded-2xl p-3.5" style={{ background: 'rgba(15,55,20,0.04)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(15,55,20,0.4)' }}>Rating</p>
                <p className="text-xl font-black text-brand-dark mt-1">{customer.rating}<span className="text-sm font-semibold" style={{ color: 'rgba(15,55,20,0.35)' }}> / 5</span></p>
              </div>
            )}

            {customer.minutes_from_hq != null && (
              <div className="rounded-2xl p-3.5" style={{ background: 'rgba(15,55,20,0.04)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(15,55,20,0.4)' }}>Drive</p>
                <p className="text-xl font-black text-brand-dark mt-1">{customer.minutes_from_hq}<span className="text-sm font-semibold" style={{ color: 'rgba(15,55,20,0.35)' }}> min</span></p>
              </div>
            )}

            {customer.maintenance_hours_balance > 0 && (
              <div className="rounded-2xl p-3.5" style={{ background: 'rgba(151,181,69,0.12)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(15,55,20,0.4)' }}>Loyalty</p>
                <p className="text-xl font-black mt-1" style={{ color: '#97B545' }}>{customer.maintenance_hours_balance.toFixed(1)}<span className="text-sm font-semibold" style={{ color: 'rgba(151,181,69,0.6)' }}> hrs</span></p>
              </div>
            )}

            {customer.discount_pct > 0 && (
              <div className="rounded-2xl p-3.5" style={{ background: 'rgba(221,176,29,0.1)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(15,55,20,0.4)' }}>Discount</p>
                <p className="text-xl font-black mt-1" style={{ color: '#DDB01D' }}>{customer.discount_pct}<span className="text-sm font-semibold" style={{ color: 'rgba(221,176,29,0.6)' }}>% off</span></p>
              </div>
            )}

            {customer.default_callout_fee != null && customer.default_callout_fee > 0 && (
              <div className="col-span-2 rounded-2xl p-3.5" style={{ background: 'rgba(15,55,20,0.04)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(15,55,20,0.4)' }}>Default Callout</p>
                <p className="text-xl font-black text-brand-dark mt-1">€{Number(customer.default_callout_fee).toFixed(2)}<span className="text-sm font-semibold" style={{ color: 'rgba(15,55,20,0.35)' }}> ex-VAT</span></p>
              </div>
            )}

          </div>
        </div>

        {/* Zone 3 — Notes strip */}
        {customer.notes && (
          <div className="px-5 py-4 flex items-start gap-3 border-t" style={{ background: 'rgba(221,176,29,0.06)', borderColor: 'rgba(221,176,29,0.2)' }}>
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: '#DDB01D' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm text-brand-dark whitespace-pre-wrap leading-relaxed">{customer.notes}</p>
          </div>
        )}

      </div>

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
                      <p className="text-sm font-semibold text-brand-dark truncate">{toTitleCase(job.title)}</p>
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
      {canEditCustomer && (
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
      )}

    </div>
  )
}
