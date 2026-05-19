export function toTitleCase(str: string | null): string | null {
  if (!str) return null
  return str
    .replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase())
    .replace(/'([a-z])/g, (_, c) => `'${c.toUpperCase()}`)
}

export function normalizePhone(phone: string): string | null {
  if (!phone.trim()) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('353') && digits.length >= 11) return '+' + digits
  if (digits.startsWith('0') && digits.length >= 9) return '+353' + digits.slice(1)
  if (phone.trim()) return phone.trim()
  return null
}

export function formatPhone(phone: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('353') && digits.length >= 11) {
    return `+353 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`
  }
  if (digits.startsWith('0') && digits.length >= 9) {
    const nat = digits.slice(1)
    return `+353 ${nat.slice(0, 2)} ${nat.slice(2, 5)} ${nat.slice(5)}`
  }
  if (digits.startsWith('1') && digits.length === 11) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return phone
}

export function formatEstimation(hours: number | null | undefined): string | null {
  if (!hours || hours <= 0) return null
  const HOURS_PER_DAY = 6
  const days = Math.floor(hours / HOURS_PER_DAY)
  const remaining = Math.round((hours % HOURS_PER_DAY) * 10) / 10
  if (days === 0) return `${remaining}h`
  if (remaining === 0) return `${days}d`
  return `${days}d ${remaining}h`
}

export function phoneHref(phone: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('353')) return `+${digits}`
  if (digits.startsWith('0')) return `+353${digits.slice(1)}`
  return phone
}
