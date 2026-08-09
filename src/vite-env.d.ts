/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface Navigator {
  standalone?: boolean
}

declare module '*.pem?raw' {
  const content: string
  export default content
}

declare module 'jsrsasign' {
  export const KEYUTIL: {
    getKey: (pem: string) => unknown
  }
  export class Signature {
    constructor(params: { alg: string })
    init: (key: unknown) => void
    updateString: (data: string) => void
    sign: () => string
  }
  export function hextorstr(hex: string): string
  export function stob64(str: string): string
  export function hextob64(hex: string): string
}

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  readonly VITE_APP_ENV: string
  readonly VITE_INFINITEPAY_HANDLE?: string
  readonly VITE_PAYMENT_GATEWAY?: string
  readonly VITE_PRINT_AGENT_URL?: string
  readonly VITE_RECEIPT_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
