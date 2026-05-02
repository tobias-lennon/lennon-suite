import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/api'
import Spinner from '../../components/Spinner'

interface FormState {
  type: string
  name: string
  company_name: string
  specialty: string
  phone: string
  email: string
  day_rate: string
  notes: string
  is_active: boolean
}

const BLANK: FormState = {
  type:         'supplier_company',
  name:         '',
  company_name: '',
  specialty:    '',
  phone:        '',
  email:        '',
  day_rate:     '',
  notes:        '',
  is_active:    true,
}

const TYPE_OPTIONS = [
  { value: 'supplier_company',    label: 'Supplier — Company' },
  { value: 'supplier_individual', label: 'Supplier — Individual' },
  { value: 'tradesman',           label: 'Tradesman / Subcontractor' },
  { value: 'other',               label: 'Other' },
]

const SPECIALTY_PLACEHOLDER: Record<string, string> = {
  supplier_company:    'e.g. Timber & Sheet Materials',
  supplier_individual: 'e.g. Aggregate, Sand',
  tradesman:           'e.g. Electrician',
  other:               'e.g. Tool Hire',
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(15,55,20,0.45)' }}>
      {children}
    </label>
  )
}

export default function ContactForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [form, setForm] = useState<FormState>(BLANK)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(isEdit)
  const [isSaving, setIsSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!isEdit) return
    api.get(`/contacts/${id}`)
      .then(r => {
        const c = r.data
        setForm({
          type:         c.type ?? 'supplier_company',
          name:         c.name ?? '',
          company_name: c.company_name ?? '',
          specialty:    c.specialty ?? '',
          phone:        c.phone ?? '',
          email:        c.email ?? '',
          day_rate:     c.day_rate != null ? String(c.day_rate) : '',
          notes:        c.notes ?? '',
          is_active:    c.is_active ?? true,
        })
      })
      .catch(() => navigate('/contacts'))
      .finally(() => setIsLoading(false))
  }, [id, isEdit])

  function set(field: keyof FormState, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => { const n = { ...prev }; delete n[field as string]; return n })
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email'
    if (form.day_rate && isNaN(parseFloat(form.day_rate))) errs.day_rate = 'Must be a number'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setIsSaving(true)
    setServerError(null)

    const payload = {
      type:         form.type,
      name:         form.name.trim(),
      company_name: form.company_name.trim() || null,
      specialty:    form.specialty.trim() || null,
      phone:        form.phone.trim() || null,
      email:        form.email.trim() || null,
      day_rate:     form.day_rate ? parseFloat(form.day_rate) : null,
      notes:        form.notes.trim() || null,
      is_active:    form.is_active,
    }

    try {
      if (isEdit) {
        await api.patch(`/contacts/${id}`, payload)
      } else {
        await api.post('/contacts', payload)
      }
      navigate('/contacts')
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { status?: number; data?: { errors?: Record<string, string[]> } } }
        if (axiosErr.response?.status === 422) {
          const serverErrs: Record<string, string> = {}
          for (const [key, msgs] of Object.entries(axiosErr.response.data?.errors ?? {})) {
            serverErrs[key] = msgs[0]
          }
          setErrors(serverErrs)
        } else {
          setServerError('Something went wrong. Please try again.')
        }
      }
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete ${form.name}? This cannot be undone.`)) return
    await api.delete(`/contacts/${id}`)
    navigate('/contacts')
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">

      <Link
        to="/contacts"
        className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-6"
      >
        ← Contacts
      </Link>

      <h1 className="text-2xl font-bold text-brand-dark mb-8">
        {isEdit ? 'Edit Contact' : 'New Contact'}
      </h1>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">

        {/* Type */}
        <div className="card p-6 flex flex-col gap-4">
          <h2 className="section-label">Contact Type</h2>

          <div>
            <FieldLabel>Type <span className="text-danger">*</span></FieldLabel>
            <select
              value={form.type}
              onChange={e => set('type', e.target.value)}
              className="field-input"
            >
              {TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Details */}
        <div className="card p-6 flex flex-col gap-4">
          <h2 className="section-label">Details</h2>

          <div>
            <FieldLabel>Name <span className="text-danger">*</span></FieldLabel>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder={form.type === 'supplier_company' ? 'Company name' : 'Full name'}
              className={`field-input${errors.name ? ' field-error' : ''}`}
            />
            {errors.name && <p className="text-xs mt-1 text-danger">{errors.name}</p>}
          </div>

          {form.type !== 'supplier_company' && (
            <div>
              <FieldLabel>Company / Employer</FieldLabel>
              <input
                type="text"
                value={form.company_name}
                onChange={e => set('company_name', e.target.value)}
                placeholder="Company they work for (if applicable)"
                className="field-input"
              />
            </div>
          )}

          <div>
            <FieldLabel>
              {form.type === 'tradesman' ? 'Trade' : 'What They Supply'}
            </FieldLabel>
            <input
              type="text"
              value={form.specialty}
              onChange={e => set('specialty', e.target.value)}
              placeholder={SPECIALTY_PLACEHOLDER[form.type]}
              className="field-input"
            />
          </div>
        </div>

        {/* Contact info */}
        <div className="card p-6 flex flex-col gap-4">
          <h2 className="section-label">Contact Info</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Phone</FieldLabel>
              <input
                type="tel"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="e.g. 087 123 4567"
                className="field-input"
              />
            </div>
            <div>
              <FieldLabel>Email</FieldLabel>
              <input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="email@example.com"
                className={`field-input${errors.email ? ' field-error' : ''}`}
              />
              {errors.email && <p className="text-xs mt-1 text-danger">{errors.email}</p>}
            </div>
          </div>

          {form.type === 'tradesman' && (
            <div>
              <FieldLabel>Day Rate (€)</FieldLabel>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.day_rate}
                onChange={e => set('day_rate', e.target.value)}
                placeholder="e.g. 250.00"
                className={`field-input${errors.day_rate ? ' field-error' : ''}`}
              />
              {errors.day_rate && <p className="text-xs mt-1 text-danger">{errors.day_rate}</p>}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="card p-6 flex flex-col gap-4">
          <h2 className="section-label">Notes</h2>

          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={4}
            placeholder="Anything useful to know about this contact…"
            className="field-input"
          />

          {/* Active toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-semibold text-brand-dark">Active</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(15,55,20,0.45)' }}>
                Inactive contacts are hidden by default
              </p>
            </div>
            <button
              type="button"
              onClick={() => set('is_active', !form.is_active)}
              className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
              style={{ backgroundColor: form.is_active ? '#97B545' : 'rgba(15,55,20,0.15)' }}
            >
              <span
                className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200"
                style={{ transform: form.is_active ? 'translateX(20px)' : 'translateX(0)' }}
              />
            </button>
          </div>
        </div>

        {serverError && (
          <p className="text-sm notice notice-error">{serverError}</p>
        )}

        <div className="flex gap-3 justify-end">
          <Link
            to="/contacts"
            className="px-5 py-2.5 text-sm font-semibold rounded-lg border border-black/8 hover:bg-white/70 transition-colors text-brand-dark"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-lg disabled:opacity-60 transition-all hover:brightness-95 cursor-pointer"
            style={{ background: '#97B545', color: '#0F3714' }}
          >
            {isSaving && <Spinner className="w-4 h-4 text-[#0F3714]" />}
            {isEdit ? 'Save Changes' : 'Create Contact'}
          </button>
        </div>

      </form>

      {isEdit && (
        <div className="pt-6 mt-2 border-t border-black/5">
          <button
            onClick={handleDelete}
            className="text-sm text-danger transition-colors cursor-pointer"
          >
            Delete contact
          </button>
        </div>
      )}
    </div>
  )
}
