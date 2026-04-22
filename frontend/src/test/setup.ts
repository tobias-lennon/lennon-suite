import '@testing-library/jest-dom'
import { vi, afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './mocks/server'
import { mockUser } from './mocks/data'

// ── PWA virtual module stub ───────────────────────────────────────────────
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    updateServiceWorker: vi.fn(),
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
  }),
}))

// ── Global AuthContext mock ───────────────────────────────────────────────
// Every test gets a logged-in user by default. login() actually calls the
// Axios API so MSW handlers can control its behaviour in Login tests.
vi.mock('../contexts/AuthContext', async () => {
  const { default: api } = await import('../lib/api')
  return {
    useAuth: () => ({
      user: mockUser,
      isLoading: false,
      login: async (email: string, password: string) => {
        const res = await api.post('/auth/login', { email, password })
        return res.data
      },
      logout: vi.fn(),
      updateUser: vi.fn(),
    }),
    AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  }
})

// ── MSW ──────────────────────────────────────────────────────────────────
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// ── jsdom stubs ───────────────────────────────────────────────────────────
Object.defineProperty(window, 'scrollTo', { value: () => {}, writable: true })
Element.prototype.scrollIntoView = () => {}

// Blob URL stubs (jsdom doesn't implement these — needed for PDF download tests)
URL.createObjectURL = vi.fn().mockReturnValue('blob:mock')
URL.revokeObjectURL = vi.fn()
