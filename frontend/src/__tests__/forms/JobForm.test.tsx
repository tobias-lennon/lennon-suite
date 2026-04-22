import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import JobForm from '../../pages/jobs/JobForm'
import { renderAt } from '../../test/renderWithProviders'
import { server } from '../../test/mocks/server'
import { mockJob } from '../../test/mocks/data'

function renderAddForm() {
  return renderAt(<JobForm />, { path: '/jobs/new', at: '/jobs/new' })
}

function renderEditForm(id = '1') {
  return renderAt(<JobForm />, { path: '/jobs/:id/edit', at: `/jobs/${id}/edit` })
}

// ── Add mode ──────────────────────────────────────────────────────────────

describe('JobForm — Add mode', () => {

  it('renders heading "New Job"', async () => {
    renderAddForm()
    expect(await screen.findByText('New Job')).toBeInTheDocument()
  })

  it('shows customer search for standard type', async () => {
    renderAddForm()
    expect(await screen.findByPlaceholderText(/search by name/i)).toBeInTheDocument()
  })

  it('hides customer search when type is Internal', async () => {
    const user = userEvent.setup()
    renderAddForm()
    const typeSelect = await screen.findByDisplayValue('Standard')
    await user.selectOptions(typeSelect, 'internal')
    expect(screen.queryByPlaceholderText(/search by name/i)).not.toBeInTheDocument()
  })

  it('requires customer for standard job — shows error on submit', async () => {
    const user = userEvent.setup()
    renderAddForm()
    const titleInput = await screen.findByPlaceholderText(/hedge trim/i)
    await user.type(titleInput, 'Test job')
    await user.click(screen.getByRole('button', { name: /create job/i }))
    expect(await screen.findByText('Customer is required')).toBeInTheDocument()
  })

  it('does not require customer for internal type', async () => {
    const user = userEvent.setup()
    renderAddForm()
    const typeSelect = await screen.findByDisplayValue('Standard')
    await user.selectOptions(typeSelect, 'internal')
    const titleInput = screen.getByPlaceholderText(/hedge trim/i)
    await user.type(titleInput, 'Internal task')
    // Should not error on customer — just title needed
    await user.click(screen.getByRole('button', { name: /create job/i }))
    expect(screen.queryByText('Customer is required')).not.toBeInTheDocument()
  })

  it('requires title — shows error on submit', async () => {
    const user = userEvent.setup()
    renderAddForm()
    await screen.findByText('New Job')
    await user.click(screen.getByRole('button', { name: /create job/i }))
    expect(await screen.findByText('Title is required')).toBeInTheDocument()
  })

  it('shows customer dropdown results when searching', async () => {
    const user = userEvent.setup()
    renderAddForm()
    const searchInput = await screen.findByPlaceholderText(/search by name/i)
    await user.type(searchInput, 'John')
    expect(await screen.findByText('John Murphy')).toBeInTheDocument()
  })

  it('selects a customer from dropdown', async () => {
    const user = userEvent.setup()
    renderAddForm()
    const searchInput = await screen.findByPlaceholderText(/search by name/i)
    await user.type(searchInput, 'John')
    await user.click(await screen.findByText('John Murphy'))
    expect(screen.getByText('John Murphy')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/search by name/i)).not.toBeInTheDocument()
  })

  it('can clear a selected customer', async () => {
    const user = userEvent.setup()
    renderAddForm()
    const searchInput = await screen.findByPlaceholderText(/search by name/i)
    await user.type(searchInput, 'John')
    await user.click(await screen.findByText('John Murphy'))
    await user.click(screen.getByRole('button', { name: /change/i }))
    expect(await screen.findByPlaceholderText(/search by name/i)).toBeInTheDocument()
  })

  it('only shows Backlog and Scheduled as status options when creating', async () => {
    renderAddForm()
    await screen.findByText('New Job')
    const statusSelect = screen.getAllByRole('combobox')[1]
    expect(statusSelect).toHaveValue('backlog')
    expect(statusSelect.querySelectorAll('option')).toHaveLength(2)
  })

  it('hides scheduled date input when status is backlog (the default)', async () => {
    renderAddForm()
    await screen.findByText('New Job')
    expect(screen.queryByText(/scheduled date/i)).not.toBeInTheDocument()
  })

  it('shows scheduled date input when status is changed to scheduled', async () => {
    const user = userEvent.setup()
    renderAddForm()
    await screen.findByText('New Job')
    const statusSelect = screen.getAllByRole('combobox')[1]
    await user.selectOptions(statusSelect, 'scheduled')
    expect(screen.getByText(/scheduled date/i)).toBeInTheDocument()
  })

  it('blocks save when status is scheduled but date is empty', async () => {
    const user = userEvent.setup()
    renderAddForm()
    // Select customer and title
    const searchInput = await screen.findByPlaceholderText(/search by name/i)
    await user.type(searchInput, 'John')
    await user.click(await screen.findByText('John Murphy'))
    await user.type(screen.getByPlaceholderText(/hedge trim/i), 'Test job')
    // Switch to scheduled — date field appears empty (no default)
    const statusSelect = screen.getAllByRole('combobox')[1]
    await user.selectOptions(statusSelect, 'scheduled')
    // Submit without filling in date
    await user.click(screen.getByRole('button', { name: /create job/i }))
    expect(await screen.findByText('A date is required when scheduling a job')).toBeInTheDocument()
  })

  it('does not show power tools or waste disposal checkboxes (those live on the work log)', async () => {
    renderAddForm()
    await screen.findByText('New Job')
    expect(screen.queryByLabelText(/power tools/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/waste disposal/i)).not.toBeInTheDocument()
  })

  it('accepts decimal callout fee', async () => {
    const user = userEvent.setup()
    renderAddForm()
    const calloutInput = await screen.findByPlaceholderText('0.00')
    await user.type(calloutInput, '70.48')
    expect((calloutInput as HTMLInputElement).value).toBe('70.48')
  })

  it('submits correct payload on valid form', async () => {
    const user = userEvent.setup()
    let captured: unknown

    server.use(
      http.post('/api/jobs', async ({ request }) => {
        captured = await request.json()
        return HttpResponse.json({ ...mockJob, id: 99 }, { status: 201 })
      })
    )

    renderAddForm()
    // Select customer
    const searchInput = await screen.findByPlaceholderText(/search by name/i)
    await user.type(searchInput, 'John')
    await user.click(await screen.findByText('John Murphy'))
    // Fill title
    await user.type(screen.getByPlaceholderText(/hedge trim/i), 'Front garden')
    await user.click(screen.getByRole('button', { name: /create job/i }))

    await waitFor(() => {
      expect(captured).toMatchObject({ title: 'Front garden', customer_id: 1 })
    })
  })

  it('opens New Customer modal', async () => {
    const user = userEvent.setup()
    renderAddForm()
    await user.click(await screen.findByRole('button', { name: /\+ new customer/i }))
    expect(await screen.findByText('New Customer')).toBeInTheDocument()
  })

  it('closes New Customer modal on Cancel', async () => {
    const user = userEvent.setup()
    renderAddForm()
    await user.click(await screen.findByRole('button', { name: /\+ new customer/i }))
    await screen.findByText('New Customer')
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(screen.queryByText('New Customer')).not.toBeInTheDocument()
  })

})

// ── Edit mode ─────────────────────────────────────────────────────────────

describe('JobForm — Edit mode', () => {

  it('renders heading "Edit Job"', async () => {
    renderEditForm()
    expect(await screen.findByText('Edit Job')).toBeInTheDocument()
  })

  it('pre-fills title from existing job', async () => {
    renderEditForm()
    expect(await screen.findByDisplayValue('Garden Clearup')).toBeInTheDocument()
  })

  it('pre-fills scheduled date when status is scheduled', async () => {
    server.use(
      http.get('/api/jobs/:id', () => HttpResponse.json({ ...mockJob, status: 'scheduled', scheduled_date: '2026-04-15' }))
    )
    renderEditForm()
    expect(await screen.findByDisplayValue('2026-04-15')).toBeInTheDocument()
  })

  it('pre-fills selected customer name', async () => {
    renderEditForm()
    expect(await screen.findByText('John Murphy')).toBeInTheDocument()
  })

  it('sends PATCH on save', async () => {
    const user = userEvent.setup()
    let patchHit = false

    server.use(
      http.patch('/api/jobs/1', () => { patchHit = true; return HttpResponse.json(mockJob) })
    )

    renderEditForm()
    await screen.findByDisplayValue('Garden Clearup')
    await user.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(patchHit).toBe(true))
  })

})
