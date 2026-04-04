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

export default function CustomerList() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [result, setResult] = useState<Paginated | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const search  = params.get('search') ?? ''
  const page    = parseInt(params.get('page') ?? '1')
  const sortDir = (params.get('sort') ?? 'asc') as SortDir

  useEffect(() => {
    setIsLoading(true)
    api.get('/customers', { params: { search, page, sort: `name_${sortDir}` } })
      .then(r => setResult(r.data))
      .finally(() => setIsLoading(false))
  }, [search, page, sortDir])

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setParams({ search: e.target.value, page: '1', sort: sortDir })
  }

  function setPage(p: number) {
    setParams({ search, page: String(p), sort: sortDir })
  }

  function toggleSort() {
    setParams({ search, page: '1', sort: sortDir === 'asc' ? 'desc' : 'asc' })
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F3714]">Customers</h1>
          {result && (
            <p className="text-gray-400 text-sm mt-0.5">{result.total.toLocaleString()} total</p>
          )}
        </div>
        <Link
          to="/customers/new"
          className="bg-[#97B545] hover:bg-[#85a03d] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Add
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={handleSearch}
          placeholder="Search by name, phone, email or eircode…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545] focus:border-transparent"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Spinner className="w-6 h-6 text-[#97B545]" />
          </div>
        ) : result?.data.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">No customers found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                {/* Name — always visible */}
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  <button
                    onClick={toggleSort}
                    style={{ touchAction: 'manipulation' }}
                    className="flex items-center gap-1 hover:text-gray-600 transition-colors cursor-pointer select-none"
                  >
                    Name
                    <span className="text-gray-300">
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
                {/* Eircode — md+ */}
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Eircode</th>
                {/* Phone — md+ */}
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Phone</th>
                {/* Email — lg+ only */}
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {result?.data.map(c => (
                  <tr key={c.id} onClick={() => navigate(`/customers/${c.id}`)} className="hover:bg-gray-50 transition-colors cursor-pointer">

                    {/* Name cell */}
                    <td className="px-4 py-3">
                      {/* Line 1: Name */}
                      <span className="font-medium text-gray-900">{toTitleCase(c.name)}</span>

                      {/* Mobile only — Line 2: Eircode (left) + Phone (right) */}
                      <div className="md:hidden flex justify-between items-center mt-1">
                        <span>
                          {c.address?.postcode ? (
                            <a
                              href={`https://maps.google.com/?q=${encodeURIComponent(c.address.postcode)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-[#97B545] font-medium tracking-wide"
                              onClick={e => e.stopPropagation()}
                            >
                              {c.address.postcode.toUpperCase()}
                            </a>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
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
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </span>
                      </div>

                      {/* Mobile only — Line 3: Email */}
                      {c.email && (
                        <a
                          href={`mailto:${c.email}`}
                          className="md:hidden block text-xs text-gray-400 mt-0.5"
                          onClick={e => e.stopPropagation()}
                        >
                          {c.email.toLowerCase()}
                        </a>
                      )}

                      {/* md only (tablet) — email sub-line, hidden on lg+ where it gets its own column */}
                      {c.email && (
                        <a
                          href={`mailto:${c.email}`}
                          className="hidden md:block lg:hidden text-xs text-gray-400 hover:text-[#97B545] mt-0.5 transition-colors"
                          onClick={e => e.stopPropagation()}
                        >
                          {c.email.toLowerCase()}
                        </a>
                      )}
                    </td>

                    {/* Eircode — md+ */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      {c.address?.postcode ? (
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(c.address.postcode)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#97B545] hover:underline font-medium tracking-wide"
                          onClick={e => e.stopPropagation()}
                        >
                          {c.address.postcode.toUpperCase()}
                        </a>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    {/* Phone — md+ */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      {c.phone ? (
                        <a
                          href={`tel:${phoneHref(c.phone)}`}
                          className="text-gray-600 hover:text-[#97B545] transition-colors"
                          onClick={e => e.stopPropagation()}
                        >
                          {formatPhone(c.phone)}
                        </a>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    {/* Email — lg+ */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {c.email ? (
                        <a
                          href={`mailto:${c.email}`}
                          className="text-gray-600 hover:text-[#97B545] transition-colors"
                          onClick={e => e.stopPropagation()}
                        >
                          {c.email.toLowerCase()}
                        </a>
                      ) : (
                        <span className="text-gray-300">—</span>
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
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>Page {result.current_page} of {result.last_page}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:border-gray-300 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === result.last_page}
              className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:border-gray-300 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
