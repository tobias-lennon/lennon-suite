export function toTitleCase(str: string | null): string | null {
  if (!str) return null
  return str
    .replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase())
    .replace(/'([a-z])/g, (_, c) => `'${c.toUpperCase()}`)
}

export function formatPhone(phone: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('353') && digits.length >= 11) {
    return `+353 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`
  }
  return phone
}

export function phoneHref(phone: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('353') ? `+${digits}` : phone
}
