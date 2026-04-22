interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message?: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in">
        <h2 className="text-base font-bold text-[#0F3714] mb-2">{title}</h2>
        {message && (
          <p className="text-sm text-gray-500 leading-relaxed mb-5">{message}</p>
        )}
        {!message && <div className="mb-5" />}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-bold rounded-lg text-white hover:brightness-90 transition-colors"
            style={{ backgroundColor: '#0F3714' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
