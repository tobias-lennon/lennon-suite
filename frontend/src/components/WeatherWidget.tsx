import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'

interface HourDetail {
  hour: string
  prob: number
  precip_mm: number
  condition: 'dry' | 'shower' | 'rain'
}

interface DayForecast {
  date: string
  day: string
  condition: 'dry' | 'shower' | 'rain'
  temp_max: number
  temp_min: number
  precip_probability: number
  precip_mm: number
  hourly: HourDetail[]
}

interface WeatherData {
  location: string
  forecasts: DayForecast[]
}

interface WeatherWidgetProps {
  days?: number
  data?: WeatherData | null
  compact?: boolean
}

function ConditionIcon({ condition, size = 'md' }: { condition: string; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5'
  if (condition === 'dry') return (
    <svg viewBox="0 0 24 24" className={cls} fill="currentColor">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  )
  if (condition === 'shower') return (
    <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M20 17.58A5 5 0 0018 8h-1.26A8 8 0 104 15.25" />
      <line x1="10" y1="16" x2="10" y2="19" />
      <line x1="14" y1="16" x2="14" y2="19" />
    </svg>
  )
  if (condition === 'rain') return (
    <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M20 17.58A5 5 0 0018 8h-1.26A8 8 0 104 15.25" />
      <line x1="8" y1="16" x2="8" y2="19" /><line x1="12" y1="16" x2="12" y2="21" /><line x1="16" y1="16" x2="16" y2="19" />
    </svg>
  )
  return (
    <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" />
    </svg>
  )
}

const CONDITION_STYLES: Record<string, { bg: string; text: string; sub: string }> = {
  dry:    { bg: 'rgba(151,181,69,0.12)', text: '#3a6e0f', sub: '#6a9a2a' },
  shower: { bg: 'rgba(221,176,29,0.13)', text: '#7a5c00', sub: '#a07800' },
  rain:   { bg: 'rgba(185,74,42,0.10)', text: '#8a2a0a', sub: '#c04010' },
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().slice(0, 10)
}

export default function WeatherWidget({ days, data: externalData, compact = false }: WeatherWidgetProps) {
  const [data, setData]       = useState<WeatherData | null>(externalData ?? null)
  const [loading, setLoading] = useState(!externalData)
  const [error, setError]     = useState<string | null>(null)

  // expanded: which card is "open" (drives the panel visibility animation)
  // displayed: what content is in the panel (lags during close so content stays visible while animating out)
  const [expanded,  setExpanded]  = useState<string | null>(null)
  const [displayed, setDisplayed] = useState<string | null>(null)

  useEffect(() => {
    if (externalData !== undefined) return
    api.get('/weather')
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error ?? 'Weather unavailable'))
      .finally(() => setLoading(false))
  }, [externalData])

  const forecasts = (data?.forecasts ?? []).slice(0, days ?? 7)

  function toggle(date: string) {
    if (expanded === date) {
      // Close: panel animates out. Keep `displayed` so content is visible during the slide.
      setExpanded(null)
    } else {
      // Open or switch: swap content immediately, then open (or keep open).
      setDisplayed(date)
      setExpanded(date)
    }
  }

  const displayedForecast = forecasts.find(f => f.date === displayed) ?? null
  const panelStyles = displayedForecast
    ? (CONDITION_STYLES[displayedForecast.condition] ?? CONDITION_STYLES.shower)
    : null

  if (loading) return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {Array.from({ length: days ?? 7 }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-16 h-20 rounded-xl bg-black/5 animate-pulse" />
      ))}
    </div>
  )

  if (error) return (
    <div className="rounded-xl bg-black/3 border border-black/6 px-4 py-3 flex items-center justify-between gap-3">
      <p className="text-xs text-gray-400">Weather unavailable — HQ location not set.</p>
      <Link to="/settings" className="text-xs font-semibold text-brand-lime whitespace-nowrap hover:underline">Set up</Link>
    </div>
  )

  return (
    <div>
      {!compact && data?.location && (
        <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-dark/35 mb-2">
          {data.location} · 7-Day Forecast
        </p>
      )}

      {/* Day strip */}
      <div className="flex gap-2.5 overflow-x-auto md:overflow-visible pb-1 -mx-0.5 px-0.5">
        {forecasts.map(f => {
          const today  = isToday(f.date)
          const isOpen = expanded === f.date
          const cStyles = CONDITION_STYLES[f.condition] ?? CONDITION_STYLES.shower

          return (
            <button
              key={f.date}
              onClick={() => toggle(f.date)}
              className="flex-shrink-0 md:flex-1 md:min-w-0 flex flex-col items-center rounded-xl px-2.5 py-3 min-w-[66px] transition-all cursor-pointer"
              style={{
                background: isOpen ? cStyles.bg : 'rgba(0,0,0,0.03)',
                border:     isOpen ? `1.5px solid ${cStyles.sub}55` : '1.5px solid transparent',
              }}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-wide"
                style={{ color: today ? '#333' : '#999' }}
              >
                {today ? 'Today' : f.day}
              </p>
              <span className="my-1.5" style={{ color: cStyles.sub }}>
                <ConditionIcon condition={f.condition} />
              </span>
              <p
                className="text-[11px] font-bold leading-none"
                style={{ color: today ? '#222' : '#444' }}
              >
                {f.temp_max}°
              </p>
              <p className="text-[10px] leading-none mt-0.5" style={{ color: '#aaa' }}>
                {f.temp_min}°
              </p>
              <div className="mt-1.5" style={{ minHeight: '14px' }}>
                {f.precip_probability > 0 ? (
                  <p className="text-[9px] font-bold leading-none" style={{ color: cStyles.sub }}>
                    {f.precip_probability}%
                  </p>
                ) : null}
              </div>
            </button>
          )
        })}
      </div>

      {/* Single detail panel — one panel, content swaps instantly when switching days */}
      <div
        style={{
          maxHeight:  expanded ? '600px' : '0',
          opacity:    expanded ? 1 : 0,
          overflow:   'hidden',
          marginTop:  expanded ? '12px' : '0',
          transition: 'max-height 0.3s ease, opacity 0.22s ease, margin-top 0.3s ease',
        }}
      >
        {displayedForecast && panelStyles && (
          <div
            className="rounded-xl p-3 border"
            style={{ background: panelStyles.bg, borderColor: `${panelStyles.sub}33` }}
          >
            {/* Summary header */}
            <p className="text-xs font-bold mb-2.5" style={{ color: panelStyles.text }}>
              {new Date(displayedForecast.date + 'T12:00:00').toLocaleDateString('en-IE', {
                weekday: 'long', day: 'numeric', month: 'short',
              })}
              {' · '}{displayedForecast.temp_min}–{displayedForecast.temp_max}°C
            </p>

            {/* Hourly breakdown */}
            {displayedForecast.hourly.length === 0 ? (
              <p className="text-xs" style={{ color: panelStyles.sub }}>No hourly data available.</p>
            ) : (
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                {displayedForecast.hourly.map(h => {
                  const hStyles = CONDITION_STYLES[h.condition] ?? CONDITION_STYLES.shower
                  const isWet   = h.condition !== 'dry'
                  const hasMm   = h.precip_mm >= 0.1
                  const hasProb = h.prob >= 5
                  return (
                    <div
                      key={h.hour}
                      className="flex flex-col items-center justify-center gap-1 rounded-lg py-2 px-1"
                      style={{
                        width:      '58px',
                        minHeight:  '64px',
                        background: isWet ? hStyles.bg : panelStyles.bg,
                        border:     `1px solid ${isWet ? 'transparent' : panelStyles.sub + '30'}`,
                        color:      isWet ? hStyles.text : panelStyles.text,
                      }}
                    >
                      <ConditionIcon condition={h.condition} size="sm" />
                      <span className="font-bold text-[11px]">{h.hour.slice(0, 5)}</span>
                      {hasMm && (
                        <span className="text-[10px] leading-none" style={{ color: isWet ? hStyles.sub : '#aaa' }}>
                          {h.precip_mm}mm
                        </span>
                      )}
                      {hasProb && (
                        <span className="text-[10px] leading-none" style={{ color: isWet ? hStyles.sub : panelStyles.sub }}>
                          {h.prob}%
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
