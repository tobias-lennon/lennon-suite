// Factory functions for consistent mock data across all tests

export const mockUser = {
  id: 1,
  name: 'Tobias Lennon',
  email: 'tobias@lennonlandscaping.ie',
  role: 'admin',
  avatar: null,
}

export const mockEmployees = [
  { id: 1, name: 'Jasper Lennon', pay_rate: 0 },
  { id: 2, name: 'Tobias Lennon', pay_rate: 0 },
]

export const mockCustomers = [
  { id: 1, name: 'John Murphy', type: 'residential', phone: '+353871234567', email: 'john@example.com', discount_pct: 0 },
  { id: 2, name: 'Mary O\'Brien', type: 'residential', phone: null, email: null, discount_pct: 0 },
]

export const mockJob = {
  id: 1,
  title: 'Garden Clearup',
  description: null,
  type: 'standard',
  status: 'in_progress',
  weather_req: 'any',
  est_duration: 'half_day',
  priority: 'normal',
  scheduled_date: '2026-04-15',
  notes: null,
  callout_fee: null,
  customer_id: 1,
  customer: mockCustomers[0],
  project: null,
  work_logs: [],
  totals: { total_hours: 0, total_labour_charged: 0, total_labour_cost: 0, total_materials: 0, callout_fee: 0, total_charged: 0, margin: 0 },
  invoice: null,
}

export const mockWorkLog = {
  id: 1,
  date: '2026-04-12',
  notes: 'Cleared the back garden',
  callout_fee: null,
  has_waste_disposal: false,
  entries: [
    {
      id: 1,
      employee: mockEmployees[0],
      start_time: '09:00:00',
      end_time: '13:00:00',
      break_minutes: 0,
      has_power_tools: false,
      billable_hours: 4.0,
      rate_per_hour: 26.43,
      discount_pct: 0,
      amount_charged: 105.72,
      amount_paid: 0,
      margin: 105.72,
    },
  ],
  materials: [
    {
      id: 1,
      description: 'Bark mulch',
      qty: 3,
      unit: 'bags',
      cost_paid: 15.00,
      amount_charged: 25.00,
      notes: null,
    },
  ],
}

export const mockLead = {
  id: 1,
  name: 'Seamus Buckley',
  phone: '086 999 1234',
  email: 'seamus@example.com',
  source: 'word_of_mouth',
  status: 'new',
  notes: 'Wants front garden redesigned',
  created_at: '2026-04-10T10:00:00.000000Z',
}

export const mockCustomerDetail = {
  ...mockCustomers[0],
  address: {
    id: 1,
    address_line_1: '12 Main Street',
    address_line_2: null,
    city: 'Millstreet',
    county: 'Cork',
    postcode: 'P51 AB12',
  },
  default_callout_fee: null,
  discount_pct: 0,
  maintenance_hours_balance: 0,
  loyalty_credits: 0,
}

export const mockCustomerHistory = {
  stats: {
    total_jobs: 0,
    total_visits: 0,
    first_job_date: null,
    last_job_date: null,
    is_returning: false,
  },
  jobs: [],
}

export const mockUnscheduledJob = {
  id: 10,
  title: 'Hedge Trim - Murphy',
  type: 'standard',
  status: 'backlog',
  scheduled_date: null,
  due_by: null,
  priority: 'normal',
  weather_req: 'any',
  customer_forecast: null,
  customer: { id: 1, name: 'John Murphy', minutes_from_hq: 10 },
}

export const mockScheduledJob = {
  id: 11,
  title: "Lawn Care - O'Brien",
  type: 'standard',
  status: 'scheduled',
  scheduled_date: '2026-06-03',
  due_by: null,
  priority: 'normal',
  weather_req: 'any',
  customer_forecast: null,
  customer: { id: 2, name: "Mary O'Brien", minutes_from_hq: 5 },
}

export const mockSchedule = {
  week_start: '2026-06-02',
  week_end:   '2026-06-08',
  scheduled:         [mockScheduledJob],
  overdue:           [],
  unscheduled:       [mockUnscheduledJob],
  scheduled_tasks:   [],
  overdue_tasks:     [],
  unscheduled_tasks: [],
}

export const mockInvoice = {
  id: 1,
  invoice_number: 'LL-2026-100',
  status: 'draft',
  issued_date: '2026-04-01',
  due_date: '2026-04-15',
  subtotal: 200.00,
  discount_pct: 0,
  discount_amount: 0,
  vat_rate: 13.5,
  vat_amount: 27.00,
  total_due: 227.00,
  amount_paid: null,
  payment_method: null,
  paid_at: null,
  payment_notes: null,
  notes: null,
  customer: {
    id: 1,
    name: 'John Murphy',
    email: 'john@example.com',
    phone: '+353871234567',
    address: {
      address_line_1: '12 Main Street',
      address_line_2: null,
      city: 'Millstreet',
      county: 'Cork',
      postcode: 'P51 AB12',
    },
  },
  job: { id: 1, title: 'Garden Clearup', type: 'standard' },
  line_items: [],
}
