const CATEGORY_BACKGROUNDS: Record<string, string> = {
  military:  '/situation-room-bg.png',
  security:  '/situation-room-bg.png',
  disaster:  '/situation-room-bg.png',
  economy:   '/cabinet-room-bg.png',
  social:    '/cabinet-room-bg.png',
  scandal:   '/press-room-bg.png',
  media:     '/press-room-bg.png',
  congress:  '/congress-bg.png',
  diplomacy: '/diplomatic-office-bg.png',
  international: '/diplomatic-office-bg.png',
}

const DEFAULT_BACKGROUND = '/oval-office-bg.png'

export function getEventBackground(category: string): string {
  return CATEGORY_BACKGROUNDS[category] ?? DEFAULT_BACKGROUND
}

// Same category -> accent-color mapping CategoryTag.tsx uses, so the crisis
// card's backdrop tint and border always match that event's own category
// color instead of a fixed neutral tone.
const CATEGORY_ACCENTS: Record<string, string> = {
  security:  'var(--color-cat-security)',
  economy:   'var(--color-cat-economy)',
  disaster:  'var(--color-cat-disaster)',
  military:  'var(--color-cat-military)',
  scandal:   'var(--color-cat-scandal)',
  congress:  'var(--color-cat-congress)',
  social:    'var(--color-cat-social)',
  diplomacy: 'var(--color-cat-diplomacy)',
}

export function getEventAccentColor(category: string): string {
  return CATEGORY_ACCENTS[category] ?? 'var(--color-brass)'
}
