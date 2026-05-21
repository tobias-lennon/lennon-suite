import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import Spinner from '../components/Spinner'
import WeatherWidget from '../components/WeatherWidget'
import { useCountUp } from '../hooks/useCountUp'
import { fmtDate } from '../lib/formatters'

interface Stats {
  total: number
  residential: number
  commercial: number
  with_email: number
}

interface UpcomingFollowup {
  id: number
  note: string
  follow_up_date: string
  customer_id: number
  customer_name: string
}

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function now() {
  const d = new Date()
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

interface StatCardProps {
  label: string
  value: number | string
  sub?: string
  to?: string
  accent: string
  textAccent?: string
  animDelay?: number
}

function StatCard({ label, value, sub, to, accent, textAccent, animDelay = 0 }: StatCardProps) {
  const numTarget = typeof value === 'number' ? value : null
  const counted = useCountUp(numTarget)
  const displayValue = numTarget !== null ? (counted ?? 0) : value

  const inner = (
    <div className="relative overflow-hidden rounded-2xl bg-cream-card p-5 border border-black/5 page-enter"
         style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)', animationDelay: `${animDelay}ms` }}>
      {/* Accent stripe */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ backgroundColor: accent }} />
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: accent }}>
        {label}
      </p>
      <p className="text-4xl font-bold leading-none" style={{ color: textAccent ?? '#0F3714' }}>
        {displayValue}
      </p>
      {sub && <p className="text-[11px] text-gray-400 mt-1.5">{sub}</p>}
    </div>
  )

  if (to) return (
    <Link to={to} className="block hover:scale-[1.02] transition-transform duration-150">
      {inner}
    </Link>
  )
  return inner
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [followups, setFollowups] = useState<UpcomingFollowup[]>([])

  useEffect(() => {
    api.get('/customers/stats')
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setStatsLoading(false))

    api.get('/customer-followups/upcoming')
      .then(r => setFollowups(r.data))
      .catch(() => {})
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.name?.split(' ')[0] ?? 'there'

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">

      {/* ── Hero card ──────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-3xl mb-6 p-6 md:p-8"
        style={{
          background: 'linear-gradient(135deg, #0F3714 0%, #1D5823 100%)',
          boxShadow: '0 12px 40px rgba(15,55,20,0.35)',
        }}
      >
        {/* Ghost "LL" watermark */}
        <div
          className="absolute right-4 bottom-0 leading-none font-black select-none pointer-events-none"
          style={{ fontSize: '140px', color: 'rgba(255,255,255,0.04)' }}
        >
          LL
        </div>

        {/* Decorative dots */}
        <div className="absolute top-4 right-4 flex gap-1.5 opacity-20">
          {[0,1,2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-brand-lime" />
          ))}
        </div>

        <p className="text-white/40 text-xs font-medium tracking-widest uppercase mb-3">
          {now()}
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
          {greeting},<br />
          <span style={{ color: '#97B545' }}>{firstName}.</span>
        </h1>
        <p className="text-white/40 text-sm mt-3">
          Lennon Landscaping · Company Suite
        </p>
      </div>

      {/* ── Weather ────────────────────────────────────────────────── */}
      <div className="mb-6">
        <WeatherWidget />
      </div>

      {/* ── Customer stats ─────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-brand-dark/40 uppercase tracking-widest">Customers</h2>
          <Link to="/customers" className="text-xs text-brand-lime font-semibold hover:underline">
            View all →
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-cream-card rounded-2xl p-5 flex items-center justify-center min-h-[100px] border border-black/5">
                <Spinner className="w-5 h-5 text-brand-lime" />
              </div>
            ))
          ) : (
            <>
              <StatCard label="Total"       value={stats?.total       ?? '—'} accent="#97B545" to="/customers"                animDelay={60}  />
              <StatCard label="Residential" value={stats?.residential ?? '—'} accent="#1D5823" to="/customers?type=residential" animDelay={120} />
              <StatCard label="Commercial"  value={stats?.commercial  ?? '—'} accent="#DDB01D" textAccent="#0F3714" to="/customers?type=commercial" animDelay={180} />
              <StatCard label="With Email"  value={stats?.with_email  ?? '—'} accent="#F4BE29" sub="reachable" to="/customers"                       animDelay={240} />
            </>
          )}
        </div>
      </div>

      {/* ── Follow-ups ─────────────────────────────────────────────── */}
      {followups.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-brand-dark/40 uppercase tracking-widest">Follow-ups Due</h2>
          </div>
          <div className="rounded-2xl overflow-hidden border border-black/5" style={{ background: '#FDFAF5' }}>
            {followups.map((f, i) => {
              const d = new Date(f.follow_up_date + 'T12:00:00')
              const today = new Date(); today.setHours(0, 0, 0, 0)
              const diff = Math.floor((d.getTime() - today.getTime()) / 86400000)
              const dateColor = diff < 0 ? '#B84A2A' : diff === 0 ? '#B84A2A' : '#DDB01D'
              const dateLabel = diff < 0 ? `${Math.abs(diff)}d overdue` : diff === 0 ? 'Today' : fmtDate(f.follow_up_date, { day: 'numeric', month: 'short' })
              return (
                <Link
                  key={f.id}
                  to={`/customers/${f.customer_id}`}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-black/3 transition-colors"
                  style={{ borderTop: i > 0 ? '1px solid rgba(0,0,0,0.05)' : undefined }}
                >
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: dateColor }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-brand-dark truncate">{f.customer_name}</p>
                    <p className="text-xs truncate mt-0.5" style={{ color: 'rgba(15,55,20,0.5)' }}>{f.note}</p>
                  </div>
                  <span className="text-xs font-semibold shrink-0" style={{ color: dateColor }}>{dateLabel}</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Quick actions ──────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-bold text-brand-dark/40 uppercase tracking-widest mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">

          <Link
            to="/jobs?status=scheduled"
            className="relative overflow-hidden rounded-2xl p-5 border border-black/5 hover:scale-[1.02] transition-transform duration-150"
            style={{ background: 'linear-gradient(135deg, #0F3714, #1D5823)', boxShadow: '0 4px 16px rgba(15,55,20,0.2)' }}
          >
            <div className="absolute right-3 bottom-2 text-5xl opacity-10 select-none">📋</div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Jobs</p>
            <p className="text-white font-bold text-base">Scheduled</p>
            <p className="text-brand-lime text-xs mt-1 font-medium">View all →</p>
          </Link>

          <Link
            to="/jobs/new"
            className="relative overflow-hidden rounded-2xl p-5 border border-black/5 hover:scale-[1.02] transition-transform duration-150"
            style={{ background: '#97B545', boxShadow: '0 4px 16px rgba(151,181,69,0.3)' }}
          >
            <div className="absolute right-3 bottom-2 text-5xl opacity-15 select-none">＋</div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-dark/50 mb-1">New</p>
            <p className="text-brand-dark font-bold text-base">Add Job</p>
            <p className="text-brand-dark/60 text-xs mt-1 font-medium">Create now →</p>
          </Link>

          <Link
            to="/invoices"
            className="relative overflow-hidden rounded-2xl p-5 border border-black/5 hover:scale-[1.02] transition-transform duration-150"
            style={{ background: '#DDB01D', boxShadow: '0 4px 16px rgba(221,176,29,0.3)' }}
          >
            <div className="absolute right-3 bottom-2 text-5xl opacity-15 select-none">💰</div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-dark/50 mb-1">Billing</p>
            <p className="text-brand-dark font-bold text-base">Invoices</p>
            <p className="text-brand-dark/60 text-xs mt-1 font-medium">View all →</p>
          </Link>

          <Link
            to="/leads"
            className="relative overflow-hidden rounded-2xl p-5 border border-black/5 hover:scale-[1.02] transition-transform duration-150"
            style={{ background: '#FDFAF5', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}
          >
            <div className="absolute right-3 bottom-2 text-5xl opacity-10 select-none">🎯</div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-dark/40 mb-1">Pipeline</p>
            <p className="text-brand-dark font-bold text-base">Leads</p>
            <p className="text-brand-lime text-xs mt-1 font-medium">View all →</p>
          </Link>

        </div>
      </div>
    </div>
  )
}
