import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/api'
import { toTitleCase, formatPhone, phoneHref } from '../../lib/formatters'
import Spinner from '../../components/Spinner'

interface Customer {
  id: number
  name: string
  type: string | null
  phone: string | null
  email: string | null
  notes: string | null
  rating: number | null
  address: {
    address_line_1: string | null
    address_line_2: string | null
    city: string | null
    county: string | null
    postcode: string | null
  } | null
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">{children}</p>
}

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.get(`/customers/${id}`)
      .then(r => setCustomer(r.data))
      .catch(() => navigate('/customers'))
      .finally(() => setIsLoading(false))
  }, [id])

  async function handleArchive() {
    if (!confirm(`Archive ${customer?.name}? They'll be hidden from your customer list but their data is kept.`)) return
    await api.patch(`/customers/${id}/archive`)
    navigate('/customers')
  }

  async function handleDelete() {
    if (!confirm(`Permanently delete ${customer?.name}? This cannot be undone — all their data will be removed.`)) return
    await api.delete(`/customers/${id}`)
    navigate('/customers')
  }

  if (isLoading) return (
    <div className="p-8 flex justify-center">
      <Spinner className="w-6 h-6 text-[#97B545]" />
    </div>
  )
  if (!customer) return null

  const addr = customer.address
  const addressLines = [
    toTitleCase(addr?.address_line_1 ?? null),
    toTitleCase(addr?.address_line_2 ?? null),
    toTitleCase(addr?.city ?? null),
    toTitleCase(addr?.county ?? null),
  ].filter(Boolean)

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">

      {/* Back */}
      <Link to="/customers" className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-6">
        ← Customers
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#0F3714]">{toTitleCase(customer.name)}</h1>
            {customer.type && (
              <span className={`inline-flex text-xs font-medium px-2 py-1 rounded-full mt-2 ${
                customer.type === 'commercial'
                  ? 'bg-[#DDB01D]/15 text-[#a07f00]'
                  : 'bg-[#97B545]/15 text-[#5a7020]'
              }`}>
                {customer.type.charAt(0).toUpperCase() + customer.type.slice(1)}
              </span>
            )}
          </div>
          <div className="flex-shrink-0">
            <Link
              to={`/customers/${id}/edit`}
              className="text-sm font-medium px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-300 text-gray-700 transition-colors"
            >
              Edit
            </Link>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white rounded-xl border border-gray-100 p-5 md:p-6 mb-5">

        {/* Phone */}
        <div>
          <FieldLabel>Phone</FieldLabel>
          {customer.phone ? (
            <a
              href={`tel:${phoneHref(customer.phone)}`}
              className="text-sm text-[#97B545] hover:underline"
            >
              {formatPhone(customer.phone)}
            </a>
          ) : (
            <p className="text-sm text-gray-400">—</p>
          )}
        </div>

        {/* Email */}
        <div>
          <FieldLabel>Email</FieldLabel>
          {customer.email ? (
            <a
              href={`mailto:${customer.email}`}
              className="text-sm text-[#97B545] hover:underline break-all"
            >
              {customer.email.toLowerCase()}
            </a>
          ) : (
            <p className="text-sm text-gray-400">—</p>
          )}
        </div>

        {/* Address */}
        <div>
          <FieldLabel>Address</FieldLabel>
          {addressLines.length > 0 ? (
            <p className="text-sm text-gray-800 leading-relaxed">
              {addressLines.map((line, i) => (
                <span key={i}>{line}{i < addressLines.length - 1 && <br />}</span>
              ))}
            </p>
          ) : (
            <p className="text-sm text-gray-400">—</p>
          )}
        </div>

        {/* Eircode */}
        <div>
          <FieldLabel>Eircode</FieldLabel>
          {addr?.postcode ? (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(addr.postcode)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#97B545] hover:underline font-medium tracking-wide"
            >
              {addr.postcode.toUpperCase()}
            </a>
          ) : (
            <p className="text-sm text-gray-400">—</p>
          )}
        </div>

        {/* Rating */}
        <div>
          <FieldLabel>Rating</FieldLabel>
          <p className="text-sm text-gray-800">{customer.rating ? `${customer.rating} / 5` : '—'}</p>
        </div>

      </div>

      {customer.notes && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 md:p-6 mb-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2">Notes</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{customer.notes}</p>
        </div>
      )}

      {/* Archive / Delete */}
      <div className="flex items-center gap-6 pt-2 pb-4">
        <button
          onClick={handleArchive}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
        >
          Archive customer
        </button>
        <button
          onClick={handleDelete}
          className="text-sm text-red-400 hover:text-red-600 transition-colors cursor-pointer"
        >
          Delete customer
        </button>
      </div>

    </div>
  )
}
