export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
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
