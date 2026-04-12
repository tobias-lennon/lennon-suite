import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../lib/api'
import Spinner from '../../components/Spinner'

interface Lead {
  id: number
  name: string
  phone: string | null
  email: string | null
  source: string
  status: string
  created_at: string
}

interface Paginated {
  data: Lead[]
  current_page: number
  last_page: number
  total: number
}

const STATUS_TABS = [
  { value: '',          label: 'All' },
  { value: 'new',       label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'quoted',    label: 'Quoted' },
  { value: 'won',       label: 'Won' },
  { value: 'lost',      label: 'Lost' },
]

const SOURCE_LABELS: Record<string, string> = {
  word_of_mouth: 'Word of Mouth',
  google:        'Google',
  instagram:     'Instagram',
  referral:      'Referral',
  other:         'Other',
}

function statusStyle(status: string) {
  switch (status) {
    case 'new':        return 'bg-blue-100 text-blue-700'
    case 'contacted':  return 'bg-amber-100 text-amber-700'
    case 'quoted':     return 'bg-violet-100 text-violet-700'
    case 'won':        return 'bg-green-100 text-green-700'
    case 'lost':       return 'bg-red-100 text-red-500'
    default:           return 'bg-gray-100 text-gray-600'
  }
}

function daysAgo(dateStr: string) {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

export default function LeadList() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [result, setResult] = useState<Paginated | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const search = params.get('search') ?? ''
  const status = params.get('status') ?? ''
  const page   = parseInt(params.get('page') ?? '1')

  useEffect(() => {
    setIsLoading(true)
    const query: Record<string, string | number> = { page }
    if (search) query.search = search
    if (status) query.status = status
    api.get('/leads', { params: query })
      .then(r => setResult(r.data))
      .finally(() => setIsLoading(false))
  }, [search, status, page])

  function setAllParams(overrides: Record<string, string>) {
    const next: Record<string, string> = {}
    if (search) next.search = search
    next.page = String(page)
    if (status) next.status = status
    Object.assign(next, overrides)
    Object.keys(next).forEach(k => { if (!next[k]) delete next[k] })
    setParams(next)
  }

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setAllParams({ search: e.target.value, page: '1' })
  }

  function handleStatus(value: string) {
    setAllParams({ status: value, page: '1' })
  }

  function setPage(p: number) {
    setAllParams({ page: String(p) })
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F3714]">Leads</h1>
          {result && (
            <p className="text-gray-400 text-sm mt-0.5">{result.total.toLocaleString()} total</p>
          )}
        </div>
        <Link
          to="/leads/new"
          className="bg-[#97B545] hover:bg-[#85a03d] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + New Lead
        </Link>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => handleStatus(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              status === tab.value
                ? 'bg-[#0F3714] text-white'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
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
          placeholder="Search by name, phone or email…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#97B545] focus:border-transparent"
        />
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Spinner className="w-6 h-6 text-[#97B545]" />
          </div>
        ) : result?.data.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">No leads found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Name</th>
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Source</th>
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Phone</th>
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {result?.data.map(lead => (
                <tr
                  key={lead.id}
                  onClick={() => navigate(`/leads/${lead.id}/edit`)}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{lead.name}</span>
                    <div className="md:hidden text-xs text-gray-400 mt-0.5">
                      {SOURCE_LABELS[lead.source] ?? lead.source}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-500">
                    {SOURCE_LABELS[lead.source] ?? lead.source}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-600">
                    {lead.phone ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusStyle(lead.status)}`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-gray-400 text-xs">
                    {daysAgo(lead.created_at)}
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
