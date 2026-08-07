export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

/** Normaliza telefone BR para wa.me (DDI 55 + DDD + número). */
export function normalizeWhatsappPhoneBr(value: string): string | null {
  let phone = digitsOnly(value)
  if (!phone) return null

  if (phone.startsWith('0')) phone = phone.replace(/^0+/, '')

  if (phone.length === 10 || phone.length === 11) {
    phone = `55${phone}`
  }

  if (phone.length === 12 || phone.length === 13) {
    if (!phone.startsWith('55')) return null
    return phone
  }

  if (phone.length >= 12 && phone.length <= 15) return phone

  return null
}

export function whatsappUrl(phoneDigits: string, text?: string): string {
  const phone = digitsOnly(phoneDigits)
  const base = `https://wa.me/${phone}`
  if (!text) return base
  return `${base}?text=${encodeURIComponent(text)}`
}

export function formatWhatsappDisplay(phoneDigits: string): string {
  const phone = digitsOnly(phoneDigits)
  if (phone.startsWith('55') && phone.length === 13) {
    return `+55 (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`
  }
  if (phone.startsWith('55') && phone.length === 12) {
    return `+55 (${phone.slice(2, 4)}) ${phone.slice(4, 8)}-${phone.slice(8)}`
  }
  return phone ? `+${phone}` : '—'
}

export function formatWhatsappInputMask(digits: string): string {
  const phone = digitsOnly(digits).slice(0, 13)
  if (phone.startsWith('55') && phone.length > 2) {
    const rest = phone.slice(2)
    if (rest.length <= 2) return `+55 (${rest}`
    if (rest.length <= 7) return `+55 (${rest.slice(0, 2)}) ${rest.slice(2)}`
    return `+55 (${rest.slice(0, 2)}) ${rest.slice(2, 7)}-${rest.slice(7, 11)}`
  }
  if (phone.length <= 2) return phone
  if (phone.length <= 6) return `(${phone.slice(0, 2)}) ${phone.slice(2)}`
  if (phone.length <= 10) {
    return `(${phone.slice(0, 2)}) ${phone.slice(2, 6)}-${phone.slice(6)}`
  }
  return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7, 11)}`
}
