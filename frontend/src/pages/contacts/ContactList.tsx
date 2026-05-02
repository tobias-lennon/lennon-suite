import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../lib/api'
import Spinner from '../../components/Spinner'

interface Contact {
  id: number
  type: string
  name: string
  company_name: string | null
  specialty: string | null
  phone: string | null
  email: string | null
  day_rate: string | null
  is_active: boolean
}

interface Paginated {
  data: Contact[]
  current_page: number
  last_page: number
  total: number
}

const TYPE_TABS = [
  { value: '',                   label: 'All' },
  { value: 'supplier_company',   label: 'Supplier Co.' },
  { value: 'supplier_individual', label: 'Supplier' },
  { value: 'tradesman',          label: 'Tradesman' },
  { value: 'other',              label: 'Other' },
]

const TYPE_LABELS: Record<string, string> = {
  supplier_company:    'Supplier Co.',
  supplier_individual: 'Supplier',
  tradesman:           'Tradesman',
  other:               'Other',
}

function typeStyle(type: string) {
  switch (type) {
    case 'supplier_company':    return 'badge-scheduled'
    case 'supplier_individual': return 'badge-quoted'
    case 'tradesman':           return 'badge-site-visit'
    default:                    return 'badge-backlog'
  }
}

export default function ContactList() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [result, setResult] = useState<Paginated | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const search = params.get('search') ?? ''
  const type   = params.get('type') ?? ''
  const page   = parseInt(params.get('page') ?? '1')

  useEffect(() => {
    setIsLoading(true)
    const query: Record<string, string | number> = { page }
    if (search) query.search = search
    if (type)   query.type   = type
    api.get('/contacts', { params: query })
      .then(r => setResult(r.data))
      .finally(() => setIsLoading(false))
  }, [search, type, page])

  function setAllParams(overrides: Record<string, string>) {
    const next: Record<string, string> = {}
    if (search) next.search = search
    next.page = String(page)
    if (type) next.type = type
    Object.assign(next, overrides)
    Object.keys(next).forEach(k => { if (!next[k]) delete next[k] })
    setParams(next)
  }

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setAllParams({ search: e.target.value, page: '1' })
  }

  function handleType(value: string) {
    setAllParams({ type: value, page: '1' })
  }

  function setPage(p: number) {
    setAllParams({ page: String(p) })
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-dark">Contacts</h1>
          {result && (
            <p className="text-sm mt-0.5" style={{ color: 'rgba(15,55,20,0.45)' }}>{result.total.toLocaleString()} total</p>
          )}
        </div>
        <Link
          to="/contacts/new"
          className="text-sm font-bold px-4 py-2.5 rounded-lg transition-all hover:brightness-95"
          style={{ background: '#97B545', color: '#0F3714' }}
        >
          + New Contact
        </Link>
      </div>

      {/* Type tabs */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto scrollbar-none pb-0.5 flex-nowrap">
        {TYPE_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => handleType(tab.value)}
            className="shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all"
            style={type === tab.value
              ? { background: '#0F3714', color: 'white' }
              : { background: 'rgba(255,255,255,0.7)', color: 'rgba(15,55,20,0.6)' }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(15,55,20,0.35)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={handleSearch}
          placeholder="Search by name, specialty, phone or email…"
          className="field-input pl-10"
        />
      </div>

      {/* Table */}
      <div className="table-card">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Spinner className="w-6 h-6 text-brand-lime" />
          </div>
        ) : result?.data.length === 0 ? (
          <div className="p-12 text-center text-sm" style={{ color: 'rgba(15,55,20,0.4)' }}>No contacts found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="thead-dark text-left">
                <th>Name</th>
                <th className="hidden md:table-cell">Specialty</th>
                <th className="hidden md:table-cell">Phone</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/4">
              {result?.data.map(contact => (
                <tr
                  key={contact.id}
                  onClick={() => navigate(`/contacts/${contact.id}/edit`)}
                  className="tr-hover transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-brand-dark">{contact.name}</span>
                      {!contact.is_active && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide" style={{ background: 'rgba(0,0,0,0.06)', color: '#6b7280' }}>
                          Inactive
                        </span>
                      )}
                    </div>
                    {contact.company_name && (
                      <div className="text-xs mt-0.5" style={{ color: 'rgba(15,55,20,0.45)' }}>
                        {contact.company_name}
                      </div>
                    )}
                    <div className="md:hidden text-xs mt-0.5" style={{ color: 'rgba(15,55,20,0.45)' }}>
                      {contact.specialty ?? contact.phone ?? '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell" style={{ color: 'rgba(15,55,20,0.55)' }}>
                    {contact.specialty ?? <span style={{ color: 'rgba(0,0,0,0.2)' }}>—</span>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell" style={{ color: 'rgba(15,55,20,0.55)' }}>
                    {contact.phone ?? <span style={{ color: 'rgba(0,0,0,0.2)' }}>—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${typeStyle(contact.type)}`}>
                      {TYPE_LABELS[contact.type] ?? contact.type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {result && result.last_page > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm" style={{ color: 'rgba(15,55,20,0.5)' }}>
          <span>Page {result.current_page} of {result.last_page}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-black/8 disabled:opacity-40 hover:bg-white/60 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === result.last_page}
              className="px-3 py-1.5 rounded-lg border border-black/8 disabled:opacity-40 hover:bg-white/60 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
