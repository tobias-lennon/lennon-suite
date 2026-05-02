import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import CustomerForm from '../../pages/customers/CustomerForm'
import { renderAt } from '../../test/renderWithProviders'
import { server } from '../../test/mocks/server'
import { mockCustomerDetail } from '../../test/mocks/data'

function renderAddForm() {
  return renderAt(<CustomerForm />, { path: '/customers/new', at: '/customers/new' })
}

function renderEditForm(id = '1') {
  return renderAt(<CustomerForm />, { path: '/customers/:id/edit', at: `/customers/${id}/edit` })
}

// ── Add mode ──────────────────────────────────────────────────────────────

describe('CustomerForm — Add mode', () => {

  it('renders heading "New Customer"', async () => {
    renderAddForm()
    expect(await screen.findByText('New Customer')).toBeInTheDocument()
  })

  it('requires name — shows error on submit', async () => {
    const user = userEvent.setup()
    renderAddForm()
    await user.click(await screen.findByRole('button', { name: /create customer|save changes/i }))
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument()
  })

  it('applies field-error class to name input when missing', async () => {
    const user = userEvent.setup()
    renderAddForm()
    await user.click(await screen.findByRole('button', { name: /create customer|save changes/i }))
    await screen.findByText(/name is required/i)
    const nameInput = screen.getByPlaceholderText('Full name')
    expect(nameInput).toHaveClass('field-error')
  })

  it('validates email format', async () => {
    const user = userEvent.setup()
    renderAddForm()
    await user.type(await screen.findByPlaceholderText('Full name'), 'Test Customer')
    await user.type(screen.getByPlaceholderText('email@…'), 'notanemail')
    await user.click(screen.getByRole('button', { name: /create customer|save changes/i }))
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument()
  })

  it('submits with name only (other fields optional)', async () => {
    const user = userEvent.setup()
    let captured: unknown
    server.use(
      http.post('/api/customers', async ({ request }) => {
        captured = await request.json()
        return HttpResponse.json({ ...mockCustomerDetail, id: 99 }, { status: 201 })
      })
    )
    renderAddForm()
    await user.type(await screen.findByPlaceholderText('Full name'), 'Seamus Buckley')
    await user.click(screen.getByRole('button', { name: /create customer|save changes/i }))
    await waitFor(() => {
      expect(captured).toMatchObject({ name: 'Seamus Buckley' })
    })
  })

  it('submits full details including address', async () => {
    const user = userEvent.setup()
    let captured: unknown
    server.use(
      http.post('/api/customers', async ({ request }) => {
        captured = await request.json()
        return HttpResponse.json({ ...mockCustomerDetail, id: 99 }, { status: 201 })
      })
    )
    renderAddForm()
    await user.type(await screen.findByPlaceholderText('Full name'), 'Seamus Buckley')
    await user.type(screen.getByPlaceholderText('email@…'), 'seamus@test.ie')
    await user.type(screen.getByPlaceholderText('+353 89 123 4567'), '087 123 4567')
    await user.click(screen.getByRole('button', { name: /create customer|save changes/i }))
    await waitFor(() => {
      expect(captured).toMatchObject({
        name: 'Seamus Buckley',
        email: 'seamus@test.ie',
        phone: '+353871234567',
      })
    })
  })

  it('shows both Residential and Commercial type options', async () => {
    renderAddForm()
    await screen.findByText('New Customer')
    const typeSelect = screen.getAllByRole('combobox')[0]
    expect(typeSelect).toBeInTheDocument()
    // Check options
    const options = Array.from((typeSelect as HTMLSelectElement).options).map(o => o.value)
    expect(options).toContain('residential')
    expect(options).toContain('commercial')
  })

})

// ── Edit mode ─────────────────────────────────────────────────────────────

describe('CustomerForm — Edit mode', () => {

  it('renders heading "Edit Customer"', async () => {
    renderEditForm()
    expect(await screen.findByText('Edit Customer')).toBeInTheDocument()
  })

  it('pre-fills name from existing data', async () => {
    renderEditForm()
    expect(await screen.findByDisplayValue('John Murphy')).toBeInTheDocument()
  })

  it('pre-fills phone', async () => {
    renderEditForm()
    expect(await screen.findByDisplayValue('+353871234567')).toBeInTheDocument()
  })

  it('pre-fills address fields', async () => {
    renderEditForm()
    expect(await screen.findByDisplayValue('12 Main Street')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Millstreet')).toBeInTheDocument()
    expect(screen.getByDisplayValue('P51 AB12')).toBeInTheDocument()
  })

  it('sends PATCH on save with updated name', async () => {
    const user = userEvent.setup()
    let captured: unknown
    server.use(
      http.patch('/api/customers/1', async ({ request }) => {
        captured = await request.json()
        return HttpResponse.json(mockCustomerDetail)
      })
    )
    renderEditForm()
    const nameInput = await screen.findByDisplayValue('John Murphy')
    await user.clear(nameInput)
    await user.type(nameInput, 'John P. Murphy')
    await user.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => {
      expect(captured).toMatchObject({ name: 'John P. Murphy' })
    })
  })

})
