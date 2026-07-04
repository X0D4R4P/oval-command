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

export interface RoomTreatment {
  backgroundPosition: string
  foregroundStyle: 'desk' | 'chairs' | 'columns'
  foregroundColor: string
}

// Per-photo composition treatment — keyed by the image path itself (not
// category) so both the fixed room pages and CrisisCard's dynamic
// per-category background share one definition. Positions/colors were
// picked by actually looking at each photo (see the room-composition plan):
// Oval Office/Cabinet/Situation Room were shot with a desk/table filling the
// bottom of frame; Diplomatic Office/Congress are symmetric architectural
// shots with strong bilateral columns; Press Room has chair-backs already
// close to camera at the bottom.
const ROOM_TREATMENTS: Record<string, RoomTreatment> = {
  '/oval-office-bg.png':      { backgroundPosition: 'center bottom', foregroundStyle: 'desk',    foregroundColor: '#2a1810' },
  '/cabinet-room-bg.png':     { backgroundPosition: 'center bottom', foregroundStyle: 'desk',    foregroundColor: '#3d2417' },
  '/situation-room-bg.png':   { backgroundPosition: 'center bottom', foregroundStyle: 'desk',    foregroundColor: '#241812' },
  '/diplomatic-office-bg.png':{ backgroundPosition: 'center 35%',    foregroundStyle: 'columns', foregroundColor: '#c9a876' },
  '/congress-bg.png':         { backgroundPosition: 'center 35%',    foregroundStyle: 'columns', foregroundColor: '#b89a6e' },
  '/press-room-bg.png':       { backgroundPosition: 'center center', foregroundStyle: 'chairs',  foregroundColor: '#1a1d24' },
}

export function getRoomTreatment(image: string): RoomTreatment {
  return ROOM_TREATMENTS[image] ?? ROOM_TREATMENTS['/oval-office-bg.png']
}
