import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import Spinner from '../components/Spinner'

interface CustomerForecastDay {
  date: string
  condition: 'dry' | 'shower' | 'rain'
}

interface JobSummary {
  id: number
  title: string
  type: string | null
  status: string
  scheduled_date: string | null
  due_by: string | null
  priority: string | null
  weather_req: string | null
  customer_forecast: CustomerForecastDay[] | null
  customer: { id: number; name: string; minutes_from_hq: number | null } | null
}

interface ScheduleData {
  week_start: string
  week_end: string
  scheduled: JobSummary[]
  overdue: JobSummary[]
  unscheduled: JobSummary[]
}

interface Forecast {
  date: string
  condition: 'dry' | 'shower' | 'rain'
  temp_max: number
  precip_probability: number
}

const STATUS_DOT: Record<string, string> = {
  backlog: '#bbb', scheduled: '#97B545', in_progress: '#DDB01D',
}
const STATUS_LABEL: Record<string, string> = {
  backlog: 'Backlog', scheduled: 'Scheduled', in_progress: 'In Progress',
}
const CONDITION_ICON: Record<string, string> = { dry: '☀', shower: '🌦', rain: '🌧' }

function getWeatherWarning(weatherReq: string | null, condition: string | undefined): 'none' | 'caution' | 'danger' {
  if (!weatherReq || weatherReq === 'any' || !condition || condition === 'dry') return 'none'
  if (weatherReq === 'dry_only') return (condition === 'rain' || condition === 'shower') ? 'danger' : 'none'
  if (weatherReq === 'dry_preferred') {
    if (condition === 'rain') return 'danger'
    if (condition === 'shower') return 'caution'
  }
  return 'none'
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function currentMonday(): string {
  const d = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d.toISOString().slice(0, 10)
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' })
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().slice(0, 10)
}

function isPast(dateStr: string): boolean {
  return dateStr < new Date().toISOString().slice(0, 10)
}

function getJobCondition(job: JobSummary, date: string, hqForecasts: Forecast[]): string | undefined {
  if (job.customer_forecast) return job.customer_forecast.find(f => f.date === date)?.condition
  return hqForecasts.find(f => f.date === date)?.condition
}

function suggestDay(job: JobSummary, days: string[], hqForecasts: Forecast[]): string | null {
  const today = new Date().toISOString().slice(0, 10)
  const futureDays = days.filter(d => d >= today)
  if (futureDays.length === 0) return null

  const cond = (date: string) => getJobCondition(job, date, hqForecasts)

  let candidates: string[]
  if (job.weather_req === 'dry_only') {
    candidates = futureDays.filter(d => { const c = cond(d); return !c || c === 'dry' })
  } else if (job.weather_req === 'dry_preferred') {
    const dryDays = futureDays.filter(d => { const c = cond(d); return !c || c === 'dry' })
    candidates = dryDays.length > 0 ? dryDays : futureDays
  } else {
    candidates = futureDays
  }

  if (candidates.length === 0) return null

  if (job.due_by) {
    const beforeDue = candidates.filter(d => d <= job.due_by!)
    if (beforeDue.length > 0) return beforeDue[0]
  }

  return candidates[0]
}

interface JobCardProps {
  job: JobSummary
  showAssign?: boolean
  showSuggest?: boolean
  days: string[]
  assigningJobId: number | null
  onToggleAssign: (id: number | null) => void
  saving: boolean
  onAssign: (job: JobSummary, date: string | null) => void
  forecasts: Forecast[]
}

function JobCard({ job, showAssign = false, showSuggest = false, days, assigningJobId, onToggleAssign, saving, onAssign, forecasts }: JobCardProps) {
  const dot = STATUS_DOT[job.status] ?? '#ccc'
  const isAssigning = assigningJobId === job.id

  const scheduledCondition = job.scheduled_date ? getJobCondition(job, job.scheduled_date, forecasts) : undefined
  const warning = getWeatherWarning(job.weather_req, scheduledCondition)

  const suggestion = showSuggest && !isAssigning ? suggestDay(job, days, forecasts) : null
  const suggestionCondition = suggestion ? getJobCondition(job, suggestion, forecasts) : undefined

  return (
    <div className="rounded-xl border border-black/6 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <Link to={`/jobs/${job.id}`} className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <span className="mt-1 w-2 h-2 rounded-full flex-shrink-0" style={{ background: dot }} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-brand-dark leading-snug">{job.title}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                {job.customer && <p className="text-xs text-gray-400">{job.customer.name}</p>}
                {job.customer?.minutes_from_hq != null && (
                  <p className="text-xs text-gray-400">{job.customer.minutes_from_hq} min away</p>
                )}
                <p className="text-xs font-medium" style={{ color: dot }}>{STATUS_LABEL[job.status] ?? job.status}</p>
              </div>
              {warning !== 'none' && (
                <div
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md"
                  style={{
                    background: warning === 'danger' ? 'rgba(184,74,42,0.1)' : 'rgba(221,176,29,0.15)',
                    color:      warning === 'danger' ? '#B84A2A' : '#9a7c0a',
                  }}
                >
                  ⚠ {warning === 'danger'
                    ? (job.weather_req === 'dry_only' ? 'Dry only — unsuitable' : 'Rain forecast')
                    : 'Prefers dry — showers expected'}
                </div>
              )}
            </div>
          </div>
        </Link>

        {showAssign && (
          <button
            onClick={() => onToggleAssign(isAssigning ? null : job.id)}
            className="flex-shrink-0 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
            style={{ background: isAssigning ? '#0F3714' : 'rgba(151,181,69,0.15)', color: isAssigning ? '#fff' : '#3a6e0f' }}
          >
            {isAssigning ? 'Cancel' : 'Assign'}
          </button>
        )}
      </div>

      {/* Suggestion chip */}
      {suggestion && (
        <div className="mt-2.5 pt-2.5 border-t border-black/5 flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Best day</span>
          <button
            disabled={saving}
            onClick={() => onAssign(job, suggestion)}
            className="text-xs font-semibold px-2 py-0.5 rounded-md cursor-pointer transition-colors"
            style={{ background: 'rgba(151,181,69,0.15)', color: '#3a6e0f' }}
          >
            {suggestionCondition ? `${CONDITION_ICON[suggestionCondition]} ` : ''}{formatDate(suggestion)}
          </button>
        </div>
      )}

      {/* Day picker — always rendered, CSS-animated open/close */}
      {showAssign && (
        <div
          style={{
            maxHeight: isAssigning ? '400px' : '0',
            opacity: isAssigning ? 1 : 0,
            overflow: 'hidden',
            transition: isAssigning ? 'max-height 0.3s ease, opacity 0.2s ease' : 'none',
          }}
        >
          <div className="mt-3 pt-3 border-t border-black/5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Assign to:</p>
            <div className="flex flex-wrap gap-1.5">
              {days.map(date => {
                const fc = forecasts.find(f => f.date === date)
                const dayWarning = getWeatherWarning(job.weather_req, getJobCondition(job, date, forecasts))
                return (
                  <button
                    key={date}
                    disabled={saving}
                    onClick={() => onAssign(job, date)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    style={{
                      background: dayWarning === 'danger'  ? 'rgba(184,74,42,0.12)'
                                : dayWarning === 'caution' ? 'rgba(221,176,29,0.2)'
                                : isToday(date)            ? '#0F3714'
                                :                            'rgba(0,0,0,0.06)',
                      color:      dayWarning === 'danger'  ? '#B84A2A'
                                : dayWarning === 'caution' ? '#9a7c0a'
                                : isToday(date)            ? '#fff'
                                :                            '#444',
                    }}
                  >
                    {fc ? `${CONDITION_ICON[fc.condition]} ` : ''}{formatDate(date)}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Schedule() {
  const [weekStart, setWeekStart] = useState(currentMonday)
  const [schedule, setSchedule] = useState<ScheduleData | null>(null)
  const [forecasts, setForecasts] = useState<Forecast[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [assigningJobId, setAssigningJobId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchSchedule = useCallback((ws: string) => {
    setLoading(true); setError(false)
    api.get('/schedule', { params: { week_start: ws } })
      .then(r => setSchedule(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchSchedule(weekStart) }, [weekStart, fetchSchedule])
  useEffect(() => {
    api.get('/weather').then(r => setForecasts(r.data.forecasts ?? [])).catch(() => {})
  }, [])

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  async function assignJob(job: JobSummary, targetDate: string | null) {
    setSaving(true)
    try {
      const res = await api.patch(`/schedule/jobs/${job.id}/date`, { scheduled_date: targetDate })
      const updated: JobSummary = res.data
      setSchedule(prev => {
        if (!prev) return prev
        const all = [...prev.scheduled, ...prev.overdue, ...prev.unscheduled].map(j => j.id === updated.id ? updated : j)
        return {
          ...prev,
          scheduled:   all.filter(j => j.scheduled_date !== null && j.scheduled_date >= prev.week_start && j.scheduled_date <= prev.week_end),
          overdue:     all.filter(j => j.scheduled_date !== null && j.scheduled_date < prev.week_start && j.status !== 'complete'),
          unscheduled: all.filter(j => j.scheduled_date === null),
        }
      })
      setAssigningJobId(null)
    } catch {}
    setSaving(false)
  }

  const totalUnscheduled = (schedule?.unscheduled.length ?? 0) + (schedule?.overdue.length ?? 0)

  const cardProps = { days, assigningJobId, onToggleAssign: setAssigningJobId, saving, onAssign: assignJob, forecasts }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-brand-dark">Schedule</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStart(w => addDays(w, -7))} className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/5 hover:bg-black/10 font-bold text-brand-dark cursor-pointer">‹</button>
          <button onClick={() => setWeekStart(currentMonday())} className="px-3 h-8 text-xs font-semibold rounded-lg bg-black/5 hover:bg-black/10 text-brand-dark cursor-pointer">This week</button>
          <button onClick={() => setWeekStart(w => addDays(w, 7))} className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/5 hover:bg-black/10 font-bold text-brand-dark cursor-pointer">›</button>
        </div>
      </div>

      {loading && <div className="flex justify-center py-12"><Spinner className="w-6 h-6 text-brand-lime" /></div>}
      {error && <p className="text-center text-sm text-gray-400 py-12">Could not load schedule. Please try again.</p>}

      {!loading && !error && (
        <>
          {/* Unscheduled + overdue panel */}
          {totalUnscheduled > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-xs font-bold text-brand-dark/40 uppercase tracking-widest">Needs scheduling</h2>
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-black/8 text-brand-dark/50">{totalUnscheduled}</span>
              </div>

              {(schedule?.overdue.length ?? 0) > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#B84A2A' }}>Overdue</p>
                  <div className="flex flex-col gap-2">
                    {schedule!.overdue.map(job => (
                      <div key={job.id} className="rounded-xl border-2 border-red-100">
                        <JobCard job={job} showAssign showSuggest {...cardProps} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(schedule?.unscheduled.length ?? 0) > 0 && (
                <div className="flex flex-col gap-2">
                  {schedule!.unscheduled.map(job => <JobCard key={job.id} job={job} showAssign showSuggest {...cardProps} />)}
                </div>
              )}
            </div>
          )}

          {/* Week days */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-xs font-bold text-brand-dark/40 uppercase tracking-widest">
                Week of {new Date(weekStart + 'T12:00:00').toLocaleDateString('en-IE', { day: 'numeric', month: 'long' })}
              </h2>
            </div>

            <div className="flex flex-col gap-3">
              {days.map(date => {
                const jobs = schedule?.scheduled.filter(j => j.scheduled_date === date) ?? []
                const forecast = forecasts.find(f => f.date === date)
                const today = isToday(date)
                const past = isPast(date)

                return (
                  <div
                    key={date}
                    className="rounded-2xl border overflow-hidden"
                    style={{ borderColor: today ? '#97B545' : 'rgba(0,0,0,0.08)' }}
                  >
                    {/* Day header */}
                    <div
                      className="flex items-center justify-between px-4 py-3"
                      style={{ background: today ? '#0F3714' : past ? 'rgba(0,0,0,0.02)' : 'rgba(151,181,69,0.06)' }}
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-sm font-bold" style={{ color: today ? '#97B545' : past ? '#aaa' : '#0F3714' }}>
                            {formatDate(date)}
                          </p>
                          {jobs.length > 0 && (
                            <p className="text-[11px]" style={{ color: today ? 'rgba(255,255,255,0.5)' : '#999' }}>
                              {jobs.length} job{jobs.length !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      </div>
                      {forecast && (
                        <div className="text-right">
                          <p className="text-sm" style={{ color: today ? 'rgba(255,255,255,0.7)' : '#888' }}>
                            {CONDITION_ICON[forecast.condition]} {forecast.temp_max}°C
                            {forecast.precip_probability > 0 && ` · ${forecast.precip_probability}% rain`}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Jobs */}
                    {jobs.length > 0 ? (
                      <div className="p-3 flex flex-col gap-2">
                        {jobs.map(job => (
                          <div key={job.id} className="flex items-center gap-2">
                            <div className="flex-1">
                              <JobCard job={job} {...cardProps} />
                            </div>
                            <button
                              onClick={() => assignJob(job, null)}
                              className="flex-shrink-0 text-xs text-gray-400 hover:text-red-400 transition-colors cursor-pointer px-1"
                              title="Unschedule"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="px-4 py-3 text-xs text-gray-300">No jobs</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {totalUnscheduled === 0 && schedule?.scheduled.length === 0 && (
            <div className="text-center py-10">
              <p className="text-sm text-gray-400">No jobs to schedule.</p>
              <Link to="/jobs/new" className="inline-block mt-2 text-xs font-semibold text-brand-lime hover:underline">+ Add a job</Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
