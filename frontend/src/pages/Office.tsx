import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import { useCountUp } from '../hooks/useCountUp'

interface Stats {
  totalPayRuns:   number | null
  hasDraftPayRun: boolean
  totalInvoices:  number | null
  outstanding:    number | null
  totalLeads:     number | null
  newLeads:       number | null
  totalContacts:  number | null
}

const CHEVRON = (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: 'rgba(255,255,255,0.25)' }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
)

const CHEVRON_DARK = (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: 'rgba(15,55,20,0.25)' }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
)

export default function Office() {
  const [stats, setStats] = useState<Stats>({
    totalPayRuns:   null,
    hasDraftPayRun: false,
    totalInvoices:  null,
    outstanding:    null,
    totalLeads:     null,
    newLeads:       null,
    totalContacts:  null,
  })

  const countPayRuns    = useCountUp(stats.totalPayRuns)
  const countInvoices   = useCountUp(stats.totalInvoices)
  const countOutstanding = useCountUp(stats.outstanding)
  const countLeads      = useCountUp(stats.totalLeads)
  const countNewLeads   = useCountUp(stats.newLeads)
  const countContacts   = useCountUp(stats.totalContacts)

  useEffect(() => {
    Promise.all([
      api.get('/payroll'),
      api.get('/invoices'),
      api.get('/invoices', { params: { status: 'sent' } }),
      api.get('/leads'),
      api.get('/leads', { params: { status: 'new' } }),
      api.get('/contacts'),
    ]).then(([payroll, inv, outstanding, leads, newLeads, contacts]) => {
      const runs = payroll.data as { status: string }[]
      setStats({
        totalPayRuns:   runs.length,
        hasDraftPayRun: runs.some(r => r.status === 'draft'),
        totalInvoices:  inv.data.total,
        outstanding:    outstanding.data.total,
        totalLeads:     leads.data.total,
        newLeads:       newLeads.data.total,
        totalContacts:  contacts.data.total,
      })
    }).catch(() => {})
  }, [])

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">

      <div className="mb-5">
        <h1 className="text-3xl font-black text-brand-dark">Office</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(15,55,20,0.45)' }}>
          Payroll, invoices, leads &amp; contacts
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        {/* Payroll */}
        <Link
          to="/payroll"
          className="rounded-2xl p-4 flex items-center gap-3.5 transition-all duration-200 hover:brightness-110 hover:scale-[1.015] active:scale-[0.99]"
          style={{ background: '#1A3A5C', color: 'white' }}
        >
          <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{ color: 'rgba(255,255,255,0.85)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-black leading-none">{countPayRuns ?? '—'}</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>pay runs</p>
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <span className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.85)' }}>Payroll</span>
            {stats.hasDraftPayRun && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(151,181,69,0.25)', color: '#97B545' }}>
                Draft pending
              </span>
            )}
          </div>
          {CHEVRON}
        </Link>

        {/* Invoices */}
        <Link
          to="/invoices"
          className="rounded-2xl p-4 flex items-center gap-3.5 transition-all duration-200 hover:brightness-110 hover:scale-[1.015] active:scale-[0.99]"
          style={{ background: '#0F3714', color: 'white' }}
        >
          <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{ color: 'rgba(255,255,255,0.85)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-black leading-none">{countInvoices ?? '—'}</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>total invoices</p>
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <span className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.85)' }}>Invoices</span>
            {stats.outstanding !== null && stats.outstanding > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(151,181,69,0.2)', color: '#97B545' }}>
                <span className="w-1 h-1 rounded-full bg-[#97B545] animate-pulse" />
                {countOutstanding} outstanding
              </span>
            )}
          </div>
          {CHEVRON}
        </Link>

        {/* Leads */}
        <Link
          to="/leads"
          className="rounded-2xl p-4 flex items-center gap-3.5 transition-all duration-200 hover:brightness-105 hover:scale-[1.015] active:scale-[0.99]"
          style={{ background: '#97B545', color: '#0F3714' }}
        >
          <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(15,55,20,0.12)' }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-black leading-none">{countLeads ?? '—'}</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(15,55,20,0.5)' }}>total leads</p>
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <span className="text-sm font-bold">Leads</span>
            {stats.newLeads !== null && stats.newLeads > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(15,55,20,0.12)', color: '#0F3714' }}>
                {countNewLeads} new
              </span>
            )}
          </div>
          {CHEVRON_DARK}
        </Link>

        {/* Contacts */}
        <Link
          to="/contacts"
          className="rounded-2xl p-4 flex items-center gap-3.5 transition-all duration-200 hover:brightness-105 hover:scale-[1.015] active:scale-[0.99]"
          style={{ background: '#C8920A', color: 'white' }}
        >
          <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{ color: 'rgba(255,255,255,0.9)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-black leading-none">{countContacts ?? '—'}</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>total contacts</p>
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <span className="text-sm font-bold">Contacts</span>
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Suppliers &amp; trades</span>
          </div>
          {CHEVRON}
        </Link>

      </div>
    </div>
  )
}
