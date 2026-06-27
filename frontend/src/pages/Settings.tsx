import { useEffect, useRef, useState } from 'react'
import api from '../lib/api'
import Spinner from '../components/Spinner'
import PatchNotesModal from '../components/PatchNotesModal'

// ── Types ────────────────────────────────────────────────────────────────────

interface CompanySettings {
  company_name: string
  company_email: string
  company_phone: string
  vat_number: string
  address_line_1: string
  address_line_2: string
  city: string
  county: string
  eircode: string
  vat_rate: number
  invoice_due_days: number
  invoice_prefix: string
  loyalty_threshold_hours: number
  loyalty_credit_ex_vat: number
  target_billable_days: number
}

interface Employee {
  id: number
  name: string
  ppsn: string | null
  pay_rate: number
  is_active: boolean
  employment_start_date: string | null
  weekly_tax_credits: number | null
  std_rate_cutoff_weekly: number | null
  usc_status: 'standard' | 'reduced' | 'exempt'
  user: { id: number; email: string } | null
}

interface RateCard {
  id: number
  name: string
  base_rate: number
  power_tool_uplift: number
  waste_uplift: number
  maintenance_rate: number
  callout_fee: number
  callout_threshold_hours: number
}

// ── Constants ────────────────────────────────────────────────────────────────

const BLANK_COMPANY: CompanySettings = {
  company_name:            '',
  company_email:           '',
  company_phone:           '',
  vat_number:              '',
  address_line_1:          '',
  address_line_2:          '',
  city:                    '',
  county:                  '',
  eircode:                 '',
  vat_rate:                13.5,
  invoice_due_days:        30,
  invoice_prefix:          'LL',
  loyalty_threshold_hours: 60,
  loyalty_credit_ex_vat:   251.10,
  target_billable_days:    160,
}

const BLANK_EMPLOYEE = { name: '', pay_rate: '', ppsn: '', email: '', password: '' }

// ── Helpers ──────────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(15,55,20,0.45)' }}>
      {children}
    </label>
  )
}

function fmt(n: number) {
  return n.toFixed(2)
}

function fmtCurrency(val: string): string {
  const n = parseFloat(val)
  return isNaN(n) ? val : n.toFixed(2)
}

function generateEmail(name: string): string {
  // Split on whitespace AND apostrophes so O'Keeffe → ["O","Keeffe"]
  const parts = name.trim().split(/[\s']+/).filter(Boolean)
  if (parts.length === 0) return ''
  const first   = parts[0].toLowerCase()
  const suffix  = parts.slice(1).map(p => p[0]?.toLowerCase() ?? '').join('')
  return `${first}${suffix}@lennonlandscaping.ie`
}

// ── Company Tab ──────────────────────────────────────────────────────────────

function CompanyTab() {
  const [form, setForm]       = useState<CompanySettings>(BLANK_COMPANY)
  const [lceInput, setLceInput] = useState(BLANK_COMPANY.loyalty_credit_ex_vat.toFixed(2))
  const [isLoading, setLoading] = useState(true)
  const [isSaving, setSaving]   = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    api.get('/settings')
      .then(r => {
        setForm({ ...BLANK_COMPANY, ...r.data })
        setLceInput((r.data.loyalty_credit_ex_vat ?? BLANK_COMPANY.loyalty_credit_ex_vat).toFixed(2))
      })
      .finally(() => setLoading(false))
  }, [])

  function set(field: keyof CompanySettings, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function normaliseEircode(raw: string): string {
    const cleaned = raw.trim().toUpperCase().replace(/\s+/g, '')
    return cleaned.length === 7 ? `${cleaned.slice(0, 3)} ${cleaned.slice(3)}` : cleaned
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const { data } = await api.patch('/settings', form)
      setForm({ ...BLANK_COMPANY, ...data })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="card p-6 flex flex-col gap-4">
        <h2 className="section-label">Company Details</h2>
        <div>
          <FieldLabel>Company Name</FieldLabel>
          <input type="text" value={form.company_name} onChange={e => set('company_name', e.target.value)} className="field-input" placeholder="Lennon Landscaping" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel>Phone</FieldLabel>
            <input type="tel" value={form.company_phone} onChange={e => set('company_phone', e.target.value)} className="field-input" placeholder="e.g. 029 12345" />
          </div>
          <div>
            <FieldLabel>Email</FieldLabel>
            <input type="email" value={form.company_email} onChange={e => set('company_email', e.target.value)} className="field-input" placeholder="info@lennonlandscaping.ie" />
          </div>
        </div>
        <div>
          <FieldLabel>VAT Number</FieldLabel>
          <input type="text" value={form.vat_number} onChange={e => set('vat_number', e.target.value)} className="field-input" placeholder="IE1234567X" />
        </div>
      </div>

      <div className="card p-6 flex flex-col gap-4">
        <h2 className="section-label">Company Address</h2>
        <div>
          <FieldLabel>Address Line 1</FieldLabel>
          <input type="text" value={form.address_line_1} onChange={e => set('address_line_1', e.target.value)} className="field-input" />
        </div>
        <div>
          <FieldLabel>Address Line 2</FieldLabel>
          <input type="text" value={form.address_line_2} onChange={e => set('address_line_2', e.target.value)} className="field-input" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <FieldLabel>City / Town</FieldLabel>
            <input type="text" value={form.city} onChange={e => set('city', e.target.value)} className="field-input" placeholder="Millstreet" />
          </div>
          <div>
            <FieldLabel>County</FieldLabel>
            <input type="text" value={form.county} onChange={e => set('county', e.target.value)} className="field-input" placeholder="Cork" />
          </div>
          <div>
            <FieldLabel>Eircode</FieldLabel>
            <input type="text" value={form.eircode} onChange={e => set('eircode', e.target.value)} onBlur={e => set('eircode', normaliseEircode(e.target.value))} className="field-input" placeholder="P51 AB12" />
          </div>
        </div>
      </div>

      <div className="card p-6 flex flex-col gap-4">
        <h2 className="section-label">Invoice Settings</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <FieldLabel>VAT Rate (%)</FieldLabel>
            <input type="number" step="0.1" min="0" max="100" value={form.vat_rate} onChange={e => set('vat_rate', parseFloat(e.target.value) || 0)} className="field-input" />
          </div>
          <div>
            <FieldLabel>Default Due Days</FieldLabel>
            <input type="number" min="1" max="365" value={form.invoice_due_days} onChange={e => set('invoice_due_days', parseInt(e.target.value) || 30)} className="field-input" />
          </div>
          <div>
            <FieldLabel>Invoice Prefix</FieldLabel>
            <input type="text" value={form.invoice_prefix} onChange={e => set('invoice_prefix', e.target.value.toUpperCase())} className="field-input" placeholder="LL" maxLength={10} />
          </div>
        </div>
      </div>

      <div className="card p-6 flex flex-col gap-4">
        <h2 className="section-label">Business Targets</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <FieldLabel>Loyalty Threshold (hours)</FieldLabel>
            <input type="number" min="1" value={form.loyalty_threshold_hours} onChange={e => set('loyalty_threshold_hours', parseInt(e.target.value) || 60)} className="field-input" />
            <p className="text-xs mt-1" style={{ color: 'rgba(15,55,20,0.4)' }}>Maintenance hours before a loyalty credit is awarded</p>
          </div>
          <div>
            <FieldLabel>Loyalty Credit Value (ex. VAT, €)</FieldLabel>
            <input
              type="number"
              step="any"
              min="0"
              value={lceInput}
              onChange={e => {
                setLceInput(e.target.value)
                const v = parseFloat(e.target.value)
                if (!isNaN(v)) set('loyalty_credit_ex_vat', v)
              }}
              onBlur={e => {
                const v = parseFloat(e.target.value)
                const formatted = isNaN(v) ? '0.00' : v.toFixed(2)
                setLceInput(formatted)
                set('loyalty_credit_ex_vat', parseFloat(formatted))
              }}
              className="field-input"
            />
            <p className="text-xs mt-1" style={{ color: 'rgba(15,55,20,0.4)' }}>Value of a free visit awarded when the threshold is reached (ex. VAT)</p>
          </div>
          <div>
            <FieldLabel>Target Billable Days / Year</FieldLabel>
            <input type="number" min="1" max="366" value={form.target_billable_days} onChange={e => set('target_billable_days', parseInt(e.target.value) || 160)} className="field-input" />
            <p className="text-xs mt-1" style={{ color: 'rgba(15,55,20,0.4)' }}>Used for overhead allocation and P&L reporting</p>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex items-center gap-4 justify-end">
        {saved && <p className="text-sm font-semibold" style={{ color: '#97B545' }}>✓ Settings saved</p>}
        <button type="submit" disabled={isSaving} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-lg disabled:opacity-60 transition-all hover:brightness-95 cursor-pointer" style={{ background: '#97B545', color: '#0F3714' }}>
          {isSaving && <Spinner className="w-4 h-4 text-[#0F3714]" />}
          Save Settings
        </button>
      </div>
    </form>
  )
}

// ── Employees Tab ─────────────────────────────────────────────────────────────

function EmployeesTab() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading]     = useState(true)
  const [showAdd, setShowAdd]     = useState(false)
  const [addForm, setAddForm]     = useState(BLANK_EMPLOYEE)
  const [addError, setAddError]   = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const [editId, setEditId]       = useState<number | null>(null)
  const [editForm, setEditForm]   = useState<{
    pay_rate: string; ppsn: string; password: string
    employment_start_date: string; weekly_tax_credits: string
    std_rate_cutoff_weekly: string; usc_status: string
  }>({ pay_rate: '', ppsn: '', password: '', employment_start_date: '', weekly_tax_credits: '', std_rate_cutoff_weekly: '', usc_status: 'standard' })
  const [editError, setEditError] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const addNameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.get('/employees')
      .then(r => setEmployees(r.data))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (showAdd) setTimeout(() => addNameRef.current?.focus(), 50)
  }, [showAdd])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setAddError(null)
    try {
      const payload: Record<string, string | number> = {
        name:     addForm.name,
        pay_rate: parseFloat(addForm.pay_rate) || 0,
      }
      if (addForm.ppsn)  payload.ppsn     = addForm.ppsn
      if (addForm.email) {
        payload.email    = addForm.email
        payload.password = addForm.password
      }
      const { data } = await api.post('/employees', payload)
      setEmployees(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setShowAdd(false)
      setAddForm(BLANK_EMPLOYEE)
    } catch (err: any) {
      setAddError(err.response?.data?.errors ? Object.values(err.response.data.errors).flat().join(' ') : 'Could not add employee.')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(emp: Employee) {
    setEditId(emp.id)
    setEditForm({
      pay_rate:               fmt(emp.pay_rate),
      ppsn:                   emp.ppsn ?? '',
      password:               '',
      employment_start_date:  emp.employment_start_date ?? '',
      weekly_tax_credits:     emp.weekly_tax_credits != null ? String(emp.weekly_tax_credits) : '',
      std_rate_cutoff_weekly: emp.std_rate_cutoff_weekly != null ? String(emp.std_rate_cutoff_weekly) : '',
      usc_status:             emp.usc_status ?? 'standard',
    })
    setEditError(null)
  }

  async function handleEdit(emp: Employee) {
    setEditSaving(true); setEditError(null)
    try {
      const payload: Record<string, string | number | null> = {
        pay_rate:               parseFloat(editForm.pay_rate) || 0,
        ppsn:                   editForm.ppsn || null,
        employment_start_date:  editForm.employment_start_date || null,
        weekly_tax_credits:     editForm.weekly_tax_credits ? parseFloat(editForm.weekly_tax_credits) : null,
        std_rate_cutoff_weekly: editForm.std_rate_cutoff_weekly ? parseFloat(editForm.std_rate_cutoff_weekly) : null,
        usc_status:             editForm.usc_status,
      }
      if (editForm.password) payload.password = editForm.password
      const { data } = await api.patch(`/employees/${emp.id}`, payload)
      setEmployees(prev => prev.map(e => e.id === data.id ? data : e))
      setEditId(null)
    } catch (err: any) {
      setEditError('Could not save changes.')
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDeactivate(emp: Employee) {
    if (!confirm(`Deactivate ${emp.name}?`)) return
    try {
      await api.delete(`/employees/${emp.id}`)
      setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, is_active: false } : e))
    } catch {
      alert('Could not deactivate employee.')
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">{employees.filter(e => e.is_active).length} active</p>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer"
            style={{ background: '#97B545', color: '#0F3714' }}
          >
            + Add Employee
          </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="card p-5 flex flex-col gap-3 border-2" style={{ borderColor: '#97B545' }}>
          <h3 className="text-sm font-bold text-brand-dark">New Employee</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel>Name</FieldLabel>
              <input
                ref={addNameRef}
                type="text"
                required
                value={addForm.name}
                onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
                onBlur={e => {
                  const suggested = generateEmail(e.target.value)
                  if (suggested && !addForm.email) setAddForm(p => ({ ...p, email: suggested }))
                }}
                className="field-input"
                placeholder="Full name"
              />
            </div>
            <div>
              <FieldLabel>Pay Rate (€/hr)</FieldLabel>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={addForm.pay_rate}
                onChange={e => setAddForm(p => ({ ...p, pay_rate: e.target.value }))}
                onBlur={e => setAddForm(p => ({ ...p, pay_rate: fmtCurrency(e.target.value) }))}
                className="field-input"
                placeholder="e.g. 16.00"
              />
            </div>
          </div>

          <div>
            <FieldLabel>PPSN</FieldLabel>
            <input
              type="text"
              value={addForm.ppsn}
              onChange={e => setAddForm(p => ({ ...p, ppsn: e.target.value.toUpperCase() }))}
              className="field-input"
              placeholder="e.g. 1234567A"
              maxLength={10}
            />
          </div>

          <div className="pt-1 border-t border-black/5">
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'rgba(15,55,20,0.4)' }}>App Login (optional)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <FieldLabel>Email</FieldLabel>
                <input type="email" value={addForm.email} onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))} className="field-input" placeholder="Leave blank for no login" />
              </div>
              <div>
                <FieldLabel>Password</FieldLabel>
                <input type="password" value={addForm.password} onChange={e => setAddForm(p => ({ ...p, password: e.target.value }))} className="field-input" placeholder={addForm.email ? 'Required' : '—'} disabled={!addForm.email} />
              </div>
            </div>
          </div>

          {addError && <p className="text-xs text-danger">{addError}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setShowAdd(false); setAddForm(BLANK_EMPLOYEE) }} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-black/6 cursor-pointer">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer disabled:opacity-60" style={{ background: '#97B545', color: '#0F3714' }}>
              {saving && <Spinner className="w-3 h-3 text-[#0F3714]" />}
              Add Employee
            </button>
          </div>
        </form>
      )}

      {/* Employee list */}
      <div className="card divide-y divide-black/5">
        {employees.length === 0 && <p className="px-5 py-4 text-sm text-gray-400">No employees yet.</p>}
        {employees.map(emp => (
          <div key={emp.id} className="px-5 py-4" style={{ opacity: emp.is_active ? 1 : 0.45 }}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-brand-dark">{emp.name}</p>
                  {!emp.is_active && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/8 text-gray-400">Inactive</span>}
                  {emp.user && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(151,181,69,0.15)', color: '#3a6e0f' }}>Has login</span>}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  €{fmt(emp.pay_rate)}/hr
                  {emp.ppsn ? ` · PPSN: ${emp.ppsn}` : ''}
                  {emp.user ? ` · ${emp.user.email}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {emp.is_active && editId !== emp.id && (
                  <>
                    <button onClick={() => startEdit(emp)} className="text-xs font-semibold px-2.5 py-1 rounded-lg cursor-pointer" style={{ background: 'rgba(0,0,0,0.05)', color: '#555' }}>Edit</button>
                    <button onClick={() => handleDeactivate(emp)} className="text-xs font-semibold px-2.5 py-1 rounded-lg cursor-pointer" style={{ background: 'rgba(184,74,42,0.08)', color: '#B84A2A' }}>Deactivate</button>
                  </>
                )}
              </div>
            </div>

            {/* Inline edit */}
            {editId === emp.id && (
              <div className="mt-3 pt-3 border-t border-black/5 flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Pay Rate (€/hr)</FieldLabel>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={editForm.pay_rate}
                      onChange={e => setEditForm(p => ({ ...p, pay_rate: e.target.value }))}
                      onBlur={e => setEditForm(p => ({ ...p, pay_rate: fmtCurrency(e.target.value) }))}
                      className="field-input"
                    />
                  </div>
                  <div>
                    <FieldLabel>PPSN</FieldLabel>
                    <input type="text" value={editForm.ppsn} onChange={e => setEditForm(p => ({ ...p, ppsn: e.target.value.toUpperCase() }))} className="field-input" placeholder="e.g. 1234567A" maxLength={10} />
                  </div>
                  {emp.user && (
                    <div>
                      <FieldLabel>New Password (leave blank to keep)</FieldLabel>
                      <input type="password" value={editForm.password} onChange={e => setEditForm(p => ({ ...p, password: e.target.value }))} className="field-input" placeholder="••••••••" />
                    </div>
                  )}
                </div>
                <div className="pt-2 border-t border-black/5">
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'rgba(15,55,20,0.4)' }}>RPN / Payroll Details</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <FieldLabel>Employment Start Date</FieldLabel>
                      <input type="date" value={editForm.employment_start_date} onChange={e => setEditForm(p => ({ ...p, employment_start_date: e.target.value }))} className="field-input" />
                    </div>
                    <div>
                      <FieldLabel>USC Status</FieldLabel>
                      <select value={editForm.usc_status} onChange={e => setEditForm(p => ({ ...p, usc_status: e.target.value }))} className="field-input">
                        <option value="standard">Standard</option>
                        <option value="reduced">Reduced (Medical Card)</option>
                        <option value="exempt">Exempt</option>
                      </select>
                    </div>
                    <div>
                      <FieldLabel>Weekly Tax Credits (€)</FieldLabel>
                      <input type="number" step="any" min="0" value={editForm.weekly_tax_credits} onChange={e => setEditForm(p => ({ ...p, weekly_tax_credits: e.target.value }))} onBlur={e => setEditForm(p => ({ ...p, weekly_tax_credits: fmtCurrency(e.target.value) }))} className="field-input" placeholder="e.g. 88.46" />
                    </div>
                    <div>
                      <FieldLabel>Weekly Rate Cut-Off (€)</FieldLabel>
                      <input type="number" step="any" min="0" value={editForm.std_rate_cutoff_weekly} onChange={e => setEditForm(p => ({ ...p, std_rate_cutoff_weekly: e.target.value }))} onBlur={e => setEditForm(p => ({ ...p, std_rate_cutoff_weekly: fmtCurrency(e.target.value) }))} className="field-input" placeholder="e.g. 807.69" />
                    </div>
                  </div>
                </div>
                {editError && <p className="text-xs text-danger">{editError}</p>}
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setEditId(null)} className="text-xs font-semibold px-2.5 py-1 rounded-lg cursor-pointer bg-black/6">Cancel</button>
                  <button type="button" onClick={() => handleEdit(emp)} disabled={editSaving} className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg cursor-pointer disabled:opacity-60" style={{ background: '#97B545', color: '#0F3714' }}>
                    {editSaving && <Spinner className="w-3 h-3 text-[#0F3714]" />}
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Rate Cards Tab ────────────────────────────────────────────────────────────

type EditSection = 'standard' | 'maintenance'

function RateCardsTab() {
  const [cards, setCards]     = useState<RateCard[]>([])
  const [loading, setLoading] = useState(true)
  const [editState, setEditState] = useState<{ id: number; section: EditSection; form: Partial<RateCard> } | null>(null)
  const [saving, setSaving]   = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    api.get('/rate-cards')
      .then(r => setCards(r.data))
      .finally(() => setLoading(false))
  }, [])

  function startEdit(card: RateCard, section: EditSection) {
    setEditState({ id: card.id, section, form: { ...card } })
    setSaveError(null)
  }

  async function handleSave() {
    if (!editState) return
    setSaving(true); setSaveError(null)
    try {
      const payload = editState.section === 'standard'
        ? {
            base_rate:               editState.form.base_rate,
            power_tool_uplift:       editState.form.power_tool_uplift,
            waste_uplift:            editState.form.waste_uplift,
            callout_fee:             editState.form.callout_fee,
            callout_threshold_hours: editState.form.callout_threshold_hours,
          }
        : { maintenance_rate: editState.form.maintenance_rate }
      const { data } = await api.patch(`/rate-cards/${editState.id}`, payload)
      setCards(prev => prev.map(c => c.id === data.id ? data : c))
      setEditState(null)
    } catch {
      setSaveError('Could not save rate card.')
    } finally {
      setSaving(false)
    }
  }

  function setField(field: keyof RateCard, value: string) {
    setEditState(prev => prev ? { ...prev, form: { ...prev.form, [field]: parseFloat(value) || 0 } } : prev)
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-gray-400">These are the rates charged to customers.</p>
      {cards.map(card => {
        const isEditingStandard    = editState?.id === card.id && editState.section === 'standard'
        const isEditingMaintenance = editState?.id === card.id && editState.section === 'maintenance'
        const anyEditing           = isEditingStandard || isEditingMaintenance

        return (
          <div key={card.id} className="flex flex-col gap-3">

            {/* Standard rates card */}
            <div className="card p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-brand-dark">{card.name}</h3>
                {!anyEditing && (
                  <button onClick={() => startEdit(card, 'standard')} className="text-xs font-semibold px-2.5 py-1 rounded-lg cursor-pointer" style={{ background: 'rgba(0,0,0,0.05)', color: '#555' }}>Edit</button>
                )}
              </div>

              {isEditingStandard ? (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {([
                      ['base_rate',               'Base Rate (€/hr)'],
                      ['power_tool_uplift',        'Power Tool Uplift (€/hr)'],
                      ['waste_uplift',             'Waste Uplift (€/hr)'],
                      ['callout_fee',              'Callout Fee (€)'],
                      ['callout_threshold_hours',  'Callout Threshold (hrs)'],
                    ] as [keyof RateCard, string][]).map(([field, label]) => (
                      <div key={field}>
                        <FieldLabel>{label}</FieldLabel>
                        <input type="number" step="any" min="0" value={(editState!.form[field] as number) ?? 0} onChange={e => setField(field, e.target.value)} onBlur={e => setField(field, fmtCurrency(e.target.value))} className="field-input" />
                      </div>
                    ))}
                  </div>
                  {saveError && <p className="text-xs text-danger">{saveError}</p>}
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setEditState(null)} className="text-xs font-semibold px-2.5 py-1 rounded-lg cursor-pointer bg-black/6">Cancel</button>
                    <button type="button" onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg cursor-pointer disabled:opacity-60" style={{ background: '#97B545', color: '#0F3714' }}>
                      {saving && <Spinner className="w-3 h-3 text-[#0F3714]" />}
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
                  {([
                    ['Base rate',        card.base_rate],
                    ['Power tool uplift', card.power_tool_uplift],
                    ['Waste uplift',     card.waste_uplift],
                    [`Callout fee (>${card.callout_threshold_hours}h jobs)`, card.callout_fee],
                  ] as [string, number][]).map(([label, val]) => (
                    <div key={label}>
                      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'rgba(15,55,20,0.4)' }}>{label}</p>
                      <p className="text-sm font-semibold text-brand-dark">€{fmt(val)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Maintenance card */}
            <div className="card p-5 flex flex-col gap-4" style={{ borderLeft: '3px solid #97B545' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-brand-dark">Maintenance</h3>
                  <p className="text-[10px] mt-0.5" style={{ color: 'rgba(15,55,20,0.4)' }}>Ongoing maintenance rate for {card.name}</p>
                </div>
                {!anyEditing && (
                  <button onClick={() => startEdit(card, 'maintenance')} className="text-xs font-semibold px-2.5 py-1 rounded-lg cursor-pointer" style={{ background: 'rgba(0,0,0,0.05)', color: '#555' }}>Edit</button>
                )}
              </div>

              {isEditingMaintenance ? (
                <div className="flex flex-col gap-3">
                  <div className="max-w-xs">
                    <FieldLabel>Maintenance Rate (€/hr)</FieldLabel>
                    <input type="number" step="any" min="0" value={(editState!.form.maintenance_rate) ?? 0} onChange={e => setField('maintenance_rate', e.target.value)} onBlur={e => setField('maintenance_rate', fmtCurrency(e.target.value))} className="field-input" />
                  </div>
                  {saveError && <p className="text-xs text-danger">{saveError}</p>}
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setEditState(null)} className="text-xs font-semibold px-2.5 py-1 rounded-lg cursor-pointer bg-black/6">Cancel</button>
                    <button type="button" onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg cursor-pointer disabled:opacity-60" style={{ background: '#97B545', color: '#0F3714' }}>
                      {saving && <Spinner className="w-3 h-3 text-[#0F3714]" />}
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'rgba(15,55,20,0.4)' }}>Rate</p>
                  <p className="text-sm font-semibold text-brand-dark">€{fmt(card.maintenance_rate)}<span className="text-xs font-normal" style={{ color: 'rgba(15,55,20,0.4)' }}>/hr</span></p>
                </div>
              )}
            </div>

          </div>
        )
      })}
    </div>
  )
}

// ── App Tab ──────────────────────────────────────────────────────────────────

function AppTab() {
  const [updateStatus, setUpdateStatus]   = useState<'idle' | 'checking' | 'up-to-date' | 'available'>('idle')
  const [showPatchNotes, setShowPatchNotes] = useState(false)

  async function handleCheckUpdate() {
    setUpdateStatus('checking')
    try {
      const reg = await navigator.serviceWorker?.getRegistration()
      if (reg) await reg.update()
      if (reg?.waiting) {
        setUpdateStatus('available')
        navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true })
        reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        return
      }
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
      const { version: serverVersion } = await res.json()
      if (serverVersion !== __APP_VERSION__) {
        setUpdateStatus('available')
        const cacheKeys = await caches.keys()
        await Promise.all(cacheKeys.map(k => caches.delete(k)))
        await reg?.unregister()
        window.location.reload()
        return
      }
    } catch { /* offline or no SW support */ }
    setUpdateStatus('up-to-date')
    setTimeout(() => setUpdateStatus('idle'), 3000)
  }

  return (
    <div className="flex flex-col gap-5">
      {showPatchNotes && (
        <PatchNotesModal forceVisible onClose={() => setShowPatchNotes(false)} />
      )}

      <div className="card p-6 flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="section-label">App Version</h2>
          <span className="text-xs font-mono font-semibold" style={{ color: 'rgba(15,55,20,0.35)' }}>v{__APP_VERSION__}</span>
        </div>
        <p className="text-xs" style={{ color: 'rgba(15,55,20,0.45)' }}>
          Check for the latest version of the Suite app. Updates install in the background and take effect on next load.
        </p>
        <button
          onClick={handleCheckUpdate}
          disabled={updateStatus === 'checking'}
          className="w-full py-3 rounded-lg text-sm font-bold transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 hover:brightness-95"
          style={{ background: '#0F3714', color: 'white' }}
        >
          {updateStatus === 'checking' && <Spinner className="w-4 h-4 text-white" />}
          {updateStatus === 'checking' ? 'Checking…' : 'Check for Update'}
        </button>
        {updateStatus === 'up-to-date' && (
          <p className="text-sm font-semibold text-center" style={{ color: '#97B545' }}>✓ You're up to date</p>
        )}
      </div>

      <div className="card p-6 flex flex-col gap-4">
        <h2 className="section-label">Patch Notes</h2>
        <p className="text-xs" style={{ color: 'rgba(15,55,20,0.45)' }}>
          Review what's changed in recent updates.
        </p>
        <button
          onClick={() => setShowPatchNotes(true)}
          className="w-full py-3 rounded-lg text-sm font-bold transition-all cursor-pointer hover:brightness-95"
          style={{ background: 'rgba(151,181,69,0.15)', color: '#0F3714' }}
        >
          What's New
        </button>
      </div>
    </div>
  )
}

// ── Main Settings Page ────────────────────────────────────────────────────────

type Tab = 'company' | 'employees' | 'rates' | 'app'

const TABS: { key: Tab; label: string }[] = [
  { key: 'company',   label: 'Company' },
  { key: 'employees', label: 'Employees' },
  { key: 'rates',     label: 'Rate Cards' },
  { key: 'app',       label: 'App' },
]

export default function Settings() {
  const [tab, setTab] = useState<Tab>('company')

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-brand-dark mb-6">Settings</h1>

      <div className="flex gap-1 mb-6 p-1 rounded-xl bg-black/5">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer"
            style={{
              background: tab === t.key ? '#fff' : 'transparent',
              color:      tab === t.key ? '#0F3714' : 'rgba(15,55,20,0.45)',
              boxShadow:  tab === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'company'   && <CompanyTab />}
      {tab === 'employees' && <EmployeesTab />}
      {tab === 'rates'     && <RateCardsTab />}
      {tab === 'app'       && <AppTab />}
    </div>
  )
}
