import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import Spinner from '../components/Spinner'

interface Stats {
  total: number
  residential: number
  commercial: number
  with_email: number
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl p-6 border border-gray-100">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">{label}</p>
      <p className="text-3xl font-semibold text-[#0F3714]">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function ComingSoonCard({ label }: { label: string }) {
  return (
    <div className="bg-white rounded-xl p-6 border border-gray-100 opacity-50">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">{label}</p>
      <p className="text-sm text-gray-300 mt-2">Coming soon</p>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    api.get('/customers/stats')
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setStatsLoading(false))
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-[#0F3714]">
          {greeting}, {user?.name?.split(' ')[0]}.
        </h1>
        <p className="text-gray-400 text-sm mt-1">Here's what's happening with Lennon Landscaping.</p>
      </div>

      {/* Customer stats */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Customers</h2>
          <Link to="/customers" className="text-xs text-[#97B545] font-medium hover:underline">View all →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-6 border border-gray-100 flex items-center justify-center min-h-[96px]">
                <Spinner className="w-5 h-5 text-[#97B545]" />
              </div>
            ))
          ) : (
            <>
              <StatCard label="Total" value={stats?.total ?? '—'} />
              <StatCard label="Residential" value={stats?.residential ?? '—'} />
              <StatCard label="Commercial" value={stats?.commercial ?? '—'} />
              <StatCard label="With Email" value={stats?.with_email ?? '—'} sub="reachable by email" />
            </>
          )}
        </div>
      </div>

      {/* Jobs quick link */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Jobs</h2>
          <Link to="/jobs" className="text-xs text-[#97B545] font-medium hover:underline">View all →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link to="/jobs?status=backlog" className="bg-white rounded-xl p-6 border border-gray-100 hover:border-[#97B545] transition-colors">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Backlog</p>
            <p className="text-sm text-[#0F3714] font-medium">View →</p>
          </Link>
          <Link to="/jobs?status=scheduled" className="bg-white rounded-xl p-6 border border-gray-100 hover:border-[#97B545] transition-colors">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Scheduled</p>
            <p className="text-sm text-[#0F3714] font-medium">View →</p>
          </Link>
          <Link to="/jobs/new" className="bg-white rounded-xl p-6 border border-gray-100 hover:border-[#97B545] transition-colors">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Add Job</p>
            <p className="text-sm text-[#0F3714] font-medium">+ New →</p>
          </Link>
          <ComingSoonCard label="Invoices" />
        </div>
      </div>
    </div>
  )
}
