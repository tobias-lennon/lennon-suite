# Lennon Suite — Integration Roadmap
*Last updated: 2026-05-26*

Each phase is ordered by dependency. A phase should be feature-complete and stable before
the next begins. Features within a phase can be built in any order unless noted.

---

## ✅ Completed

### Phase 1 — Foundation Hardening
- **1.1** Company Settings (name, address, VAT number, logo, HQ eircode, default VAT rate, due days, target billable days, monthly overheads)
- **1.2** Customer — minutes from HQ field
- **1.3** Follow-up notes on work logs *(partial — field exists, banner not yet implemented → see Phase 7)*
- **1.4** Lead — site visit badge on list
- **1.5** User roles (admin / field / customer) with middleware

### Phase 1.6 — Suppliers & Contacts Directory
Full CRUD contacts module: supplier companies, supplier individuals, tradesmen (with day rate), other. Accessible via Office section.

### Phase 2 — Scheduling & Weather
- Met.éireann forecast widget on dashboard (per-customer lat/lng via Nominatim)
- Weekly scheduling view with drag-and-drop, weather colour coding
- Rule-based scheduling suggestions (weather_req, due date proximity, overdue maintenance)

### Phase 3 — Employee Management, Field Role & Payroll
- Employee admin panel (CRUD, pay rates, PPSN, RPN data: tax credits, rate cut-off, USC status)
- Field user app view (jobs, work log entry, my hours, my payslips)
- Weekly payroll runs: auto-pull hours from work logs, add extra hours, full Irish 2025 tax calc (PAYE/PRSI/USC from RPN), payslip PDF, ROS submission summary

### Leads Module
Full CRM pipeline: lead capture, site visit flag, status tracking, conversion to job.

### Materials Tracking
Per-job materials logging with cost, used in job cost calculations.

---

## Phase 4 — Task Overhaul
*No dependencies. Fix now — current task system is not fit for purpose.*

### What's wrong
Tasks exist but lack structure, assignment, and urgency — not used in practice.

### What it needs
- **Types:** one-off task, recurring task, follow-up reminder
- **Assignment:** assign to a user (admin or field) or leave unassigned (general)
- **Linked context:** optionally linked to a Customer, Job, Lead, or Contact
- **Due date + priority** (low / normal / urgent)
- **Status:** open → in progress → done
- **Dashboard badge:** task count on home screen for assigned open tasks
- **Notifications:** in-app alert when a task is assigned to you or becomes overdue
- **Recurring tasks:** define interval (daily / weekly / monthly), auto-generates next instance on completion

---

## Phase 5 — Scheduling Improvements
*Depends on: Phase 4 (tasks can be linked to schedule)*

### What to improve
- Reduce friction when assigning/moving jobs — fewer taps to reschedule
- Visual density: show more info per day without scrolling
- Unscheduled jobs panel improvements: filter by type, weather req, customer area
- Multi-day job support: a job that spans e.g. 3 days, shows across all 3
- "Clone to next week" for recurring maintenance jobs
- Quick-add job directly from the schedule day view (not via Jobs → New)

---

## Phase 6 — Follow-up Notifications, Notes & Customer Info
*Depends on: Phase 4 (tasks are the follow-up mechanism)*

### Follow-up system
- **Follow-up note on work log:** when closing a work log, optionally set a follow-up reminder (text + date). Surfaces as a task automatically.
- **Follow-up banner:** when opening a new work log or job for the same customer, show any open follow-up notes as a banner
- **Lead follow-ups:** same mechanism — "call back Thursday", auto-creates task

### Customer info improvements
- Emergency/secondary contact field
- Customer-level notes (not per-job — general relationship notes)
- "Last visited" and "Next scheduled" surfaced on customer card
- Customer tags (e.g. "maintenance contract", "one-off", "nursery customer")
- Preferred contact method (call / text / email)

---

## Phase 7 — Quoting & Pricing System
*No hard dependencies. Recommend after Phase 6 so customer info is solid before generating quotes.*
*Feeds into Phase 8 (Financial Engine) — quotes carry internal cost breakdown used in job profitability.*

### 7.1 Activity Timer & Averages
Repeatable physical activities (emptying recycling trailer, loading manure trailer, etc.) are timed over multiple instances to build averages used in pricing.

- Admin logs an activity: name + duration (either live stopwatch or log-after-the-fact entry)
- System calculates rolling average per activity type over last N instances
- Averages are used as time estimates when building a quote

### 7.2 Rate Calculators
Parameterised pricing formulas for common job types. Admin configures base rates, calculator produces a cost/time estimate.

**Examples:**
- Hedge cutting: X metres × rate per metre = estimated price + estimated hours
- Wildflower bed: X m² × rate per m² = estimated price
- Lawn cut: X m² band → estimated time
- Custom: free-form item with manual hours + rate

Rates are editable by admin. Calculators feed directly into quote line items.

### 7.3 Quote Builder
A quote is assembled from a mix of calculator outputs, activity time estimates, and manual line items.

**Internal cost breakdown (admin view):**
- Labour: estimated hours × employee pay rate + employer PRSI
- Materials: cost price (what you pay) + markup → charged price
- Equipment rental: cost
- Tools/consumables: cost
- Overhead allocation: auto-calculated from company settings (cost per billable day × estimated days)
- Contingency buffer: configurable % (e.g. 10%)
- Target profit margin: configurable %
- **Total cost to business / Total charged to customer / Estimated profit**

**Customer-facing breakdown (abstracted):**
Admin groups internal line items into customer-readable categories, e.g.:
- Site Preparation
- Materials & Planting
- Labour
- Waste Removal
- Equipment

Customer sees category totals only — not internal costs, margins, or pay rates.

### 7.4 Quote Lifecycle
- Statuses: Draft → Sent → Accepted / Declined / Expired
- Generate customer-facing PDF (abstracted breakdown, company branding, signature line)
- Convert accepted quote → Job (pre-fills job details from quote)
- Declined quotes: log reason (optional), auto-create follow-up task

---

## Phase 8 — Financial Engine
*Depends on: Company Settings (done), Payroll (done), Materials Tracking (done), Phase 7 (quotes carry cost data)*
*This is the most complex phase. Plan each sub-feature before building.*

### 8.1 Double-Entry Bookkeeping Core
A `journal_entries` table. Every financial event auto-posts a journal entry:
- Invoice raised → Debit Accounts Receivable, Credit Revenue
- Payment received → Debit Bank, Credit Accounts Receivable
- Material purchased → Debit Materials Cost, Credit Bank/Creditors
- Wage paid → Debit Labour Cost, Credit Bank
- Quote converted → estimated cost entries for planning

Chart of accounts: predefined for a sole trader (Revenue, COGS, Overheads, Assets, Liabilities). Not user-configurable to start.

### 8.2 Overhead Allocation
Monthly overhead line items from Company Settings (insurance, fuel, equipment, phone, etc.).
System calculates cost-per-billable-day based on target days. Each job gets an overhead
allocation factored into margin reporting.

### 8.3 Job Financial Summary
On each job detail page, a full breakdown:
- Labour charged vs labour cost (employee gross + employer PRSI)
- Materials charged vs materials cost
- Equipment/rental cost
- Overhead allocation for this job
- Loyalty discount (real cost to business)
- Contingency and margin
- **Net profit on this job**

If the job came from a quote: show quoted vs actual figures side by side.

### 8.4 P&L Dashboard
Revenue vs costs by week / month / season:
- Revenue (invoiced)
- Labour cost (from payroll)
- Materials cost
- Overhead allocation
- Gross and net margin
- Days worked vs target, overhead clearance date
- Tax liability estimate (Irish sole trader rates)
- VAT summary: outputs (invoiced) vs inputs (materials purchased), quarterly

### 8.5 Director / Owner Viability Model
*Context: Jasper (sole trader) and Tobias (not yet formally in the business) want to know if
the business could support both of them fully — replacing the dole, Jasper subsidising Tobias,
and informal jobs for their mother. Plan is to go limited eventually and both draw proper wages.*

**Mechanism:** Treat owners as a special employee type (`type: director`) in the employee system.
- Jasper and Tobias are added as director-type employees with a hypothetical hourly rate
- They log their own hours the same way field staff do (via work logs)
- Pay runs include director entries — calculated identically to employees (gross, PAYE, PRSI, USC)
- Clearly labelled "Viability Model — not real payroll" in the UI
- Incentive effect: hours worked = modelled wage earned, so there's a reason to track time properly

**What it answers:**
- What would the business owe us if it paid us properly at X/hour?
- Does monthly revenue cover: employee wages + director model wages + materials + overheads?
- How many more billable days per month are needed to close the gap?

**Viability dashboard:** A simple summary — revenue this month vs full labour cost (real + modelled)
vs overheads, showing the surplus/deficit. When the surplus is consistently positive, the business
can support going limited. Target: ~€2,200/month net each (≈€800/week gross each).

### 8.6 Loyalty Points as Financial Entries
When loyalty points are earned or redeemed, post a journal entry. Loyalty liability on the
balance sheet. Redemption reduces liability and revenue.

---

## Phase 9 — Customer Portal
*Depends on: Phase 8 (loyalty has financial meaning), customer role (done)*

### 9.1 Customer Login
Email/password login. Customers see only their own data.
- Loyalty balance and history
- Invoice history
- Past job history (dates, type, brief summary)
- Cannot see: rates, employee info, other customers, financials

### 9.2 Loyalty Dashboard
- Points earned per job
- Current balance
- How to earn more (maintenance visits, referrals, reviews, nursery spend)
- Redemption request → triggers admin notification + follow-up task

### 9.3 Appointment Queries
- Customer submits a service request (type, preferred dates, notes)
- Admin receives notification, can convert to Lead or Job directly
- Not a booking system — a structured enquiry form

### 9.4 Referral Tracking
- Referral code per customer
- New lead created with that code → linked to referrer
- On job conversion, award loyalty points to referrer automatically

---

## Phase 10 — Plant Nursery
*Depends on: Phase 9 (customer portal, loyalty points)*

### 10.1 Product Catalogue
Admin manages plants, supplies, and accessories with stock quantities and prices.

### 10.2 Loyalty Redemption in Shop
Customers spend loyalty points at checkout for discounts or free items.
Points redeemed → journal entry (liability cleared, discount posted).

### 10.3 Nursery Purchase → Loyalty Points
In-person purchase cashier UI: admin logs sale against a customer account, points awarded automatically.

### 10.4 Stock Management
- Stock levels tracked per product
- Low-stock alerts
- Supplier linked to product (from Contacts module)
- Purchase orders: record restock from supplier, updates stock level and posts materials cost journal entry

---

## Open Questions (resolve before each phase)

- **Phase 7:** Timer mechanic — live stopwatch or log-after-the-fact? (affects mobile UX build)
- **Phase 8:** Irish sole trader or partnership for tax calc? Affects P&L tax estimate rates.
- **Phase 8:** VAT returns: assistance with quarterly filing, or just summary figures?
- **Phase 9:** Customer login: email/password or magic link (passwordless)?
- **Phase 10:** Is the nursery a separate physical till, or managed entirely through the app?

---

## Known Gaps to Watch
- `AddressLookupController.php` still exists on server (routes removed, file harmless but messy — delete on next backend-only deploy)
- Work log follow-up banner not yet implemented (spec'd in Phase 6)
- `weather_req` comparison uses forecast data correctly but could be smarter with rain probability thresholds
- Loyalty points tracked on invoices but no customer-facing display until Phase 9
