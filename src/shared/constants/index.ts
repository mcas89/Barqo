export const APP_NAME = 'BALQO'
export const APP_TAGLINE = 'Seu comércio em movimento'
export const APP_VERSION = '1.0.13'

/** Azul-marinho da marca (logo em /logo.png). */
export const DEFAULT_THEME_COLOR = '#0b1f3a'
export const DEFAULT_THEME_BG = '#f4f6fa'
export const DEFAULT_THEME_SOFT = '#dbe4f0'

/** Logo oficial BALQO em `public/`. */
export const BALQO_LOGO_SRC = '/logo.png'

const LEGACY_THEME_COLORS = new Set(['#0f3d2e', '#14532d', '#1f6b52'])

/** WhatsApp do suporte BALQO (DDI+DDD+número, só dígitos). */
export const BALQO_SUPPORT_WHATSAPP = '5531983919015'

export const THEME_PRESETS = [
  { id: 'navy', name: 'Marinho', color: '#0b1f3a', bg: '#f4f6fa', soft: '#dbe4f0' },
  { id: 'midnight', name: 'Noite', color: '#081226', bg: '#f3f4f7', soft: '#d9dde6' },
  { id: 'ocean', name: 'Oceano', color: '#1a3a66', bg: '#f1f5fb', soft: '#d5e2f2' },
  { id: 'royal', name: 'Azul', color: '#1d4ed8', bg: '#eef3ff', soft: '#d6e2ff' },
  { id: 'slate', name: 'Grafite', color: '#334155', bg: '#f4f5f7', soft: '#e2e6ec' },
  { id: 'rose', name: 'Rosa', color: '#be185d', bg: '#fdf2f6', soft: '#f8d7e5' },
  { id: 'blush', name: 'Blush', color: '#e11d48', bg: '#fff1f3', soft: '#ffd6de' },
  { id: 'orchid', name: 'Orquídea', color: '#a21caf', bg: '#faf0fb', soft: '#f0d4f4' },
  { id: 'lilac', name: 'Lilás', color: '#7c3aed', bg: '#f5f0ff', soft: '#e4d8ff' },
  { id: 'wine', name: 'Vinho', color: '#9f1239', bg: '#fdf2f4', soft: '#f3d4dc' },
  { id: 'coral', name: 'Coral', color: '#ea580c', bg: '#fff4ed', soft: '#ffdcc8' },
] as const

export const THEME_COLOR_PRESETS = THEME_PRESETS.map((theme) => theme.color)

export type ThemeTokens = {
  brand: string
  bg: string
  soft: string
}

function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const value = Number.parseInt(match[1], 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function mixWithWhite(hex: string, whiteRatio: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return DEFAULT_THEME_BG
  const mix = (channel: number) => Math.round(channel * (1 - whiteRatio) + 255 * whiteRatio)
  return `#${[mix(rgb[0]), mix(rgb[1]), mix(rgb[2])]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`
}

export function resolveThemeColor(color?: string | null): string {
  if (!color) return DEFAULT_THEME_COLOR
  const normalized = color.trim().toLowerCase()
  if (LEGACY_THEME_COLORS.has(normalized)) return DEFAULT_THEME_COLOR
  return color.trim()
}

export function resolveThemeTokens(color?: string | null): ThemeTokens {
  const brand = resolveThemeColor(color)
  const preset = THEME_PRESETS.find((theme) => theme.color.toLowerCase() === brand.toLowerCase())
  if (preset) {
    return { brand: preset.color, bg: preset.bg, soft: preset.soft }
  }
  return {
    brand,
    bg: mixWithWhite(brand, 0.93),
    soft: mixWithWhite(brand, 0.82),
  }
}

export function themeCssVars(color?: string | null): Record<string, string> {
  const tokens = resolveThemeTokens(color)
  return {
    '--balqo-brand': tokens.brand,
    '--balqo-bg': tokens.bg,
    '--balqo-brand-soft': tokens.soft,
  }
}

export const SYNC_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  SYNCING: 'syncing',
  ERROR: 'error',
} as const

export type SyncStatus = (typeof SYNC_STATUS)[keyof typeof SYNC_STATUS]

export const USER_ROLES = {
  OWNER: 'owner',
  MANAGER: 'manager',
  CASHIER: 'cashier',
  ATTENDANT: 'attendant',
} as const

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES]

export { PLAN_IDS, type PlanId } from './plans'
