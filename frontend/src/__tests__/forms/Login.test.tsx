import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import Login from '../../pages/Login'
import { renderSimple } from '../../test/renderWithProviders'
import { server } from '../../test/mocks/server'

describe('Login', () => {

  it('renders the login form', async () => {
    renderSimple(<Login />)
    expect(await screen.findByPlaceholderText('you@lennonlandscaping.ie')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows error when API returns 401', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ message: 'Invalid credentials.' }, { status: 401 })
      )
    )
    const user = userEvent.setup()
    renderSimple(<Login />)
    await user.type(await screen.findByPlaceholderText('you@lennonlandscaping.ie'), 'bad@example.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrongpass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument()
  })

  it('calls login with email and password without client-side errors', async () => {
    const user = userEvent.setup()
    renderSimple(<Login />)
    await user.type(await screen.findByPlaceholderText('you@lennonlandscaping.ie'), 'tobias@lennonlandscaping.ie')
    await user.type(screen.getByPlaceholderText('••••••••'), 'Lennon2026!')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => {
      expect(screen.queryByText(/required/i)).not.toBeInTheDocument()
    })
  })

  it('disables the button while submitting', async () => {
    server.use(
      http.post('/api/auth/login', async () => {
        await new Promise(r => setTimeout(r, 200))
        return HttpResponse.json({ token: 'abc', user: { id: 1, name: 'Tobias', email: 'tobias@lennonlandscaping.ie', role: 'admin', avatar: null } })
      })
    )
    const user = userEvent.setup()
    renderSimple(<Login />)
    await user.type(await screen.findByPlaceholderText('you@lennonlandscaping.ie'), 'tobias@lennonlandscaping.ie')
    await user.type(screen.getByPlaceholderText('••••••••'), 'Lennon2026!')
    const btn = screen.getByRole('button', { name: /sign in/i })
    await user.click(btn)
    expect(btn).toBeDisabled()
  })

})
