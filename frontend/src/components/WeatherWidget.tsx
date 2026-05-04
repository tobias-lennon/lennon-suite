import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'

interface HourDetail {
  hour: string
  prob: number
  precip_mm: number
  condition: string
}

interface DayForecast {
  date: string
  day: string
  condition: string
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

  if (condition === 'sunny') return (
    <svg viewBox="0 0 24 24" className={cls} fill="currentColor">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5.64 5.64l1.77 1.77M16.59 16.59l1.77 1.77M5.64 18.36l1.77-1.77M16.59 7.41l1.77-1.77"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  )

  if (condition === 'partly-cloudy') return (
    <svg viewBox="0 0 24 24" className={cls} fill="currentColor">
      <circle cx="9" cy="8" r="3" />
      <path d="M9 3v1.5M9 10.5V12M3 8h1.5M10.5 8H12M5.4 4.9l1.1 1.1M11.5 11l1.1 1.1M5.4 11.1l1.1-1.1M11.5 5l1.1-1.1"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M17 21H8a4 4 0 0 1-.9-7.9 5 5 0 0 1 9.7-.5A3 3 0 0 1 17 21z" />
    </svg>
  )

  if (condition === 'cloudy') return (
    <svg viewBox="0 0 24 24" className={cls} fill="currentColor">
      <path d="M19 18H6a5 5 0 0 1-.7-9.9A7 7 0 0 1 19 10a5 5 0 0 1 0 8z" />
    </svg>
  )

  if (condition === 'fog') return (
    <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 7h18M3 11h16M3 15h12M3 19h8" />
    </svg>
  )

  if (condition === 'drizzle') return (
    <svg viewBox="0 0 24 24" className={cls} fill="currentColor">
      <path d="M17 15H8a4 4 0 0 1-.6-7.9A6 6 0 0 1 17 9a4 4 0 0 1 0 6z" />
      <path d="M9 18l-1 4M15 18l-1 4"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  )

  if (condition === 'shower') return (
    <svg viewBox="0 0 24 24" className={cls} fill="currentColor">
      <circle cx="18.5" cy="6" r="2.5" />
      <path d="M18.5 1.5V3M18.5 9v1.5M13.5 6H15M20.5 6H22M15.3 3.3l1.1 1.1M20.7 8.7l1.1 1.1M15.3 8.7l1.1-1.1M20.7 3.3l1.1-1.1"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M15 17H6a4 4 0 0 1-.9-7.9A5 5 0 0 1 14.7 9h.3a3 3 0 0 1 0 8z" />
      <path d="M7 19l-1 4M11 19l-1 4M15 19l-1 4"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  )

  if (condition === 'rain') return (
    <svg viewBox="0 0 24 24" className={cls} fill="currentColor">
      <path d="M19 15H6a5 5 0 0 1-.7-9.9A7 7 0 0 1 19 7a5 5 0 0 1 0 8z" />
      <path d="M6 18l-1.5 5M10 18l-1.5 5M14 18l-1.5 5M18 18l-1.5 5"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  )

  if (condition === 'thunder') return (
    <svg viewBox="0 0 24 24" className={cls} fill="currentColor">
      <path d="M19 13H6a5 5 0 0 1-.7-9.9A7 7 0 0 1 19 5a5 5 0 0 1 0 8z" />
      <path d="M13 13l-3 5h5l-3 5"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )

  if (condition === 'snow') return (
    <svg viewBox="0 0 24 24" className={cls} fill="currentColor">
      <path d="M19 15H6a5 5 0 0 1-.7-9.9A7 7 0 0 1 19 7a5 5 0 0 1 0 8z" />
      <circle cx="7" cy="20" r="1.5" />
      <circle cx="12" cy="22" r="1.5" />
      <circle cx="17" cy="20" r="1.5" />
    </svg>
  )

  // fallback — plain cloud
  return (
    <svg viewBox="0 0 24 24" className={cls} fill="currentColor">
      <path d="M19 18H6a5 5 0 0 1-.7-9.9A7 7 0 0 1 19 10a5 5 0 0 1 0 8z" />
    </svg>
  )
}

const CONDITION_STYLES: Record<string, { bg: string; text: string; sub: string }> = {
  sunny:          { bg: 'rgba(255,200,50,0.15)',  text: '#7a5c00', sub: '#c49000' },
  'partly-cloudy':{ bg: 'rgba(151,181,69,0.13)',  text: '#3a6e0f', sub: '#5a9a20' },
  cloudy:         { bg: 'rgba(0,0,0,0.05)',        text: '#555',    sub: '#777'    },
  fog:            { bg: 'rgba(160,170,190,0.15)',  text: '#555',    sub: '#7a8a9a' },
  drizzle:        { bg: 'rgba(100,160,220,0.15)',  text: '#1a4a7a', sub: '#3070bb' },
  shower:         { bg: 'rgba(221,176,29,0.15)',   text: '#7a5c00', sub: '#a07800' },
  rain:           { bg: 'rgba(185,74,42,0.12)',    text: '#8a2a0a', sub: '#c04010' },
  thunder:        { bg: 'rgba(80,40,130,0.13)',    text: '#4a2070', sub: '#7040b0' },
  snow:           { bg: 'rgba(190,215,240,0.22)',  text: '#1a4060', sub: '#3068a0' },
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
