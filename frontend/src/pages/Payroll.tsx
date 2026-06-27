import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import Spinner from '../components/Spinner'

interface PayrollRun {
  id: number
  period_start: string
  period_end: string
  pay_date: string
  status: 'draft' | 'finalised'
  payslip_count: number
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getMonday(d: Date) {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default function Payroll() {
  const navigate = useNavigate()
  const [runs, setRuns]         = useState<PayrollRun[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const monday   = getMonday(new Date())
  const sunday   = new Date(monday); sunday.setDate(monday.getDate() + 6)
  const nextFri  = new Date(monday); nextFri.setDate(monday.getDate() + 4)

  const [form, setForm] = useState({
    period_start: toInputDate(monday),
    period_end:   toInputDate(sunday),
    pay_date:     toInputDate(nextFri),
  })

  useEffect(() => {
    api.get('/payroll')
      .then(r => setRuns(r.data))
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true); setCreateError(null)
    try {
      const { data } = await api.post('/payroll', form)
      navigate(`/payroll/${data.id}`)
    } catch (err: any) {
      setCreateError(err.response?.data?.message ?? 'Could not create pay run.')
    } finally {
      setCreating(false)
    }
  }

  if (loading) return <div className="p-8 flex justify-center"><Spinner className="w-6 h-6 text-[#97B545]" /></div>

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-brand-dark">Payroll</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 text-sm font-bold rounded-lg cursor-pointer"
            style={{ background: '#97B545', color: '#0F3714' }}
          >
            + New Pay Run
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card p-5 flex flex-col gap-4 mb-6 border-2" style={{ borderColor: '#97B545' }}>
          <h2 className="text-sm font-bold text-brand-dark">New Weekly Pay Run</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(15,55,20,0.45)' }}>Period Start</label>
              <input type="date" value={form.period_start} onChange={e => setForm(p => ({ ...p, period_start: e.target.value }))} className="field-input" required />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(15,55,20,0.45)' }}>Period End</label>
              <input type="date" value={form.period_end} onChange={e => setForm(p => ({ ...p, period_end: e.target.value }))} className="field-input" required />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(15,55,20,0.45)' }}>Pay Date</label>
              <input type="date" value={form.pay_date} onChange={e => setForm(p => ({ ...p, pay_date: e.target.value }))} className="field-input" required />
            </div>
          </div>
          <p className="text-xs" style={{ color: 'rgba(15,55,20,0.45)' }}>
            Hours will be pulled automatically from work logs in this period. You can add extra hours on the next screen.
          </p>
          {createError && <p className="text-xs text-danger">{createError}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-black/6 cursor-pointer">Cancel</button>
            <button type="submit" disabled={creating} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer disabled:opacity-60" style={{ background: '#0F3714', color: 'white' }}>
              {creating && <Spinner className="w-3 h-3 text-white" />}
              Create Pay Run
            </button>
          </div>
        </form>
      )}

      {runs.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-gray-400">No pay runs yet. Create your first one above.</p>
        </div>
      ) : (
        <div className="card divide-y divide-black/5">
          {runs.map(run => (
            <Link
              key={run.id}
              to={`/payroll/${run.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-black/2 transition-colors"
            >
              <div>
                <p className="text-sm font-semibold text-brand-dark">
                  {fmtDate(run.period_start)} – {fmtDate(run.period_end)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Pay date: {fmtDate(run.pay_date)} · {run.payslip_count} payslip{run.payslip_count !== 1 ? 's' : ''}</p>
              </div>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={run.status === 'finalised'
                  ? { background: 'rgba(151,181,69,0.15)', color: '#3a6e0f' }
                  : { background: 'rgba(0,0,0,0.06)', color: '#666' }}
              >
                {run.status === 'finalised' ? 'Finalised' : 'Draft'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
