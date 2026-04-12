import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/api'
import Spinner from '../../components/Spinner'

interface FormState {
  name: string
  phone: string
  email: string
  source: string
  status: string
  notes: string
}

interface Lead {
  id: number
  name: string
  phone: string | null
  email: string | null
  source: string
  status: string
  notes: string | null
  converted_customer_id: number | null
}

const BLANK: FormState = {
  name:   '',
  phone:  '',
  email:  '',
  source: 'other',
  status: 'new',
  notes:  '',
}

const SOURCE_OPTIONS = [
  { value: 'word_of_mouth', label: 'Word of Mouth' },
  { value: 'google',        label: 'Google' },
  { value: 'instagram',     label: 'Instagram' },
  { value: 'referral',      label: 'Referral' },
  { value: 'other',         label: 'Other' },
]

const STATUS_OPTIONS = [
  { value: 'new',       label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'quoted',    label: 'Quoted' },
  { value: 'won',       label: 'Won' },
  { value: 'lost',      label: 'Lost' },
]

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
          name:   l.name ?? '',
          phone:  l.phone ?? '',
          email:  l.email ?? '',
          source: l.source ?? 'other',
          status: l.status ?? 'new',
          notes:  l.notes ?? '',
        })
      })
      .catch(() => navigate('/leads'))
      .finally(() => setIsLoading(false))
  }, [id, isEdit])

  function set(field: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n })
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setIsSaving(true)
    setServerError(null)

    const payload = {
      name:   form.name.trim(),
      phone:  form.phone.trim() || null,
      email:  form.email.trim() || null,
      source: form.source,
      status: form.status,
      notes:  form.notes.trim() || null,
    }

    try {
      if (isEdit) {
        await api.patch(`/leads/${id}`, payload)
        navigate('/leads')
      } else {
        await api.post('/leads', payload)
        navigate('/leads')
      }
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
    <div className="p-4 md:p-6 max-w-2xl mx-auto">

      <div className="flex items-center gap-3 mb-6">
        <Link to="/leads" className="text-sm text-gray-500 hover:text-gray-700">
          ← Leads
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">
          {isEdit ? 'Edit Lead' : 'New Lead'}
        </h1>
      </div>

      {alreadyConverted && (
        <div className="mb-5 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700 flex items-center justify-between">
          <span>This lead has been converted to a customer.</span>
          <Link
            to={`/customers/${lead.converted_customer_id}`}
            className="font-medium underline hover:no-underline"
          >
            View customer →
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Full name"
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545] ${errors.name ? 'border-red-400' : 'border-gray-300'}`}
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
        </div>

        {/* Source + Status */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Source</label>
            <select
              value={form.source}
              onChange={e => set('source', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545]"
            >
              {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Status</label>
            <select
              value={form.status}
              onChange={e => set('status', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545]"
            >
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* Phone + Email */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              placeholder="e.g. 087 123 4567"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="email@example.com"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545] ${errors.email ? 'border-red-400' : 'border-gray-300'}`}
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={4}
            placeholder="What did they enquire about?"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545]"
          />
        </div>

        {serverError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {serverError}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: '#97B545' }}
          >
            {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Create lead'}
          </button>
          <Link to="/leads" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            Cancel
          </Link>
        </div>
      </form>

      {/* Convert + Delete — edit mode only, not yet converted */}
      {isEdit && !alreadyConverted && (
        <div className="flex items-center gap-6 pt-6 mt-2 border-t border-gray-100">
          <button
            onClick={handleConvert}
            disabled={isConverting}
            className="text-sm font-medium text-[#97B545] hover:text-[#85a03d] transition-colors disabled:opacity-60 cursor-pointer"
          >
            {isConverting ? 'Converting…' : '→ Convert to customer'}
          </button>
          <button
            onClick={handleDelete}
            className="text-sm text-red-400 hover:text-red-600 transition-colors cursor-pointer"
          >
            Delete lead
          </button>
        </div>
      )}
    </div>
  )
}
