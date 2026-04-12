import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/api'
import { toTitleCase } from '../../lib/formatters'
import Spinner from '../../components/Spinner'

interface LineItem {
  id: number
  type: 'labour' | 'material'
  description: string
  quantity: number
  unit_price: number
  amount: number
}

interface Invoice {
  id: number
  invoice_number: string
  status: string
  issued_date: string
  due_date: string
  subtotal: number
  discount_pct: number
  discount_amount: number
  vat_rate: number
  vat_amount: number
  total_due: number
  amount_paid: number | null
  payment_method: string | null
  paid_at: string | null
  payment_notes: string | null
  notes: string | null
  customer: {
    id: number
    name: string
    email: string | null
    phone: string | null
    address: {
      address_line_1: string | null
      address_line_2: string | null
      city: string | null
      county: string | null
      postcode: string | null
    } | null
  }
  job: { id: number; title: string; type: string }
  line_items: LineItem[]
}

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

async function downloadBlob(url: string, filename: string) {
  const res = await api.get(url, { responseType: 'blob' })
  const blobUrl = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
  const anchor = document.createElement('a')
  anchor.href = blobUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(blobUrl)
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [downloadingReceipt, setDownloadingReceipt] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Payment form
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    amount_paid: '',
    payment_method: 'bank_transfer',
    paid_at: new Date().toISOString().split('T')[0],
    payment_notes: '',
  })
  const [paymentErrors, setPaymentErrors] = useState<Record<string, string>>({})
  const [isRecordingPayment, setIsRecordingPayment] = useState(false)

  useEffect(() => {
    api.get(`/invoices/${id}`).then(res => {
      setInvoice(res.data)
      if (res.data.total_due) {
        setPaymentForm(f => ({ ...f, amount_paid: res.data.total_due.toFixed(2) }))
      }
      setIsLoading(false)
    })
  }, [id])

  async function updateStatus(status: string) {
    if (!invoice) return
    setStatusUpdating(true)
    await api.patch(`/invoices/${id}/status`, { status })
    setInvoice(prev => prev ? { ...prev, status } : prev)
    setStatusUpdating(false)
  }

  async function recordPayment() {
    setPaymentErrors({})
    setIsRecordingPayment(true)
    try {
      const res = await api.post(`/invoices/${id}/payment`, {
        amount_paid: parseFloat(paymentForm.amount_paid),
        payment_method: paymentForm.payment_method,
        paid_at: paymentForm.paid_at,
        payment_notes: paymentForm.payment_notes || undefined,
      })
      setInvoice(res.data)
      setShowPaymentForm(false)
    } catch (err: any) {
      if (err.response?.status === 422) {
        const errs = err.response.data.errors ?? {}
        const flat: Record<string, string> = {}
        Object.entries(errs).forEach(([k, v]) => { flat[k] = (v as string[])[0] })
        setPaymentErrors(flat)
      }
    } finally {
      setIsRecordingPayment(false)
    }
  }

  async function handleDownloadPdf() {
    if (!invoice) return
    setDownloading(true)
    await downloadBlob(`/invoices/${id}/download`, `invoice-${invoice.invoice_number}.pdf`)
    setDownloading(false)
  }

  async function handleDownloadReceipt() {
    if (!invoice) return
    setDownloadingReceipt(true)
    await downloadBlob(`/invoices/${id}/receipt`, `receipt-${invoice.invoice_number}.pdf`)
    setDownloadingReceipt(false)
  }

  async function deleteInvoice() {
    await api.delete(`/invoices/${id}`)
    navigate('/invoices')
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>
  }

  if (!invoice) {
    return <div className="p-6 text-gray-500">Invoice not found.</div>
  }

  const variance = invoice.amount_paid !== null ? invoice.amount_paid - invoice.total_due : 0
  const isOverpaid  = variance > 0.005
  const isUnderpaid = variance < -0.005

  const addrParts = [
    invoice.customer.address?.address_line_1,
    invoice.customer.address?.address_line_2,
    invoice.customer.address?.city,
    invoice.customer.address?.county,
    invoice.customer.address?.postcode,
  ].filter(Boolean)

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">

      {/* Back */}
      <button onClick={() => navigate(-1)} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-6">
        ← Back
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[#0F3714]">{invoice.invoice_number}</h1>
          <p className="text-sm text-gray-500 mt-1">
            <Link to={`/customers/${invoice.customer.id}`} className="hover:underline" style={{ color: '#97B545' }}>
              {toTitleCase(invoice.customer.name)}
            </Link>
            <span className="text-gray-300 mx-1">·</span>
            <Link to={`/jobs/${invoice.job.id}`} className="hover:underline text-gray-500">
              {invoice.job.title}
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLOURS[invoice.status] ?? ''}`}>
            {statusLabel(invoice.status)}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={handleDownloadPdf}
          disabled={downloading}
          className="min-w-[152px] flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
        >
          {downloading ? (
            <svg className="animate-spin w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
          Download Invoice
        </button>

        {invoice.status === 'paid' && (
          <button
            onClick={handleDownloadReceipt}
            disabled={downloadingReceipt}
            className="min-w-[152px] flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
          >
            {downloadingReceipt ? (
              <svg className="animate-spin w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            )}
            Download Receipt
          </button>
        )}

        {invoice.status !== 'paid' && (
          <button
            onClick={() => setShowPaymentForm(v => !v)}
            className="min-w-[140px] flex items-center justify-center px-3 py-2 text-sm font-medium rounded-lg text-white"
            style={{ backgroundColor: '#97B545' }}
          >
            Record Payment
          </button>
        )}

        {invoice.status === 'paid' && (
          <button
            disabled={statusUpdating}
            onClick={() => updateStatus('sent')}
            className="min-w-[120px] flex items-center justify-center px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {statusUpdating ? (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : 'Revert to Sent'}
          </button>
        )}
      </div>

      {/* Send flow hint — only when not yet sent */}
      {invoice.status === 'draft' && (
        <div className="flex items-center gap-3 mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="text-sm text-amber-800">
            <span className="font-medium">Next step:</span> Download the invoice above, send it to the customer, then come back and record payment when received.
          </div>
          <button
            disabled={statusUpdating}
            onClick={() => updateStatus('sent')}
            className="shrink-0 min-w-[100px] flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            {statusUpdating ? (
              <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : 'Mark Sent ✓'}
          </button>
        </div>
      )}

      {/* Payment recording form */}
      {showPaymentForm && (
        <div className="bg-[#f9fdf4] border border-[#c8e08a] rounded-xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-[#0F3714] mb-4">Record Payment</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div>
              <label className="block text-xs text-gray-500 mb-1">Amount Paid (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={paymentForm.amount_paid}
                onChange={e => setPaymentForm(f => ({ ...f, amount_paid: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545]"
              />
              {paymentErrors.amount_paid && (
                <p className="text-xs text-red-500 mt-1">{paymentErrors.amount_paid}</p>
              )}
              {/* Variance hint */}
              {paymentForm.amount_paid && !isNaN(parseFloat(paymentForm.amount_paid)) && (
                (() => {
                  const diff = parseFloat(paymentForm.amount_paid) - invoice.total_due
                  if (Math.abs(diff) < 0.005) return null
                  return (
                    <p className={`text-xs mt-1 ${diff > 0 ? 'text-amber-600' : 'text-red-500'}`}>
                      {diff > 0 ? `Overpaid by €${diff.toFixed(2)}` : `Underpaid by €${Math.abs(diff).toFixed(2)}`}
                    </p>
                  )
                })()
              )}
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Payment Method</label>
              <select
                value={paymentForm.payment_method}
                onChange={e => setPaymentForm(f => ({ ...f, payment_method: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545] bg-white"
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Date Received</label>
              <input
                type="date"
                value={paymentForm.paid_at}
                onChange={e => setPaymentForm(f => ({ ...f, paid_at: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545]"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
              <input
                type="text"
                value={paymentForm.payment_notes}
                onChange={e => setPaymentForm(f => ({ ...f, payment_notes: e.target.value }))}
                placeholder="e.g. rounded up"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545]"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={recordPayment}
              disabled={isRecordingPayment}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
              style={{ backgroundColor: '#0F3714' }}
            >
              {isRecordingPayment ? 'Saving…' : 'Save Payment'}
            </button>
            <button
              onClick={() => setShowPaymentForm(false)}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Payment confirmed banner */}
      {invoice.status === 'paid' && invoice.amount_paid !== null && (
        <div className={`rounded-xl border p-4 mb-6 ${
          isOverpaid
            ? 'bg-amber-50 border-amber-200'
            : isUnderpaid
              ? 'bg-red-50 border-red-200'
              : 'bg-green-50 border-green-200'
        }`}>
          <div className="flex items-start justify-between">
            <div>
              <p className={`text-sm font-semibold ${isOverpaid ? 'text-amber-800' : isUnderpaid ? 'text-red-800' : 'text-green-800'}`}>
                {isOverpaid ? 'Payment received (overpaid)' : isUnderpaid ? 'Partial payment received' : 'Payment confirmed'}
              </p>
              <p className="text-sm text-gray-600 mt-0.5">
                {fmt(invoice.amount_paid)} via {invoice.payment_method === 'bank_transfer' ? 'Bank Transfer' : 'Cash'}
                {invoice.paid_at && ` · ${formatDate(invoice.paid_at)}`}
              </p>
              {isOverpaid && (
                <p className="text-xs text-amber-700 mt-1">Customer overpaid by {fmt(variance)}</p>
              )}
              {isUnderpaid && (
                <p className="text-xs text-red-700 mt-1">Outstanding balance: {fmt(Math.abs(variance))}</p>
              )}
              {invoice.payment_notes && (
                <p className="text-xs text-gray-400 mt-1">{invoice.payment_notes}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invoice info */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-5">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Bill To</p>
            <p className="font-medium text-gray-900">{toTitleCase(invoice.customer.name)}</p>
            {addrParts.length > 0 && (
              <p className="text-gray-500 text-xs leading-relaxed mt-0.5">{addrParts.join(', ')}</p>
            )}
            {invoice.customer.email && (
              <p className="text-gray-400 text-xs mt-0.5">{invoice.customer.email}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Job</p>
            <Link to={`/jobs/${invoice.job.id}`} className="text-[#97B545] hover:underline text-sm">
              {invoice.job.title}
            </Link>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Dates</p>
            <p className="text-gray-700">Issued: {formatDate(invoice.issued_date)}</p>
            <p className="text-gray-700">Due: {formatDate(invoice.due_date)}</p>
          </div>
        </div>

        {invoice.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}
      </div>

      {/* Line items */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
              <th className="text-left px-4 py-3 font-medium">Description</th>
              <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Qty</th>
              <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Unit Price</th>
              <th className="text-right px-4 py-3 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {invoice.line_items.map(item => (
              <tr key={item.id} className={item.type === 'material' ? 'bg-gray-50/50' : ''}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${
                      item.type === 'labour'
                        ? 'bg-[#97B545]/15 text-[#5a7020]'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {item.type === 'labour' ? 'Labour' : 'Material'}
                    </span>
                    <span className="text-gray-700">{item.description}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-gray-400 hidden md:table-cell">{item.quantity}</td>
                <td className="px-4 py-3 text-right text-gray-400 hidden md:table-cell">{fmt(item.unit_price)}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals block */}
        <div className="border-t border-gray-100 px-4 py-4 space-y-1.5">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>{fmt(invoice.subtotal)}</span>
          </div>
          {invoice.discount_amount > 0 && (
            <div className="flex justify-between text-sm text-red-600">
              <span>Discount ({invoice.discount_pct}%)</span>
              <span>−{fmt(invoice.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-gray-600">
            <span>VAT ({invoice.vat_rate}%)</span>
            <span>{fmt(invoice.vat_amount)}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold text-[#0F3714] border-t border-gray-100 pt-2 mt-1">
            <span>Total Due</span>
            <span className="text-base" style={{ color: '#97B545' }}>{fmt(invoice.total_due)}</span>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="border-t border-gray-200 pt-6">
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} className="text-sm text-red-400 hover:text-red-600">
            Delete invoice
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Delete this invoice?</span>
            <button onClick={deleteInvoice} className="text-sm font-medium text-red-600 hover:text-red-800">
              Yes, delete
            </button>
            <button onClick={() => setConfirmDelete(false)} className="text-sm text-gray-500">Cancel</button>
          </div>
        )}
      </div>

    </div>
  )
}
