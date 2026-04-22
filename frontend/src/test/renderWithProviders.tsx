import { render, type RenderResult } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import type { ReactElement } from 'react'

// Catch-all shown after a form successfully navigates away
const Navigated = () => <div data-testid="navigated">Navigated</div>

// ── renderAt: render a component at a specific route with params ───────────
export function renderAt(
  element: ReactElement,
  {
    path = '/',
    at,
    additionalRoutes = [],
  }: {
    path: string
    at: string
    additionalRoutes?: { path: string; element: ReactElement }[]
  }
): RenderResult {
  const router = createMemoryRouter(
    [
      { path, element },
      ...additionalRoutes,
      { path: '*', element: <Navigated /> },
    ],
    { initialEntries: [at] }
  )
  return render(<RouterProvider router={router} />)
}

// ── renderSimple: render a component with no route params needed ───────────
export function renderSimple(element: ReactElement): RenderResult {
  const router = createMemoryRouter([{ path: '/', element }], { initialEntries: ['/'] })
  return render(<RouterProvider router={router} />)
}
