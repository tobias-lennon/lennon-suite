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
    case 'new':        return 'badge-new'
    case 'contacted':  return 'badge-contacted'
    case 'quoted':     return 'badge-quoted'
    case 'won':        return 'badge-won'
    case 'lost':       return 'badge-lost'
    default:           return 'badge-backlog'
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
          <h1 className="text-2xl font-bold text-brand-dark">Leads</h1>
          {result && (
            <p className="text-sm mt-0.5" style={{ color: 'rgba(15,55,20,0.45)' }}>{result.total.toLocaleString()} total</p>
          )}
        </div>
        <Link
          to="/leads/new"
          className="text-sm font-bold px-4 py-2.5 rounded-lg transition-all hover:brightness-95"
          style={{ background: '#97B545', color: '#0F3714' }}
        >
          + New Lead
        </Link>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto scrollbar-none pb-0.5 flex-nowrap">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => handleStatus(tab.value)}
            className="shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all"
            style={status === tab.value
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
          placeholder="Search by name, phone or email…"
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
          <div className="p-12 text-center text-sm" style={{ color: 'rgba(15,55,20,0.4)' }}>No leads found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="thead-dark text-left">
                <th>Name</th>
                <th className="hidden md:table-cell">Source</th>
                <th className="hidden md:table-cell">Phone</th>
                <th>Status</th>
                <th className="hidden sm:table-cell">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/4">
              {result?.data.map(lead => (
                <tr
                  key={lead.id}
                  onClick={() => navigate(`/leads/${lead.id}/edit`)}
                  className="tr-hover transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <span className="font-semibold text-brand-dark">{lead.name}</span>
                    <div className="md:hidden text-xs mt-0.5" style={{ color: 'rgba(15,55,20,0.45)' }}>
                      {SOURCE_LABELS[lead.source] ?? lead.source}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell" style={{ color: 'rgba(15,55,20,0.55)' }}>
                    {SOURCE_LABELS[lead.source] ?? lead.source}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-600">
                    {lead.phone ?? <span style={{ color: 'rgba(0,0,0,0.2)' }}>—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge capitalize ${statusStyle(lead.status)}`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-xs" style={{ color: 'rgba(15,55,20,0.4)' }}>
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
