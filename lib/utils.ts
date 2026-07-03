import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { GameStats } from '@/types/game'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ============================================================
// STAT DISPLAY HELPERS
// ============================================================

export function formatStat(key: keyof GameStats, value: number): string {
  switch (key) {
    case 'debt':
      return `$${value.toFixed(1)}T`
    case 'unemployment':
    case 'inflation':
      return `${value.toFixed(1)}%`
    case 'approval':
      return `${Math.round(value)}%`
    case 'mediaScore':
      const labels = [-2, -1, 0, 1, 2]
      const names = ['Hostile', 'Critical', 'Neutral', 'Favorable', 'Amplifying']
      const idx = labels.indexOf(Math.round(value))
      return idx >= 0 ? names[idx] : 'Neutral'
    default:
      return String(Math.round(value))
  }
}

export function getStatLabel(key: keyof GameStats): string {
  const labels: Record<keyof GameStats, string> = {
    approval: 'Approval',
    economy: 'Economy',
    security: 'Security',
    congressSupport: 'Congress',
    debt: 'National Debt',
    unrest: 'Civil Unrest',
    globalReputation: 'Global Rep.',
    unemployment: 'Unemployment',
    inflation: 'Inflation',
    baseSupport: 'Base Support',
    partyUnity: 'Party Unity',
    militaryReadiness: 'Mil. Readiness',
    mediaScore: 'Media',
  }
  return labels[key] ?? key
}

/** Percentage of stat bar to fill (0-100) */
export function getStatBarPercent(key: keyof GameStats, value: number): number {
  const ranges: Record<string, { min: number; max: number }> = {
    debt: { min: 28, max: 58 },
    unemployment: { min: 2, max: 18 },
    inflation: { min: 0.5, max: 15 },
    mediaScore: { min: -2, max: 2 },
  }
  const range = ranges[key] ?? { min: 0, max: 100 }
  return Math.round(((value - range.min) / (range.max - range.min)) * 100)
}

// ============================================================
// DELTA DISPLAY
// ============================================================

export function formatDelta(key: string, value: number): string {
  const isDebt = key === 'debt'
  const isPercent = key === 'unemployment' || key === 'inflation'
  const sign = value > 0 ? '+' : ''
  if (isDebt) return `${sign}$${Math.abs(value).toFixed(1)}T`
  if (isPercent) return `${sign}${value.toFixed(1)}%`
  return `${sign}${Math.round(value)}`
}

/** Is this delta good or bad? */
export function isDeltaGood(key: string, value: number): boolean {
  const invertedStats = ['debt', 'unrest', 'unemployment', 'inflation']
  const isInverted = invertedStats.includes(key)
  return isInverted ? value < 0 : value > 0
}

// ============================================================
// MONTH / TIME HELPERS
// ============================================================

export function monthToDate(month: number): string {
  const startYear = 2025
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]
  const totalMonths = month - 1
  const year = startYear + Math.floor(totalMonths / 12)
  const monthIdx = totalMonths % 12
  return `${monthNames[monthIdx]} ${year}`
}

export function getTermYear(month: number): number {
  return Math.ceil(month / 12)
}

// ============================================================
// DETERMINISTIC SEEDING
// ============================================================

/**
 * Simple deterministic string hash (djb2 variant). Used to derive stable,
 * non-random-looking values (e.g. intel confidence %) from identifiers like
 * (gameId, eventId) so the same pair always produces the same result across
 * reloads, without persisting anything new.
 */
export function hashSeed(...parts: string[]): number {
  const input = parts.join(':')
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i)
  }
  return Math.abs(hash >>> 0)
}

// ============================================================
// NPC AVATAR COLOR CLASSES
// ============================================================

export const AVATAR_COLORS: Record<string, string> = {
  blue:   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  gray:   'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  green:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  coral:  'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  amber:  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  red:    'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  teal:   'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
}
