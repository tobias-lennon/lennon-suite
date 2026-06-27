import { useState } from 'react'

interface Props {
  onClose: () => void
}

export default function VatCalc({ onClose }: Props) {
  const [mode, setMode]     = useState<'remove' | 'add'>('remove')
  const [amount, setAmount] = useState('')
  const [rate, setRate]     = useState('13.5')

  const amt = parseFloat(amount)
  const r   = parseFloat(rate) / 100

  let net: number | null   = null
  let vat: number | null   = null
  let gross: number | null = null

  if (!isNaN(amt) && !isNaN(r) && amt > 0 && r > 0) {
    if (mode === 'remove') {
      gross = amt
      net   = amt / (1 + r)
      vat   = amt - net
    } else {
      net   = amt
      vat   = amt * r
      gross = amt + vat
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px]"
        onPointerDown={onClose}
      />

      <div className="fixed z-[61] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-72 bg-[#FDFAF5] rounded-2xl shadow-2xl p-5">

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-brand-dark">VAT Calculator</h2>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/8 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer text-base leading-none"
          >
            ×
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 mb-4 p-1 rounded-xl bg-black/6">
          <button
            onClick={() => setMode('remove')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mode === 'remove' ? 'bg-white shadow-sm text-brand-dark' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Remove VAT
          </button>
          <button
            onClick={() => setMode('add')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mode === 'add' ? 'bg-white shadow-sm text-brand-dark' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Add VAT
          </button>
        </div>

        {/* Inputs */}
        <div className="flex flex-col gap-3 mb-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(15,55,20,0.45)' }}>
              {mode === 'remove' ? 'Gross Amount (inc. VAT)' : 'Net Amount (ex. VAT)'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: 'rgba(15,55,20,0.4)' }}>€</span>
              <input
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="field-input pl-7"
                placeholder="0.00"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(15,55,20,0.45)' }}>
              VAT Rate
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="any"
                value={rate}
                onChange={e => setRate(e.target.value)}
                className="field-input pr-7"
                placeholder="13.5"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: 'rgba(15,55,20,0.4)' }}>%</span>
            </div>
          </div>
        </div>

        {/* Results */}
        {net !== null ? (
          <div className="rounded-xl p-3.5 flex flex-col gap-2" style={{ background: 'rgba(15,55,20,0.05)' }}>
            <div className="flex justify-between text-xs">
              <span style={{ color: 'rgba(15,55,20,0.5)' }}>Net</span>
              <span className="font-semibold text-brand-dark">€{net.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: 'rgba(15,55,20,0.5)' }}>VAT ({rate}%)</span>
              <span className="font-semibold text-brand-dark">€{vat!.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs pt-2 border-t border-black/8">
              <span className="font-bold text-brand-dark">Gross</span>
              <span className="font-bold text-brand-dark">€{gross!.toFixed(2)}</span>
            </div>
          </div>
        ) : (
          <div className="rounded-xl p-3.5 text-center text-xs" style={{ background: 'rgba(15,55,20,0.04)', color: 'rgba(15,55,20,0.35)' }}>
            Enter an amount above
          </div>
        )}
      </div>
    </>
  )
}
