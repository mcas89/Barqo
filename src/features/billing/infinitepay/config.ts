export const INFINITEPAY_LINKS_URL = 'https://api.checkout.infinitepay.io/links'
export const INFINITEPAY_CHECK_URL = 'https://api.checkout.infinitepay.io/payment_check'

export function getInfinitePayHandle(): string {
  const handle = (import.meta.env.VITE_INFINITEPAY_HANDLE as string | undefined)?.trim()
  if (!handle) {
    throw new Error('InfinitePay não configurada. Defina VITE_INFINITEPAY_HANDLE no .env.')
  }
  return handle.replace(/^\$/, '')
}
