import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../../test/mocks/server'
import Schedule from '../../pages/Schedule'
import { renderSimple } from '../../test/renderWithProviders'
import { mockScheduledJob } from '../../test/mocks/data'

// Fix time to Monday 2 Jun 2026 so week dates are deterministic
const FIXED_NOW = new Date('2026-06-02T10:00:00')

function renderSchedule() {
  return renderSimple(<Schedule />)
}

// ── Display ───────────────────────────────────────────────────────────────

describe('Schedule — display', () => {
  beforeAll(() => vi.setSystemTime(FIXED_NOW))
  afterAll(() => vi.useRealTimers())

  it('renders the Schedule heading', async () => {
    renderSchedule()
    expect(await screen.findByRole('heading', { name: /schedule/i })).toBeInTheDocument()
  })

  it('shows the week range', async () => {
    renderSchedule()
    expect(await screen.findByText(/Jun 2026/)).toBeInTheDocument()
  })

  it('renders 7 day slots', async () => {
    renderSchedule()
    // Wait for data to load — day slots are inside {!loading && !error && ...}
    await screen.findByText("Lawn Care - O'Brien")
    // FIXED_NOW is Tue 2 Jun, so weekStart = Mon 1 Jun, weekEnd = Sun 7 Jun
    expect(document.querySelector('[data-date="2026-06-01"]')).toBeInTheDocument()
    expect(document.querySelector('[data-date="2026-06-07"]')).toBeInTheDocument()
  })

  it('shows a scheduled job in the week calendar', async () => {
    renderSchedule()
    expect(await screen.findByText("Lawn Care - O'Brien")).toBeInTheDocument()
  })

  it('shows unscheduled jobs in the Needs scheduling section', async () => {
    renderSchedule()
    expect(await screen.findByText('Hedge Trim - Murphy')).toBeInTheDocument()
    expect(screen.getByText(/needs scheduling/i)).toBeInTheDocument()
  })
})

// ── Assigning a date via Assign button ────────────────────────────────────

describe('Schedule — assigning a date', () => {
  beforeAll(() => vi.setSystemTime(FIXED_NOW))
  afterAll(() => vi.useRealTimers())

  it('expands day picker when Assign is clicked', async () => {
    const user = userEvent.setup()
    renderSchedule()
    const assignBtn = await screen.findByRole('button', { name: 'Assign' })
    await user.click(assignBtn)
    expect(await screen.findByText(/assign to:/i)).toBeInTheDocument()
  })

  it('collapses day picker when Cancel is clicked', async () => {
    const user = userEvent.setup()
    renderSchedule()
    const assignBtn = await screen.findByRole('button', { name: 'Assign' })
    await user.click(assignBtn)
    await screen.findByText(/assign to:/i)
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() => {
      expect(screen.queryByText(/assign to:/i)).not.toBeVisible()
    })
  })

  it('removes job from Needs Scheduling after a date is assigned', async () => {
    const user = userEvent.setup()
    renderSchedule()

    const assignBtn = await screen.findByRole('button', { name: 'Assign' })
    await user.click(assignBtn)

    // Pick the first day button in the picker (any day in the week)
    const dayButtons = await screen.findAllByRole('button', { name: /Jun/i })
    await user.click(dayButtons[0])

    await waitFor(() => {
      // Job now only appears once — in the day slot, not also in Needs Scheduling
      const instances = screen.getAllByText('Hedge Trim - Murphy')
      expect(instances).toHaveLength(1)
    })
  })

  it('shows Scheduled status (not Backlog) after a date is assigned', async () => {
    const user = userEvent.setup()
    renderSchedule()

    const assignBtn = await screen.findByRole('button', { name: 'Assign' })
    await user.click(assignBtn)

    const dayButtons = await screen.findAllByRole('button', { name: /Jun/i })
    await user.click(dayButtons[0])

    // After assignment, the job's status changes from Backlog → Scheduled
    // (Both jobs now show "Scheduled" — assert "Backlog" is gone)
    await waitFor(() => {
      expect(screen.queryByText('Backlog')).not.toBeInTheDocument()
    })
  })
})

// ── Unscheduling via × button ─────────────────────────────────────────────

describe('Schedule — unscheduling', () => {
  beforeAll(() => vi.setSystemTime(FIXED_NOW))
  afterAll(() => vi.useRealTimers())

  it('moves job to Needs Scheduling when × is clicked', async () => {
    server.use(
      http.patch('/api/schedule/jobs/11/date', () =>
        HttpResponse.json({ ...mockScheduledJob, scheduled_date: null, status: 'backlog' })
      )
    )

    const user = userEvent.setup()
    renderSchedule()

    await screen.findByText("Lawn Care - O'Brien")

    const unscheduleBtn = screen.getByTitle(/unschedule/i)
    await user.click(unscheduleBtn)

    await waitFor(() => {
      expect(screen.getByText(/needs scheduling/i)).toBeInTheDocument()
    })
  })

  it('removes job from day slot when × is clicked', async () => {
    server.use(
      http.patch('/api/schedule/jobs/11/date', () =>
        HttpResponse.json({ ...mockScheduledJob, scheduled_date: null, status: 'backlog' })
      )
    )

    const user = userEvent.setup()
    renderSchedule()

    await screen.findByText("Lawn Care - O'Brien")

    const mondaySlot = document.querySelector('[data-date="2026-06-03"]')!
    expect(mondaySlot).toBeInTheDocument()

    const unscheduleBtn = screen.getByTitle(/unschedule/i)
    await user.click(unscheduleBtn)

    await waitFor(() => {
      // Day slot for Jun 3 should now show "No jobs"
      expect(mondaySlot.textContent).toContain('No jobs')
    })
  })
})

// ── Week navigation ───────────────────────────────────────────────────────

describe('Schedule — week navigation', () => {
  beforeAll(() => vi.setSystemTime(FIXED_NOW))
  afterAll(() => vi.useRealTimers())

  it('does not show "This week" button when on current week', async () => {
    renderSchedule()
    await screen.findByText(/Jun 2026/)
    expect(screen.queryByRole('button', { name: /this week/i })).not.toBeInTheDocument()
  })

  it('shows "This week" button after navigating to next week', async () => {
    const user = userEvent.setup()
    renderSchedule()
    await screen.findByText(/Jun 2026/)
    const nextBtn = screen.getByRole('button', { name: '›' })
    await user.click(nextBtn)
    expect(await screen.findByRole('button', { name: /this week/i })).toBeInTheDocument()
  })

  it('"This week" button returns to current week', async () => {
    const user = userEvent.setup()
    renderSchedule()
    await screen.findByText(/Jun 2026/)
    const nextBtn = screen.getByRole('button', { name: '›' })
    await user.click(nextBtn)
    const thisWeekBtn = await screen.findByRole('button', { name: /this week/i })
    await user.click(thisWeekBtn)
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /this week/i })).not.toBeInTheDocument()
    })
  })
})
