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
  draft: 'bg-amber-100 text-amber-700',
  sent:  'bg-blue-100 text-blue-700',
  paid:  'bg-green-100 text-green-700',
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
        <h1 className="text-xl font-semibold text-gray-900">Invoices</h1>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {STATUS_TABS.map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              statusFilter === s
                ? 'border-[#97B545] text-[#5a7020]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : !invoices || invoices.data.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No invoices found.</div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-medium">Invoice #</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Customer</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Job</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Issued</th>
                  <th className="text-right px-4 py-3 font-medium">Amount</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invoices.data.map(inv => (
                  <tr
                    key={inv.id}
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-[#0F3714]">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-gray-700 hidden md:table-cell">{inv.customer?.name}</td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell truncate max-w-[180px]">{inv.job?.title}</td>
                    <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{formatDate(inv.issued_date)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(inv.total_due)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOURS[inv.status] ?? 'bg-gray-100 text-gray-500'}`}>
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
            <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
              <span>{invoices.total} total</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                >
                  ‹ Prev
                </button>
                <span className="px-3 py-1">{page} / {invoices.last_page}</span>
                <button
                  disabled={page >= invoices.last_page}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
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
