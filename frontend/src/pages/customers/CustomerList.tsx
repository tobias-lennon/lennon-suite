import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../lib/api'
import { toTitleCase, formatPhone, phoneHref } from '../../lib/formatters'
import Spinner from '../../components/Spinner'

interface Address {
  city: string | null
  county: string | null
  postcode: string | null
}

interface Customer {
  id: number
  name: string
  type: string | null
  phone: string | null
  email: string | null
  address: Address | null
}

interface Paginated {
  data: Customer[]
  current_page: number
  last_page: number
  total: number
}

type SortDir = 'asc' | 'desc'

const ACTIVITY_OPTIONS = [
  { value: '',         label: 'All customers' },
  { value: '3m',      label: 'Active — last 3 months' },
  { value: '6m',      label: 'Active — last 6 months' },
  { value: '12m',     label: 'Active — last 12 months' },
  { value: 'inactive', label: 'Inactive (12+ months)' },
]

export default function CustomerList() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [result, setResult] = useState<Paginated | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const search   = params.get('search') ?? ''
  const page     = parseInt(params.get('page') ?? '1')
  const sortDir  = (params.get('sort') ?? 'asc') as SortDir
  const activity = params.get('activity') ?? ''

  useEffect(() => {
    setIsLoading(true)
    api.get('/customers', {
      params: {
        search:   search   || undefined,
        page,
        sort:     `name_${sortDir}`,
        activity: activity || undefined,
      },
    })
      .then(r => setResult(r.data))
      .finally(() => setIsLoading(false))
  }, [search, page, sortDir, activity])

  function buildParams(overrides: Record<string, string>): Record<string, string> {
    const next: Record<string, string> = {}
    if (search)   next.search   = search
    if (sortDir)  next.sort     = sortDir
    if (activity) next.activity = activity
    next.page = String(page)
    Object.assign(next, overrides)
    Object.keys(next).forEach(k => { if (!next[k]) delete next[k] })
    return next
  }

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setParams(buildParams({ search: e.target.value, page: '1' }))
  }

  function handleActivity(value: string) {
    setParams(buildParams({ activity: value, page: '1' }))
  }

  function setPage(p: number) {
    setParams(buildParams({ page: String(p) }))
  }

  function toggleSort() {
    setParams(buildParams({ sort: sortDir === 'asc' ? 'desc' : 'asc', page: '1' }))
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-dark">Customers</h1>
          {result && (
            <p className="text-sm mt-0.5" style={{ color: 'rgba(15,55,20,0.45)' }}>{result.total.toLocaleString()} total</p>
          )}
        </div>
        <Link
          to="/customers/new"
          className="text-sm font-bold px-4 py-2.5 rounded-lg transition-all hover:brightness-95"
          style={{ background: '#97B545', color: '#0F3714' }}
        >
          + Add
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(15,55,20,0.35)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={handleSearch}
          placeholder="Search by name, phone, email or eircode…"
          className="field-input pl-10"
        />
      </div>

      {/* Activity filter */}
      <div className="flex items-center gap-2 mb-5">
        <label className="text-xs font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(15,55,20,0.4)' }}>Activity</label>
        <select
          value={activity}
          onChange={e => handleActivity(e.target.value)}
          className={`field-input py-1.5 w-auto ${activity ? 'font-medium' : ''}`}
          style={activity ? { color: '#0F3714', borderColor: '#97B545' } : {}}
        >
          {ACTIVITY_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="table-card">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Spinner className="w-6 h-6 text-brand-lime" />
          </div>
        ) : result?.data.length === 0 ? (
          <div className="p-12 text-center text-sm" style={{ color: 'rgba(15,55,20,0.4)' }}>No customers found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="thead-dark text-left">
                <th>
                  <button
                    onClick={toggleSort}
                    style={{ touchAction: 'manipulation' }}
                    className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer select-none text-white/60 text-[0.65rem] font-bold uppercase tracking-[0.09em]"
                  >
                    Name
                    <span>
                      {sortDir === 'asc' ? (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </span>
                  </button>
                </th>
                <th className="hidden md:table-cell">Eircode</th>
                <th className="hidden md:table-cell">Phone</th>
                <th className="hidden lg:table-cell">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/4">
              {result?.data.map(c => (
                <tr key={c.id} onClick={() => navigate(`/customers/${c.id}`)} className="tr-hover transition-colors cursor-pointer">

                  <td className="px-4 py-3">
                    <span className="font-semibold text-brand-dark">{toTitleCase(c.name)}</span>

                    <div className="md:hidden flex justify-between items-center mt-1">
                      <span>
                        {c.address?.postcode ? (
                          <a
                            href={`https://maps.google.com/?q=${encodeURIComponent(c.address.postcode)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-brand-lime font-medium tracking-wide"
                            onClick={e => e.stopPropagation()}
                          >
                            {c.address.postcode.toUpperCase()}
                          </a>
                        ) : (
                          <span className="text-xs" style={{ color: 'rgba(0,0,0,0.2)' }}>—</span>
                        )}
                      </span>
                      <span>
                        {c.phone ? (
                          <a
                            href={`tel:${phoneHref(c.phone)}`}
                            className="text-xs text-gray-500"
                            onClick={e => e.stopPropagation()}
                          >
                            {formatPhone(c.phone)}
                          </a>
                        ) : (
                          <span className="text-xs" style={{ color: 'rgba(0,0,0,0.2)' }}>—</span>
                        )}
                      </span>
                    </div>

                    {c.email && (
                      <a
                        href={`mailto:${c.email}`}
                        className="md:hidden block text-xs text-gray-400 mt-0.5"
                        onClick={e => e.stopPropagation()}
                      >
                        {c.email.toLowerCase()}
                      </a>
                    )}

                    {c.email && (
                      <a
                        href={`mailto:${c.email}`}
                        className="hidden md:block lg:hidden text-xs text-gray-400 hover:text-brand-lime mt-0.5 transition-colors"
                        onClick={e => e.stopPropagation()}
                      >
                        {c.email.toLowerCase()}
                      </a>
                    )}
                  </td>

                  <td className="px-4 py-3 hidden md:table-cell">
                    {c.address?.postcode ? (
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(c.address.postcode)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-lime hover:underline font-medium tracking-wide"
                        onClick={e => e.stopPropagation()}
                      >
                        {c.address.postcode.toUpperCase()}
                      </a>
                    ) : (
                      <span style={{ color: 'rgba(0,0,0,0.2)' }}>—</span>
                    )}
                  </td>

                  <td className="px-4 py-3 hidden md:table-cell">
                    {c.phone ? (
                      <a
                        href={`tel:${phoneHref(c.phone)}`}
                        className="text-gray-600 hover:text-brand-lime transition-colors"
                        onClick={e => e.stopPropagation()}
                      >
                        {formatPhone(c.phone)}
                      </a>
                    ) : (
                      <span style={{ color: 'rgba(0,0,0,0.2)' }}>—</span>
                    )}
                  </td>

                  <td className="px-4 py-3 hidden lg:table-cell">
                    {c.email ? (
                      <a
                        href={`mailto:${c.email}`}
                        className="text-gray-600 hover:text-brand-lime transition-colors"
                        onClick={e => e.stopPropagation()}
                      >
                        {c.email.toLowerCase()}
                      </a>
                    ) : (
                      <span style={{ color: 'rgba(0,0,0,0.2)' }}>—</span>
                    )}
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
