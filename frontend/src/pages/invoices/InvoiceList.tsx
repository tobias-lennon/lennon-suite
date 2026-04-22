import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../lib/api'
import Spinner from '../../components/Spinner'

interface Invoice {
  id: number
  invoice_number: string
  status: string
  issued_date: string
  due_date: string
  total_due: number
  customer: { id: number; name: string }
  job: { id: number; title: string }
}

interface Paginated {
  data: Invoice[]
  current_page: number
  last_page: number
  total: number
}

const STATUS_TABS = ['all', 'draft', 'sent', 'paid'] as const
const STATUS_LABELS: Record<string, string> = { all: 'All', draft: 'Not Sent', sent: 'Sent', paid: 'Paid' }
const STATUS_COLOURS: Record<string, string> = {
  draft: 'badge-draft',
  sent:  'badge-sent',
  paid:  'badge-paid',
}

function statusLabel(s: string) {
  if (s === 'draft') return 'Not Sent'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function fmt(val: number) {
  return `€${val.toFixed(2)}`
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function InvoiceList() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const statusFilter = searchParams.get('status') ?? 'all'
  const page = parseInt(searchParams.get('page') ?? '1', 10)

  const [invoices, setInvoices] = useState<Paginated | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    const params: Record<string, string> = { page: String(page) }
    if (statusFilter !== 'all') params.status = statusFilter

    api.get('/invoices', { params }).then(res => {
      setInvoices(res.data)
      setIsLoading(false)
    })
  }, [statusFilter, page])

  function setStatus(s: string) {
    setSearchParams({ status: s, page: '1' })
  }

  function setPage(p: number) {
    setSearchParams({ status: statusFilter, page: String(p) })
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-brand-dark">Invoices</h1>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {STATUS_TABS.map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className="px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all"
            style={statusFilter === s
              ? { background: '#0F3714', color: 'white' }
              : { background: 'rgba(255,255,255,0.7)', color: 'rgba(15,55,20,0.6)' }
            }
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner className="w-6 h-6 text-brand-lime" /></div>
      ) : !invoices || invoices.data.length === 0 ? (
        <div className="text-center py-12 text-sm" style={{ color: 'rgba(15,55,20,0.4)' }}>No invoices found.</div>
      ) : (
        <>
          <div className="table-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="thead-dark text-left">
                  <th>Invoice #</th>
                  <th className="hidden md:table-cell">Customer</th>
                  <th className="hidden lg:table-cell">Job</th>
                  <th className="hidden md:table-cell">Issued</th>
                  <th className="text-right">Amount</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/4">
                {invoices.data.map(inv => (
                  <tr
                    key={inv.id}
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                    className="tr-hover cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-bold text-brand-dark">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-gray-700 hidden md:table-cell">{inv.customer?.name}</td>
                    <td className="px-4 py-3 hidden lg:table-cell truncate max-w-[180px]" style={{ color: 'rgba(15,55,20,0.5)' }}>{inv.job?.title}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs" style={{ color: 'rgba(15,55,20,0.5)' }}>{formatDate(inv.issued_date)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-brand-dark">{fmt(inv.total_due)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`badge ${STATUS_COLOURS[inv.status] ?? 'badge-backlog'}`}>
                        {statusLabel(inv.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {invoices.last_page > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm" style={{ color: 'rgba(15,55,20,0.5)' }}>
              <span>{invoices.total} total</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1.5 rounded-lg border border-black/8 disabled:opacity-40 hover:bg-white/60 transition-colors"
                >
                  ‹ Prev
                </button>
                <span className="px-3 py-1.5">{page} / {invoices.last_page}</span>
                <button
                  disabled={page >= invoices.last_page}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1.5 rounded-lg border border-black/8 disabled:opacity-40 hover:bg-white/60 transition-colors"
                >
                  Next ›
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
