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
        await api.patch(`/customers/${id}`, payload)
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
                if (raw.length === 7) {
                  setAddr('postcode', `${raw.slice(0, 3)} ${raw.slice(3)}`)
                } else if (raw.length > 0) {
                  setAddr('postcode', raw)
                }
              }}
              className={inputCls(!!errors.postcode && touched.has('postcode'))}
              placeholder="e.g. A65 F4E2"
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
        <div className="card p-6">
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
