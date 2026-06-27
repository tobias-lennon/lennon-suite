import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/api'
import { toTitleCase } from '../../lib/formatters'
import { usePermissions } from '../../hooks/usePermissions'
import Spinner from '../../components/Spinner'
import ConfirmDialog from '../../components/ConfirmDialog'

interface LineItem {
  id: number
  type: 'labour' | 'material' | 'callout'
  description: string
  quantity: number
  unit: string | null
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
  loyalty_hours_earned: number | null
  loyalty_balance_after: number | null
  loyalty_credit_applied: boolean
  loyalty_credit_amount: number | null
  can_apply_loyalty_credit: boolean
  has_pending_loyalty_credit: boolean
  loyalty_credit_value_inc_vat: number | null
  loyalty_credit_ex_vat: number | null
  customer_loyalty_balance: number | null
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
  const { canManageInvoice } = usePermissions()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadingReceipt, setDownloadingReceipt] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [applyingCredit, setApplyingCredit] = useState(false)

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
    api.get(`/invoices/${id}`)
      .then(res => {
        setInvoice(res.data)
        if (res.data.total_due) {
          setPaymentForm(f => ({ ...f, amount_paid: res.data.total_due.toFixed(2) }))
        }
      })
      .catch(() => setLoadError(true))
      .finally(() => setIsLoading(false))
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
    try {
      await downloadBlob(`/invoices/${id}/download`, `INV-${invoice.invoice_number}.pdf`)
    } finally {
      setDownloading(false)
    }
  }

  async function handleDownloadReceipt() {
    if (!invoice) return
    setDownloadingReceipt(true)
    try {
      await downloadBlob(`/invoices/${id}/receipt`, `REC-${invoice.invoice_number}.pdf`)
    } finally {
      setDownloadingReceipt(false)
    }
  }

  async function applyLoyaltyCredit() {
    if (!invoice) return
    setApplyingCredit(true)
    try {
      await api.post(`/invoices/${id}/apply-loyalty`)
      const res = await api.get(`/invoices/${id}`)
      setInvoice(res.data)
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Could not apply loyalty credit.')
    } finally {
      setApplyingCredit(false)
    }
  }

  async function deleteInvoice() {
    await api.delete(`/invoices/${id}`)
    navigate('/invoices')
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>
  }

  if (loadError) {
    return <div className="p-6 text-gray-500">Could not load invoice. Please try again.</div>
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

      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="Delete invoice?"
        message={`Delete ${invoice.invoice_number}? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={async () => { setShowDeleteDialog(false); await deleteInvoice() }}
        onCancel={() => setShowDeleteDialog(false)}
      />

      {/* Header */}
      <div className="mb-6">
        <button onClick={() => navigate(-1)} className="md:hidden text-sm transition-colors" style={{ color: 'rgba(15,55,20,0.45)' }}>
          ← Back
        </button>
        <div className="flex items-start justify-between gap-4 mt-1">
          <div>
            <h1 className="text-2xl font-bold text-brand-dark">{invoice.invoice_number}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              <Link to={`/customers/${invoice.customer.id}`} className="hover:underline" style={{ color: '#97B545' }}>
                {toTitleCase(invoice.customer.name)}
              </Link>
              <span className="text-gray-300 mx-1">·</span>
              <Link to={`/jobs/${invoice.job.id}`} className="hover:underline text-gray-500">
                {invoice.job.title}
              </Link>
            </p>
          </div>
          <span className={`mt-1 shrink-0 badge ${STATUS_COLOURS[invoice.status] ?? 'badge-draft'}`}>
            {statusLabel(invoice.status)}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={handleDownloadPdf}
          disabled={downloading}
          className="min-w-[152px] flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50"
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
            className="min-w-[152px] flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50"
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

        {invoice.status !== 'paid' && canManageInvoice && (
          <button
            onClick={() => setShowPaymentForm(v => !v)}
            className="min-w-[140px] flex items-center justify-center px-3 py-2 text-sm font-medium rounded-lg text-white"
            style={{ backgroundColor: '#97B545' }}
          >
            Record Payment
          </button>
        )}

        {invoice.status === 'paid' && canManageInvoice && (
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
      {invoice.status === 'draft' && canManageInvoice && (
        <div className="flex items-center gap-3 mb-6 p-3 rounded-lg" style={{ background: 'rgba(15,55,20,0.05)', border: '1px solid rgba(15,55,20,0.12)' }}>
          <div className="text-sm" style={{ color: '#0F3714' }}>
            <span className="font-medium">Next step:</span> Download the invoice above, send it to the customer, then come back and record payment when received.
          </div>
          <button
            disabled={statusUpdating}
            onClick={() => updateStatus('sent')}
            className="shrink-0 min-w-[100px] flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-lg disabled:opacity-50"
            style={{ background: 'rgba(151,181,69,0.18)', color: '#0F3714' }}
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
      {showPaymentForm && canManageInvoice && (
        <div className="bg-[#f9fdf4] border border-[#c8e08a] rounded-lg p-5 mb-6">
          <h3 className="text-sm font-semibold text-[#0F3714] mb-4">Record Payment</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div>
              <label className="block text-xs text-gray-500 mb-1">Amount Paid (€)</label>
              <input
                type="number"
                step="any"
                min="0"
                value={paymentForm.amount_paid}
                onChange={e => setPaymentForm(f => ({ ...f, amount_paid: e.target.value }))}
                onBlur={e => { const v = e.target.valueAsNumber; if (!isNaN(v)) setPaymentForm(f => ({ ...f, amount_paid: v.toFixed(2) })) }}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545]"
              />
              {paymentErrors.amount_paid && (
                <p className="text-xs text-danger mt-1">{paymentErrors.amount_paid}</p>
              )}
              {/* Variance hint */}
              {paymentForm.amount_paid && !isNaN(parseFloat(paymentForm.amount_paid)) && (
                (() => {
                  const diff = parseFloat(paymentForm.amount_paid) - invoice.total_due
                  if (Math.abs(diff) < 0.005) return null
                  return (
                    <p className={`text-xs mt-1 ${diff > 0 ? '' : 'text-danger'}`} style={diff > 0 ? { color: '#DDB01D' } : {}}>
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
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
              style={{ backgroundColor: '#0F3714' }}
            >
              {isRecordingPayment && <Spinner className="w-4 h-4 text-white" />}
              Save Payment
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
        <div
          className="rounded-lg border p-4 mb-6"
          style={{
            background: isOverpaid ? 'rgba(221,176,29,0.08)' : isUnderpaid ? 'rgba(15,55,20,0.05)' : 'rgba(151,181,69,0.1)',
            borderColor: isOverpaid ? 'rgba(221,176,29,0.35)' : isUnderpaid ? 'rgba(15,55,20,0.2)' : 'rgba(151,181,69,0.35)',
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold" style={{ color: '#0F3714' }}>
                {isOverpaid ? 'Payment received (overpaid)' : isUnderpaid ? 'Partial payment received' : 'Payment confirmed'}
              </p>
              <p className="text-sm text-gray-600 mt-0.5">
                {fmt(invoice.amount_paid)} via {invoice.payment_method === 'bank_transfer' ? 'Bank Transfer' : 'Cash'}
                {invoice.paid_at && ` · ${formatDate(invoice.paid_at)}`}
              </p>
              {isOverpaid && (
                <p className="text-xs mt-1" style={{ color: '#DDB01D' }}>Customer overpaid by {fmt(variance)}</p>
              )}
              {isUnderpaid && (
                <p className="text-xs font-medium mt-1" style={{ color: '#0F3714' }}>Outstanding balance: {fmt(Math.abs(variance))}</p>
              )}
              {invoice.payment_notes && (
                <p className="text-xs text-gray-400 mt-1">{invoice.payment_notes}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invoice info */}
      <div className="bg-white rounded-lg border border-gray-100 p-5 mb-5">
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
            <p className="text-xs text-gray-500 mt-0.5 capitalize">{invoice.job.type}</p>
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

      {/* Loyalty panel — maintenance jobs with loyalty enabled (null hours_earned means skip_loyalty) */}
      {invoice.loyalty_hours_earned !== null && invoice.job.type === 'maintenance' && (() => {
        const THRESHOLD = 60
        const balance   = invoice.customer_loyalty_balance ?? 0
        // Visits earned from raw balance + any pending credits already auto-fired
        // (checkMaintenanceLoyalty deducts from balance when firing, so we add those back)
        const pendingBanked = invoice.has_pending_loyalty_credit ? 1 : 0
        const visitsEarned  = Math.floor(balance / THRESHOLD) + pendingBanked
        const overflow      = parseFloat((balance % THRESHOLD).toFixed(2))
        const progressPct   = Math.min(100, (overflow / THRESHOLD) * 100)

        return (
          <div className="rounded-lg border p-5 mb-5" style={{ background: '#f3f8e8', borderColor: '#c8e08a' }}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#0F3714' }}>
                  ★ Maintenance Loyalty
                </p>

                {/* Visits earned badge */}
                {visitsEarned >= 1 && !invoice.loyalty_credit_applied && (
                  <p className="text-sm font-semibold mb-1" style={{ color: '#15803d' }}>
                    {visitsEarned === 1 ? '1 complimentary visit earned' : `${visitsEarned} complimentary visits earned`}
                  </p>
                )}

                {/* Points earned this job + progress towards next */}
                <p className="text-sm text-gray-600">
                  {invoice.loyalty_hours_earned != null && (
                    <><span className="font-medium">{invoice.loyalty_hours_earned.toFixed(1)} points</span> earned this job
                    {visitsEarned >= 1 ? ' · ' : ' · balance: '}</>
                  )}
                  {visitsEarned >= 1
                    ? <span><span className="font-semibold">{overflow.toFixed(1)} points</span> towards next visit</span>
                    : <span><span className="font-semibold">{balance.toFixed(1)} / {THRESHOLD} points</span> towards your next free visit</span>
                  }
                </p>

                <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.1)', width: '12rem', maxWidth: '100%' }}>
                  <div className="h-full rounded-full" style={{ width: `${progressPct}%`, background: '#97B545' }} />
                </div>
              </div>

              {invoice.loyalty_credit_applied && invoice.loyalty_credit_amount != null && (
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold" style={{ color: '#15803d' }}>✓ Credit Applied</p>
                  <p className="text-lg font-bold" style={{ color: '#15803d' }}>−{fmt(invoice.loyalty_credit_amount)}</p>
                  {invoice.loyalty_credit_ex_vat != null && (
                    <p className="text-[10px] text-gray-400">€{invoice.loyalty_credit_ex_vat.toFixed(2)} ex. VAT</p>
                  )}
                </div>
              )}
            </div>

            {/* Apply credit section */}
            {invoice.can_apply_loyalty_credit && canManageInvoice && (
              <div className="mt-4 pt-4 border-t" style={{ borderColor: '#c8e08a' }}>
                <p className="text-sm text-gray-700 mb-3">
                  Apply this customer's complimentary visit to this invoice?
                  {invoice.loyalty_credit_value_inc_vat != null && (
                    <> Worth <strong>€{invoice.loyalty_credit_value_inc_vat.toFixed(2)}</strong> inc. VAT
                    {invoice.loyalty_credit_ex_vat != null && (
                      <span className="text-gray-400"> (€{invoice.loyalty_credit_ex_vat.toFixed(2)} ex. VAT)</span>
                    )}
                    {invoice.loyalty_credit_value_inc_vat != null && invoice.total_due < invoice.loyalty_credit_value_inc_vat && (
                      <span className="text-gray-500"> — invoice total is less than the credit value; this invoice will be zeroed out</span>
                    )}
                    .</>
                  )}
                </p>
                <button
                  onClick={applyLoyaltyCredit}
                  disabled={applyingCredit}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg disabled:opacity-50 transition-opacity"
                  style={{ background: '#0F3714', color: 'white' }}
                >
                  {applyingCredit && (
                    <svg className="animate-spin w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  )}
                  Apply Free Visit
                </button>
              </div>
            )}
          </div>
        )
      })()}

      {/* Line items — grouped by visit date */}
      {(() => {
        // Parse date from description: "Labour — dd/mm/yyyy" or "Callout fee — dd/mm/yyyy"
        function extractDate(desc: string): string | null {
          const m = desc.match(/(\d{2}\/\d{2}\/\d{4})$/)
          return m ? m[1] : null
        }
        function parseDate(ddmmyyyy: string): Date {
          const [d, mo, y] = ddmmyyyy.split('/')
          return new Date(Number(y), Number(mo) - 1, Number(d))
        }
        function fmtVisitDate(ddmmyyyy: string): string {
          return parseDate(ddmmyyyy).toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
        }

        // Build ordered groups
        const orderedDates: string[] = []
        const groups = new Map<string, LineItem[]>()
        const materials: LineItem[] = []

        invoice.line_items.forEach(item => {
          const d = extractDate(item.description)
          if (d) {
            if (!groups.has(d)) { groups.set(d, []); orderedDates.push(d) }
            groups.get(d)!.push(item)
          } else {
            materials.push(item)
          }
        })

        orderedDates.sort((a, b) => parseDate(a).getTime() - parseDate(b).getTime())

        // Strip the date from descriptions for display (we show it in the group header)
        function cleanDesc(desc: string): string {
          return desc.replace(/\s+—\s+\d{2}\/\d{2}\/\d{4}$/, '').trim()
        }

        function typeBadge(type: string) {
          const label = type === 'labour' ? 'Labour' : type === 'callout' ? 'Callout' : 'Material'
          const mod   = type === 'labour' ? 'badge-standard' : type === 'callout' ? 'badge-scheduled' : 'badge-high'
          return <span className={`badge ${mod}`}>{label}</span>
        }

        return (
          <div className="bg-white rounded-lg border border-gray-100 overflow-hidden mb-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium">Description</th>
                  <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Hrs / Qty</th>
                  <th className="text-right px-4 py-3 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {orderedDates.map((date, visitIdx) => {
                  const items = groups.get(date)!
                  const labourItems = items.filter(i => i.type === 'labour')
                  const totalHours = labourItems.reduce((s, i) => s + i.quantity, 0)
                  const peopleCount = labourItems.length

                  return (
                    <>
                      {/* Visit date header row */}
                      <tr key={`h-${date}`} className="border-t border-gray-100">
                        <td colSpan={3} className="px-4 py-2 bg-[#f5f8f0]">
                          <span className="text-xs font-semibold text-[#0F3714]">
                            Visit {visitIdx + 1} — {fmtVisitDate(date)}
                          </span>
                          {peopleCount > 0 && (
                            <span className="ml-2 text-xs text-gray-400">
                              {peopleCount === 1 ? '1 person' : `${peopleCount} people`}
                              {totalHours > 0 && ` · ${totalHours.toFixed(2)}h total`}
                            </span>
                          )}
                        </td>
                      </tr>
                      {/* Items in this visit */}
                      {items.map(item => (
                        <tr key={item.id} className="border-t border-gray-50">
                          <td className="px-4 py-2.5 pl-6">
                            <div className="flex items-center gap-2">
                              {typeBadge(item.type)}
                              <span className="text-gray-700">{cleanDesc(item.description)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-400 hidden md:table-cell text-xs">
                            {item.type === 'labour' ? `${item.quantity.toFixed(2)}h` : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-gray-900">{fmt(item.amount)}</td>
                        </tr>
                      ))}
                    </>
                  )
                })}
                {/* Materials with no date (not tied to a specific visit) */}
                {materials.length > 0 && (
                  <>
                    <tr className="border-t border-gray-100">
                      <td colSpan={3} className="px-4 py-2" style={{ background: 'rgba(221,176,29,0.08)' }}>
                        <span className="text-xs font-semibold" style={{ color: '#0F3714' }}>Materials</span>
                      </td>
                    </tr>
                    {materials.map(item => (
                      <tr key={item.id} className="border-t border-gray-50">
                        <td className="px-4 py-2.5 pl-6">
                          <div className="flex items-center gap-2">
                            {typeBadge(item.type)}
                            <span className="text-gray-700">{item.description}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-400 hidden md:table-cell text-xs">
                          {Number.isInteger(item.quantity) ? item.quantity : item.quantity.toFixed(2)}{item.unit ? ` ${item.unit}` : ''}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-gray-900">{fmt(item.amount)}</td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>

            {/* Totals block */}
            <div className="border-t border-gray-100 px-4 py-4 space-y-1.5">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>{fmt(invoice.subtotal)}</span>
              </div>
              {invoice.discount_amount > 0 && (
                <div className="flex justify-between text-sm text-danger">
                  <span>Discount ({invoice.discount_pct}%)</span>
                  <span>−{fmt(invoice.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-gray-600">
                <span>VAT ({invoice.vat_rate}%)</span>
                <span>{fmt(invoice.vat_amount)}</span>
              </div>
              {invoice.loyalty_credit_applied && invoice.loyalty_credit_amount != null && (
                <div className="flex justify-between text-sm font-medium" style={{ color: '#15803d' }}>
                  <span>
                    ★ Loyalty Reward
                    {invoice.loyalty_credit_ex_vat != null && (
                      <span className="ml-1 font-normal text-gray-400 text-xs">(€{invoice.loyalty_credit_ex_vat.toFixed(2)} ex. VAT)</span>
                    )}
                  </span>
                  <span>−{fmt(invoice.loyalty_credit_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold text-[#0F3714] border-t border-gray-100 pt-2 mt-1">
                <span>Total Due</span>
                <span className="text-base" style={{ color: '#97B545' }}>{fmt(invoice.total_due)}</span>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Danger zone */}
      {canManageInvoice && (
        <div className="border-t border-gray-200 pt-6">
          <button onClick={() => setShowDeleteDialog(true)} className="text-sm text-danger">
            Delete invoice
          </button>
        </div>
      )}

    </div>
  )
}
