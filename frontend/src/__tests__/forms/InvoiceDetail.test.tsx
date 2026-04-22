import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import InvoiceDetail from '../../pages/invoices/InvoiceDetail'
import { renderAt } from '../../test/renderWithProviders'
import { server } from '../../test/mocks/server'
import { mockInvoice } from '../../test/mocks/data'

function renderInvoice(id = '1') {
  return renderAt(<InvoiceDetail />, { path: '/invoices/:id', at: `/invoices/${id}` })
}

const paidInvoice = {
  ...mockInvoice,
  status: 'paid',
  amount_paid: 227.00,
  payment_method: 'bank_transfer',
  paid_at: '2026-04-16',
}

// ── Display ───────────────────────────────────────────────────────────────

describe('InvoiceDetail — display', () => {

  it('renders the invoice number', async () => {
    renderInvoice()
    expect(await screen.findByText('LL-2026-100')).toBeInTheDocument()
  })

  it('renders the customer name', async () => {
    renderInvoice()
    // Customer name appears in both the header link and the "Bill To" section
    const matches = await screen.findAllByText('John Murphy')
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('shows draft status as "Not Sent"', async () => {
    renderInvoice()
    expect(await screen.findByText('Not Sent')).toBeInTheDocument()
  })

  it('renders the total due', async () => {
    renderInvoice()
    // €227.00 appears in the totals block
    const totals = await screen.findAllByText('€227.00')
    expect(totals.length).toBeGreaterThanOrEqual(1)
  })

  it('shows "Record Payment" button for a non-paid invoice', async () => {
    renderInvoice()
    expect(await screen.findByRole('button', { name: /record payment/i })).toBeInTheDocument()
  })

  it('shows "Download Invoice" button', async () => {
    renderInvoice()
    expect(await screen.findByRole('button', { name: /download invoice/i })).toBeInTheDocument()
  })

  it('shows the "Next step" hint for draft invoices', async () => {
    renderInvoice()
    expect(await screen.findByText(/next step/i)).toBeInTheDocument()
  })

})

// ── Payment form ──────────────────────────────────────────────────────────

describe('InvoiceDetail — payment form', () => {

  it('payment form is hidden initially', async () => {
    renderInvoice()
    await screen.findByRole('button', { name: /record payment/i })
    expect(screen.queryByRole('button', { name: /save payment/i })).not.toBeInTheDocument()
  })

  it('clicking "Record Payment" reveals the form', async () => {
    const user = userEvent.setup()
    renderInvoice()
    await user.click(await screen.findByRole('button', { name: /record payment/i }))
    expect(screen.getByRole('button', { name: /save payment/i })).toBeInTheDocument()
  })

  it('pre-fills amount_paid with total_due', async () => {
    const user = userEvent.setup()
    renderInvoice()
    await user.click(await screen.findByRole('button', { name: /record payment/i }))
    expect(screen.getByDisplayValue('227.00')).toBeInTheDocument()
  })

  it('submits payment with correct payload', async () => {
    const user = userEvent.setup()
    let captured: unknown
    server.use(
      http.post('/api/invoices/1/payment', async ({ request }) => {
        captured = await request.json()
        return HttpResponse.json(paidInvoice)
      })
    )
    renderInvoice()
    await user.click(await screen.findByRole('button', { name: /record payment/i }))
    await user.click(screen.getByRole('button', { name: /save payment/i }))
    await waitFor(() => {
      expect(captured).toMatchObject({ amount_paid: 227, payment_method: 'bank_transfer' })
    })
  })

  it('hides the form after a successful save', async () => {
    const user = userEvent.setup()
    server.use(
      http.post('/api/invoices/1/payment', () => HttpResponse.json(paidInvoice))
    )
    renderInvoice()
    await user.click(await screen.findByRole('button', { name: /record payment/i }))
    await user.click(screen.getByRole('button', { name: /save payment/i }))
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /save payment/i })).not.toBeInTheDocument()
    })
  })

  it('shows API validation errors on 422', async () => {
    const user = userEvent.setup()
    server.use(
      http.post('/api/invoices/1/payment', () =>
        HttpResponse.json(
          { errors: { amount_paid: ['The amount paid field is required.'] } },
          { status: 422 }
        )
      )
    )
    renderInvoice()
    await user.click(await screen.findByRole('button', { name: /record payment/i }))
    const amountInput = screen.getByDisplayValue('227.00')
    await user.clear(amountInput)
    await user.click(screen.getByRole('button', { name: /save payment/i }))
    expect(await screen.findByText(/the amount paid field is required/i)).toBeInTheDocument()
  })

  it('shows overpaid hint when entered amount > total_due', async () => {
    const user = userEvent.setup()
    renderInvoice()
    await user.click(await screen.findByRole('button', { name: /record payment/i }))
    const amountInput = screen.getByDisplayValue('227.00')
    await user.clear(amountInput)
    await user.type(amountInput, '250.00')
    expect(await screen.findByText(/overpaid by/i)).toBeInTheDocument()
  })

  it('shows underpaid hint when entered amount < total_due', async () => {
    const user = userEvent.setup()
    renderInvoice()
    await user.click(await screen.findByRole('button', { name: /record payment/i }))
    const amountInput = screen.getByDisplayValue('227.00')
    await user.clear(amountInput)
    await user.type(amountInput, '100.00')
    expect(await screen.findByText(/underpaid by/i)).toBeInTheDocument()
  })

  it('Cancel button hides the payment form', async () => {
    const user = userEvent.setup()
    renderInvoice()
    await user.click(await screen.findByRole('button', { name: /record payment/i }))
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /save payment/i })).not.toBeInTheDocument()
    })
  })

})

// ── Status actions ────────────────────────────────────────────────────────

describe('InvoiceDetail — status actions', () => {

  it('shows "Mark Sent" button for a draft invoice', async () => {
    renderInvoice()
    expect(await screen.findByRole('button', { name: /mark sent/i })).toBeInTheDocument()
  })

  it('"Mark Sent" sends PATCH with status=sent', async () => {
    const user = userEvent.setup()
    let captured: unknown
    server.use(
      http.patch('/api/invoices/1/status', async ({ request }) => {
        captured = await request.json()
        return HttpResponse.json({ ...mockInvoice, status: 'sent' })
      })
    )
    renderInvoice()
    await user.click(await screen.findByRole('button', { name: /mark sent/i }))
    await waitFor(() => {
      expect(captured).toMatchObject({ status: 'sent' })
    })
  })

  it('paid invoice shows "Revert to Sent" and hides "Record Payment"', async () => {
    server.use(
      http.get('/api/invoices/1', () => HttpResponse.json(paidInvoice))
    )
    renderInvoice()
    expect(await screen.findByRole('button', { name: /revert to sent/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /record payment/i })).not.toBeInTheDocument()
  })

  it('paid invoice shows "Download Receipt" button', async () => {
    server.use(
      http.get('/api/invoices/1', () => HttpResponse.json(paidInvoice))
    )
    renderInvoice()
    expect(await screen.findByRole('button', { name: /download receipt/i })).toBeInTheDocument()
  })

  it('paid invoice shows "Payment confirmed" banner', async () => {
    server.use(
      http.get('/api/invoices/1', () => HttpResponse.json(paidInvoice))
    )
    renderInvoice()
    expect(await screen.findByText(/payment confirmed/i)).toBeInTheDocument()
  })

})

// ── Delete ────────────────────────────────────────────────────────────────

describe('InvoiceDetail — delete', () => {

  it('clicking "Delete invoice" opens the confirm dialog', async () => {
    const user = userEvent.setup()
    renderInvoice()
    await user.click(await screen.findByText(/delete invoice/i))
    expect(await screen.findByText(/delete LL-2026-100/i)).toBeInTheDocument()
  })

  it('confirming delete navigates away', async () => {
    const user = userEvent.setup()
    renderInvoice()
    await user.click(await screen.findByText(/delete invoice/i))
    await user.click(await screen.findByRole('button', { name: /^delete$/i }))
    expect(await screen.findByTestId('navigated')).toBeInTheDocument()
  })

  it('cancelling the delete dialog keeps the page', async () => {
    const user = userEvent.setup()
    renderInvoice()
    await user.click(await screen.findByText(/delete invoice/i))
    await user.click(await screen.findByRole('button', { name: /^cancel$/i }))
    await waitFor(() => {
      expect(screen.queryByText(/delete LL-2026-100/i)).not.toBeInTheDocument()
    })
    expect(screen.getByText('LL-2026-100')).toBeInTheDocument()
  })

})
