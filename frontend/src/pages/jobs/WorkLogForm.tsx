import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/api'
import Spinner from '../../components/Spinner'

interface Employee {
  id: number
  name: string
}

interface EntryRow {
  id?: number          // present in edit mode
  employee_id: string
  start_time: string
  end_time: string
  break_minutes: string
  billable_hours: string
  hasPowerTools: boolean
}

interface MaterialRow {
  id?: number          // present for existing materials in edit mode
  description: string
  qty: string
  unit: string
  cost_paid: string
  amount_charged: string
  notes: string
  _deleted?: boolean   // mark for deletion on save
}

const DEFAULT_ENTRY: EntryRow = {
  employee_id: '',
  start_time: '',
  end_time: '',
  break_minutes: '0',
  billable_hours: '',
  hasPowerTools: false,
}

function getCurrentTimeRounded(): string {
  const now = new Date()
  const totalMins = now.getHours() * 60 + now.getMinutes()
  const rounded = Math.round(totalMins / 15) * 15
  const h = Math.floor(rounded / 60) % 24
  const m = rounded % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const BLANK_MATERIAL: MaterialRow = {
  description: '',
  qty: '',
  unit: '',
  cost_paid: '',
  amount_charged: '',
  notes: '',
}

function roundToQuarter(hours: number): number {
  return Math.round(hours * 4) / 4
}

function calcBillableHours(start: string, end: string, breakMins: string): string {
  if (!start || !end) return ''
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const startTotal = sh * 60 + sm
  let endTotal = eh * 60 + em
  // Handle overnight (e.g. start 22:00 end 01:30)
  if (endTotal <= startTotal) endTotal += 24 * 60
  const gross = endTotal - startTotal - Number(breakMins || 0)
  if (gross <= 0) return '0'
  return roundToQuarter(gross / 60).toFixed(2)
}

function adjustTime(time: string, deltaMins: number): string {
  if (!time) return time
  const [h, m] = time.split(':').map(Number)
  let total = h * 60 + m + deltaMins
  total = Math.max(0, Math.min(23 * 60 + 59, total))
  const newH = Math.floor(total / 60)
  const newM = total % 60
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`
}

function TimeField({
  label,
  value,
  onChange,
  defaultEmpty = '00:00',
  hasError = false,
}: {
  label: string
  value: string
  onChange: (val: string) => void
  placeholder?: string
  defaultEmpty?: string
  hasError?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(15,55,20,0.45)' }}>{label}</label>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(value ? adjustTime(value, -15) : defaultEmpty)}
          className="w-7 h-9 flex items-center justify-center text-sm border border-black/8 rounded-lg bg-white hover:bg-[#F0ECE4] text-brand-dark font-bold select-none transition-colors shrink-0"
        >
          −
        </button>
        <input
          type="time"
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`flex-1 min-w-[72px] field-input text-center py-2 px-1${hasError ? ' field-error' : ''}`}
        />
        <button
          type="button"
          onClick={() => onChange(value ? adjustTime(value, 15) : defaultEmpty)}
          className="w-7 h-9 flex items-center justify-center text-sm border border-black/8 rounded-lg bg-white hover:bg-[#F0ECE4] text-brand-dark font-bold select-none transition-colors shrink-0"
        >
          +
        </button>
      </div>
    </div>
  )
}

function ToggleChip({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all select-none ${
        checked
          ? 'bg-[#97B545] border-[#97B545] text-[#0F3714]'
          : 'bg-white/50 border-black/10 text-[rgba(15,55,20,0.45)] hover:border-black/20'
      }`}
    >
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        {checked
          ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          : <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h12" />
        }
      </svg>
      {label}
    </button>
  )
}

export default function WorkLogForm() {
  const { id, logId } = useParams<{ id: string; logId: string }>()
  const isEdit = Boolean(logId)
  const navigate = useNavigate()

  const [date, setDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [notes, setNotes] = useState('')
  const [followUpNote, setFollowUpNote] = useState('')
  const [prevFollowUpNote, setPrevFollowUpNote] = useState<string | null>(null)
  const [hasWasteDisposal, setHasWasteDisposal] = useState(false)
  const [entries, setEntries] = useState<EntryRow[]>(() => {
    const t = getCurrentTimeRounded()
    return [{ ...DEFAULT_ENTRY, start_time: t, end_time: '' }]
  })
  const [materials, setMaterials] = useState<MaterialRow[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [jobComplete, setJobComplete] = useState(false)
  const [jobType, setJobType] = useState<string>('')

  useEffect(() => {
    const requests = [api.get(`/jobs/${id}`), api.get('/employees')]
    if (isEdit) requests.push(api.get(`/jobs/${id}/logs/${logId}`))

    Promise.all(requests).then(([jobRes, empRes, logRes]) => {
      const jobData = jobRes.data
      if (jobData.status === 'complete' && !isEdit) {
        setJobComplete(true)
      }
      setJobType(jobData.type ?? '')
      setEmployees(empRes.data)

      // For new logs, surface the previous log's follow-up note as a banner
      if (!isEdit && jobData.work_logs?.length > 0) {
        const sorted = [...jobData.work_logs].sort(
          (a: { date: string }, b: { date: string }) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )
        if (sorted[0]?.follow_up_note) {
          setPrevFollowUpNote(sorted[0].follow_up_note)
        }
      }

      if (isEdit && logRes) {
        const log = logRes.data
        setDate((log.date ?? '').substring(0, 10))
        setNotes(log.notes ?? '')
        setFollowUpNote(log.follow_up_note ?? '')
        setHasWasteDisposal(!!log.has_waste_disposal)
        setMaterials(
          (log.materials ?? []).map((m: {
            id: number
            description: string
            qty: number | null
            unit: string | null
            cost_paid: number
            amount_charged: number
            notes: string | null
          }) => ({
            id: m.id,
            description: m.description,
            qty: m.qty != null ? String(m.qty) : '',
            unit: m.unit ?? '',
            cost_paid: String(m.cost_paid),
            amount_charged: String(m.amount_charged),
            notes: m.notes ?? '',
          }))
        )
        setEntries(
          log.entries.length > 0
            ? log.entries.map((e: {
                id: number
                employee: { id: number }
                start_time: string | null
                end_time: string | null
                break_minutes: number
                billable_hours: number
                has_power_tools: boolean
              }) => ({
                id: e.id,
                employee_id: String(e.employee.id),
                start_time: e.start_time ? e.start_time.substring(0, 5) : '',
                end_time: e.end_time ? e.end_time.substring(0, 5) : '',
                break_minutes: String(e.break_minutes),
                billable_hours: String(e.billable_hours),
                hasPowerTools: !!e.has_power_tools,
              }))
            : [{ ...DEFAULT_ENTRY }]
        )
      }

      setIsLoading(false)
    })
  }, [id, logId, isEdit])

  function updateEntry(index: number, field: keyof EntryRow, value: string | boolean) {
    setEntries(prev => prev.map((e, i) => {
      if (i !== index) return e
      const next = { ...e, [field]: value }
      if (field === 'start_time' || field === 'end_time' || field === 'break_minutes') {
        const s = field === 'start_time' ? String(value) : next.start_time
        const en = field === 'end_time' ? String(value) : next.end_time
        const b = field === 'break_minutes' ? String(value) : next.break_minutes
        next.billable_hours = calcBillableHours(s, en, b)
      }
      return next
    }))
  }

  function addEntry() {
    const first = entries[0]
    setEntries(prev => [
      ...prev,
      {
        ...DEFAULT_ENTRY,
        start_time: first?.start_time ?? DEFAULT_ENTRY.start_time,
        end_time: first?.end_time ?? DEFAULT_ENTRY.end_time,
        break_minutes: first?.break_minutes ?? DEFAULT_ENTRY.break_minutes,
        billable_hours: first?.billable_hours ?? DEFAULT_ENTRY.billable_hours,
      },
    ])
  }

  function removeEntry(index: number) {
    setEntries(prev => prev.filter((_, i) => i !== index))
  }

  function updateMaterial(index: number, field: keyof MaterialRow, value: string) {
    setMaterials(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m))
  }

  function addMaterial() {
    setMaterials(prev => [...prev, { ...BLANK_MATERIAL }])
  }

  function removeMaterial(index: number) {
    setMaterials(prev => prev.map((m, i) => {
      if (i !== index) return m
      // Existing materials: mark for deletion; new materials: remove immediately
      return m.id ? { ...m, _deleted: true } : null
    }).filter(Boolean) as typeof prev)
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!date) errs.date = 'Date is required'
    entries.forEach((e, i) => {
      if (!e.employee_id) errs[`entry_${i}_employee`] = 'Select an employee'
      if (!e.start_time) errs[`entry_${i}_start`] = 'Start time is required'
      if (e.end_time) {
        if (!e.billable_hours || isNaN(Number(e.billable_hours)) || Number(e.billable_hours) <= 0) {
          errs[`entry_${i}_hours`] = 'Enter hours worked'
        }
      }
    })
    materials.filter(m => !m._deleted).forEach((m, i) => {
      if (!m.description.trim()) errs[`mat_${i}_desc`] = 'Description required'
      if (!m.cost_paid || isNaN(Number(m.cost_paid))) errs[`mat_${i}_cost`] = 'Enter cost'
      if (!m.amount_charged || isNaN(Number(m.amount_charged))) errs[`mat_${i}_charged`] = 'Enter amount charged'
    })
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      // Scroll to the first error
      setTimeout(() => {
        const firstErr = document.querySelector('.field-error, [data-error="true"]')
        firstErr?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
      return false
    }
    return true
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setIsSaving(true)
    setServerError(null)

    try {
      if (isEdit) {
        await api.patch(`/jobs/${id}/logs/${logId}`, {
          date,
          notes: notes || null,
          follow_up_note: followUpNote || null,
          has_waste_disposal: hasWasteDisposal,
        })
        // Update each time entry
        for (const entry of entries) {
          if (entry.id) {
            await api.patch(`/logs/${logId}/entries/${entry.id}`, {
              start_time: entry.start_time || null,
              end_time: entry.end_time || null,
              break_minutes: Number(entry.break_minutes || 0),
              billable_hours: Number(entry.billable_hours || 0),
              has_power_tools: entry.hasPowerTools,
            })
          }
        }
        // Handle materials: update existing, create new, delete removed
        for (const mat of materials) {
          if (mat._deleted) {
            if (mat.id) await api.delete(`/logs/${logId}/materials/${mat.id}`)
          } else if (mat.id) {
            await api.patch(`/logs/${logId}/materials/${mat.id}`, {
              description: mat.description,
              qty: mat.qty ? Number(mat.qty) : null,
              unit: mat.unit || null,
              cost_paid: Number(mat.cost_paid),
              amount_charged: Number(mat.amount_charged),
              notes: mat.notes || null,
            })
          } else {
            await api.post(`/logs/${logId}/materials`, {
              description: mat.description,
              qty: mat.qty ? Number(mat.qty) : null,
              unit: mat.unit || null,
              cost_paid: Number(mat.cost_paid),
              amount_charged: Number(mat.amount_charged),
              notes: mat.notes || null,
            })
          }
        }
      } else {
        const payload = {
          date,
          notes: notes || null,
          follow_up_note: followUpNote || null,
          has_waste_disposal: hasWasteDisposal,
          entries: entries.map(e => ({
            employee_id: Number(e.employee_id),
            start_time: e.start_time || null,
            end_time: e.end_time || null,
            break_minutes: Number(e.break_minutes || 0),
            billable_hours: Number(e.billable_hours || 0),
            has_power_tools: e.hasPowerTools,
          })),
          materials: materials.map(m => ({
            description: m.description,
            qty: m.qty ? Number(m.qty) : null,
            unit: m.unit || null,
            cost_paid: Number(m.cost_paid),
            amount_charged: Number(m.amount_charged),
            notes: m.notes || null,
          })),
        }
        await api.post(`/jobs/${id}/logs`, payload)
      }
      navigate(`/jobs/${id}`)
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { status?: number; data?: { message?: string } } }
        setServerError(axiosErr.response?.data?.message ?? 'Something went wrong.')
      }
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>
  }

  if (jobComplete) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
          <p className="text-sm font-medium text-gray-700 mb-1">This job is marked as complete.</p>
          <p className="text-xs text-gray-500">No further work logs can be added. Edit the job to reopen it first.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-dark">{isEdit ? 'Edit Work Log' : 'Add Work Log'}</h1>
      </div>

      {isEdit && (
        <p className="text-xs text-gray-400 italic mb-4">
          Tip: update end time when you finish or take a break to calculate hours.
        </p>
      )}

      {prevFollowUpNote && (
        <div className="mb-5 flex gap-3 p-4 rounded-xl" style={{ background: 'rgba(221,176,29,0.12)', border: '1px solid rgba(221,176,29,0.35)' }}>
          <span className="text-lg shrink-0">📌</span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#9a7c0a' }}>Note from last visit</p>
            <p className="text-sm" style={{ color: '#0F3714' }}>{prevFollowUpNote}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Date */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(15,55,20,0.45)' }}>Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className={`field-input${errors.date ? ' field-error' : ''}`}
          />
          {errors.date && <p className="text-xs mt-1 text-danger">{errors.date}</p>}
        </div>

        {/* Day-level flags */}
        {jobType !== 'internal' && (
          <div className="flex gap-2 flex-wrap">
            <ToggleChip label="Waste disposal" checked={hasWasteDisposal} onChange={setHasWasteDisposal} />
          </div>
        )}

        {/* Time entries */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-label mb-0">Time Entries</h2>
            {!isEdit && (
              <button
                type="button"
                onClick={addEntry}
                className="text-xs font-bold px-3 py-1.5 rounded-lg border border-brand-lime text-brand-lime hover:bg-brand-lime/10 transition-colors"
              >
                + Add person
              </button>
            )}
          </div>

          {!isEdit && (
            <p className="text-xs text-gray-400 italic mb-3">
              You can save with just a start time and fill in the end time later.
            </p>
          )}

          <div className="space-y-4">
            {entries.map((entry, i) => (
              <div key={i} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="section-label mb-0">Person {i + 1}</span>
                  {!isEdit && entries.length > 1 && (
                    <button type="button" onClick={() => removeEntry(i)} className="text-xs text-gray-400 hover:text-gray-600">
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(15,55,20,0.45)' }}>Employee</label>
                    <select
                      value={entry.employee_id}
                      onChange={e => updateEntry(i, 'employee_id', e.target.value)}
                      disabled={isEdit}
                      className={`field-input${errors[`entry_${i}_employee`] ? ' field-error' : ''}${isEdit ? ' opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <option value="">— Select —</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                      ))}
                    </select>
                    {errors[`entry_${i}_employee`] && (
                      <p className="text-xs mt-0.5 text-danger">{errors[`entry_${i}_employee`]}</p>
                    )}
                  </div>

                  <div className="col-span-2 grid grid-cols-2 gap-2">
                    <div>
                      <TimeField
                        label="Start time"
                        value={entry.start_time}
                        onChange={val => updateEntry(i, 'start_time', val)}
                        defaultEmpty={getCurrentTimeRounded()}
                        hasError={!!errors[`entry_${i}_start`]}
                      />
                      {errors[`entry_${i}_start`] && (
                        <p className="text-xs mt-1 text-danger">{errors[`entry_${i}_start`]}</p>
                      )}
                    </div>
                    <TimeField
                      label="End time"
                      value={entry.end_time}
                      onChange={val => updateEntry(i, 'end_time', val)}
                      defaultEmpty={entry.start_time ? adjustTime(entry.start_time, 60) : getCurrentTimeRounded()}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(15,55,20,0.45)' }}>Break (mins)</label>
                    <input
                      type="number"
                      min="0"
                      value={entry.break_minutes}
                      onChange={e => updateEntry(i, 'break_minutes', e.target.value)}
                      className="field-input py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(15,55,20,0.45)' }}>
                      Billable hours
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={entry.billable_hours}
                      onChange={e => updateEntry(i, 'billable_hours', e.target.value)}
                      placeholder="0"
                      className={`field-input py-2${errors[`entry_${i}_hours`] ? ' field-error' : ''}`}
                    />
                    {errors[`entry_${i}_hours`] && (
                      <p className="text-xs mt-0.5 text-danger">{errors[`entry_${i}_hours`]}</p>
                    )}
                  </div>
                </div>

                {jobType !== 'internal' && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <ToggleChip
                      label="Power tools"
                      checked={entry.hasPowerTools}
                      onChange={v => updateEntry(i, 'hasPowerTools', v)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Materials */}
        <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-label mb-0">Materials</h2>
              <button
                type="button"
                onClick={addMaterial}
                className="text-xs font-bold px-3 py-1.5 rounded-lg border border-brand-lime text-brand-lime hover:bg-brand-lime/10 transition-colors"
              >
                + Add material
              </button>
            </div>

            {materials.length === 0 && (
              <p className="text-xs text-gray-400 italic">No materials — add if any were used today.</p>
            )}

            <div className="space-y-4">
              {materials.map((mat, i) => mat._deleted ? null : (
                <div key={i} className="card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="section-label mb-0">Material {i + 1}</span>
                    <button type="button" onClick={() => removeMaterial(i)} className="text-xs text-gray-400 hover:text-gray-600">
                      Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(15,55,20,0.45)' }}>Description</label>
                      <input
                        type="text"
                        value={mat.description}
                        onChange={e => updateMaterial(i, 'description', e.target.value)}
                        placeholder="e.g. Compost, Bark mulch"
                        className={`field-input${errors[`mat_${i}_desc`] ? ' field-error' : ''}`}
                      />
                      {errors[`mat_${i}_desc`] && (
                        <p className="text-xs mt-0.5 text-danger">{errors[`mat_${i}_desc`]}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(15,55,20,0.45)' }}>Qty</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={mat.qty}
                        onChange={e => updateMaterial(i, 'qty', e.target.value)}
                        className="field-input"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(15,55,20,0.45)' }}>Unit</label>
                      <input
                        type="text"
                        value={mat.unit}
                        onChange={e => updateMaterial(i, 'unit', e.target.value)}
                        placeholder="bags, kg, m²…"
                        className="field-input"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(15,55,20,0.45)' }}>Cost paid</label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-gray-400 shrink-0">€</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={mat.cost_paid}
                          onChange={e => updateMaterial(i, 'cost_paid', e.target.value)}
                          onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) updateMaterial(i, 'cost_paid', v.toFixed(2)) }}
                          placeholder="0.00"
                          className={`field-input${errors[`mat_${i}_cost`] ? ' field-error' : ''}`}
                        />
                      </div>
                      {errors[`mat_${i}_cost`] && <p className="text-xs mt-0.5 text-danger">{errors[`mat_${i}_cost`]}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(15,55,20,0.45)' }}>Charged to customer</label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-gray-400 shrink-0">€</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={mat.amount_charged}
                          onChange={e => updateMaterial(i, 'amount_charged', e.target.value)}
                          onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) updateMaterial(i, 'amount_charged', v.toFixed(2)) }}
                          placeholder="0.00"
                          className={`field-input${errors[`mat_${i}_charged`] ? ' field-error' : ''}`}
                        />
                      </div>
                      {errors[`mat_${i}_charged`] && <p className="text-xs mt-0.5 text-danger">{errors[`mat_${i}_charged`]}</p>}
                    </div>

                    <div className="col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(15,55,20,0.45)' }}>Notes</label>
                      <input
                        type="text"
                        value={mat.notes}
                        onChange={e => updateMaterial(i, 'notes', e.target.value)}
                        className="field-input"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(15,55,20,0.45)' }}>Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Any notes about this visit…"
            className="field-input"
          />
        </div>

        {/* Follow-up note */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(15,55,20,0.45)' }}>Follow-up note for next visit</label>
          <textarea
            value={followUpNote}
            onChange={e => setFollowUpNote(e.target.value)}
            rows={2}
            placeholder="e.g. Bring weed suppressor, check back fence…"
            className="field-input"
          />
          <p className="text-xs mt-1" style={{ color: 'rgba(15,55,20,0.35)' }}>Shown as a reminder when logging the next visit on this job.</p>
        </div>

        {serverError && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ background: 'rgba(15,55,20,0.05)', border: '1px solid rgba(15,55,20,0.15)', color: '#0F3714' }}>
            {serverError}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold disabled:opacity-60 transition-all hover:brightness-95 cursor-pointer"
            style={{ background: '#97B545', color: '#0F3714' }}
          >
            {isSaving && <Spinner className="w-4 h-4 text-[#0F3714]" />}
            {isEdit ? 'Save changes' : 'Save work log'}
          </button>
          <Link to={`/jobs/${id}`} className="px-4 py-2 text-sm font-semibold transition-colors" style={{ color: 'rgba(15,55,20,0.5)' }}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
