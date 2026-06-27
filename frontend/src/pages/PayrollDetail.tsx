import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../lib/api'
import Spinner from '../components/Spinner'

interface Payslip {
  id: number
  employee_id: number
  employee_name: string
  employee_ppsn: string | null
  hours_logged: number
  hours_extra: number
  extra_description: string | null
  hours_total: number
  gross_pay: number
  paye: number
  prsi_employee: number
  prsi_employer: number
  usc: number
  net_pay: number
  emailed_at: string | null
  has_rpn_data: boolean
}

interface PayrollRun {
  id: number
  period_start: string
  period_end: string
  pay_date: string
  status: 'draft' | 'finalised'
  payslips: Payslip[]
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function eur(n: number) {
  return `€${n.toFixed(2)}`
}

export default function PayrollDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [run, setRun]                 = useState<PayrollRun | null>(null)
  const [loading, setLoading]         = useState(true)
  const [editingId, setEditingId]     = useState<number | null>(null)
  const [editForm, setEditForm]       = useState({ hours_extra: '', extra_description: '' })
  const [editSaving, setEditSaving]   = useState(false)
  const [finalising, setFinalising]   = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [error, setError]             = useState<string | null>(null)

  useEffect(() => {
    api.get(`/payroll/${id}`)
      .then(r => setRun(r.data))
      .catch(() => setError('Pay run not found.'))
      .finally(() => setLoading(false))
  }, [id])

  function startEdit(p: Payslip) {
    setEditingId(p.id)
    setEditForm({
      hours_extra:       p.hours_extra > 0 ? String(p.hours_extra) : '',
      extra_description: p.extra_description ?? '',
    })
  }

  async function handleSaveEdit(payslipId: number) {
    setEditSaving(true)
    try {
      const { data } = await api.patch(`/payroll/${id}/payslips/${payslipId}`, {
        hours_extra:       parseFloat(editForm.hours_extra) || 0,
        extra_description: editForm.extra_description || null,
      })
      setRun(prev => prev ? { ...prev, payslips: prev.payslips.map(p => p.id === payslipId ? data : p) } : prev)
      setEditingId(null)
    } catch {
      setError('Could not save changes.')
    } finally {
      setEditSaving(false)
    }
  }

  async function handleFinalise() {
    if (!confirm('Finalise this pay run? This locks the figures and cannot be undone.')) return
    setFinalising(true); setError(null)
    try {
      const { data } = await api.post(`/payroll/${id}/finalise`)
      setRun(data)
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Could not finalise pay run.')
    } finally {
      setFinalising(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this draft pay run?')) return
    setDeleting(true)
    try {
      await api.delete(`/payroll/${id}`)
      navigate('/payroll')
    } catch {
      setError('Could not delete pay run.')
      setDeleting(false)
    }
  }

  function openPdf(payslipId: number) {
    window.open(`${import.meta.env.VITE_API_URL ?? ''}/api/payroll/${id}/payslips/${payslipId}/pdf`, '_blank')
  }

  if (loading) return <div className="p-8 flex justify-center"><Spinner className="w-6 h-6 text-[#97B545]" /></div>
  if (!run) return <div className="p-8 text-center text-sm text-gray-400">{error ?? 'Pay run not found.'}</div>

  const isDraft = run.status === 'draft'

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <Link to="/payroll" className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-6">← Payroll</Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-dark">
            {fmtDate(run.period_start)} – {fmtDate(run.period_end)}
          </h1>
          <p className="text-sm text-gray-400 mt-1">Pay date: {fmtDate(run.pay_date)}</p>
        </div>
        <span
          className="text-xs font-bold px-3 py-1 rounded-full flex-shrink-0 mt-1"
          style={isDraft
            ? { background: 'rgba(0,0,0,0.06)', color: '#555' }
            : { background: 'rgba(151,181,69,0.15)', color: '#3a6e0f' }}
        >
          {isDraft ? 'Draft' : 'Finalised'}
        </span>
      </div>

      {error && <p className="text-sm text-danger mb-4">{error}</p>}

      {/* Payslips */}
      <div className="flex flex-col gap-4 mb-6">
        {run.payslips.map(p => (
          <div key={p.id} className="card p-5 flex flex-col gap-4">

            {/* Employee header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-brand-dark">{p.employee_name}</p>
                {p.employee_ppsn && <p className="text-xs font-mono text-gray-400 mt-0.5">PPSN: {p.employee_ppsn}</p>}
                {!p.has_rpn_data && (
                  <p className="text-xs mt-1 font-semibold" style={{ color: '#c87a00' }}>
                    ⚠ No RPN data — tax figures may be wrong. Add via Settings → Employees.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {isDraft && editingId !== p.id && (
                  <button onClick={() => startEdit(p)} className="text-xs font-semibold px-2.5 py-1 rounded-lg cursor-pointer" style={{ background: 'rgba(0,0,0,0.05)', color: '#555' }}>
                    Edit hours
                  </button>
                )}
                <button
                  onClick={() => openPdf(p.id)}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg cursor-pointer"
                  style={{ background: 'rgba(151,181,69,0.12)', color: '#3a6e0f' }}
                >
                  PDF
                </button>
              </div>
            </div>

            {/* Edit extra hours */}
            {editingId === p.id && (
              <div className="p-3 rounded-lg flex flex-col gap-3" style={{ background: 'rgba(151,181,69,0.06)', border: '1px solid rgba(151,181,69,0.2)' }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(15,55,20,0.45)' }}>Extra Hours</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={editForm.hours_extra}
                      onChange={e => setEditForm(prev => ({ ...prev, hours_extra: e.target.value }))}
                      className="field-input"
                      placeholder="e.g. 4"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(15,55,20,0.45)' }}>Description</label>
                    <input
                      type="text"
                      value={editForm.extra_description}
                      onChange={e => setEditForm(prev => ({ ...prev, extra_description: e.target.value }))}
                      className="field-input"
                      placeholder="e.g. House work"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditingId(null)} className="text-xs font-semibold px-2.5 py-1 rounded-lg cursor-pointer bg-black/6">Cancel</button>
                  <button onClick={() => handleSaveEdit(p.id)} disabled={editSaving} className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg cursor-pointer disabled:opacity-60" style={{ background: '#97B545', color: '#0F3714' }}>
                    {editSaving && <Spinner className="w-3 h-3 text-[#0F3714]" />}
                    Save
                  </button>
                </div>
              </div>
            )}

            {/* Pay breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'rgba(15,55,20,0.4)' }}>Hours</p>
                <p className="text-sm font-semibold text-brand-dark">
                  {p.hours_total.toFixed(2)}
                  {p.hours_extra > 0 && <span className="text-xs font-normal text-gray-400"> ({p.hours_logged.toFixed(2)} + {p.hours_extra.toFixed(2)})</span>}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'rgba(15,55,20,0.4)' }}>Gross</p>
                <p className="text-sm font-semibold text-brand-dark">{eur(p.gross_pay)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'rgba(15,55,20,0.4)' }}>Deductions</p>
                <p className="text-sm font-semibold text-brand-dark">{eur(p.paye + p.prsi_employee + p.usc)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'rgba(151,181,69,0.8)' }}>Take-Home</p>
                <p className="text-sm font-black" style={{ color: '#97B545' }}>{eur(p.net_pay)}</p>
              </div>
            </div>

            {/* Deductions detail */}
            <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-black/5">
              <div><span className="text-gray-400">PAYE </span><span className="font-semibold text-brand-dark">{eur(p.paye)}</span></div>
              <div><span className="text-gray-400">PRSI (ee) </span><span className="font-semibold text-brand-dark">{eur(p.prsi_employee)}</span></div>
              <div><span className="text-gray-400">USC </span><span className="font-semibold text-brand-dark">{eur(p.usc)}</span></div>
            </div>

          </div>
        ))}
      </div>

      {/* ROS Submission Summary */}
      <div className="card p-5 mb-6">
        <h2 className="text-sm font-bold text-brand-dark mb-4">ROS Submission Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: 'rgba(15,55,20,0.45)' }}>
                <th className="text-left pb-2 font-bold uppercase tracking-wide">Employee</th>
                <th className="text-left pb-2 font-bold uppercase tracking-wide">PPSN</th>
                <th className="text-right pb-2 font-bold uppercase tracking-wide">Gross</th>
                <th className="text-right pb-2 font-bold uppercase tracking-wide">PAYE</th>
                <th className="text-right pb-2 font-bold uppercase tracking-wide">PRSI (ee)</th>
                <th className="text-right pb-2 font-bold uppercase tracking-wide">PRSI (er)</th>
                <th className="text-right pb-2 font-bold uppercase tracking-wide">USC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {run.payslips.map(p => (
                <tr key={p.id}>
                  <td className="py-2 font-semibold text-brand-dark">{p.employee_name}</td>
                  <td className="py-2 font-mono text-gray-500">{p.employee_ppsn ?? '—'}</td>
                  <td className="py-2 text-right font-semibold">{eur(p.gross_pay)}</td>
                  <td className="py-2 text-right">{eur(p.paye)}</td>
                  <td className="py-2 text-right">{eur(p.prsi_employee)}</td>
                  <td className="py-2 text-right">{eur(p.prsi_employer)}</td>
                  <td className="py-2 text-right">{eur(p.usc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] mt-3" style={{ color: 'rgba(15,55,20,0.4)' }}>
          Enter these figures in ROS → PAYE Services → Submit Payroll Submission Request (PSR). LPT is €0.00 for all employees unless otherwise notified by Revenue.
        </p>
      </div>

      {/* Actions */}
      {isDraft && (
        <div className="flex items-center justify-between">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer disabled:opacity-60"
            style={{ background: 'rgba(184,74,42,0.08)', color: '#B84A2A' }}
          >
            {deleting ? 'Deleting…' : 'Delete Draft'}
          </button>
          <button
            onClick={handleFinalise}
            disabled={finalising}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-lg cursor-pointer disabled:opacity-60 transition-all hover:brightness-95"
            style={{ background: '#0F3714', color: 'white' }}
          >
            {finalising && <Spinner className="w-4 h-4 text-white" />}
            {finalising ? 'Finalising…' : 'Finalise Pay Run'}
          </button>
        </div>
      )}
    </div>
  )
}
