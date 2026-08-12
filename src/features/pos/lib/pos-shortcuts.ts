import type { PaymentMethod } from '../types'
import { PAYMENT_METHODS } from '../types'

/** Atalhos fixos do PDV (fase 1). Evita F5 e outros conflitos do navegador. */
export const POS_SHORTCUT_LABELS = {
  focusSearch: 'F2',
  cash: 'F4',
  pix: 'F6',
  debit: 'F7',
  finish: 'F8',
  customer: 'F9',
  removeLast: 'Del',
} as const

export const POS_PAYMENT_SHORTCUTS: Partial<Record<PaymentMethod, string>> = {
  [PAYMENT_METHODS.CASH]: POS_SHORTCUT_LABELS.cash,
  [PAYMENT_METHODS.PIX]: POS_SHORTCUT_LABELS.pix,
  [PAYMENT_METHODS.DEBIT]: POS_SHORTCUT_LABELS.debit,
}

export function paymentMethodFromShortcutKey(key: string): PaymentMethod | null {
  if (key === 'F4') return PAYMENT_METHODS.CASH
  if (key === 'F6') return PAYMENT_METHODS.PIX
  if (key === 'F7') return PAYMENT_METHODS.DEBIT
  return null
}

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return target.isContentEditable
}
