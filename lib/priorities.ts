/**
 * Presidential Priorities — 3-5 campaign-promised goals chosen at cabinet
 * assembly (see components/CabinetSlotPicker.tsx), stored as
 * Game.priorities. Deliberately lightweight: no separate tracking
 * subsystem, just a `hasProgress` check against state that already
 * exists (passedLaws/flags/activeConflicts). A neglected priority raises
 * the weight of a small set of authored "neglect nudge" personnel scenes
 * via lib/cabinet-narrative.ts — same queuing mechanism as every other
 * personnel scene, just a new trigger source.
 */

import { LAWS } from '@/lib/game-engine'
import type { Game, LawSector } from '@/types/game'

export interface PriorityDef {
  id:          string
  label:       string
  description: string
  hasProgress: (game: Pick<Game, 'passedLaws' | 'flags' | 'activeConflicts'>) => boolean
}

function sectorProgress(sector: LawSector) {
  return (game: Pick<Game, 'passedLaws'>) =>
    LAWS.some(l => l.sector === sector && game.passedLaws.includes(l.id))
}

export const PRIORITY_DEFS: PriorityDef[] = [
  {
    id: 'balance_budget',
    label: 'Balance the Budget',
    description: 'Bring the federal deficit under control.',
    hasProgress: sectorProgress('economy_finance'),
  },
  {
    id: 'universal_healthcare',
    label: 'Pass Universal Healthcare',
    description: 'Expand healthcare coverage nationwide.',
    hasProgress: sectorProgress('healthcare'),
  },
  {
    id: 'secure_border',
    label: 'Secure the Border',
    description: 'Strengthen border security and immigration enforcement.',
    hasProgress: game => Boolean(game.flags['border_security']),
  },
  {
    id: 'reduce_crime',
    label: 'Reduce Crime',
    description: 'Lower crime rates through policy and enforcement.',
    hasProgress: sectorProgress('justice_civil_rights'),
  },
  {
    id: 'end_foreign_wars',
    label: 'End Foreign Wars',
    description: 'Wind down active military conflicts.',
    hasProgress: game => game.activeConflicts.length === 0,
  },
  {
    id: 'invest_ai',
    label: 'Invest in AI',
    description: 'Position the country as a leader in artificial intelligence.',
    hasProgress: sectorProgress('technology'),
  },
  {
    id: 'rebuild_infrastructure',
    label: 'Rebuild Infrastructure',
    description: 'Modernize roads, bridges, and utilities.',
    hasProgress: sectorProgress('infrastructure'),
  },
  {
    id: 'combat_climate_change',
    label: 'Combat Climate Change',
    description: 'Reduce emissions and invest in clean energy.',
    hasProgress: sectorProgress('energy_environment'),
  },
]

export const MAX_PRIORITIES = 5
export const MIN_PRIORITIES = 3

/** A priority stays eligible for a "neglect nudge" scene once the term is old enough for inaction to mean something (not month 2). */
const NEGLECT_MONTH_THRESHOLD = 6

export function getNeglectedPriorities(
  game: Pick<Game, 'priorities' | 'passedLaws' | 'flags' | 'activeConflicts' | 'currentMonth'>,
): string[] {
  if (game.currentMonth < NEGLECT_MONTH_THRESHOLD) return []
  return game.priorities.filter(id => {
    const def = PRIORITY_DEFS.find(p => p.id === id)
    return def ? !def.hasProgress(game) : false
  })
}

export function validatePriorities(submitted: string[] | undefined): string[] {
  if (!Array.isArray(submitted)) return []
  const valid = submitted.filter(id => PRIORITY_DEFS.some(p => p.id === id))
  return Array.from(new Set(valid)).slice(0, MAX_PRIORITIES)
}
