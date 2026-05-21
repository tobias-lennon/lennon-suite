import { http, HttpResponse } from 'msw'
import { mockEmployees, mockJob, mockCustomers, mockWorkLog, mockLead, mockCustomerDetail, mockCustomerHistory, mockInvoice, mockUser, mockSchedule, mockScheduledJob, mockUnscheduledJob } from './data'

export const handlers = [

  // ── Auth ─────────────────────────────────────────────────────────────
  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json() as { email: string; password: string }
    if (body.email === 'bad@example.com') {
      return HttpResponse.json({ message: 'Invalid credentials.' }, { status: 401 })
    }
    return HttpResponse.json({ token: 'mock-token', user: mockUser })
  }),

  http.post('/api/auth/logout', () => HttpResponse.json({ message: 'Logged out.' })),

  http.get('/api/auth/me', () => HttpResponse.json(mockUser)),

  // ── Users ─────────────────────────────────────────────────────────────
  http.patch('/api/users/me/password', async ({ request }) => {
    const body = await request.json() as { current_password: string }
    if (body.current_password === 'wrongpassword') {
      return HttpResponse.json(
        { errors: { current_password: ['Current password is incorrect.'] } },
        { status: 422 }
      )
    }
    return HttpResponse.json({ message: 'Password updated.' })
  }),

  http.post('/api/users/me/avatar', () =>
    HttpResponse.json({ avatar: '/storage/avatars/1/test.jpg' })
  ),

  // ── Employees ────────────────────────────────────────────────────────
  http.get('/api/employees', () => HttpResponse.json(mockEmployees)),

  // ── Jobs ─────────────────────────────────────────────────────────────
  http.get('/api/jobs', () =>
    HttpResponse.json({ data: [mockJob], current_page: 1, last_page: 1, total: 1 })
  ),

  http.get('/api/jobs/:id', ({ params }) => {
    if (params.id === '999') return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    return HttpResponse.json(mockJob)
  }),

  http.post('/api/jobs', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...mockJob, ...body, id: 99 }, { status: 201 })
  }),

  http.patch('/api/jobs/:id', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...mockJob, ...body })
  }),

  http.patch('/api/jobs/:id/status', async ({ request }) => {
    const body = await request.json() as { status: string }
    return HttpResponse.json({ ...mockJob, status: body.status })
  }),

  // ── Work logs ─────────────────────────────────────────────────────────
  http.get('/api/jobs/:id/logs/:logId', () => HttpResponse.json(mockWorkLog)),

  http.post('/api/jobs/:id/logs', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...mockWorkLog, ...body, id: 99 }, { status: 201 })
  }),

  http.patch('/api/jobs/:id/logs/:logId', () => HttpResponse.json(mockWorkLog)),

  http.patch('/api/logs/:logId/entries/:entryId', () =>
    HttpResponse.json(mockWorkLog.entries[0])
  ),

  http.delete('/api/jobs/:id/logs/:logId', () => new HttpResponse(null, { status: 204 })),

  // ── Materials ─────────────────────────────────────────────────────────
  http.post('/api/logs/:logId/materials', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ id: 99, ...body }, { status: 201 })
  }),

  http.patch('/api/logs/:logId/materials/:matId', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...mockWorkLog.materials[0], ...body })
  }),

  http.delete('/api/logs/:logId/materials/:matId', () => new HttpResponse(null, { status: 204 })),

  // ── Customers ────────────────────────────────────────────────────────
  http.get('/api/customers', () =>
    HttpResponse.json({ data: mockCustomers, current_page: 1, last_page: 1, total: 2 })
  ),

  http.get('/api/customers/:id', () => HttpResponse.json(mockCustomerDetail)),

  http.post('/api/customers', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...mockCustomerDetail, ...body, id: 99 }, { status: 201 })
  }),

  http.patch('/api/customers/:id', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...mockCustomerDetail, ...body })
  }),

  http.get('/api/customers/:id/history', () =>
    HttpResponse.json(mockCustomerHistory)
  ),

  http.patch('/api/customers/:id/discount', async ({ request }) => {
    const body = await request.json() as { discount_pct: number }
    return HttpResponse.json({ ...mockCustomerDetail, discount_pct: body.discount_pct })
  }),

  http.patch('/api/customers/:id/rates', async ({ request }) => {
    const body = await request.json() as { default_callout_fee: number | null }
    return HttpResponse.json({ ...mockCustomerDetail, default_callout_fee: body.default_callout_fee })
  }),

  http.patch('/api/customers/:id/archive', () =>
    HttpResponse.json({ message: 'Archived.' })
  ),

  http.delete('/api/customers/:id', () => new HttpResponse(null, { status: 204 })),

  http.get('/api/customers/stats', () =>
    HttpResponse.json({ total_jobs: 2, is_returning: true, total_revenue: 500 })
  ),

  // ── Address autocomplete ───────────────────────────────────────────────
  http.get('/api/address/autocomplete', () => HttpResponse.json({ suggestions: [] })),

  // ── Leads ─────────────────────────────────────────────────────────────
  http.get('/api/leads', () =>
    HttpResponse.json({ data: [mockLead], current_page: 1, last_page: 1, total: 1 })
  ),

  http.get('/api/leads/:id', () => HttpResponse.json(mockLead)),

  http.post('/api/leads', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...mockLead, ...body, id: 99 }, { status: 201 })
  }),

  http.patch('/api/leads/:id', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...mockLead, ...body })
  }),

  http.post('/api/leads/:id/convert', () =>
    HttpResponse.json({ customer: mockCustomerDetail })
  ),

  // ── Schedule ──────────────────────────────────────────────────────────────
  http.get('/api/schedule', () => HttpResponse.json(mockSchedule)),

  http.patch('/api/schedule/jobs/:id/date', async ({ request, params }) => {
    const body = await request.json() as { scheduled_date: string | null }
    const id = Number(params.id)
    const base = id === mockScheduledJob.id ? mockScheduledJob : mockUnscheduledJob
    const newStatus = body.scheduled_date !== null && base.status === 'backlog'
      ? 'scheduled'
      : body.scheduled_date === null && base.status === 'scheduled'
        ? 'backlog'
        : base.status
    return HttpResponse.json({ ...base, scheduled_date: body.scheduled_date, status: newStatus })
  }),

  http.patch('/api/schedule/tasks/:id/date', async ({ request }) => {
    const body = await request.json() as { scheduled_date: string | null }
    return HttpResponse.json({ id: 1, title: 'Mock Task', status: 'pending', weather_req: 'any',
      scheduled_date: body.scheduled_date, scheduled_time: null, due_by: null,
      estimated_hours: null, customer_forecast: null, job: null })
  }),

  http.get('/api/weather', () => HttpResponse.json({ forecasts: [] })),

  // ── Rate cards ────────────────────────────────────────────────────────
  http.get('/api/rate-cards', () => HttpResponse.json([
    { id: 1, name: 'Standard 2026', base_rate: 26.43, tools_rate: 8.81, waste_rate: 13.22, maintenance_rate: 41.85 }
  ])),

  // ── Invoices ─────────────────────────────────────────────────────────────
  http.get('/api/invoices/:id', ({ params }) => {
    if (params.id === '999') return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    return HttpResponse.json(mockInvoice)
  }),

  http.patch('/api/invoices/:id/status', async ({ request }) => {
    const body = await request.json() as { status: string }
    return HttpResponse.json({ ...mockInvoice, status: body.status })
  }),

  http.post('/api/invoices/:id/payment', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...mockInvoice, status: 'paid', ...body })
  }),

  http.delete('/api/invoices/:id', () => new HttpResponse(null, { status: 204 })),

  http.get('/api/invoices/:id/download', () =>
    new HttpResponse(new Blob(['%PDF'], { type: 'application/pdf' }), {
      headers: { 'Content-Type': 'application/pdf' },
    })
  ),

  http.get('/api/invoices/:id/receipt', () =>
    new HttpResponse(new Blob(['%PDF'], { type: 'application/pdf' }), {
      headers: { 'Content-Type': 'application/pdf' },
    })
  ),
]
