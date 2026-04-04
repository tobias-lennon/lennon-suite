import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/api'
import Spinner from '../../components/Spinner'

interface Employee {
  id: number
  name: string
}

interface EntryRow {
  employee_id: string
  start_time: string
  end_time: string
  break_minutes: string
  billable_hours: string
}

interface MaterialRow {
  description: string
  qty: string
  unit: string
  cost_paid: string
  amount_charged: string
  notes: string
}

const DEFAULT_ENTRY: EntryRow = {
  employee_id: '',
  start_time: '09:00',
  end_time: '16:00',
  break_minutes: '60',
  billable_hours: '6.00',
}

const BLANK_MATERIAL: MaterialRow = {
  description: '',
  qty: '',
  unit: '',
  cost_paid: '',
  amount_charged: '',
  notes: '',
}

function calcBillableHours(start: string, end: string, breakMins: string): string {
  if (!start || !end) return ''
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const startTotal = sh * 60 + sm
  const endTotal = eh * 60 + em
  if (endTotal <= startTotal) return ''
  const gross = endTotal - startTotal - Number(breakMins || 0)
  if (gross <= 0) return '0'
  return (gross / 60).toFixed(2)
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
}: {
  label: string
  value: string
  onChange: (val: string) => void
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(adjustTime(value, -15))}
          className="px-2 py-1.5 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-600 select-none"
        >
          −
        </button>
        <input
          type="time"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545] text-center"
        />
        <button
          type="button"
          onClick={() => onChange(adjustTime(value, 15))}
          className="px-2 py-1.5 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-600 select-none"
        >
          +
        </button>
      </div>
    </div>
  )
}

export default function WorkLogForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [date, setDate] = useState(new Date().toISOString().substring(0, 10))
  const [notes, setNotes] = useState('')
  const [entries, setEntries] = useState<EntryRow[]>([{ ...DEFAULT_ENTRY }])
  const [materials, setMaterials] = useState<MaterialRow[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [jobComplete, setJobComplete] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get(`/jobs/${id}`),
      api.get('/employees'),
    ]).then(([jobRes, empRes]) => {
      if (jobRes.data.status === 'complete') {
        setJobComplete(true)
      }
      setEmployees(empRes.data)
      setIsLoading(false)
    })
  }, [id])

  function updateEntry(index: number, field: keyof EntryRow, value: string) {
    setEntries(prev => prev.map((e, i) => {
      if (i !== index) return e
      const next = { ...e, [field]: value }
      if (field === 'start_time' || field === 'end_time' || field === 'break_minutes') {
        const s = field === 'start_time' ? value : next.start_time
        const en = field === 'end_time' ? value : next.end_time
        const b = field === 'break_minutes' ? value : next.break_minutes
        next.billable_hours = calcBillableHours(s, en, b)
      }
      return next
    }))
  }

  function addEntry() {
    setEntries(prev => [...prev, { ...DEFAULT_ENTRY }])
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
    setMaterials(prev => prev.filter((_, i) => i !== index))
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!date) errs.date = 'Date is required'
    entries.forEach((e, i) => {
      if (!e.employee_id) errs[`entry_${i}_employee`] = 'Select an employee'
      if (!e.billable_hours || isNaN(Number(e.billable_hours)) || Number(e.billable_hours) <= 0) {
        errs[`entry_${i}_hours`] = 'Enter hours worked'
      }
    })
    materials.forEach((m, i) => {
      if (!m.description.trim()) errs[`mat_${i}_desc`] = 'Description required'
      if (!m.cost_paid || isNaN(Number(m.cost_paid))) errs[`mat_${i}_cost`] = 'Enter cost'
      if (!m.amount_charged || isNaN(Number(m.amount_charged))) errs[`mat_${i}_charged`] = 'Enter amount charged'
    })
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setIsSaving(true)
    setServerError(null)

    const payload = {
      date,
      notes: notes || null,
      entries: entries.map(e => ({
        employee_id: Number(e.employee_id),
        start_time: e.start_time || null,
        end_time: e.end_time || null,
        break_minutes: Number(e.break_minutes || 0),
        billable_hours: Number(e.billable_hours),
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

    try {
      await api.post(`/jobs/${id}/logs`, payload)
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
        <Link to={`/jobs/${id}`} className="text-sm text-gray-500 hover:text-gray-700">← Back</Link>
        <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
          <p className="text-sm font-medium text-gray-700 mb-1">This job is marked as complete.</p>
          <p className="text-xs text-gray-500">No further work logs can be added. Edit the job to reopen it first.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/jobs/${id}`} className="text-sm text-gray-500 hover:text-gray-700">← Back</Link>
        <h1 className="text-xl font-semibold text-gray-900">Add Work Log</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545] ${errors.date ? 'border-red-400' : 'border-gray-300'}`}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545]"
          />
        </div>

        {/* Time entries */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Time Entries</h2>
            <button
              type="button"
              onClick={addEntry}
              className="text-xs font-medium px-3 py-1 rounded border"
              style={{ color: '#97B545', borderColor: '#97B545' }}
            >
              + Add person
            </button>
          </div>

          <div className="space-y-4">
            {entries.map((entry, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Person {i + 1}</span>
                  {entries.length > 1 && (
                    <button type="button" onClick={() => removeEntry(i)} className="text-xs text-red-500 hover:text-red-700">
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Employee</label>
                    <select
                      value={entry.employee_id}
                      onChange={e => updateEntry(i, 'employee_id', e.target.value)}
                      className={`w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545] ${errors[`entry_${i}_employee`] ? 'border-red-400' : 'border-gray-300'}`}
                    >
                      <option value="">— Select —</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                      ))}
                    </select>
                    {errors[`entry_${i}_employee`] && (
                      <p className="text-red-500 text-xs mt-0.5">{errors[`entry_${i}_employee`]}</p>
                    )}
                  </div>

                  <TimeField
                    label="Start time"
                    value={entry.start_time}
                    onChange={val => updateEntry(i, 'start_time', val)}
                  />

                  <TimeField
                    label="End time"
                    value={entry.end_time}
                    onChange={val => updateEntry(i, 'end_time', val)}
                  />

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Break (mins)</label>
                    <input
                      type="number"
                      min="0"
                      value={entry.break_minutes}
                      onChange={e => updateEntry(i, 'break_minutes', e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Billable hours</label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={entry.billable_hours}
                      onChange={e => updateEntry(i, 'billable_hours', e.target.value)}
                      placeholder="Auto or enter"
                      className={`w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545] ${errors[`entry_${i}_hours`] ? 'border-red-400' : 'border-gray-300'}`}
                    />
                    {errors[`entry_${i}_hours`] && (
                      <p className="text-red-500 text-xs mt-0.5">{errors[`entry_${i}_hours`]}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Materials */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Materials</h2>
            <button
              type="button"
              onClick={addMaterial}
              className="text-xs font-medium px-3 py-1 rounded border"
              style={{ color: '#97B545', borderColor: '#97B545' }}
            >
              + Add material
            </button>
          </div>

          {materials.length === 0 && (
            <p className="text-xs text-gray-400 italic">No materials — add if any were used today.</p>
          )}

          <div className="space-y-4">
            {materials.map((mat, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Material {i + 1}</span>
                  <button type="button" onClick={() => removeMaterial(i)} className="text-xs text-red-500 hover:text-red-700">
                    Remove
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Description</label>
                    <input
                      type="text"
                      value={mat.description}
                      onChange={e => updateMaterial(i, 'description', e.target.value)}
                      placeholder="e.g. Compost, Bark mulch"
                      className={`w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545] ${errors[`mat_${i}_desc`] ? 'border-red-400' : 'border-gray-300'}`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Qty</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={mat.qty}
                      onChange={e => updateMaterial(i, 'qty', e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Unit</label>
                    <input
                      type="text"
                      value={mat.unit}
                      onChange={e => updateMaterial(i, 'unit', e.target.value)}
                      placeholder="bags, kg, m²…"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Cost paid (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={mat.cost_paid}
                      onChange={e => updateMaterial(i, 'cost_paid', e.target.value)}
                      className={`w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545] ${errors[`mat_${i}_cost`] ? 'border-red-400' : 'border-gray-300'}`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Charged to customer (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={mat.amount_charged}
                      onChange={e => updateMaterial(i, 'amount_charged', e.target.value)}
                      className={`w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545] ${errors[`mat_${i}_charged`] ? 'border-red-400' : 'border-gray-300'}`}
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Notes</label>
                    <input
                      type="text"
                      value={mat.notes}
                      onChange={e => updateMaterial(i, 'notes', e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545]"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {serverError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {serverError}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: '#97B545' }}
          >
            {isSaving ? 'Saving…' : 'Save work log'}
          </button>
          <Link to={`/jobs/${id}`} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
