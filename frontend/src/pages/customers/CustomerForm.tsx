import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/api'
import { toTitleCase, normalizePhone } from '../../lib/formatters'
import Spinner from '../../components/Spinner'

interface FormData {
  name: string
  type: string
  phone: string
  email: string
  notes: string
  rating: string
  minutes_from_hq: string
  discount_pct: string
  default_callout_fee: string
  custom_rate: string
  skip_loyalty: boolean
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
  county?: string
}

const IRISH_COUNTIES = [
  'CARLOW', 'CAVAN', 'CLARE', 'CORK', 'DONEGAL',
  'DUBLIN', 'GALWAY', 'KERRY', 'KILDARE', 'KILKENNY',
  'LAOIS', 'LEITRIM', 'LIMERICK', 'LONGFORD', 'LOUTH',
  'MAYO', 'MEATH', 'MONAGHAN', 'OFFALY', 'ROSCOMMON',
  'SLIGO', 'TIPPERARY', 'WATERFORD', 'WESTMEATH',
  'WEXFORD', 'WICKLOW',
  'ANTRIM', 'ARMAGH', 'DOWN', 'FERMANAGH', 'LONDONDERRY', 'TYRONE',
]

const empty: FormData = {
  name: '', type: 'residential', phone: '', email: '', notes: '', rating: '', minutes_from_hq: '',
  discount_pct: '', default_callout_fee: '', custom_rate: '', skip_loyalty: false,
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
      errors.postcode = 'Enter a valid Eircode (e.g. P51R2P2)'
    }
  }

  return errors
}

function hasErrors(errors: FormErrors) {
  return Object.keys(errors).length > 0
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-danger">{message}</p>
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(15,55,20,0.45)' }}>
        {label}
      </label>
      {children}
      <FieldError message={error} />
    </div>
  )
}

function inputCls(hasError: boolean) {
  return `field-input${hasError ? ' field-error' : ''}`
}

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

  const nameRef     = useRef<HTMLInputElement>(null)
  const phoneRef    = useRef<HTMLInputElement>(null)
  const emailRef    = useRef<HTMLInputElement>(null)
  const postcodeRef = useRef<HTMLInputElement>(null)
  const countyRef   = useRef<HTMLSelectElement>(null)

  const fieldRefs: Record<typeof VALIDATED_FIELDS[number], React.RefObject<HTMLInputElement | null>> = {
    name: nameRef, phone: phoneRef, email: emailRef, postcode: postcodeRef,
  }

  useEffect(() => {
    if (!isEdit) return
    api.get(`/customers/${id}`).then(r => {
      const c = r.data
      setForm({
        name: c.name ?? '',
        type: ['residential', 'commercial'].includes(c.type) ? c.type : 'residential',
        phone: normalizePhone(c.phone ?? '') ?? '',
        email: c.email ?? '',
        notes: c.notes ?? '',
        rating: c.rating ? String(c.rating) : '',
        minutes_from_hq: c.minutes_from_hq ? String(c.minutes_from_hq) : '',
        discount_pct: c.discount_pct ? String(c.discount_pct) : '',
        default_callout_fee: c.default_callout_fee ? String(c.default_callout_fee) : '',
        custom_rate: c.custom_rate ? String(c.custom_rate) : '',
        skip_loyalty: c.skip_loyalty ?? false,
        address: {
          address_line_1: c.address?.address_line_1 ?? '',
          address_line_2: c.address?.address_line_2 ?? '',
          city: c.address?.city ?? '',
          county: (c.address?.county ?? '').toUpperCase(),
          postcode: c.address?.postcode ?? '',
        },
      })
    }).finally(() => setIsLoading(false))
  }, [id])

  function set(field: keyof Omit<FormData, 'address'>, value: string | boolean) {
    const updated = { ...form, [field]: value }
    setForm(updated)
    if (touched.has(field)) setErrors(validate(updated))
  }

  function setAddr(field: keyof FormData['address'], value: string) {
    const updated = { ...form, address: { ...form.address, [field]: value } }
    setForm(updated)
    if (touched.has(field)) setErrors(validate(updated))
  }

  function touch(field: string) {
    setTouched(prev => new Set(prev).add(field))
    setErrors(validate(form))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const validationErrors = validate(form)

    if (hasErrors(validationErrors)) {
      setErrors(validationErrors)
      setTouched(new Set(VALIDATED_FIELDS))

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
      name: toTitleCase(form.name.trim()) ?? form.name.trim(),
      type: form.type || null,
      phone: normalizePhone(form.phone) ?? null,
      email: form.email.trim().toLowerCase() || null,
      notes: form.notes.trim() || null,
      rating: form.rating ? parseInt(form.rating) : null,
      minutes_from_hq: form.minutes_from_hq ? parseInt(form.minutes_from_hq) : null,
      discount_pct: form.discount_pct ? parseFloat(form.discount_pct) : 0,
      default_callout_fee: form.default_callout_fee ? parseFloat(form.default_callout_fee) : null,
      custom_rate: form.custom_rate ? parseFloat(form.custom_rate) : null,
      skip_loyalty: form.skip_loyalty,
      address: {
        address_line_1: toTitleCase(form.address.address_line_1.trim()) ?? null,
        address_line_2: toTitleCase(form.address.address_line_2.trim()) ?? null,
        city: toTitleCase(form.address.city.trim()) ?? null,
        county: form.address.county.trim() || null,
        postcode: form.address.postcode.trim() || null,
      },
    }

    try {
      if (isEdit) {
        await api.patch(`/customers/${id}`, payload)
        navigate(`/customers/${id}`)
      } else {
        const { data } = await api.post('/customers', payload)
        navigate(`/customers/${data.id}`)
      }
    } catch (err: any) {
      if (err.response?.status === 422) {
        const serverErrors: Record<string, string[]> = err.response.data?.errors ?? {}
        const mapped: FormErrors = {}
        if (serverErrors['name'])             mapped.name     = serverErrors['name'][0]
        if (serverErrors['email'])            mapped.email    = serverErrors['email'][0]
        if (serverErrors['phone'])            mapped.phone    = serverErrors['phone'][0]
        if (serverErrors['address.postcode']) mapped.postcode = serverErrors['address.postcode'][0]
        if (serverErrors['address.county'])   mapped.county   = serverErrors['address.county'][0]

        if (Object.keys(mapped).length > 0) {
          setErrors(mapped)
          if (mapped.county) {
            countyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            countyRef.current?.focus({ preventScroll: true })
          } else {
            const firstKey = VALIDATED_FIELDS.find(k => mapped[k])
            const el = firstKey ? fieldRefs[firstKey].current : null
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            el?.focus({ preventScroll: true })
          }
          setIsSaving(false)
          return
        }
      }
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

      <h1 className="text-2xl font-bold text-brand-dark mb-8">
        {isEdit ? 'Edit Customer' : 'New Customer'}
      </h1>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">

        {/* Core details */}
        <div className="card p-6 flex flex-col gap-4">
          <h2 className="section-label">Details</h2>

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
                type="tel"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                onBlur={() => {
                  touch('phone')
                  const normalized = normalizePhone(form.phone)
                  set('phone', normalized ?? '')
                }}
                className={inputCls(!!errors.phone && touched.has('phone'))}
                placeholder="+353 89 123 4567"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Rating (1–5)">
              <select value={form.rating} onChange={e => set('rating', e.target.value)} className={inputCls(false)}>
                <option value="">—</option>
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="Drive from HQ (mins)">
              <input
                type="number"
                min="1"
                max="600"
                value={form.minutes_from_hq}
                onChange={e => set('minutes_from_hq', e.target.value)}
                className={inputCls(false)}
                placeholder="e.g. 25"
              />
            </Field>
          </div>
        </div>

        {/* Address */}
        <div className="card p-6 flex flex-col gap-4">
          <h2 className="section-label">Address</h2>

          <Field label="Eircode" error={touched.has('postcode') ? errors.postcode : undefined}>
            <input
              ref={postcodeRef}
              value={form.address.postcode}
              onChange={e => setAddr('postcode', e.target.value)}
              onBlur={() => {
                touch('postcode')
                const raw = form.address.postcode.replace(/\s/g, '').toUpperCase()
                if (raw.length > 0) setAddr('postcode', raw)
              }}
              className={inputCls(!!errors.postcode && touched.has('postcode'))}
              placeholder="e.g. P51R2P2"
            />
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
            <Field label="County" error={errors.county}>
              <select
                ref={countyRef}
                value={form.address.county}
                onChange={e => { setAddr('county', e.target.value); setErrors(prev => ({ ...prev, county: undefined })) }}
                className={inputCls(!!errors.county)}
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

        {/* Rates */}
        <div className="card p-6 flex flex-col gap-4">
          <h2 className="section-label">Rates</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Standing Discount (%)">
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={form.discount_pct}
                  onChange={e => set('discount_pct', e.target.value)}
                  className={inputCls(false)}
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: 'rgba(15,55,20,0.4)' }}>%</span>
              </div>
            </Field>
            <Field label="Default Callout Fee">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: 'rgba(15,55,20,0.4)' }}>€</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.default_callout_fee}
                  onChange={e => set('default_callout_fee', e.target.value)}
                  onBlur={e => { const v = e.target.valueAsNumber; if (!isNaN(v)) set('default_callout_fee', v.toFixed(2)) }}
                  className={`${inputCls(false)} pl-7`}
                  placeholder="0.00"
                />
              </div>
            </Field>
            <Field label="Custom Hourly Rate">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: 'rgba(15,55,20,0.4)' }}>€</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.custom_rate}
                  onChange={e => set('custom_rate', e.target.value)}
                  onBlur={e => { const v = e.target.valueAsNumber; if (!isNaN(v)) set('custom_rate', v.toFixed(2)) }}
                  className={`${inputCls(false)} pl-7`}
                  placeholder="Overrides standard rate"
                />
              </div>
            </Field>
          </div>
        </div>

        {/* Notes */}
        <div className="card p-6 flex flex-col gap-4">
          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={4}
              className={inputCls(false)}
              placeholder="Any relevant notes…"
            />
          </Field>

          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-semibold text-brand-dark">Loyalty Points</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(15,55,20,0.45)' }}>
                Earns points on maintenance visits
              </p>
            </div>
            <button
              type="button"
              onClick={() => set('skip_loyalty', !form.skip_loyalty)}
              className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
              style={{ backgroundColor: !form.skip_loyalty ? '#97B545' : 'rgba(15,55,20,0.15)' }}
            >
              <span
                className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200"
                style={{ transform: !form.skip_loyalty ? 'translateX(20px)' : 'translateX(0)' }}
              />
            </button>
          </div>
        </div>

        {submitError && <p className="text-sm text-danger">{submitError}</p>}

        <div className="flex gap-3 justify-end">
          <Link
            to={isEdit ? `/customers/${id}` : '/customers'}
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
            {isEdit ? 'Save Changes' : 'Create Customer'}
          </button>
        </div>

      </form>
    </div>
  )
}
