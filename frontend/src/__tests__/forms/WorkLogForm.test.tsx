import { describe, it, expect } from 'vitest'
import { screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import WorkLogForm from '../../pages/jobs/WorkLogForm'
import { renderAt } from '../../test/renderWithProviders'
import { server } from '../../test/mocks/server'
import { mockWorkLog } from '../../test/mocks/data'

// ── Helpers ───────────────────────────────────────────────────────────────

function renderAddForm(jobId = '1') {
  return renderAt(<WorkLogForm />, {
    path: '/jobs/:id/logs/new',
    at: `/jobs/${jobId}/logs/new`,
  })
}

function renderEditForm(jobId = '1', logId = '1') {
  return renderAt(<WorkLogForm />, {
    path: '/jobs/:id/logs/:logId/edit',
    at: `/jobs/${jobId}/logs/${logId}/edit`,
  })
}

// ── Add mode ──────────────────────────────────────────────────────────────

describe('WorkLogForm — Add mode', () => {

  it('renders heading "Add Work Log"', async () => {
    renderAddForm()
    expect(await screen.findByText('Add Work Log')).toBeInTheDocument()
  })

  it('pre-fills date with today', async () => {
    renderAddForm()
    const today = new Date().toISOString().substring(0, 10)
    const dateInput = await screen.findByDisplayValue(today)
    expect(dateInput).toBeInTheDocument()
  })

  it('loads employee list into dropdown', async () => {
    renderAddForm()
    const selects = await screen.findAllByRole('combobox')
    const empSelect = selects[0]
    expect(within(empSelect).getByText('Jasper Lennon')).toBeInTheDocument()
    expect(within(empSelect).getByText('Tobias Lennon')).toBeInTheDocument()
  })

  // ── Validation: Date ──────────────────────────────────────────────────

  it('blocks save with no date and shows error text', async () => {
    const user = userEvent.setup()
    renderAddForm()
    // Clear the pre-filled date
    const dateInput = await screen.findByDisplayValue(new Date().toISOString().substring(0, 10))
    await user.clear(dateInput)
    await user.click(screen.getByRole('button', { name: /save work log/i }))
    expect(await screen.findByText('Date is required')).toBeInTheDocument()
  })

  it('applies field-error class to date input when missing', async () => {
    const user = userEvent.setup()
    renderAddForm()
    const dateInput = await screen.findByDisplayValue(new Date().toISOString().substring(0, 10))
    await user.clear(dateInput)
    await user.click(screen.getByRole('button', { name: /save work log/i }))
    await screen.findByText('Date is required')
    expect(dateInput).toHaveClass('field-error')
  })

  // ── Validation: Employee ──────────────────────────────────────────────

  it('blocks save with no employee selected', async () => {
    const user = userEvent.setup()
    renderAddForm()
    await screen.findByText('Add Work Log')
    await user.click(screen.getByRole('button', { name: /save work log/i }))
    expect(await screen.findByText('Select an employee')).toBeInTheDocument()
  })

  // ── Validation: Start time ────────────────────────────────────────────

  it('blocks save with no start time and shows error', async () => {
    const user = userEvent.setup()
    renderAddForm()
    await screen.findByText('Add Work Log')
    // Select employee, then clear the pre-filled start time
    const sel = await screen.findByRole('combobox')
    await user.selectOptions(sel, '1')
    const [startInput] = document.querySelectorAll('input[type="time"]')
    fireEvent.change(startInput, { target: { value: '' } })
    await user.click(screen.getByRole('button', { name: /save work log/i }))
    expect(await screen.findByText('Start time is required')).toBeInTheDocument()
  })

  it('applies field-error class to the start time input when missing', async () => {
    const user = userEvent.setup()
    renderAddForm()
    await screen.findByText('Add Work Log')
    const sel = await screen.findByRole('combobox')
    await user.selectOptions(sel, '1')
    const [startInput] = document.querySelectorAll('input[type="time"]')
    fireEvent.change(startInput, { target: { value: '' } })
    await user.click(screen.getByRole('button', { name: /save work log/i }))
    await screen.findByText('Start time is required')
    expect(document.querySelectorAll('input[type="time"]')[0]).toHaveClass('field-error')
  })

  // ── Validation: Hours when end time is set ────────────────────────────

  it('blocks save when end time set but billable hours is zero', async () => {
    const user = userEvent.setup()
    renderAddForm()
    const sel = await screen.findByRole('combobox')
    await user.selectOptions(sel, '1')
    // Set start time
    const [startInput, endInput] = document.querySelectorAll('input[type="time"]')
    fireEvent.change(startInput, { target: { value: '09:00' } })
    // Set end time (same as start — would produce 0 hours after rounding)
    fireEvent.change(endInput, { target: { value: '09:00' } })
    // billable_hours auto-calculates to '0'; find it by its placeholder (always '0')
    const hoursInput = screen.getByPlaceholderText('0') as HTMLInputElement
    await user.clear(hoursInput)
    await user.click(screen.getByRole('button', { name: /save work log/i }))
    expect(await screen.findByText('Enter hours worked')).toBeInTheDocument()
  })

  // ── Time button behaviour ─────────────────────────────────────────────

  it('end time is empty by default on new log', async () => {
    renderAddForm()
    await screen.findByText('Add Work Log')
    const [, endTimeInput] = document.querySelectorAll('input[type="time"]')
    expect((endTimeInput as HTMLInputElement).value).toBe('')
  })

  it('clicking + on empty end time sets it to a valid time (the default)', async () => {
    const user = userEvent.setup()
    renderAddForm()
    await screen.findByText('Add Work Log')
    const [, endTimeInput] = document.querySelectorAll('input[type="time"]')
    expect((endTimeInput as HTMLInputElement).value).toBe('')
    const plusButtons = screen.getAllByRole('button', { name: '+' })
    await user.click(plusButtons[1])
    expect((endTimeInput as HTMLInputElement).value).toMatch(/^\d{2}:\d{2}$/)
  })

  it('clicking − on empty end time sets it to a valid time (the default)', async () => {
    const user = userEvent.setup()
    renderAddForm()
    await screen.findByText('Add Work Log')
    const [, endTimeInput] = document.querySelectorAll('input[type="time"]')
    expect((endTimeInput as HTMLInputElement).value).toBe('')
    const minusButtons = screen.getAllByRole('button', { name: '−' })
    await user.click(minusButtons[1])
    expect((endTimeInput as HTMLInputElement).value).toMatch(/^\d{2}:\d{2}$/)
  })

  it('increments end time by 15 min when already set', async () => {
    const user = userEvent.setup()
    renderAddForm()
    await screen.findByText('Add Work Log')
    const [, endTimeInput] = document.querySelectorAll('input[type="time"]')
    fireEvent.change(endTimeInput, { target: { value: '09:00' } })
    const plusButtons = screen.getAllByRole('button', { name: '+' })
    await user.click(plusButtons[1])
    expect((endTimeInput as HTMLInputElement).value).toBe('09:15')
  })

  // ── Surcharge flags ───────────────────────────────────────────────────

  it('renders waste disposal toggle at day level', async () => {
    renderAddForm()
    expect(await screen.findByRole('button', { name: /waste disposal/i })).toBeInTheDocument()
  })

  it('waste disposal toggle is inactive by default', async () => {
    renderAddForm()
    const btn = await screen.findByRole('button', { name: /waste disposal/i })
    expect(btn).toHaveAttribute('aria-pressed', 'false')
  })

  it('renders power tools toggle per entry', async () => {
    renderAddForm()
    expect(await screen.findByRole('button', { name: /power tools/i })).toBeInTheDocument()
  })

  it('power tools toggle is inactive by default', async () => {
    renderAddForm()
    const btn = await screen.findByRole('button', { name: /power tools/i })
    expect(btn).toHaveAttribute('aria-pressed', 'false')
  })

  it('includes has_waste_disposal in submitted payload', async () => {
    const user = userEvent.setup()
    let captured: unknown

    server.use(
      http.post('/api/jobs/1/logs', async ({ request }) => {
        captured = await request.json()
        return HttpResponse.json({ ...mockWorkLog, id: 99 }, { status: 201 })
      })
    )

    renderAddForm()
    const sel = await screen.findByRole('combobox')
    await user.selectOptions(sel, '1')
    fireEvent.change(document.querySelectorAll('input[type="time"]')[0], { target: { value: '09:00' } })
    await user.click(await screen.findByRole('button', { name: /waste disposal/i }))
    await user.click(screen.getByRole('button', { name: /save work log/i }))

    await waitFor(() => {
      expect(captured).toMatchObject({ has_waste_disposal: true })
    })
  })

  it('includes has_power_tools per entry in submitted payload', async () => {
    const user = userEvent.setup()
    let captured: unknown

    server.use(
      http.post('/api/jobs/1/logs', async ({ request }) => {
        captured = await request.json()
        return HttpResponse.json({ ...mockWorkLog, id: 99 }, { status: 201 })
      })
    )

    renderAddForm()
    const sel = await screen.findByRole('combobox')
    await user.selectOptions(sel, '1')
    fireEvent.change(document.querySelectorAll('input[type="time"]')[0], { target: { value: '09:00' } })
    await user.click(await screen.findByRole('button', { name: /power tools/i }))
    await user.click(screen.getByRole('button', { name: /save work log/i }))

    await waitFor(() => {
      expect(captured).toMatchObject({
        entries: expect.arrayContaining([
          expect.objectContaining({ has_power_tools: true })
        ])
      })
    })
  })

  // ── Materials ─────────────────────────────────────────────────────────

  it('shows materials section with Add material button', async () => {
    renderAddForm()
    expect(await screen.findByRole('button', { name: /add material/i })).toBeInTheDocument()
  })

  it('adds a material row when + Add material is clicked', async () => {
    const user = userEvent.setup()
    renderAddForm()
    await user.click(await screen.findByRole('button', { name: /add material/i }))
    expect(screen.getByText('Material 1')).toBeInTheDocument()
  })

  it('removes a material row when Remove is clicked', async () => {
    const user = userEvent.setup()
    renderAddForm()
    await user.click(await screen.findByRole('button', { name: /add material/i }))
    expect(screen.getByText('Material 1')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /remove/i }))
    expect(screen.queryByText('Material 1')).not.toBeInTheDocument()
  })

  it('validates material description required', async () => {
    const user = userEvent.setup()
    renderAddForm()
    await user.click(await screen.findByRole('button', { name: /add material/i }))
    // Fill cost_paid — both money inputs share placeholder 0.00, take the first
    const [costInput] = screen.getAllByPlaceholderText('0.00')
    await user.type(costInput, '10')
    await user.click(screen.getByRole('button', { name: /save work log/i }))
    expect(await screen.findByText('Description required')).toBeInTheDocument()
  })

  // ── Price formatting ──────────────────────────────────────────────────

  // TODO: React 19 + jsdom does not reliably fire onBlur via user.tab(), element.blur(),
  // fireEvent.blur(), or fireEvent.focusOut(). The formatting feature works correctly in
  // the real browser. Revisit when @testing-library/react or jsdom improve React 19 blur support.
  it.todo('formats cost_paid to 2 decimal places on blur')
  it.todo('formats amount_charged to 2 decimal places on blur')

  // ── Notes ─────────────────────────────────────────────────────────────

  it('shows Notes textarea at bottom of form', async () => {
    renderAddForm()
    await screen.findByText('Add Work Log')
    const textarea = screen.getByPlaceholderText(/any notes about this visit/i)
    expect(textarea).toBeInTheDocument()
  })

  // ── Successful submission ─────────────────────────────────────────────

  it('submits correct payload and navigates on success', async () => {
    const user = userEvent.setup()
    let captured: unknown

    server.use(
      http.post('/api/jobs/1/logs', async ({ request }) => {
        captured = await request.json()
        return HttpResponse.json({ ...mockWorkLog, id: 99 }, { status: 201 })
      })
    )

    renderAddForm()
    // Select employee
    const sel = await screen.findByRole('combobox')
    await user.selectOptions(sel, '1')
    // Set start time
    fireEvent.change(document.querySelectorAll('input[type="time"]')[0], { target: { value: '09:00' } })

    await user.click(screen.getByRole('button', { name: /save work log/i }))

    await waitFor(() => {
      expect(captured).toMatchObject({
        entries: expect.arrayContaining([
          expect.objectContaining({ employee_id: 1, start_time: '09:00' })
        ])
      })
    })
  })

})

// ── Edit mode ─────────────────────────────────────────────────────────────

describe('WorkLogForm — Edit mode', () => {

  it('renders heading "Edit Work Log"', async () => {
    renderEditForm()
    expect(await screen.findByText('Edit Work Log')).toBeInTheDocument()
  })

  it('loads existing date into the date input', async () => {
    renderEditForm()
    const dateInput = await screen.findByDisplayValue('2026-04-12')
    expect(dateInput).toBeInTheDocument()
  })

  it('loads existing notes', async () => {
    renderEditForm()
    const textarea = await screen.findByDisplayValue('Cleared the back garden')
    expect(textarea).toBeInTheDocument()
  })

  it('loads existing start and end times (trimmed to HH:mm)', async () => {
    renderEditForm()
    await screen.findByText('Edit Work Log')
    await waitFor(() => {
      const [startInput, endInput] = document.querySelectorAll('input[type="time"]')
      expect((startInput as HTMLInputElement).value).toBe('09:00')
      expect((endInput as HTMLInputElement).value).toBe('13:00')
    })
  })

  it('loads existing materials', async () => {
    renderEditForm()
    expect(await screen.findByDisplayValue('Bark mulch')).toBeInTheDocument()
  })

  it('shows material cost and charged values from existing data', async () => {
    renderEditForm()
    await screen.findByDisplayValue('Bark mulch')
    expect(screen.getByDisplayValue('15')).toBeInTheDocument()  // cost_paid
    expect(screen.getByDisplayValue('25')).toBeInTheDocument()  // amount_charged
  })

  it('loads has_waste_disposal from existing log', async () => {
    renderEditForm()
    await screen.findByText('Edit Work Log')
    const btn = await screen.findByRole('button', { name: /waste disposal/i })
    // mockWorkLog.has_waste_disposal is false
    expect(btn).toHaveAttribute('aria-pressed', 'false')
  })

  it('employee dropdown is enabled in edit mode', async () => {
    renderEditForm()
    await screen.findByText('Edit Work Log')
    await waitFor(() => {
      const sel = screen.getByRole('combobox')
      expect(sel).not.toBeDisabled()
    })
  })

  it('sends PATCH to log and entries on save', async () => {
    const user = userEvent.setup()
    const calls: string[] = []

    server.use(
      http.patch('/api/jobs/1/logs/1', () => { calls.push('log'); return HttpResponse.json(mockWorkLog) }),
      http.patch('/api/logs/1/entries/1', () => { calls.push('entry'); return HttpResponse.json(mockWorkLog.entries[0]) }),
    )

    renderEditForm()
    await screen.findByText('Edit Work Log')
    await user.click(await screen.findByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(calls).toContain('log')
      expect(calls).toContain('entry')
    })
  })

  it('marks existing material as deleted when Remove clicked and sends DELETE on save', async () => {
    const user = userEvent.setup()
    let deleteHit = false

    server.use(
      http.delete('/api/logs/1/materials/1', () => { deleteHit = true; return new HttpResponse(null, { status: 204 }) }),
    )

    renderEditForm()
    await screen.findByDisplayValue('Bark mulch')
    await user.click(screen.getByRole('button', { name: /remove/i }))
    // Material card should disappear from UI
    expect(screen.queryByDisplayValue('Bark mulch')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(deleteHit).toBe(true))
  })

})
