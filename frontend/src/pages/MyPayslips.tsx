import { useEffect, useState } from 'react'
import api from '../lib/api'
import Spinner from '../components/Spinner'

interface MyPayslip {
  id: number
  period_start: string
  period_end: string
  pay_date: string
  hours_total: number
  gross_pay: number
  net_pay: number
  emailed_at: string | null
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function MyPayslips() {
  const [payslips, setPayslips] = useState<MyPayslip[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    api.get('/my-payslips')
      .then(r => setPayslips(r.data))
      .finally(() => setLoading(false))
  }, [])

  function downloadPdf(payslipId: number) {
    window.open(`${import.meta.env.VITE_API_URL ?? ''}/api/my-payslips/${payslipId}/pdf`, '_blank')
  }

  if (loading) return <div className="p-8 flex justify-center"><Spinner className="w-6 h-6 text-[#97B545]" /></div>

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-brand-dark mb-6">My Payslips</h1>

      {payslips.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-gray-400">No payslips yet.</p>
        </div>
      ) : (
        <div className="card divide-y divide-black/5">
          {payslips.map(p => (
            <div key={p.id} className="flex items-center justify-between px-5 py-4 gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-brand-dark">
                  {fmtDate(p.period_start)} – {fmtDate(p.period_end)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Pay date: {fmtDate(p.pay_date)} · {p.hours_total.toFixed(2)} hrs
                </p>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="text-right">
                  <p className="text-xs text-gray-400">Take-home</p>
                  <p className="text-sm font-black" style={{ color: '#97B545' }}>€{p.net_pay.toFixed(2)}</p>
                </div>
                <button
                  onClick={() => downloadPdf(p.id)}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer"
                  style={{ background: 'rgba(151,181,69,0.12)', color: '#3a6e0f' }}
                >
                  PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
