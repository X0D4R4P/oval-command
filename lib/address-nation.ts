import type { Game, StatDelta } from '@/types/game'
import type { SpeechTheme } from '@/lib/headlines'

export interface SpeechThemeMeta {
  id: SpeechTheme
  label: string
  description: string
}

// Shown in the UI before the player picks — deliberately no numeric
// preview, since the actual effect is conditional on current stats (a
// speech that contradicts reality should underperform, not just always
// help) and showing exact deltas up front would give away the answer.
export const SPEECH_THEMES: SpeechThemeMeta[] = [
  { id: 'economy', label: 'Reassure on the Economy', description: 'Tell the country the economy is turning a corner.' },
  { id: 'security', label: 'Project Strength on Security', description: 'Show the country — and the world — that you’re in command.' },
  { id: 'unity', label: 'Call for National Unity', description: 'Ask a divided country to come together.' },
  { id: 'record', label: 'Defend Your Record', description: 'Make the case for what your administration has accomplished.' },
  { id: 'diplomacy', label: 'Reaffirm America’s Global Leadership', description: 'Tell the world where America stands.' },
  { id: 'reform', label: 'Promise to Fix a Broken Congress', description: 'Make the case that gridlock has a cure.' },
]

/**
 * Resolves an "Address the Nation" speech into a stat delta and whether it
 * landed. Each theme's effectiveness is conditioned on whether the
 * underlying stat actually backs up the message — the same "don't just
 * always help" discipline the law/crisis effects already follow, kept
 * simple as a plain lookup rather than a new engine mechanic.
 */
export function resolveSpeech(theme: SpeechTheme, game: Game): { effects: StatDelta; effective: boolean } {
  switch (theme) {
    case 'economy': {
      const effective = game.stats.economy >= 50
      return { effective, effects: effective ? { approval: 4, mediaScore: 1 } : { approval: -3, mediaScore: -1 } }
    }
    case 'security': {
      const effective = game.stats.security >= 50
      return { effective, effects: effective ? { approval: 4, baseSupport: 3 } : { approval: -2, globalReputation: -2 } }
    }
    case 'unity': {
      // Diminishing returns from an already-unpopular president — a unity
      // speech reads as desperate rather than uniting.
      const effective = game.stats.approval >= 35
      return {
        effective,
        effects: { approval: effective ? 2 : 1, unrest: -3, partyUnity: 2 },
      }
    }
    case 'record': {
      const effective = game.passedLaws.length >= 3
      return { effective, effects: effective ? { approval: 5, baseSupport: 4 } : { approval: -1, mediaScore: -1 } }
    }
    case 'diplomacy': {
      const effective = game.stats.globalReputation >= 50
      return { effective, effects: effective ? { globalReputation: 5, approval: 2 } : { globalReputation: -2, approval: -2 } }
    }
    case 'reform': {
      const effective = game.stats.congressSupport >= 50
      return { effective, effects: effective ? { congressSupport: 4, approval: 3 } : { congressSupport: -2, approval: -3 } }
    }
  }
}
