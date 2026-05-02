import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CustomerDetail from '../../pages/customers/CustomerDetail'
import { renderAt } from '../../test/renderWithProviders'

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
    expect(await screen.findByText('+353 87 123 4567')).toBeInTheDocument()
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
