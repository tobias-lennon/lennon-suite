import { useEffect, useState } from 'react'
import api from '../lib/api'
import Spinner from '../components/Spinner'

interface CompanySettings {
  company_name: string
  company_email: string
  company_phone: string
  vat_number: string
  address_line_1: string
  address_line_2: string
  city: string
  county: string
  eircode: string
  vat_rate: number
  invoice_due_days: number
  invoice_prefix: string
  loyalty_threshold_hours: number
  target_billable_days: number
}

const BLANK: CompanySettings = {
  company_name:            '',
  company_email:           '',
  company_phone:           '',
  vat_number:              '',
  address_line_1:          '',
  address_line_2:          '',
  city:                    '',
  county:                  '',
  eircode:                 '',
  vat_rate:                13.5,
  invoice_due_days:        30,
  invoice_prefix:          'LL',
  loyalty_threshold_hours: 60,
  target_billable_days:    160,
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(15,55,20,0.45)' }}>
      {children}
    </label>
  )
}

export default function Settings() {
  const [form, setForm] = useState<CompanySettings>(BLANK)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get('/settings')
      .then(r => setForm({ ...BLANK, ...r.data }))
      .finally(() => setIsLoading(false))
  }, [])

  function set(field: keyof CompanySettings, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    try {
      const { data } = await api.patch('/settings', form)
      setForm({ ...BLANK, ...data })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Something went wrong.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return (
    <div className="flex justify-center py-12"><Spinner /></div>
  )

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-brand-dark mb-8">Settings</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* Company details */}
        <div className="card p-6 flex flex-col gap-4">
          <h2 className="section-label">Company Details</h2>

          <div>
            <FieldLabel>Company Name</FieldLabel>
            <input
              type="text"
              value={form.company_name}
              onChange={e => set('company_name', e.target.value)}
              className="field-input"
              placeholder="Lennon Landscaping"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Phone</FieldLabel>
              <input
                type="tel"
                value={form.company_phone}
                onChange={e => set('company_phone', e.target.value)}
                className="field-input"
                placeholder="e.g. 029 12345"
              />
            </div>
            <div>
              <FieldLabel>Email</FieldLabel>
              <input
                type="email"
                value={form.company_email}
                onChange={e => set('company_email', e.target.value)}
                className="field-input"
                placeholder="info@lennonlandscaping.ie"
              />
            </div>
          </div>

          <div>
            <FieldLabel>VAT Number</FieldLabel>
            <input
              type="text"
              value={form.vat_number}
              onChange={e => set('vat_number', e.target.value)}
              className="field-input"
              placeholder="IE1234567X"
            />
          </div>
        </div>

        {/* Company address */}
        <div className="card p-6 flex flex-col gap-4">
          <h2 className="section-label">Company Address</h2>

          <div>
            <FieldLabel>Address Line 1</FieldLabel>
            <input
              type="text"
              value={form.address_line_1}
              onChange={e => set('address_line_1', e.target.value)}
              className="field-input"
            />
          </div>
          <div>
            <FieldLabel>Address Line 2</FieldLabel>
            <input
              type="text"
              value={form.address_line_2}
              onChange={e => set('address_line_2', e.target.value)}
              className="field-input"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <FieldLabel>City / Town</FieldLabel>
              <input
                type="text"
                value={form.city}
                onChange={e => set('city', e.target.value)}
                className="field-input"
                placeholder="Millstreet"
              />
            </div>
            <div>
              <FieldLabel>County</FieldLabel>
              <input
                type="text"
                value={form.county}
                onChange={e => set('county', e.target.value)}
                className="field-input"
                placeholder="Cork"
              />
            </div>
            <div>
              <FieldLabel>Eircode</FieldLabel>
              <input
                type="text"
                value={form.eircode}
                onChange={e => set('eircode', e.target.value)}
                className="field-input"
                placeholder="P51 AB12"
              />
            </div>
          </div>
        </div>

        {/* Invoice settings */}
        <div className="card p-6 flex flex-col gap-4">
          <h2 className="section-label">Invoice Settings</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <FieldLabel>VAT Rate (%)</FieldLabel>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={form.vat_rate}
                onChange={e => set('vat_rate', parseFloat(e.target.value) || 0)}
                className="field-input"
              />
            </div>
            <div>
              <FieldLabel>Default Due Days</FieldLabel>
              <input
                type="number"
                min="1"
                max="365"
                value={form.invoice_due_days}
                onChange={e => set('invoice_due_days', parseInt(e.target.value) || 30)}
                className="field-input"
              />
            </div>
            <div>
              <FieldLabel>Invoice Prefix</FieldLabel>
              <input
                type="text"
                value={form.invoice_prefix}
                onChange={e => set('invoice_prefix', e.target.value.toUpperCase())}
                className="field-input"
                placeholder="LL"
                maxLength={10}
              />
            </div>
          </div>
        </div>

        {/* Business targets */}
        <div className="card p-6 flex flex-col gap-4">
          <h2 className="section-label">Business Targets</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Loyalty Threshold (hours)</FieldLabel>
              <input
                type="number"
                min="1"
                value={form.loyalty_threshold_hours}
                onChange={e => set('loyalty_threshold_hours', parseInt(e.target.value) || 60)}
                className="field-input"
              />
              <p className="text-xs mt-1" style={{ color: 'rgba(15,55,20,0.4)' }}>
                Maintenance hours before a loyalty credit is awarded
              </p>
            </div>
            <div>
              <FieldLabel>Target Billable Days / Year</FieldLabel>
              <input
                type="number"
                min="1"
                max="366"
                value={form.target_billable_days}
                onChange={e => set('target_billable_days', parseInt(e.target.value) || 160)}
                className="field-input"
              />
              <p className="text-xs mt-1" style={{ color: 'rgba(15,55,20,0.4)' }}>
                Used for overhead allocation and P&L reporting
              </p>
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex items-center gap-4 justify-end">
          {saved && (
            <p className="text-sm font-semibold" style={{ color: '#97B545' }}>
              ✓ Settings saved
            </p>
          )}
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-lg disabled:opacity-60 transition-all hover:brightness-95 cursor-pointer"
            style={{ background: '#97B545', color: '#0F3714' }}
          >
            {isSaving && <Spinner className="w-4 h-4 text-[#0F3714]" />}
            Save Settings
          </button>
        </div>

      </form>
    </div>
  )
}
