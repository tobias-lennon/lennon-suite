import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/api'
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
  has_power_tools: boolean
  has_waste_disposal: boolean
  weather_req: string
  est_duration: string
  priority: string
  scheduled_date: string
  notes: string
}

function todayString() {
  return new Date().toISOString().substring(0, 10)
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
  has_power_tools: false,
  has_waste_disposal: false,
  weather_req: 'any',
  est_duration: '',
  priority: 'normal',
  scheduled_date: todayString(),
  notes: '',
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
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', type: 'residential', phone: '' })
  const [newCustomerErrors, setNewCustomerErrors] = useState<Record<string, string>>({})
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false)

  useEffect(() => {
    if (!showNewCustomerModal) return
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
    try {
      const res = await api.post('/customers', {
        name:  newCustomerForm.name.trim(),
        type:  newCustomerForm.type,
        phone: newCustomerForm.phone.trim() || null,
      })
      selectCustomer({ id: res.data.id, name: res.data.name })
      setShowNewCustomerModal(false)
      setNewCustomerForm({ name: '', type: 'residential', phone: '' })
    } finally {
      setIsCreatingCustomer(false)
    }
  }

  const isInternal = form.type === 'internal'
  const isMaintenance = form.type === 'maintenance'
  const isSiteVisit = form.type === 'site_visit'
  const showPowerWasteOptions = !isMaintenance && !isInternal && !isSiteVisit

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
    api.get(`/jobs/${id}`).then(res => {
      const j = res.data
      setForm({
        customer_id: j.customer_id ? String(j.customer_id) : '',
        title: j.title ?? '',
        description: j.description ?? '',
        type: j.type ?? 'standard',
        status: j.status ?? 'backlog',
        has_power_tools: j.has_power_tools ?? false,
        has_waste_disposal: j.has_waste_disposal ?? false,
        weather_req: j.weather_req ?? 'any',
        est_duration: j.est_duration ?? '',
        priority: j.priority ?? 'normal',
        scheduled_date: j.scheduled_date ? j.scheduled_date.substring(0, 10) : todayString(),
        notes: j.notes ?? '',
      })
      if (j.customer) setSelectedCustomerName(j.customer.name)
      setIsLoading(false)
    })
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
      has_power_tools: (value === 'maintenance' || value === 'internal' || value === 'site_visit') ? false : prev.has_power_tools,
      has_waste_disposal: (value === 'maintenance' || value === 'internal' || value === 'site_visit') ? false : prev.has_waste_disposal,
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
      title: cleanText(form.title),
      description: form.description ? cleanText(form.description) : null,
      notes: form.notes ? cleanText(form.notes) : null,
      customer_id: form.customer_id ? Number(form.customer_id) : null,
      est_duration: form.est_duration || null,
      scheduled_date: form.scheduled_date || null,
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
      <div className="flex items-center gap-3 mb-6">
        <Link to={isEdit ? `/jobs/${id}` : '/jobs'} className="text-sm text-gray-500 hover:text-gray-700">
          ← Back
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">
          {isEdit ? 'Edit Job' : 'New Job'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Type + Status — type first so conditional fields react immediately */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Type</label>
            <select
              value={form.type}
              onChange={e => handleTypeChange(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545]"
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545]"
            >
              <option value="backlog">Backlog</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="complete">Complete</option>
            </select>
          </div>
        </div>

        {/* Customer search — hidden for internal */}
        {!isInternal && (
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                Customer <span className="text-red-500">*</span>
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
              <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50">
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
                  className={`w-full border rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545] ${errors.customer_id ? 'border-red-400' : 'border-gray-300'}`}
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

            {errors.customer_id && <p className="text-red-500 text-xs mt-1">{errors.customer_id}</p>}
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            ref={titleRef}
            type="text"
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="e.g. Hedge trim, Garden clearup"
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545] ${errors.title ? 'border-red-400' : 'border-gray-300'}`}
          />
          {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
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
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545]"
          />
        </div>

        {/* Power tools + waste — hidden for maintenance, internal, site_visit */}
        {showPowerWasteOptions && (
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.has_power_tools}
                onChange={e => set('has_power_tools', e.target.checked)}
                className="rounded accent-[#97B545]"
              />
              Power tools
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.has_waste_disposal}
                onChange={e => set('has_waste_disposal', e.target.checked)}
                className="rounded accent-[#97B545]"
              />
              Waste disposal
            </label>
          </div>
        )}

        {/* Priority + Duration */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Priority</label>
            <select
              value={form.priority}
              onChange={e => set('priority', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545]"
            >
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Est. Duration</label>
            <select
              value={form.est_duration}
              onChange={e => set('est_duration', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545]"
            >
              <option value="">— Unknown —</option>
              <option value="quick">Quick (&lt;2hrs)</option>
              <option value="half_day">Half day</option>
              <option value="full_day">Full day</option>
              <option value="multi_day">Multi-day</option>
            </select>
          </div>
        </div>

        {/* Weather (hidden for internal) + Scheduled date */}
        <div className="grid grid-cols-2 gap-4">
          {!isInternal && (
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Weather</label>
              <select
                value={form.weather_req}
                onChange={e => set('weather_req', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545]"
              >
                <option value="any">Any</option>
                <option value="dry_preferred">Dry preferred</option>
                <option value="dry_only">Dry only</option>
              </select>
            </div>
          )}
          <div className={isInternal ? 'col-span-2' : ''}>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Scheduled Date</label>
            <input
              type="date"
              value={form.scheduled_date}
              onChange={e => set('scheduled_date', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545]"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={3}
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
            {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Create job'}
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
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">New Customer</h2>
            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newCustomerForm.name}
                  onChange={e => setNewCustomerForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Full name"
                  autoFocus
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545] ${newCustomerErrors.name ? 'border-red-400' : 'border-gray-300'}`}
                />
                {newCustomerErrors.name && <p className="text-red-500 text-xs mt-1">{newCustomerErrors.name}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Type</label>
                <select
                  value={newCustomerForm.type}
                  onChange={e => setNewCustomerForm(p => ({ ...p, type: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545]"
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545]"
                />
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={isCreatingCustomer}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60"
                  style={{ backgroundColor: '#97B545' }}
                >
                  {isCreatingCustomer ? 'Creating…' : 'Create & select'}
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
