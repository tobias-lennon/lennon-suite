import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/api'
import Spinner from '../../components/Spinner'

interface FormState {
  name: string
  phone: string
  email: string
  eircode: string
  source: string
  status: string
  requires_site_visit: boolean
  notes: string
}

interface Lead {
  id: number
  name: string
  phone: string | null
  email: string | null
  eircode: string | null
  source: string
  status: string
  requires_site_visit: boolean
  notes: string | null
  converted_customer_id: number | null
}

const BLANK: FormState = {
  name:                '',
  phone:               '',
  email:               '',
  eircode:             '',
  source:              'other',
  status:              'new',
  requires_site_visit: false,
  notes:               '',
}

const SOURCE_OPTIONS = [
  { value: 'word_of_mouth', label: 'Word of Mouth' },
  { value: 'google',        label: 'Google' },
  { value: 'instagram',     label: 'Instagram' },
  { value: 'referral',      label: 'Referral' },
  { value: 'other',         label: 'Other' },
]

const STATUS_OPTIONS = [
  { value: 'new',          label: 'New' },
  { value: 'contacted',    label: 'Contacted' },
  { value: 'quoted',       label: 'Quoted' },
  { value: 'site_visited', label: 'Site Visited' },
  { value: 'won',          label: 'Won' },
  { value: 'lost',         label: 'Lost' },
]

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(15,55,20,0.45)' }}>
      {children}
    </label>
  )
}

export default function LeadForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [form, setForm] = useState<FormState>(BLANK)
  const [lead, setLead] = useState<Lead | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(isEdit)
  const [isSaving, setIsSaving] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!isEdit) return
    api.get(`/leads/${id}`)
      .then(r => {
        const l: Lead = r.data
        setLead(l)
        setForm({
          name:                l.name ?? '',
          phone:               l.phone ?? '',
          email:               l.email ?? '',
          eircode:             l.eircode ?? '',
          source:              l.source ?? 'other',
          status:              l.status ?? 'new',
          requires_site_visit: !!l.requires_site_visit,
          notes:               l.notes ?? '',
        })
      })
      .catch(() => navigate('/leads'))
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
    if (form.eircode.trim()) {
      const clean = form.eircode.replace(/\s/g, '').toUpperCase()
      if (!/^[A-Z0-9]{7}$/.test(clean)) errs.eircode = 'Enter a valid Eircode (e.g. P51 AB12)'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setIsSaving(true)
    setServerError(null)

    const raw = form.eircode.replace(/\s/g, '').toUpperCase()
    const normalisedEircode = raw.length === 7 ? `${raw.slice(0, 3)} ${raw.slice(3)}` : raw || null

    const payload = {
      name:                form.name.trim(),
      phone:               form.phone.trim() || null,
      email:               form.email.trim() || null,
      eircode:             normalisedEircode,
      source:              form.source,
      status:              form.status,
      requires_site_visit: form.requires_site_visit,
      notes:               form.notes.trim() || null,
    }

    try {
      if (isEdit) {
        await api.patch(`/leads/${id}`, payload)
      } else {
        await api.post('/leads', payload)
      }
      navigate('/leads')
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

  async function handleConvert() {
    if (!confirm(`Convert ${lead?.name} to a customer? A new customer profile will be created.`)) return
    setIsConverting(true)
    try {
      const res = await api.post(`/leads/${id}/convert`)
      navigate(`/customers/${res.data.customer_id}`)
    } catch {
      setServerError('Conversion failed. Please try again.')
      setIsConverting(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete this lead? This cannot be undone.`)) return
    await api.delete(`/leads/${id}`)
    navigate('/leads')
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>
  }

  const alreadyConverted = isEdit && lead?.converted_customer_id

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">

      <Link
        to="/leads"
        className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-6"
      >
        ← Leads
      </Link>

      <h1 className="text-2xl font-bold text-brand-dark mb-8">
        {isEdit ? 'Edit Lead' : 'New Lead'}
      </h1>

      {alreadyConverted && (
        <div className="mb-5 text-sm notice notice-success flex items-center justify-between">
          <span>This lead has been converted to a customer.</span>
          <Link
            to={`/customers/${lead.converted_customer_id}`}
            className="font-medium underline hover:no-underline"
          >
            View customer →
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">

        {/* Contact details */}
        <div className="card p-6 flex flex-col gap-4">
          <h2 className="section-label">Contact Details</h2>

          <div>
            <FieldLabel>Name <span className="text-danger">*</span></FieldLabel>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Full name"
              className={`field-input${errors.name ? ' field-error' : ''}`}
            />
            {errors.name && <p className="text-xs mt-1 text-danger">{errors.name}</p>}
          </div>

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

          <div>
            <FieldLabel>Eircode</FieldLabel>
            <input
              type="text"
              value={form.eircode}
              onChange={e => set('eircode', e.target.value)}
              onBlur={() => {
                const raw = form.eircode.replace(/\s/g, '').toUpperCase()
                if (raw.length === 7) set('eircode', `${raw.slice(0, 3)} ${raw.slice(3)}`)
                else if (raw.length > 0) set('eircode', raw)
              }}
              placeholder="e.g. P51 AB12"
              className={`field-input${errors.eircode ? ' field-error' : ''}`}
            />
            {errors.eircode && <p className="text-xs mt-1 text-danger">{errors.eircode}</p>}
          </div>
        </div>

        {/* Lead info */}
        <div className="card p-6 flex flex-col gap-4">
          <h2 className="section-label">Lead Info</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Source</FieldLabel>
              <select
                value={form.source}
                onChange={e => set('source', e.target.value)}
                className="field-input"
              >
                {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Status</FieldLabel>
              <select
                value={form.status}
                onChange={e => set('status', e.target.value)}
                className="field-input"
              >
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Site visit toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-semibold text-brand-dark">Requires Site Visit</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(15,55,20,0.45)' }}>
                A visit is needed before quoting
              </p>
            </div>
            <button
              type="button"
              onClick={() => set('requires_site_visit', !form.requires_site_visit)}
              className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
              style={{ backgroundColor: form.requires_site_visit ? '#97B545' : 'rgba(15,55,20,0.15)' }}
            >
              <span
                className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200"
                style={{ transform: form.requires_site_visit ? 'translateX(20px)' : 'translateX(0)' }}
              />
            </button>
          </div>
        </div>

        {/* Notes */}
        <div className="card p-6">
          <FieldLabel>Notes</FieldLabel>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={4}
            placeholder="What did they enquire about?"
            className="field-input"
          />
        </div>

        {serverError && (
          <p className="text-sm notice notice-error">{serverError}</p>
        )}

        <div className="flex gap-3 justify-end">
          <Link
            to="/leads"
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
            {isEdit ? 'Save Changes' : 'Create Lead'}
          </button>
        </div>

      </form>

      {/* Convert + Delete — edit mode only, not yet converted */}
      {isEdit && !alreadyConverted && (
        <div className="flex items-center gap-6 pt-6 mt-2 border-t border-black/5">
          <button
            onClick={handleConvert}
            disabled={isConverting}
            className="text-sm font-medium transition-colors disabled:opacity-60 cursor-pointer"
            style={{ color: '#97B545' }}
          >
            {isConverting ? 'Converting…' : '→ Convert to customer'}
          </button>
          <button
            onClick={handleDelete}
            className="text-sm text-danger transition-colors cursor-pointer"
          >
            Delete lead
          </button>
        </div>
      )}
    </div>
  )
}
