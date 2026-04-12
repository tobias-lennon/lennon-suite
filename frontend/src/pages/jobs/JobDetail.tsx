import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/api'
import { toTitleCase } from '../../lib/formatters'
import Spinner from '../../components/Spinner'

const INVOICE_STATUS_COLOURS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent:  'bg-blue-100 text-blue-700',
  paid:  'bg-green-100 text-green-700',
}

interface Employee { id: number; name: string }
interface WorkLogEntry {
  id: number
  employee: Employee
  start_time: string | null
  end_time: string | null
  break_minutes: number
  billable_hours: number
  rate_per_hour: number
  discount_pct: number
  amount_charged: number
  amount_paid: number
  margin: number
}
interface Material {
  id: number
  description: string
  qty: number | null
  unit: string | null
  cost_paid: number
  amount_charged: number
  notes: string | null
}
interface WorkLog {
  id: number
  date: string
  notes: string | null
  entries: WorkLogEntry[]
  materials: Material[]
}
interface Totals {
  total_hours: number
  total_labour_charged: number
  total_labour_cost: number
  total_materials: number
  callout_fee: number
  total_charged: number
  margin: number
}
interface InvoiceSummary {
  id: number
  invoice_number: string
  status: string
  total_due: number
  issued_date: string
}
interface Job {
  id: number
  title: string
  description: string | null
  type: string
  status: string
  has_power_tools: boolean
  has_waste_disposal: boolean
  weather_req: string
  est_duration: string | null
  priority: string
  scheduled_date: string | null
  notes: string | null
  customer: { id: number; name: string; phone: string | null; discount_pct: number }
  project: { id: number; name: string } | null
  work_logs: WorkLog[]
  totals: Totals
  invoice: InvoiceSummary | null
}

const STATUS_COLOURS: Record<string, string> = {
  backlog: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  complete: 'bg-green-100 text-green-800',
}
const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog', scheduled: 'Scheduled', in_progress: 'In Progress', complete: 'Complete',
}
const TYPE_LABELS: Record<string, string> = {
  standard: 'Standard', maintenance: 'Maintenance', site_visit: 'Site Visit', internal: 'Internal',
}
const WEATHER_LABELS: Record<string, string> = {
  any: 'Any', dry_preferred: 'Dry preferred', dry_only: 'Dry only',
}
const DURATION_LABELS: Record<string, string> = {
  quick: 'Quick (<2hrs)', half_day: 'Half day', full_day: 'Full day', multi_day: 'Multi-day',
}

function fmt(val: number) {
  return `€${val.toFixed(2)}`
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [job, setJob] = useState<Job | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set())
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [creatingInvoice, setCreatingInvoice] = useState(false)

  useEffect(() => {
    api.get(`/jobs/${id}`).then(res => {
      setJob(res.data)
      setIsLoading(false)
    })
  }, [id])

  function toggleLog(logId: number) {
    setExpandedLogs(prev => {
      const next = new Set(prev)
      next.has(logId) ? next.delete(logId) : next.add(logId)
      return next
    })
  }

  async function updateStatus(status: string) {
    if (!job) return
    setStatusUpdating(true)
    await api.patch(`/jobs/${id}/status`, { status })
    setJob(prev => prev ? { ...prev, status } : prev)
    setStatusUpdating(false)
  }

  async function deleteJob() {
    await api.delete(`/jobs/${id}`)
    navigate('/jobs')
  }

  async function createInvoice() {
    if (!job) return
    setCreatingInvoice(true)
    try {
      const res = await api.post('/invoices', { field_job_id: job.id })
      navigate(`/invoices/${res.data.id}`)
    } finally {
      setCreatingInvoice(false)
    }
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>
  }

  if (!job) {
    return <div className="p-6 text-gray-500">Job not found.</div>
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <button onClick={() => navigate(-1)} className="text-sm text-gray-400 hover:text-gray-600">← Back</button>
          <h1 className="text-xl font-semibold text-gray-900 mt-1 truncate">{job.title}</h1>
          <p className="text-sm text-gray-500">
            {job.customer ? (
              <Link to={`/customers/${job.customer.id}`} className="hover:underline" style={{ color: '#97B545' }}>
                {toTitleCase(job.customer.name)}
              </Link>
            ) : (
              <span className="text-gray-400 italic">Internal / Admin</span>
            )}
            {job.project && <span className="text-gray-400 ml-2">· {job.project.name}</span>}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            to={`/jobs/${id}/edit`}
            className="min-w-[52px] text-center px-3 py-1.5 rounded-lg text-sm border border-gray-300 hover:bg-gray-50"
          >
            Edit
          </Link>
          {job.status !== 'complete' && (
            <Link
              to={`/jobs/${id}/logs/new`}
              className="min-w-[90px] text-center px-3 py-1.5 rounded-lg text-sm text-white font-medium"
              style={{ backgroundColor: '#97B545' }}
            >
              + Log work
            </Link>
          )}
        </div>
      </div>

      {/* Status quick-change */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status:</span>
        {['backlog', 'scheduled', 'in_progress', 'complete'].map(s => (
          <button
            key={s}
            disabled={statusUpdating || job.status === s}
            onClick={() => updateStatus(s)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-opacity ${
              job.status === s ? STATUS_COLOURS[s] : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            } disabled:opacity-50`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <Field label="Type">{TYPE_LABELS[job.type]}</Field>
        <Field label="Priority">
          <span className={job.priority === 'urgent' ? 'text-red-600 font-medium' : job.priority === 'high' ? 'text-yellow-700 font-medium' : ''}>
            {job.priority.charAt(0).toUpperCase() + job.priority.slice(1)}
          </span>
        </Field>
        <Field label="Weather">{WEATHER_LABELS[job.weather_req]}</Field>
        {job.est_duration && <Field label="Duration">{DURATION_LABELS[job.est_duration]}</Field>}
        {job.scheduled_date && (
          <Field label="Scheduled">{new Date(job.scheduled_date).toLocaleDateString('en-IE')}</Field>
        )}
        {job.type === 'standard' && (
          <Field label="Flags">
            {[job.has_power_tools && 'Power tools', job.has_waste_disposal && 'Waste disposal']
              .filter(Boolean).join(', ') || '—'}
          </Field>
        )}
      </div>

      {job.description && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Description</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{job.description}</p>
        </div>
      )}

      {job.notes && (
        <div className="mb-6">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notes</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{job.notes}</p>
        </div>
      )}

      {/* Totals */}
      {job.work_logs.length > 0 && (
        <div className="rounded-lg border border-gray-200 p-4 mb-6 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Job Totals</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <TotalRow label="Total hours" value={`${job.totals.total_hours}h`} />
            <TotalRow label="Labour charged" value={fmt(job.totals.total_labour_charged)} />
            <TotalRow label="Labour cost" value={fmt(job.totals.total_labour_cost)} />
            <TotalRow label="Materials" value={fmt(job.totals.total_materials)} />
            {job.totals.callout_fee > 0 && (
              <TotalRow label="Callout fee" value={fmt(job.totals.callout_fee)} />
            )}
            <TotalRow label="Total charged" value={fmt(job.totals.total_charged)} highlight />
            <TotalRow label="Labour margin" value={fmt(job.totals.margin)} highlight={job.totals.margin >= 0} />
          </div>
          {job.customer?.discount_pct > 0 && (
            <p className="text-xs text-gray-400 mt-2">
              {job.customer.discount_pct}% discount applied to this customer's rates.
            </p>
          )}
        </div>
      )}

      {/* Invoice panel */}
      {job.status === 'complete' && job.type !== 'internal' && (
        <div className={`rounded-lg border mb-6 ${
          job.invoice
            ? 'border-gray-200 bg-white cursor-pointer hover:bg-gray-50 transition-colors'
            : 'border-amber-200 bg-amber-50'
        }`}
          onClick={job.invoice ? () => navigate(`/invoices/${job.invoice!.id}`) : undefined}
        >
          {job.invoice ? (
            <div className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Invoice</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#0F3714]">{job.invoice.invoice_number}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${INVOICE_STATUS_COLOURS[job.invoice.status] ?? ''}`}>
                    {job.invoice.status === 'draft' ? 'Not Sent' : job.invoice.status.charAt(0).toUpperCase() + job.invoice.status.slice(1)}
                  </span>
                </div>
              </div>
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-sm font-medium text-amber-800">Not yet invoiced</p>
                <p className="text-xs text-amber-600 mt-0.5">This job is complete but hasn't been invoiced.</p>
              </div>
              <button
                onClick={createInvoice}
                disabled={creatingInvoice || job.work_logs.length === 0}
                title={job.work_logs.length === 0 ? 'Add at least one work log before invoicing' : ''}
                className="min-w-[130px] flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium text-white rounded-lg disabled:opacity-50 shrink-0"
                style={{ backgroundColor: '#0F3714' }}
              >
                {creatingInvoice ? (
                  <>
                    <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Creating
                  </>
                ) : 'Create Invoice'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Work logs */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Work Logs ({job.work_logs.length})</h2>
        </div>

        {job.work_logs.length === 0 && (
          <p className="text-sm text-gray-400 italic">No work logged yet.</p>
        )}

        <div className="space-y-3">
          {job.work_logs.map(log => {
            const logHours = log.entries.reduce((s, e) => s + e.billable_hours, 0)
            const logCharged = log.entries.reduce((s, e) => s + e.amount_charged, 0)
              + log.materials.reduce((s, m) => s + m.amount_charged, 0)
            const isExpanded = expandedLogs.has(log.id)

            return (
              <div key={log.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleLog(log.id)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900">
                      {new Date(log.date).toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                    <span className="text-xs text-gray-400">
                      {logHours.toFixed(2)}h · {fmt(logCharged)}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{isExpanded ? '▲' : '▼'}</span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    {log.notes && (
                      <p className="text-xs text-gray-500 italic my-2">{log.notes}</p>
                    )}

                    {/* Entries */}
                    {log.entries.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Time</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-400 border-b">
                                <th className="text-left pb-1">Person</th>
                                <th className="text-right pb-1">Hours</th>
                                <th className="text-right pb-1">Rate</th>
                                <th className="text-right pb-1">Charged</th>
                                <th className="text-right pb-1">Margin</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {log.entries.map(e => (
                                <tr key={e.id}>
                                  <td className="py-1">{e.employee.name}</td>
                                  <td className="text-right py-1">{e.billable_hours.toFixed(2)}h</td>
                                  <td className="text-right py-1 text-gray-400">€{e.rate_per_hour.toFixed(2)}/h</td>
                                  <td className="text-right py-1 font-medium">{fmt(e.amount_charged)}</td>
                                  <td className={`text-right py-1 ${e.margin >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                    {fmt(e.margin)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Materials */}
                    {log.materials.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Materials</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-400 border-b">
                                <th className="text-left pb-1">Item</th>
                                <th className="text-right pb-1">Qty</th>
                                <th className="text-right pb-1">Cost</th>
                                <th className="text-right pb-1">Charged</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {log.materials.map(m => (
                                <tr key={m.id}>
                                  <td className="py-1">{m.description}</td>
                                  <td className="text-right py-1 text-gray-400">
                                    {m.qty ? `${m.qty}${m.unit ? ' ' + m.unit : ''}` : '—'}
                                  </td>
                                  <td className="text-right py-1">{fmt(m.cost_paid)}</td>
                                  <td className="text-right py-1 font-medium">{fmt(m.amount_charged)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Danger zone */}
      <div className="border-t border-gray-200 pt-6">
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Delete job
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Delete this job and all its work logs?</span>
            <button onClick={deleteJob} className="text-sm font-medium text-red-600 hover:text-red-800">
              Yes, delete
            </button>
            <button onClick={() => setConfirmDelete(false)} className="text-sm text-gray-500">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-gray-900">{children}</p>
    </div>
  )
}

function TotalRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-sm font-medium ${highlight ? 'text-[#0F3714]' : 'text-gray-700'}`}>{value}</p>
    </div>
  )
}
