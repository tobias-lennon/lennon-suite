import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import LeadForm from '../../pages/leads/LeadForm'
import { renderAt } from '../../test/renderWithProviders'
import { server } from '../../test/mocks/server'
import { mockLead } from '../../test/mocks/data'

function renderAddForm() {
  return renderAt(<LeadForm />, { path: '/leads/new', at: '/leads/new' })
}

function renderEditForm(id = '1') {
  return renderAt(<LeadForm />, { path: '/leads/:id/edit', at: `/leads/${id}/edit` })
}

// ── Add mode ──────────────────────────────────────────────────────────────

describe('LeadForm — Add mode', () => {

  it('renders "New Lead" heading', async () => {
    renderAddForm()
    expect(await screen.findByText('New Lead')).toBeInTheDocument()
  })

  it('requires name — shows error', async () => {
    const user = userEvent.setup()
    renderAddForm()
    await user.click(await screen.findByRole('button', { name: /save changes|create lead/i }))
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument()
  })

  it('validates email format', async () => {
    const user = userEvent.setup()
    renderAddForm()
    await user.type(await screen.findByPlaceholderText('Full name'), 'Pat')
    await user.type(screen.getByPlaceholderText('email@example.com'), 'notvalid')
    await user.click(screen.getByRole('button', { name: /save changes|create lead/i }))
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument()
  })

  it('submits with name and source', async () => {
    const user = userEvent.setup()
    let captured: unknown
    server.use(
      http.post('/api/leads', async ({ request }) => {
        captured = await request.json()
        return HttpResponse.json({ ...mockLead, id: 99 }, { status: 201 })
      })
    )
    renderAddForm()
    await user.type(await screen.findByPlaceholderText('Full name'), 'Pat Shine')
    await user.click(screen.getByRole('button', { name: /save changes|create lead/i }))
    await waitFor(() => {
      expect(captured).toMatchObject({ name: 'Pat Shine' })
    })
  })

  it('shows all source options', async () => {
    renderAddForm()
    await screen.findByText('New Lead')
    const sourceSelect = screen.getAllByRole('combobox').find(
      s => Array.from((s as HTMLSelectElement).options).some(o => o.value === 'google')
    )
    expect(sourceSelect).toBeTruthy()
    const opts = Array.from((sourceSelect as HTMLSelectElement).options).map(o => o.value)
    expect(opts).toContain('word_of_mouth')
    expect(opts).toContain('google')
    expect(opts).toContain('instagram')
    expect(opts).toContain('referral')
  })

})

// ── Edit mode ─────────────────────────────────────────────────────────────

describe('LeadForm — Edit mode', () => {

  it('renders "Edit Lead" heading', async () => {
    renderEditForm()
    expect(await screen.findByText('Edit Lead')).toBeInTheDocument()
  })

  it('pre-fills name', async () => {
    renderEditForm()
    expect(await screen.findByDisplayValue('Seamus Buckley')).toBeInTheDocument()
  })

  it('pre-fills phone', async () => {
    renderEditForm()
    expect(await screen.findByDisplayValue('086 999 1234')).toBeInTheDocument()
  })

  it('pre-fills notes', async () => {
    renderEditForm()
    expect(await screen.findByDisplayValue('Wants front garden redesigned')).toBeInTheDocument()
  })

  it('shows Convert to Customer button', async () => {
    renderEditForm()
    expect(await screen.findByRole('button', { name: /convert to customer/i })).toBeInTheDocument()
  })

  it('calls convert endpoint when Convert clicked', async () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true)
    const user = userEvent.setup()
    let convertHit = false
    server.use(
      http.post('/api/leads/1/convert', () => {
        convertHit = true
        return HttpResponse.json({ customer: { id: 1, name: 'Seamus Buckley' } })
      })
    )
    renderEditForm()
    await user.click(await screen.findByRole('button', { name: /convert to customer/i }))
    await waitFor(() => expect(convertHit).toBe(true))
  })

  it('sends PATCH on save', async () => {
    const user = userEvent.setup()
    let patchHit = false
    server.use(
      http.patch('/api/leads/1', () => { patchHit = true; return HttpResponse.json(mockLead) })
    )
    renderEditForm()
    await screen.findByDisplayValue('Seamus Buckley')
    await user.click(screen.getByRole('button', { name: /save changes|create lead/i }))
    await waitFor(() => expect(patchHit).toBe(true))
  })

})
