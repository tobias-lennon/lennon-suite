# Lennon Suite — Integration Roadmap
*Last updated: 2026-04-22*

Each phase is ordered by dependency. A phase should be feature-complete and stable before
the next begins. Features within a phase can be built in any order unless noted.

---

## Phase 1 — Foundation Hardening
*The app is stable. Before adding complexity, close the gaps that will cause pain later.*

### 1.1 Company Settings (Admin)
**What:** A settings page storing company-wide values used across the system.
**Fields:** Company name, address, VAT number, logo, HQ eircode/coordinates, default VAT
rate (currently hardcoded 13.5%), default invoice due days (currently hardcoded 30),
minimum billable days target (e.g. 160/year).
**Why now:** Invoice PDFs currently have no company details. VAT rate and due days are
hardcoded. Everything downstream (finance, overhead calc) reads from here.
**Pain points to resolve:** PDF template needs company detail injection. VAT rate must be
pulled from settings not hardcoded.

### 1.2 Customer — Minutes from HQ
**What:** `minutes_from_hq` integer field on customers. Manually entered.
**Why now:** Small change, used immediately for scheduling and route planning later.
No API dependency.

### 1.3 Follow-up Notes on Work Logs
**What:** `follow_up_note` text field on WorkLog. Surfaces as a banner when:
- Opening the work log form for a new log on the same job
- Creating a new job for the same customer
**Why now:** Ties into scheduling — you need to see "bring weed suppressor" before
heading out. Also feeds into the customer portal later.

### 1.4 Lead — Site Visit Badge on List
**What:** Surface `requires_site_visit` as a badge on the leads list. Currently saved
but invisible.
**Why now:** The field exists, it just needs to be shown.

### 1.5 User Roles (Groundwork Only)
**What:** Add a `role` column to users: `admin`, `field`, `customer`. Current users are
all `admin`. Add middleware that checks role on protected routes.
**Why now:** Every phase after this adds role-restricted features. Retrofitting roles
onto a built system is painful. The groundwork is a small migration + middleware change.
**Note:** No UI change needed yet — just the plumbing.

---

## Phase 2 — Scheduling & Weather
*Depends on: 1.1 (HQ eircode for weather), 1.2 (minutes from HQ for routing)*

### 2.1 Weather Dashboard Widget
**What:** Met.éireann free public API, no key required. Show 5-day forecast on the
dashboard. Each day shows condition icon, temp range, rain probability.
**Per-job weather:** Convert customer eircode to lat/lng (one-time, stored on customer).
Pull forecast for that location when viewing a job.
**API:** `https://api.met.ie/opendata/pwsstation.jsonld` / forecast endpoint.
**Pain points:** Need lat/lng on customer — add `latitude` and `longitude` nullable
floats, populate via free geocoding (OpenStreetMap Nominatim, no key, no limit).

### 2.2 Weekly Scheduling View
**What:** A dedicated scheduling page. Week grid (Mon–Sun), each day shows:
- Weather summary for that day (from Met.éireann)
- Jobs assigned to that day
- Total estimated hours
- Colour coding: green = dry, amber = mixed, red = rain
Drag jobs onto days. Jobs panel on the side shows unscheduled jobs sorted by priority
and due date.
**New field needed:** `scheduled_date` already exists on FieldJob. Just need the UI.

### 2.3 Scheduling Suggestions
**What:** Rule-based only (no AI). For each unscheduled job:
- `weather_req: dry_only` → only suggest on forecast-dry days
- `weather_req: dry_preferred` → prefer dry days, allow light rain
- `weather_req: any` → any day
- Maintenance jobs overdue → flagged and prioritised
- Due date proximity → jobs approaching due_by surfaced first
Show suggested day assignments. User can accept or override.

---

## Phase 3 — Employee Management & Field User Role
*Depends on: 1.5 (role groundwork)*

### 3.1 Employee Admin Panel
**What:** Full CRUD for employees from admin settings. Currently employees exist in the
DB but there's no management UI.
**Fields:** Name, phone, email, role (labourer/supervisor), pay rate, active/inactive.
**Note:** Employees are not the same as users currently. Decision needed: do employees
get app logins? If yes, link Employee → User. Recommend yes — field users need to log
their own hours eventually.

### 3.2 Field User App View
**What:** Stripped-down app view for `role: field` users.
**Sees:** Only jobs assigned to them for the day/week, ability to log their own hours on
a work log, their own pay summary.
**Cannot see:** Financials, other employees' rates, customer details beyond name/address,
invoices.
**Pain points:** Current job/customer detail pages expose everything. Need route-level
and component-level role guards.

---

## Phase 4 — Financial Engine
*Depends on: 1.1 (VAT rate, company settings), Phase 3 (employee costs are real)*
*This is the most complex phase. Plan each sub-feature before building.*

### 4.1 Double-Entry Bookkeeping Core
**What:** A `journal_entries` table. Every financial event auto-posts a journal entry:
- Invoice raised → Debit Accounts Receivable, Credit Revenue
- Payment received → Debit Bank, Credit Accounts Receivable
- Material purchased → Debit Materials Cost, Credit Bank/Creditors
- Wage paid → Debit Labour Cost, Credit Bank
**Chart of accounts:** Predefined for a sole trader (Revenue, COGS, Overheads, Assets,
Liabilities). Not user-configurable to start.
**Why not GnuCash:** Two sources of truth = guaranteed drift. Build it in.

### 4.2 Overhead Allocation
**What:** Fixed overheads entered in company settings (insurance, fuel, equipment,
phone, etc.). System calculates cost-per-billable-day based on target days (from 1.1).
Each job gets an overhead allocation displayed on the job detail and factored into
margin reporting.
**Fields needed on company settings:** Monthly overhead line items.

### 4.3 P&L Dashboard
**What:** Revenue vs costs by week/month/season. Charts showing:
- Revenue (invoiced)
- Labour cost
- Materials cost
- Overhead allocation
- Gross and net margin
- Days worked vs target (160/year), overhead clearance date
- Tax liability estimate (Irish sole trader rates)

### 4.4 Job Financial Summary
**What:** On each job detail page, a full breakdown:
- Labour charged vs labour cost (margin)
- Materials charged vs materials cost
- Overhead allocation for this job
- Loyalty discount (real cost to business)
- Tax fraction
- Net profit on this job

### 4.5 Loyalty Points as Financial Entries
**What:** When loyalty hours are earned or redeemed, post a journal entry.
Loyalty liability on the balance sheet. Redemption reduces liability and revenue.
**Note:** This requires the customer portal to exist (Phase 5) before redemption
is possible, but the earning side can be built here.

---

## Phase 5 — Customer Portal
*Depends on: 1.5 (customer role), Phase 4 (loyalty has financial meaning)*

### 5.1 Customer Login
**What:** Customers log in with email/password. See only their own data.
**Sees:** Loyalty balance, invoice history, job history (past visits).
**Cannot see:** Other customers, rates, employee info, financials.

### 5.2 Loyalty Programme UI
**What:** Customer-facing loyalty dashboard.
- Hours earned per job
- Current balance
- How to earn more (referrals, reviews, nursery spend)
- Redemption request (triggers admin notification)
**Earning events:**
- Maintenance billable hours (already tracked)
- Referral (new lead converted with referral source = this customer)
- Good review (admin manually awards)
- Nursery purchase (Phase 6)

### 5.3 Referral Tracking
**What:** Referral code per customer. When a lead is created with that code, link it.
On conversion, award loyalty points to the referrer.

---

## Phase 6 — Plant Nursery Integration
*Depends on: Phase 5 (customer portal, loyalty points)*

### 6.1 Product Catalogue
**What:** Basic product listing (plants, supplies). Admin manages stock and pricing.

### 6.2 Loyalty Redemption in Shop
**What:** Customers can spend loyalty points at checkout for discounts or free items.
Points redeemed → journal entry (liability cleared, discount posted).

### 6.3 Nursery Purchase → Loyalty Points
**What:** Purchase in nursery awards loyalty points. Cashier UI for admin to log
in-person purchases against a customer account.

---

## Open Questions (resolve before each phase)

- **Phase 3:** Do employees get app logins now, or later? Recommend now.
- **Phase 4:** Irish sole trader or partnership for tax calc? Affects rates.
- **Phase 4:** Do we want VAT returns assistance (inputs vs outputs) or just P&L?
- **Phase 5:** Email/password login for customers, or magic link?
- **Phase 6:** Is the nursery a separate physical till, or online only?

---

## Current System — Known Gaps to Watch
- `AddressLookupController.php` file still exists on server (routes removed, file harmless but messy)
- PDF invoice template has no company logo or VAT number yet (Phase 1.1 unblocks this)
- `weather_req` field exists on jobs but has no weather data to compare against yet (Phase 2)
- Loyalty hours tracked on invoices but no customer-facing display yet (Phase 5)
- Employee model exists but no management UI (Phase 3)
