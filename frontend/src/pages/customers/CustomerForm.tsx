import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/api'
import Spinner from '../../components/Spinner'

interface FormData {
  name: string
  type: string
  phone: string
  email: string
  notes: string
  rating: string
  address: {
    address_line_1: string
    address_line_2: string
    city: string
    county: string
    postcode: string
  }
}

interface FormErrors {
  name?: string
  email?: string
  phone?: string
  postcode?: string
}

interface AddressSuggestion {
  ecad_id: string
  display_name: string
  address_line_1?: string
  address_line_2?: string
  city?: string
  county?: string
  eircode?: string
}

const IRISH_COUNTIES = [
  'CARLOW', 'CAVAN', 'CLARE', 'CORK', 'DONEGAL',
  'DUBLIN', 'GALWAY', 'KERRY', 'KILDARE', 'KILKENNY',
  'LAOIS', 'LEITRIM', 'LIMERICK', 'LONGFORD', 'LOUTH',
  'MAYO', 'MEATH', 'MONAGHAN', 'OFFALY', 'ROSCOMMON',
  'SLIGO', 'TIPPERARY', 'WATERFORD', 'WESTMEATH',
  'WEXFORD', 'WICKLOW',
  // Northern Ireland
  'ANTRIM', 'ARMAGH', 'DOWN', 'FERMANAGH', 'LONDONDERRY', 'TYRONE',
]

const empty: FormData = {
  name: '', type: 'residential', phone: '', email: '', notes: '', rating: '',
  address: { address_line_1: '', address_line_2: '', city: '', county: '', postcode: '' },
}

function validate(form: FormData): FormErrors {
  const errors: FormErrors = {}

  if (!form.name.trim()) {
    errors.name = 'Name is required'
  } else if (form.name.trim().length < 2) {
    errors.name = 'Must be at least 2 characters'
  }

  if (form.phone.trim()) {
    const digits = form.phone.replace(/\D/g, '')
    if (digits.length < 7 || digits.length > 15) {
      errors.phone = 'Enter a valid phone number'
    }
  }

  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = 'Enter a valid email address'
  }

  if (form.address.postcode.trim()) {
    const clean = form.address.postcode.replace(/\s/g, '').toUpperCase()
    if (!/^[A-Z0-9]{7}$/.test(clean)) {
      errors.postcode = 'Enter a valid Eircode (e.g. A65 F4E2)'
    }
  }

  return errors
}

function hasErrors(errors: FormErrors) {
  return Object.keys(errors).length > 0
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-red-500">{message}</p>
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      {children}
      <FieldError message={error} />
    </div>
  )
}

function inputCls(hasError: boolean) {
  return `w-full px-3 py-2.5 border rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:border-transparent transition ${
    hasError
      ? 'border-red-300 focus:ring-red-300 bg-red-50/30'
      : 'border-gray-200 focus:ring-[#97B545]'
  }`
}

// Field order matches top-to-bottom position in the form
const VALIDATED_FIELDS = ['name', 'phone', 'email', 'postcode'] as const

export default function CustomerForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [form, setForm] = useState<FormData>(empty)
  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(isEdit)
  const [isSaving, setIsSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Eircode autocomplete
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [isLooking, setIsLooking] = useState(false)
  const lookupDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const eircodeWrapperRef = useRef<HTMLDivElement>(null)

  // Refs for scroll-to-first-error
  const nameRef    = useRef<HTMLInputElement>(null)
  const phoneRef   = useRef<HTMLInputElement>(null)
  const emailRef   = useRef<HTMLInputElement>(null)
  const postcodeRef = useRef<HTMLInputElement>(null)

  const fieldRefs: Record<typeof VALIDATED_FIELDS[number], React.RefObject<HTMLInputElement | null>> = {
    name: nameRef, phone: phoneRef, email: emailRef, postcode: postcodeRef,
  }

  useEffect(() => {
    if (!isEdit) return
    api.get(`/customers/${id}`).then(r => {
      const c = r.data
      setForm({
        name: c.name ?? '',
        type: c.type ?? 'residential',
        phone: c.phone ?? '',
        email: c.email ?? '',
        notes: c.notes ?? '',
        rating: c.rating ? String(c.rating) : '',
        address: {
          address_line_1: c.address?.address_line_1 ?? '',
          address_line_2: c.address?.address_line_2 ?? '',
          city: c.address?.city ?? '',
          county: c.address?.county ?? '',
          postcode: c.address?.postcode ?? '',
        },
      })
    }).finally(() => setIsLoading(false))
  }, [id])

  function set(field: keyof Omit<FormData, 'address'>, value: string) {
    const updated = { ...form, [field]: value }
    setForm(updated)
    if (touched.has(field)) setErrors(validate(updated))
  }

  function setAddr(field: keyof FormData['address'], value: string) {
    const updated = { ...form, address: { ...form.address, [field]: value } }
    setForm(updated)
    if (touched.has(field)) setErrors(validate(updated))
    if (field === 'postcode') {
      triggerAutocomplete(value)
    }
  }

  function triggerAutocomplete(query: string) {
    if (lookupDebounce.current) clearTimeout(lookupDebounce.current)
    if (!query.trim() || query.trim().length < 3) {
      setSuggestions([])
      setSuggestionsOpen(false)
      return
    }
    lookupDebounce.current = setTimeout(async () => {
      setIsLooking(true)
      try {
        const res = await api.get('/address/autocomplete', { params: { query: query.trim() } })
        const items: AddressSuggestion[] = res.data.suggestions ?? []
        setSuggestions(items)
        setSuggestionsOpen(items.length > 0)
      } catch {
        setSuggestions([])
        setSuggestionsOpen(false)
      } finally {
        setIsLooking(false)
      }
    }, 300)
  }

  function touch(field: string) {
    setTouched(prev => new Set(prev).add(field))
    setErrors(validate(form))
  }

  // Strip "Co." prefix and uppercase — normalises autoaddress "Co. Waterford" → "WATERFORD"
  function normaliseCounty(raw: string | undefined | null): string {
    if (!raw) return ''
    return raw.replace(/^co\.?\s*/i, '').trim().toUpperCase()
  }

  async function applySuggestion(suggestion: AddressSuggestion) {
    setSuggestionsOpen(false)
    setSuggestions([])

    // If the suggestion has a full address already, apply it directly
    if (suggestion.address_line_1 || suggestion.city) {
      setForm(f => ({
        ...f,
        address: {
          address_line_1: suggestion.address_line_1 ?? f.address.address_line_1,
          address_line_2: suggestion.address_line_2 ?? f.address.address_line_2,
          city: suggestion.city ?? f.address.city,
          county: normaliseCounty(suggestion.county) || f.address.county,
          postcode: suggestion.eircode ?? f.address.postcode,
        },
      }))
      return
    }

    // Otherwise resolve the full address from the ecad_id
    try {
      const res = await api.get('/address/resolve', { params: { ecad_id: suggestion.ecad_id } })
      const a = res.data.address
      if (a) {
        setForm(f => ({
          ...f,
          address: {
            address_line_1: a.address_line_1 ?? f.address.address_line_1,
            address_line_2: a.address_line_2 ?? f.address.address_line_2,
            city: a.city ?? f.address.city,
            county: normaliseCounty(a.county) || f.address.county,
            postcode: a.eircode ?? f.address.postcode,
          },
        }))
      }
    } catch {
      // resolve failed — at minimum show the display name in line 1
      setForm(f => ({
        ...f,
        address: {
          ...f.address,
          address_line_1: suggestion.display_name,
        },
      }))
    }
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (eircodeWrapperRef.current && !eircodeWrapperRef.current.contains(e.target as Node)) {
        setSuggestionsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const validationErrors = validate(form)

    if (hasErrors(validationErrors)) {
      setErrors(validationErrors)
      setTouched(new Set(VALIDATED_FIELDS))

      // Scroll to the first invalid field (top-down order)
      const firstErrorKey = VALIDATED_FIELDS.find(k => validationErrors[k])
      if (firstErrorKey) {
        const el = fieldRefs[firstErrorKey].current
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el?.focus({ preventScroll: true })
      }
      return
    }

    setIsSaving(true)
    setSubmitError(null)

    const payload = {
      name: form.name.trim(),
      type: form.type || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      notes: form.notes.trim() || null,
      rating: form.rating ? parseInt(form.rating) : null,
      address: {
        address_line_1: form.address.address_line_1.trim() || null,
        address_line_2: form.address.address_line_2.trim() || null,
        city: form.address.city.trim() || null,
        county: form.address.county.trim() || null,
        postcode: form.address.postcode.trim() || null,
      },
    }

    try {
      if (isEdit) {
        await api.put(`/customers/${id}`, payload)
        navigate(`/customers/${id}`)
      } else {
        const { data } = await api.post('/customers', payload)
        navigate(`/customers/${data.id}`)
      }
    } catch (err: any) {
      setSubmitError(err.response?.data?.message ?? 'Something went wrong.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return (
    <div className="p-8 flex justify-center">
      <Spinner className="w-6 h-6 text-[#97B545]" />
    </div>
  )

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <Link
        to={isEdit ? `/customers/${id}` : '/customers'}
        className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-6"
      >
        ← {isEdit ? 'Back to customer' : 'Customers'}
      </Link>

      <h1 className="text-2xl font-semibold text-[#0F3714] mb-8">
        {isEdit ? 'Edit Customer' : 'New Customer'}
      </h1>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">

        {/* Core details */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 flex flex-col gap-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Details</h2>

          <Field label="Name *" error={touched.has('name') ? errors.name : undefined}>
            <input
              ref={nameRef}
              value={form.name}
              onChange={e => set('name', e.target.value)}
              onBlur={() => touch('name')}
              className={inputCls(!!errors.name && touched.has('name'))}
              placeholder="Full name"
            />
          </Field>

          <Field label="Type">
            <select value={form.type} onChange={e => set('type', e.target.value)} className={inputCls(false)}>
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
            </select>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Phone" error={touched.has('phone') ? errors.phone : undefined}>
              <input
                ref={phoneRef}
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                onBlur={() => touch('phone')}
                className={inputCls(!!errors.phone && touched.has('phone'))}
                placeholder="+353…"
              />
            </Field>
            <Field label="Email" error={touched.has('email') ? errors.email : undefined}>
              <input
                ref={emailRef}
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                onBlur={() => touch('email')}
                className={inputCls(!!errors.email && touched.has('email'))}
                placeholder="email@…"
              />
            </Field>
          </div>

          <Field label="Rating (1–5)">
            <select value={form.rating} onChange={e => set('rating', e.target.value)} className={inputCls(false)}>
              <option value="">—</option>
              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
        </div>

        {/* Address */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 flex flex-col gap-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Address</h2>

          {/* Eircode autocomplete */}
          <Field label="Eircode" error={touched.has('postcode') ? errors.postcode : undefined}>
            <div ref={eircodeWrapperRef} className="relative">
              <div className="relative">
                <input
                  ref={postcodeRef}
                  value={form.address.postcode}
                  onChange={e => setAddr('postcode', e.target.value)}
                  onBlur={() => {
                    touch('postcode')
                    // Normalise: uppercase, ensure single space after first 3 chars
                    const raw = form.address.postcode.replace(/\s/g, '').toUpperCase()
                    if (raw.length === 7) {
                      setAddr('postcode', `${raw.slice(0, 3)} ${raw.slice(3)}`)
                    } else if (raw.length > 0) {
                      setAddr('postcode', raw)
                    }
                  }}
                  onKeyDown={e => { if (e.key === 'Escape') setSuggestionsOpen(false) }}
                  className={inputCls(!!errors.postcode && touched.has('postcode'))}
                  placeholder="Start typing your eircode or address…"
                  autoComplete="off"
                />
                {isLooking && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Spinner className="w-4 h-4 text-gray-400" />
                  </span>
                )}
              </div>

              {suggestionsOpen && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg z-10 overflow-hidden">
                  {suggestions.map((s, i) => (
                    <button
                      key={s.ecad_id ?? i}
                      type="button"
                      onMouseDown={e => { e.preventDefault(); applySuggestion(s) }}
                      className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                    >
                      {s.display_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>

          <Field label="Address Line 1">
            <input
              value={form.address.address_line_1}
              onChange={e => setAddr('address_line_1', e.target.value)}
              className={inputCls(false)}
            />
          </Field>
          <Field label="Address Line 2">
            <input
              value={form.address.address_line_2}
              onChange={e => setAddr('address_line_2', e.target.value)}
              className={inputCls(false)}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="City / Town">
              <input
                value={form.address.city}
                onChange={e => setAddr('city', e.target.value)}
                className={inputCls(false)}
              />
            </Field>
            <Field label="County">
              <select
                value={IRISH_COUNTIES.includes(form.address.county) ? form.address.county : ''}
                onChange={e => setAddr('county', e.target.value)}
                className={inputCls(false)}
              >
                <option value="">— Select county —</option>
                {IRISH_COUNTIES.map(c => (
                  <option key={c} value={c}>
                    Co. {c.charAt(0) + c.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={4}
              className={inputCls(false)}
              placeholder="Any relevant notes…"
            />
          </Field>
        </div>

        {submitError && <p className="text-sm text-red-500">{submitError}</p>}

        <div className="flex gap-3 justify-end">
          <Link
            to={isEdit ? `/customers/${id}` : '/customers'}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 text-sm font-medium text-white bg-[#97B545] hover:bg-[#85a03d] rounded-lg disabled:opacity-60 transition-colors cursor-pointer"
          >
            {isSaving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Customer'}
          </button>
        </div>

      </form>
    </div>
  )
}
