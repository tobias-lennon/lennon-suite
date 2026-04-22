import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import CustomerDetail from '../../pages/customers/CustomerDetail'
import { renderAt } from '../../test/renderWithProviders'
import { server } from '../../test/mocks/server'
import { mockCustomerDetail } from '../../test/mocks/data'

function renderCustomer(id = '1') {
  return renderAt(<CustomerDetail />, { path: '/customers/:id', at: `/customers/${id}` })
}

// ── Display ───────────────────────────────────────────────────────────────

describe('CustomerDetail — display', () => {

  it('renders the customer name', async () => {
    renderCustomer()
    expect(await screen.findByText('John Murphy')).toBeInTheDocument()
  })

  it('renders the phone number', async () => {
    renderCustomer()
    expect(await screen.findByText('087 123 4567')).toBeInTheDocument()
  })

  it('renders the email address', async () => {
    renderCustomer()
    expect(await screen.findByText('john@example.com')).toBeInTheDocument()
  })

  it('renders the address', async () => {
    renderCustomer()
    expect(await screen.findByText('12 Main Street')).toBeInTheDocument()
    expect(await screen.findByText('Millstreet')).toBeInTheDocument()
  })

  it('renders the Eircode', async () => {
    renderCustomer()
    expect(await screen.findByText('P51 AB12')).toBeInTheDocument()
  })

  it('renders the Edit link', async () => {
    renderCustomer()
    expect(await screen.findByRole('link', { name: /edit/i })).toBeInTheDocument()
  })

  it('shows "No jobs recorded yet" when history is empty', async () => {
    renderCustomer()
    expect(await screen.findByText(/no jobs recorded yet/i)).toBeInTheDocument()
  })

})

// ── Discount inline editing ───────────────────────────────────────────────

describe('CustomerDetail — discount editing', () => {

  it('shows "None" when discount is 0', async () => {
    renderCustomer()
    await screen.findByText('John Murphy')
    // Both discount and callout fee default to "None" — check discount label is present
    expect(screen.getAllByText('None').length).toBeGreaterThanOrEqual(1)
  })

  it('clicking the discount pencil reveals the input', async () => {
    const user = userEvent.setup()
    renderCustomer()
    await screen.findByText('John Murphy')
    const [discountPencil] = screen.getAllByTitle(/edit/i)
    await user.click(discountPencil)
    expect(screen.getByDisplayValue('0')).toBeInTheDocument()
  })

  it('saves discount and sends PATCH /customers/:id/discount', async () => {
    const user = userEvent.setup()
    let captured: unknown
    server.use(
      http.patch('/api/customers/1/discount', async ({ request }) => {
        captured = await request.json()
        return HttpResponse.json({ ...mockCustomerDetail, discount_pct: 10 })
      })
    )
    renderCustomer()
    await screen.findByText('John Murphy')
    const [discountPencil] = screen.getAllByTitle(/edit/i)
    await user.click(discountPencil)
    const input = screen.getByDisplayValue('0')
    await user.clear(input)
    await user.type(input, '10')
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => {
      expect(captured).toMatchObject({ discount_pct: 10 })
    })
  })

  it('Escape key cancels discount editing', async () => {
    const user = userEvent.setup()
    renderCustomer()
    await screen.findByText('John Murphy')
    const [discountPencil] = screen.getAllByTitle(/edit/i)
    await user.click(discountPencil)
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByDisplayValue('0')).not.toBeInTheDocument()
    })
  })

  it('Cancel button closes discount editing', async () => {
    const user = userEvent.setup()
    renderCustomer()
    await screen.findByText('John Murphy')
    const [discountPencil] = screen.getAllByTitle(/edit/i)
    await user.click(discountPencil)
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => {
      expect(screen.queryByDisplayValue('0')).not.toBeInTheDocument()
    })
  })

})

// ── Callout fee inline editing ────────────────────────────────────────────

describe('CustomerDetail — callout fee editing', () => {

  it('clicking the callout pencil reveals the input', async () => {
    const user = userEvent.setup()
    renderCustomer()
    await screen.findByText('John Murphy')
    const pencils = screen.getAllByTitle(/edit/i)
    await user.click(pencils[1]) // second pencil is callout fee
    expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument()
  })

  it('saves callout fee and sends PATCH /customers/:id/rates', async () => {
    const user = userEvent.setup()
    let captured: unknown
    server.use(
      http.patch('/api/customers/1/rates', async ({ request }) => {
        captured = await request.json()
        return HttpResponse.json({ ...mockCustomerDetail, default_callout_fee: 70.48 })
      })
    )
    renderCustomer()
    await screen.findByText('John Murphy')
    const pencils = screen.getAllByTitle(/edit/i)
    await user.click(pencils[1])
    await user.type(screen.getByPlaceholderText('0.00'), '70.48')
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => {
      expect(captured).toMatchObject({ default_callout_fee: 70.48 })
    })
  })

  it('sending empty callout fee saves null', async () => {
    const user = userEvent.setup()
    let captured: unknown
    server.use(
      http.patch('/api/customers/1/rates', async ({ request }) => {
        captured = await request.json()
        return HttpResponse.json({ ...mockCustomerDetail, default_callout_fee: null })
      })
    )
    renderCustomer()
    await screen.findByText('John Murphy')
    const pencils = screen.getAllByTitle(/edit/i)
    await user.click(pencils[1])
    // Leave field empty and save
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => {
      expect(captured).toMatchObject({ default_callout_fee: null })
    })
  })

  it('Escape key cancels callout fee editing', async () => {
    const user = userEvent.setup()
    renderCustomer()
    await screen.findByText('John Murphy')
    const pencils = screen.getAllByTitle(/edit/i)
    await user.click(pencils[1])
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('0.00')).not.toBeInTheDocument()
    })
  })

})

// ── Danger zone ───────────────────────────────────────────────────────────

describe('CustomerDetail — danger zone', () => {

  it('archive button navigates away when confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderCustomer()
    await user.click(await screen.findByText(/archive customer/i))
    expect(await screen.findByTestId('navigated')).toBeInTheDocument()
  })

  it('archive is a no-op when user cancels the confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    renderCustomer()
    await user.click(await screen.findByText(/archive customer/i))
    await waitFor(() => {
      expect(screen.queryByTestId('navigated')).not.toBeInTheDocument()
    })
    expect(screen.getByText('John Murphy')).toBeInTheDocument()
  })

  it('delete button navigates away when confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderCustomer()
    await user.click(await screen.findByText(/delete customer/i))
    expect(await screen.findByTestId('navigated')).toBeInTheDocument()
  })

  it('delete is a no-op when user cancels the confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    renderCustomer()
    await user.click(await screen.findByText(/delete customer/i))
    await waitFor(() => {
      expect(screen.queryByTestId('navigated')).not.toBeInTheDocument()
    })
    expect(screen.getByText('John Murphy')).toBeInTheDocument()
  })

})
