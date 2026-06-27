import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/api'
import { toTitleCase } from '../../lib/formatters'
import Spinner from '../../components/Spinner'

interface CustomerOption {
  id: number
  name: string
}

interface FormState {
  customer_id: string
  title: string
  description: string
  type: string
  status: string
  weather_req: string
  estimated_hours: string

  scheduled_date: string
  due_by: string
  notes: string
  callout_fee: string
}

function cleanText(str: string): string {
  const trimmed = str.trim().replace(/\s+/g, ' ')
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

const BLANK: FormState = {
  customer_id: '',
  title: '',
  description: '',
  type: 'standard',
  status: 'backlog',
  weather_req: 'any',
  estimated_hours: '',
  scheduled_date: '',
  due_by: '',
  notes: '',
  callout_fee: '',
}

export default function JobForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [form, setForm] = useState<FormState>(BLANK)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(isEdit)
  const [isSaving, setIsSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  // Customer search
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([])
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [selectedCustomerName, setSelectedCustomerName] = useState('')
  const [customerSearching, setCustomerSearching] = useState(false)
  const customerSearchRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const titleRef = useRef<HTMLInputElement>(null)

  // New customer modal
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false)
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', type: 'residential', phone: '', email: '', eircode: '' })
  const [newCustomerErrors, setNewCustomerErrors] = useState<Record<string, string>>({})
  const [newCustomerServerError, setNewCustomerServerError] = useState<string | null>(null)
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false)

  useEffect(() => {
    if (!showNewCustomerModal) {
      setNewCustomerServerError(null)
      return
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowNewCustomerModal(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [showNewCustomerModal])

  async function handleCreateCustomer(e: React.FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!newCustomerForm.name.trim()) errs.name = 'Name is required'
    setNewCustomerErrors(errs)
    if (Object.keys(errs).length > 0) return

    setIsCreatingCustomer(true)
    setNewCustomerServerError(null)
    try {
      const res = await api.post('/customers', {
        name:  newCustomerForm.name.trim(),
        type:  newCustomerForm.type,
        phone: newCustomerForm.phone.trim() || null,
        email: newCustomerForm.email.trim() || null,
        ...(newCustomerForm.eircode.trim() ? { address: { postcode: newCustomerForm.eircode.trim() } } : {}),
      })
      selectCustomer({ id: res.data.id, name: res.data.name })
      setShowNewCustomerModal(false)
      setNewCustomerForm({ name: '', type: 'residential', phone: '', email: '', eircode: '' })
    } catch {
      setNewCustomerServerError('Failed to create customer. Please try again.')
    } finally {
      setIsCreatingCustomer(false)
    }
  }

  const isInternal = form.type === 'internal'

  // Customer search — debounced
  useEffect(() => {
    if (isInternal) return
    if (customerSearch.length < 1) {
      setCustomerResults([])
      setShowCustomerDropdown(false)
      setCustomerSearching(false)
      return
    }
    setCustomerSearching(true)
    const timer = setTimeout(() => {
      api.get('/customers', { params: { per_page: 20, search: customerSearch } })
        .then(res => {
          setCustomerResults(res.data.data ?? [])
          setShowCustomerDropdown(true)
        })
        .finally(() => setCustomerSearching(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [customerSearch, isInternal])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        customerSearchRef.current && !customerSearchRef.current.contains(e.target as Node)
      ) {
        setShowCustomerDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Load job for edit
  useEffect(() => {
    if (!isEdit) return
    api.get(`/jobs/${id}`)
      .then(res => {
        const j = res.data
        setForm({
          customer_id: j.customer_id ? String(j.customer_id) : '',
          title: j.title ?? '',
          description: j.description ?? '',
          type: j.type ?? 'standard',
          status: j.status ?? 'backlog',
          weather_req: j.weather_req ?? 'any',
          estimated_hours: j.estimated_hours != null ? String(j.estimated_hours) : '',
          scheduled_date: j.scheduled_date ? j.scheduled_date.substring(0, 10) : '',
          due_by: j.due_by ? j.due_by.substring(0, 10) : '',
          notes: j.notes ?? '',
          callout_fee: j.callout_fee != null ? String(j.callout_fee) : '',
        })
        if (j.customer) setSelectedCustomerName(j.customer.name)
      })
      .catch(() => navigate('/jobs'))
      .finally(() => setIsLoading(false))
  }, [id, isEdit])

  function set(field: keyof FormState, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n })
  }

  function handleTypeChange(value: string) {
    setForm(prev => ({
      ...prev,
      type: value,
      customer_id: value === 'internal' ? '' : prev.customer_id,
      weather_req: value === 'internal' ? 'any' : prev.weather_req,
    }))
    if (value === 'internal') {
      setSelectedCustomerName('')
      setCustomerSearch('')
    }
    setErrors(prev => { const n = { ...prev }; delete n.type; delete n.customer_id; return n })
  }

  function selectCustomer(customer: CustomerOption) {
    set('customer_id', String(customer.id))
    setSelectedCustomerName(customer.name)
    setCustomerSearch('')
    setShowCustomerDropdown(false)
  }

  function clearCustomer() {
    set('customer_id', '')
    setSelectedCustomerName('')
    setCustomerSearch('')
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!form.customer_id && !isInternal) errs.customer_id = 'Customer is required'
    if (!form.title.trim()) errs.title = 'Title is required'
    if (!form.type) errs.type = 'Type is required'
    if (form.status === 'scheduled' && !form.scheduled_date) errs.scheduled_date = 'A date is required when scheduling a job'
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      if (errs.customer_id) customerSearchRef.current?.focus()
      else if (errs.title) titleRef.current?.focus()
      return false
    }
    return true
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setIsSaving(true)
    setServerError(null)

    const payload = {
      ...form,
      title: toTitleCase(form.title.trim().replace(/\s+/g, ' ')) ?? form.title.trim(),
      description: form.description ? cleanText(form.description) : null,
      notes: form.notes ? cleanText(form.notes) : null,
      customer_id: form.customer_id ? Number(form.customer_id) : null,
      estimated_hours: form.estimated_hours.trim() !== '' ? Number(form.estimated_hours) : null,
      scheduled_date: form.scheduled_date || null,
      due_by: form.due_by || null,
      callout_fee: form.callout_fee.trim() !== '' ? Number(form.callout_fee) : null,
    }

    try {
      if (isEdit) {
        await api.patch(`/jobs/${id}`, payload)
        navigate(`/jobs/${id}`)
      } else {
        const res = await api.post('/jobs', payload)
        navigate(`/jobs/${res.data.id}`)
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

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-dark">{isEdit ? 'Edit Job' : 'New Job'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Type + Status — type first so conditional fields react immediately */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Type</label>
            <select
              value={form.type}
              onChange={e => handleTypeChange(e.target.value)}
              className="field-input"
            >
              <option value="standard">Standard</option>
              <option value="maintenance">Maintenance</option>
              <option value="site_visit">Site Visit</option>
              <option value="internal">Internal / Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Status</label>
            <select
              value={form.status}
              onChange={e => set('status', e.target.value)}
              className="field-input"
            >
              <option value="backlog">Backlog</option>
              <option value="scheduled">Scheduled</option>
              {isEdit && <option value="in_progress">In Progress</option>}
              {isEdit && <option value="complete">Complete</option>}
            </select>
          </div>
        </div>

        {/* Customer search — hidden for internal */}
        {!isInternal && (
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                Customer <span className="text-danger">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowNewCustomerModal(true)}
                className="text-xs text-[#97B545] hover:text-[#85a03d] font-medium transition-colors"
              >
                + New customer
              </button>
            </div>

            {/* Selected customer pill */}
            {selectedCustomerName ? (
              <div className="flex items-center gap-2 field-input" style={{ background: 'rgba(255,255,255,0.5)' }}>
                <span className="flex-1 text-gray-900">{selectedCustomerName}</span>
                <button
                  type="button"
                  onClick={clearCustomer}
                  className="text-gray-400 hover:text-gray-600 text-xs"
                >
                  ✕ Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  ref={customerSearchRef}
                  type="text"
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  onFocus={() => customerSearch.length >= 1 && setShowCustomerDropdown(true)}
                  placeholder="Search by name…"
                  className={`field-input pr-8${errors.customer_id ? ' field-error' : ''}`}
                />
                {customerSearching && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <svg className="animate-spin w-4 h-4 text-[#97B545]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  </div>
                )}
              </div>
            )}

            {/* Dropdown results */}
            {showCustomerDropdown && customerResults.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
              >
                {customerResults.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectCustomer(c)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-gray-900"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            {errors.customer_id && <p className="text-xs mt-1 text-danger">{errors.customer_id}</p>}
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Title <span className="text-danger">*</span>
          </label>
          <input
            ref={titleRef}
            type="text"
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="e.g. Hedge trim, Garden clearup"
            className={`field-input${errors.title ? ' field-error' : ''}`}
          />
          {errors.title && <p className="text-xs mt-1 text-danger">{errors.title}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={e => set('description', e.target.value)}
            rows={3}
            className="field-input"
          />
        </div>

        {/* Duration */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Est. Hours</label>
          <input
            type="number"
            min="0"
            max="999"
            step="0.5"
            placeholder="e.g. 14"
            value={form.estimated_hours}
            onChange={e => set('estimated_hours', e.target.value)}
            className="field-input"
          />
        </div>

        {/* Scheduled date — only visible when status is scheduled */}
        {form.status === 'scheduled' && (
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Scheduled Date</label>
            <input
              type="date"
              value={form.scheduled_date}
              onChange={e => set('scheduled_date', e.target.value)}
              className={`field-input${errors.scheduled_date ? ' field-error' : ''}`}
            />
            {errors.scheduled_date && <p className="text-xs mt-1 text-danger">{errors.scheduled_date}</p>}
          </div>
        )}

        {/* Weather (hidden for internal) + Due By */}
        <div className="grid grid-cols-2 gap-4">
          {!isInternal && (
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Weather</label>
              <select
                value={form.weather_req}
                onChange={e => set('weather_req', e.target.value)}
                className="field-input"
              >
                <option value="any">Any</option>
                <option value="dry_preferred">Dry preferred</option>
                <option value="dry_only">Dry only</option>
              </select>
            </div>
          )}
          {form.status !== 'complete' && (
            <div className={isInternal ? 'col-span-2' : ''}>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Due By</label>
              <input
                type="date"
                value={form.due_by}
                onChange={e => set('due_by', e.target.value)}
                className="field-input"
              />
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={3}
            className="field-input"
          />
        </div>

        {/* Callout fee default — hidden for internal jobs */}
        {!isInternal && (
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Callout fee default
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">€</span>
              <input
                type="number"
                step="any"
                min="0"
                value={form.callout_fee}
                onChange={e => set('callout_fee', e.target.value)}
                onBlur={e => { const v = e.target.valueAsNumber; if (!isNaN(v)) set('callout_fee', v.toFixed(2)) }}
                placeholder="0.00"
                className="w-36 field-input"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Pre-fills the callout fee on each new work log for this job. Leave blank for none.</p>
          </div>
        )}

        {serverError && (
          <p className="text-sm notice notice-error">
            {serverError}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: '#97B545' }}
          >
            {isSaving && <Spinner className="w-4 h-4 text-[#0F3714]" />}
            {isEdit ? 'Save changes' : 'Create job'}
          </button>
          <Link
            to={isEdit ? `/jobs/${id}` : '/jobs'}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Cancel
          </Link>
        </div>
      </form>

      {/* New customer modal */}
      {showNewCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowNewCustomerModal(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">New Customer</h2>
            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={newCustomerForm.name}
                  onChange={e => setNewCustomerForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Full name"
                  autoFocus
                  className={`field-input${newCustomerErrors.name ? ' field-error' : ''}`}
                />
                {newCustomerErrors.name && <p className="text-xs mt-1 text-danger">{newCustomerErrors.name}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Type</label>
                <select
                  value={newCustomerForm.type}
                  onChange={e => setNewCustomerForm(p => ({ ...p, type: e.target.value }))}
                  className="field-input"
                >
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Phone</label>
                <input
                  type="tel"
                  value={newCustomerForm.phone}
                  onChange={e => setNewCustomerForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="e.g. 087 123 4567"
                  className="field-input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Email</label>
                <input
                  type="email"
                  value={newCustomerForm.email}
                  onChange={e => setNewCustomerForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="e.g. name@example.com"
                  className="field-input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Eircode</label>
                <input
                  type="text"
                  value={newCustomerForm.eircode}
                  onChange={e => setNewCustomerForm(p => ({ ...p, eircode: e.target.value }))}
                  placeholder="e.g. P51 AB12"
                  className="field-input"
                />
              </div>
              {newCustomerServerError && (
                <p className="text-xs text-danger">{newCustomerServerError}</p>
              )}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={isCreatingCustomer}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60"
                  style={{ backgroundColor: '#97B545' }}
                >
                  {isCreatingCustomer && <Spinner className="w-3.5 h-3.5 text-white" />}
                  Create & select
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewCustomerModal(false)}
                  className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
