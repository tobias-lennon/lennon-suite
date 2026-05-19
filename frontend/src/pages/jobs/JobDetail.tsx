import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/api'
import { toTitleCase, formatEstimation, fmtDate } from '../../lib/formatters'
import { usePermissions } from '../../hooks/usePermissions'
import Spinner from '../../components/Spinner'
import ConfirmDialog from '../../components/ConfirmDialog'

const INVOICE_STATUS_COLOURS: Record<string, string> = {
  draft: 'badge-draft',
  sent:  'badge-sent',
  paid:  'badge-paid',
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
  follow_up_note: string | null
  callout_fee: number | null
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
interface JobTask {
  id: number
  title: string
  estimated_hours: number | null
  weather_req: string
  scheduled_date: string | null
  scheduled_time: string | null
  status: 'pending' | 'in_progress' | 'complete'
  invoice_id: number | null
  sort_order: number
  notes: string | null
}

interface Job {
  id: number
  title: string
  description: string | null
  type: string
  status: string
  weather_req: string
  estimated_hours: number | null
  scheduled_date: string | null
  due_by: string | null
  notes: string | null
  callout_fee: number | null
  tasks: JobTask[]
  customer: { id: number; name: string; phone: string | null; discount_pct: number }
  project: { id: number; name: string } | null
  work_logs: WorkLog[]
  totals: Totals
  invoice: InvoiceSummary | null
}

const STATUS_COLOURS: Record<string, string> = {
  backlog:     'badge-backlog',
  scheduled:   'badge-scheduled',
  in_progress: 'badge-in-progress',
  complete:    'badge-complete',
}
const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog', scheduled: 'Scheduled', in_progress: 'In Progress', complete: 'Complete',
}
const TYPE_LABELS: Record<string, string> = {
  standard: 'Standard', maintenance: 'Maintenance', site_visit: 'Site Visit', internal: 'Internal',
}
const WEATHER_LABELS: Record<string, string> = {
  any: 'Any', light_rain_ok: 'Light rain OK', dry_preferred: 'Dry preferred', dry_only: 'Dry only', frost_free: 'Frost free',
}
const TASK_WEATHER_SHORT: Record<string, string> = {
  any: 'Any', light_rain_ok: '🌧 OK', dry_preferred: 'Dry pref.', dry_only: 'Dry only', frost_free: 'No frost',
}

function fmt(val: number) {
  return `€${val.toFixed(2)}`
}
function fmtTime(t: string | null) {
  if (!t) return '—'
  return t.substring(0, 5)
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { canEditJob, canDeleteJob, canCreateInvoice, canLogWork } = usePermissions()
  const [job, setJob] = useState<Job | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set())
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [creatingInvoice, setCreatingInvoice] = useState(false)
  const [openEntryLogIds, setOpenEntryLogIds] = useState<Set<number>>(new Set())
  const [taskForm, setTaskForm] = useState<{
    id: number | null
    title: string
    estimated_hours: string
    weather_req: string
    scheduled_date: string
    scheduled_time: string
    notes: string
  } | null>(null)
  const [savingTask, setSavingTask] = useState(false)

  // Single confirm dialog state — covers all confirmations
  const [confirm, setConfirm] = useState<{
    title: string
    message?: string
    confirmLabel?: string
    onConfirm: () => void
  } | null>(null)

  function loadJob() {
    return api.get(`/jobs/${id}`).then(res => setJob(res.data))
  }

  useEffect(() => {
    loadJob()
      .then(() => setIsLoading(false))
      .catch(() => { setLoadError(true); setIsLoading(false) })
  }, [id])

  function toggleLog(logId: number) {
    setExpandedLogs(prev => {
      const next = new Set(prev)
      next.has(logId) ? next.delete(logId) : next.add(logId)
      return next
    })
  }

  async function doStatusUpdate(status: string) {
    setStatusUpdating(true)
    await api.patch(`/jobs/${id}/status`, { status })
    setJob(prev => prev ? { ...prev, status, invoice: status !== 'complete' ? null : prev.invoice } : prev)
    setStatusUpdating(false)
  }

  function handleStatusChange(status: string) {
    if (!job) return
    // Reverting away from complete when an invoice exists — warn and delete invoice
    if (job.status === 'complete' && status !== 'complete' && job.invoice) {
      setConfirm({
        title: 'Delete invoice?',
        message: `This job has invoice ${job.invoice.invoice_number}. Reverting the status will permanently delete it.`,
        confirmLabel: 'Delete & revert',
        onConfirm: async () => {
          setConfirm(null)
          await api.delete(`/invoices/${job.invoice!.id}`)
          await doStatusUpdate(status)
        },
      })
      return
    }
    doStatusUpdate(status)
  }

  async function deleteJob() {
    await api.delete(`/jobs/${id}`)
    navigate('/jobs')
  }

  async function deleteLog(logId: number) {
    await api.delete(`/jobs/${id}/logs/${logId}`)
    await loadJob()
  }

  function openAddTask() {
    setTaskForm({ id: null, title: '', estimated_hours: '', weather_req: 'any', scheduled_date: '', scheduled_time: '', notes: '' })
  }
  function openEditTask(task: JobTask) {
    setTaskForm({
      id: task.id,
      title: task.title,
      estimated_hours: task.estimated_hours != null ? String(task.estimated_hours) : '',
      weather_req: task.weather_req,
      scheduled_date: task.scheduled_date ?? '',
      scheduled_time: task.scheduled_time ?? '',
      notes: task.notes ?? '',
    })
  }
  function closeTaskForm() { setTaskForm(null) }

  async function saveTask() {
    if (!taskForm || !taskForm.title.trim()) return
    setSavingTask(true)
    const payload = {
      title: taskForm.title.trim(),
      estimated_hours: taskForm.estimated_hours ? parseFloat(taskForm.estimated_hours) : null,
      weather_req: taskForm.weather_req,
      scheduled_date: taskForm.scheduled_date || null,
      scheduled_time: taskForm.scheduled_time || null,
      notes: taskForm.notes || null,
    }
    try {
      if (taskForm.id) {
        await api.patch(`/jobs/${id}/tasks/${taskForm.id}`, payload)
      } else {
        await api.post(`/jobs/${id}/tasks`, payload)
      }
      closeTaskForm()
      await loadJob()
    } finally {
      setSavingTask(false)
    }
  }

  async function deleteTask(taskId: number) {
    await api.delete(`/jobs/${id}/tasks/${taskId}`)
    await loadJob()
  }

  async function cycleTaskStatus(task: JobTask) {
    const next = task.status === 'pending' ? 'in_progress' : task.status === 'in_progress' ? 'complete' : 'pending'
    await api.patch(`/jobs/${id}/tasks/${task.id}`, { status: next })
    await loadJob()
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

  function playRoyalFanfare() {
    const AC = window.AudioContext || (window as any).webkitAudioContext
    if (!AC) return
    try {
      const ctx = new AC()
      const dL = ctx.createDelay(0.4); dL.delayTime.value = 0.18
      const dR = ctx.createDelay(0.4); dR.delayTime.value = 0.27
      const fbL = ctx.createGain(); fbL.gain.value = 0.28
      const fbR = ctx.createGain(); fbR.gain.value = 0.28
      const wet = ctx.createGain(); wet.gain.value = 0.20
      dL.connect(fbL); fbL.connect(dR)
      dR.connect(fbR); fbR.connect(dL)
      dL.connect(wet); dR.connect(wet)
      wet.connect(ctx.destination)
      function note(freq: number, start: number, dur: number, vol: number) {
        const o1 = ctx.createOscillator(); const o2 = ctx.createOscillator()
        const g2 = ctx.createGain(); const env = ctx.createGain()
        o1.type = 'sawtooth'; o1.frequency.value = freq; o1.detune.value = -7
        o2.type = 'sawtooth'; o2.frequency.value = freq; o2.detune.value = +7
        g2.gain.value = 0.55
        o1.connect(env); o2.connect(g2); g2.connect(env)
        env.connect(ctx.destination); env.connect(dL); env.connect(dR)
        env.gain.setValueAtTime(0, start)
        env.gain.linearRampToValueAtTime(vol, start + 0.020)
        env.gain.linearRampToValueAtTime(vol * 0.83, start + 0.065)
        env.gain.setValueAtTime(vol * 0.83, Math.max(start + 0.07, start + dur - 0.055))
        env.gain.linearRampToValueAtTime(0, start + dur)
        o1.start(start); o2.start(start)
        o1.stop(start + dur + 0.05); o2.stop(start + dur + 0.05)
      }
      const t = ctx.currentTime + 0.07
      note(392, t + 0.00, 0.12, 0.40); note(196, t + 0.00, 0.12, 0.20)
      note(392, t + 0.15, 0.12, 0.42); note(196, t + 0.15, 0.12, 0.21)
      note(392, t + 0.30, 0.14, 0.44); note(196, t + 0.30, 0.14, 0.22)
      note(523, t + 0.50, 0.16, 0.46); note(261, t + 0.50, 0.16, 0.22)
      note(659, t + 0.70, 0.16, 0.48); note(330, t + 0.70, 0.16, 0.23)
      note(784, t + 0.90, 0.16, 0.50); note(392, t + 0.90, 0.16, 0.24)
      note(261,  t + 1.12, 1.05, 0.30); note(523,  t + 1.12, 1.05, 0.36)
      note(659,  t + 1.12, 1.05, 0.38); note(784,  t + 1.12, 1.05, 0.40)
      note(1047, t + 1.12, 1.05, 0.52)
    } catch { /* audio context unavailable */ }
  }

  function triggerCelebration() {
    import('canvas-confetti').then(m => {
      const fire = m.default as (opts: object) => void
      fire({ particleCount: 160, spread: 80, origin: { y: 0.55 }, colors: ['#97B545', '#0F3714', '#F0ECE4', '#FFD700', '#fff'] })
      setTimeout(() => fire({ particleCount: 70, angle: 55, spread: 65, origin: { x: 0, y: 0.6 } }), 220)
      setTimeout(() => fire({ particleCount: 70, angle: 125, spread: 65, origin: { x: 1, y: 0.6 } }), 420)
    })
    playRoyalFanfare()
  }

  async function completeJob() {
    if (!job) return

    // Block standard/maintenance jobs with no work logs
    if ((job.type === 'standard' || job.type === 'maintenance') && job.work_logs.length === 0) {
      const el = document.getElementById('work-logs-section')
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    // Block if any entry has no end time or 0 hours
    const badLogIds = new Set(
      job.work_logs
        .filter(log => log.entries.some(e => e.end_time === null || e.billable_hours === 0))
        .map(log => log.id)
    )

    if (badLogIds.size > 0) {
      setOpenEntryLogIds(badLogIds)
      // Expand all offending logs
      setExpandedLogs(prev => new Set([...prev, ...badLogIds]))
      // Scroll to the first bad log
      const firstId = [...badLogIds][0]
      setTimeout(() => {
        document.getElementById(`log-${firstId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
      return
    }

    setOpenEntryLogIds(new Set())
    setStatusUpdating(true)
    await api.patch(`/jobs/${id}/status`, { status: 'complete' })
    setJob(prev => prev ? { ...prev, status: 'complete' } : prev)
    setStatusUpdating(false)
    triggerCelebration()
  }

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>
  if (loadError) return <div className="p-6 text-gray-500">Could not load job. Please try again.</div>
  if (!job) return <div className="p-6 text-gray-500">Job not found.</div>

  const showInvoicePanel = job.status === 'complete' && job.type !== 'internal'

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">

      {/* Confirm dialog */}
      <ConfirmDialog
        isOpen={confirm !== null}
        title={confirm?.title ?? ''}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        onConfirm={confirm?.onConfirm ?? (() => {})}
        onCancel={() => setConfirm(null)}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-brand-dark truncate">{job.title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
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
          {job.status !== 'complete' && canEditJob && (
            <Link
              to={`/jobs/${id}/edit`}
              className="min-w-[52px] text-center px-3 py-1.5 rounded-lg text-sm border border-black/10 hover:bg-black/5 transition-colors"
            >
              Edit
            </Link>
          )}
          {job.status !== 'complete' && canLogWork && (
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
      <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-none pb-0.5">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide shrink-0">Status:</span>
        {['backlog', 'scheduled', 'in_progress', 'complete'].filter(s => s !== 'scheduled' || job.status === 'scheduled').map(s => (
          <button
            key={s}
            disabled={statusUpdating || job.status === s}
            onClick={() => s === 'complete' ? completeJob() : handleStatusChange(s)}
            className={`badge transition-opacity ${
              job.status === s ? STATUS_COLOURS[s] : 'badge-backlog hover:brightness-95'
            } disabled:opacity-50`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <Field label="Type">{TYPE_LABELS[job.type]}</Field>
        <Field label="Weather">{WEATHER_LABELS[job.weather_req]}</Field>
        {job.estimated_hours != null && <Field label="Est. Duration">{formatEstimation(job.estimated_hours)}</Field>}
        {job.scheduled_date && job.status !== 'backlog' && (
          <Field label="Scheduled">{fmtDate(job.scheduled_date)}</Field>
        )}
        {job.due_by && job.status !== 'complete' && (() => {
          const today = new Date(); today.setHours(0,0,0,0)
          const due = new Date(job.due_by.substring(0, 10) + 'T12:00:00')
          const diff = Math.floor((due.getTime() - today.getTime()) / 86400000)
          const colour = diff < 0 ? '#B84A2A' : diff <= 7 ? '#DDB01D' : undefined
          return (
            <Field label="Due By">
              <span style={colour ? { color: colour, fontWeight: 600 } : {}}>
                {due.toLocaleDateString('en-IE')}
                {diff < 0 && ' · Overdue'}
                {diff >= 0 && diff <= 7 && ` · ${diff === 0 ? 'Today' : `${diff}d left`}`}
              </span>
            </Field>
          )
        })()}
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

      {/* Tasks */}
      <div className="card overflow-hidden mb-6">
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
          <h2 className="section-label mb-0">
            Tasks
            {job.tasks.length > 0 && <span className="ml-1.5 text-xs font-normal" style={{ color: 'rgba(15,55,20,0.4)' }}>({job.tasks.length})</span>}
          </h2>
          {canEditJob && (
            <button
              onClick={openAddTask}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors"
              style={{ background: 'rgba(151,181,69,0.15)', color: '#3a6e0f' }}
            >
              + Add task
            </button>
          )}
        </div>

        {job.tasks.length === 0 && !taskForm && (
          <p className="text-sm text-center py-5" style={{ color: 'rgba(15,55,20,0.35)' }}>
            No tasks — add steps to schedule and track work separately.
          </p>
        )}

        {job.tasks.map(task => (
          <div key={task.id} className="border-b border-black/4 last:border-0">
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                onClick={() => cycleTaskStatus(task)}
                className="shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                style={
                  task.status === 'complete'    ? { background: '#97B545', borderColor: '#97B545' }
                  : task.status === 'in_progress' ? { background: 'rgba(221,176,29,0.3)', borderColor: '#DDB01D' }
                  : { background: 'transparent', borderColor: 'rgba(15,55,20,0.25)' }
                }
                title="Click to advance status"
              >
                {task.status === 'complete' && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              <button className="flex-1 text-left min-w-0" onClick={() => canEditJob && openEditTask(task)}>
                <span className={`text-sm font-medium ${task.status === 'complete' ? 'line-through' : 'text-brand-dark'}`}
                  style={task.status === 'complete' ? { color: 'rgba(15,55,20,0.35)' } : {}}>
                  {task.title}
                </span>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(15,55,20,0.07)', color: 'rgba(15,55,20,0.5)' }}>
                    {TASK_WEATHER_SHORT[task.weather_req] ?? task.weather_req}
                  </span>
                  {task.scheduled_date && (
                    <span className="text-xs" style={{ color: 'rgba(15,55,20,0.45)' }}>
                      {fmtDate(task.scheduled_date, { weekday: 'short', day: 'numeric', month: 'short' })}
                      {task.scheduled_time && ` · ${task.scheduled_time}`}
                    </span>
                  )}
                  {task.estimated_hours != null && (
                    <span className="text-xs" style={{ color: 'rgba(15,55,20,0.45)' }}>{formatEstimation(task.estimated_hours)}</span>
                  )}
                  {task.invoice_id && (
                    <span className="text-xs px-1.5 py-0.5 rounded badge-paid">Invoiced</span>
                  )}
                </div>
              </button>

              {canEditJob && (
                <button
                  onClick={() => setConfirm({
                    title: 'Delete task?',
                    message: `Delete "${task.title}"? This cannot be undone.`,
                    confirmLabel: 'Delete',
                    onConfirm: async () => { setConfirm(null); await deleteTask(task.id) },
                  })}
                  className="shrink-0 transition-colors"
                  style={{ color: 'rgba(15,55,20,0.2)' }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}

        {taskForm && (
          <div className="px-4 py-4 border-t border-black/5" style={{ background: 'rgba(15,55,20,0.025)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'rgba(15,55,20,0.45)' }}>
              {taskForm.id ? 'Edit task' : 'New task'}
            </p>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Task title"
                value={taskForm.title}
                onChange={e => setTaskForm(f => f && { ...f, title: e.target.value })}
                className="field-input"
                autoFocus
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Weather</label>
                  <select value={taskForm.weather_req} onChange={e => setTaskForm(f => f && { ...f, weather_req: e.target.value })} className="field-input">
                    <option value="any">Any conditions</option>
                    <option value="light_rain_ok">Light rain OK</option>
                    <option value="dry_preferred">Dry preferred</option>
                    <option value="dry_only">Dry only</option>
                    <option value="frost_free">Frost free</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Est. hours</label>
                  <input type="number" min="0" max="999" step="0.5" placeholder="e.g. 6"
                    value={taskForm.estimated_hours}
                    onChange={e => setTaskForm(f => f && { ...f, estimated_hours: e.target.value })}
                    className="field-input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Date</label>
                  <input type="date" value={taskForm.scheduled_date}
                    onChange={e => setTaskForm(f => f && { ...f, scheduled_date: e.target.value })}
                    className="field-input" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Time</label>
                  <input type="time" value={taskForm.scheduled_time}
                    onChange={e => setTaskForm(f => f && { ...f, scheduled_time: e.target.value })}
                    className="field-input" />
                </div>
              </div>
              <textarea placeholder="Notes (optional)" rows={2}
                value={taskForm.notes}
                onChange={e => setTaskForm(f => f && { ...f, notes: e.target.value })}
                className="field-input resize-none" />
              <div className="flex gap-2">
                <button onClick={saveTask} disabled={savingTask || !taskForm.title.trim()}
                  className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
                  style={{ background: '#0F3714' }}>
                  {savingTask ? 'Saving…' : taskForm.id ? 'Save changes' : 'Add task'}
                </button>
                <button onClick={closeTaskForm}
                  className="px-4 py-2 text-sm font-medium rounded-lg"
                  style={{ color: 'rgba(15,55,20,0.6)' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Totals */}
      {job.work_logs.length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="section-label">Job Totals</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <TotalRow label="Total hours" value={`${job.totals.total_hours}h`} />
            {job.type !== 'internal' && <>
              <TotalRow label="Labour charged" value={fmt(job.totals.total_labour_charged)} />
              <TotalRow label="Labour cost" value={fmt(job.totals.total_labour_cost)} />
              <TotalRow label="Materials" value={fmt(job.totals.total_materials)} />
              {job.totals.callout_fee > 0 && (
                <TotalRow label="Callout fee" value={fmt(job.totals.callout_fee)} />
              )}
              <TotalRow label="Total charged" value={fmt(job.totals.total_charged)} highlight />
              <TotalRow label="Labour margin" value={fmt(job.totals.margin)} highlight={job.totals.margin >= 0} />
            </>}
          </div>
          {job.type === 'internal' && (
            <p className="text-xs text-gray-400 mt-2 italic">Internal work — hours logged only, no billing.</p>
          )}
          {job.customer?.discount_pct > 0 && (
            <p className="text-xs text-gray-400 mt-2">
              {job.customer.discount_pct}% discount applied to this customer's rates.
            </p>
          )}
        </div>
      )}

      {/* Invoice panel — animated slide-down */}
      <div
        style={{
          maxHeight: showInvoicePanel ? '200px' : '0',
          opacity: showInvoicePanel ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.35s ease, opacity 0.25s ease, margin-bottom 0.35s ease',
          marginBottom: showInvoicePanel ? '1.5rem' : '0',
        }}
      >
        <div
          className={`rounded-lg border ${job.invoice ? 'border-gray-200 bg-white cursor-pointer hover:bg-gray-50 transition-colors' : ''}`}
          style={!job.invoice ? { background: 'rgba(221,176,29,0.1)', borderColor: 'rgba(221,176,29,0.35)' } : {}}
          onClick={job.invoice ? () => navigate(`/invoices/${job.invoice!.id}`) : undefined}
        >
          {job.invoice ? (
            <div className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Invoice</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#0F3714]">{job.invoice.invoice_number}</span>
                  <span className={`badge ${INVOICE_STATUS_COLOURS[job.invoice.status] ?? 'badge-draft'}`}>
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
                <p className="text-sm font-medium" style={{ color: '#0F3714' }}>Not yet invoiced</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(15,55,20,0.6)' }}>This job is complete but hasn't been invoiced.</p>
              </div>
              {canCreateInvoice && (
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
              )}
            </div>
          )}
        </div>
      </div>

      {/* Work logs */}
      <div id="work-logs-section" className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-label mb-0">Work Logs ({job.work_logs.length})</h2>
        </div>

        {job.work_logs.length === 0 && (
          <div>
            <p className="text-sm text-gray-400 italic">No work logged yet.</p>
            {(job.type === 'standard' || job.type === 'maintenance') && (
              <p className="text-xs mt-1" style={{ color: '#0F3714' }}>Add at least one work log before marking this job complete.</p>
            )}
          </div>
        )}

        <div className="space-y-3">
          {job.work_logs.map(log => {
            const logHours   = log.entries.reduce((s, e) => s + e.billable_hours, 0)
            const logCharged = log.entries.reduce((s, e) => s + e.amount_charged, 0)
              + log.materials.reduce((s, m) => s + m.amount_charged, 0)
              + (log.callout_fee ?? 0)
            const isExpanded = expandedLogs.has(log.id)
            const hasOpenEntry = log.entries.some(e => e.end_time === null)
            const hasError = openEntryLogIds.has(log.id)

            return (
              <div key={log.id} id={`log-${log.id}`} className="card overflow-hidden" style={hasError ? { borderLeft: '3px solid #B84A2A' } : {}}>
                <button
                  onClick={() => toggleLog(log.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-black/3"
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">
                      {fmtDate(log.date, { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                    <span className="text-xs text-gray-400">
                      {logHours.toFixed(2)}h · {fmt(logCharged)}
                    </span>
                    {(log.callout_fee ?? 0) > 0 && (
                      <span className="badge badge-scheduled">callout</span>
                    )}
                    {hasOpenEntry && (
                      <span className="badge badge-urgent">open</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0 ml-2">{isExpanded ? '▲' : '▼'}</span>
                </button>

                {/* Animated expand */}
                <div
                  style={{
                    maxHeight: isExpanded ? '800px' : '0',
                    opacity: isExpanded ? 1 : 0,
                    overflow: 'hidden',
                    transition: 'max-height 0.3s ease, opacity 0.2s ease',
                  }}
                >
                  <div className="px-4 pb-4 border-t border-black/5">
                    {hasError && (
                      <p className="text-xs text-danger mt-2 mb-1">Fix open or zero-hour entries before completing.</p>
                    )}
                    {log.notes && (
                      <p className="text-xs text-gray-500 italic my-2">{log.notes}</p>
                    )}
                    {log.follow_up_note && (
                      <div className="flex items-start gap-1.5 my-2 px-2 py-1.5 rounded-lg" style={{ background: 'rgba(221,176,29,0.1)', border: '1px solid rgba(221,176,29,0.25)' }}>
                        <span className="text-xs shrink-0">📌</span>
                        <p className="text-xs" style={{ color: '#9a7c0a' }}>{log.follow_up_note}</p>
                      </div>
                    )}

                    {/* Entries */}
                    {log.entries.length > 0 && (
                      <div className="mt-3">
                        <p className="section-label mb-2">Time</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-black/8" style={{ color: 'rgba(15,55,20,0.4)' }}>
                                <th className="text-left pb-1">Person</th>
                                <th className="text-right pb-1">In / Out</th>
                                <th className="text-right pb-1">Hours</th>
                                <th className="text-right pb-1">Rate</th>
                                <th className="text-right pb-1">Charged</th>
                                <th className="text-right pb-1">Margin</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5">
                              {log.entries.map(e => (
                                <tr key={e.id}>
                                  <td className="py-1">{e.employee.name}</td>
                                  <td className="text-right py-1 text-gray-400">
                                    {fmtTime(e.start_time)}{e.end_time ? `–${fmtTime(e.end_time)}` : <span className="text-danger"> (open)</span>}
                                  </td>
                                  <td className="text-right py-1">{e.billable_hours.toFixed(2)}h</td>
                                  <td className="text-right py-1 text-gray-400">€{e.rate_per_hour.toFixed(2)}/h</td>
                                  <td className="text-right py-1 font-medium">{fmt(e.amount_charged)}</td>
                                  <td className="text-right py-1" style={{ color: e.margin >= 0 ? '#0F3714' : '#DDB01D' }}>
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
                        <p className="section-label mb-2">Materials</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-black/8" style={{ color: 'rgba(15,55,20,0.4)' }}>
                                <th className="text-left pb-1">Item</th>
                                <th className="text-right pb-1">Qty</th>
                                <th className="text-right pb-1">Cost</th>
                                <th className="text-right pb-1">Charged</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5">
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

                    {/* Log actions */}
                    <div className="mt-3 pt-3 border-t border-black/5 flex items-center gap-4">
                      {job.status !== 'complete' && canLogWork && (
                        <Link
                          to={`/jobs/${id}/logs/${log.id}/edit`}
                          className="text-xs font-medium"
                          style={{ color: '#97B545' }}
                        >
                          Edit log
                        </Link>
                      )}
                      {(job.status === 'complete' || job.invoice) ? (
                        <span className="text-xs text-gray-400">
                          {job.invoice ? 'Delete the invoice first to remove logs' : 'Revert status to remove logs'}
                        </span>
                      ) : canLogWork ? (
                        <button
                          onClick={() => setConfirm({
                            title: 'Delete work log?',
                            message: `Delete the log for ${fmtDate(log.date, { day: 'numeric', month: 'short' })}? This cannot be undone.`,
                            confirmLabel: 'Delete',
                            onConfirm: async () => { setConfirm(null); await deleteLog(log.id) },
                          })}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Delete log
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="border-t border-black/5 pt-6 flex items-center gap-4 flex-wrap">
        {job.status !== 'complete' && canEditJob && (
          <button
            onClick={completeJob}
            disabled={statusUpdating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: '#0F3714' }}
          >
            {statusUpdating && <Spinner className="w-4 h-4" />}
            Mark Complete
          </button>
        )}
        {canDeleteJob && (
          <button
            onClick={() => setConfirm({
              title: 'Delete this job?',
              message: 'All work logs and entries will be permanently deleted.',
              confirmLabel: 'Delete job',
              onConfirm: async () => { setConfirm(null); await deleteJob() },
            })}
            className="text-sm text-danger"
          >
            Delete job
          </button>
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
