const CATEGORY_BACKGROUNDS: Record<string, string> = {
  military:  '/situation-room-bg.webp',
  security:  '/situation-room-bg.webp',
  disaster:  '/situation-room-bg.webp',
  economy:   '/cabinet-room-bg.webp',
  social:    '/cabinet-room-bg.webp',
  scandal:   '/press-room-bg.webp',
  media:     '/press-room-bg.webp',
  congress:  '/congress-bg.webp',
  diplomacy: '/diplomatic-office-bg.webp',
  international: '/diplomatic-office-bg.webp',
}

const DEFAULT_BACKGROUND = '/oval-office-bg.webp'

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
// per-category background share one definition. All six room photos are now
// first-person POV shots (seated at the desk/table, or standing at a podium)
// with a blurred foreground object — a nameplate, folder, teacup, or the
// presidential seal — sitting at the bottom of frame, same "desk edge"
// composition the campaign/debate photos already use.
const ROOM_TREATMENTS: Record<string, RoomTreatment> = {
  '/oval-office-bg.webp':      { backgroundPosition: 'center center', foregroundStyle: 'desk', foregroundColor: '#1c130c' },
  '/cabinet-room-bg.webp':     { backgroundPosition: 'center center', foregroundStyle: 'desk', foregroundColor: '#1f150d' },
  '/situation-room-bg.webp':   { backgroundPosition: 'center center', foregroundStyle: 'desk', foregroundColor: '#12141a' },
  '/diplomatic-office-bg.webp':{ backgroundPosition: 'center center', foregroundStyle: 'desk', foregroundColor: '#3d2417' },
  '/congress-bg.webp':         { backgroundPosition: 'center center', foregroundStyle: 'desk', foregroundColor: '#3d2b18' },
  '/press-room-bg.webp':       { backgroundPosition: 'center center', foregroundStyle: 'desk', foregroundColor: '#12141a' },
  // The podium's own curved top edge (with the presidential seal) already
  // sits at the very bottom of frame, same composition as the desk-edge
  // rooms — foregroundColor sampled from the podium's dark navy body so
  // the added gradient blends into the photo rather than tinting it.
  '/debate-podium-bg.webp':    { backgroundPosition: 'center center', foregroundStyle: 'desk',    foregroundColor: '#12141a' },
  // Same podium-edge composition, one per campaign-flow beat.
  '/campaign-rally-bg.webp':   { backgroundPosition: 'center center', foregroundStyle: 'desk',    foregroundColor: '#3d2b18' },
  '/victory-night-bg.webp':    { backgroundPosition: 'center center', foregroundStyle: 'desk',    foregroundColor: '#151824' },
  '/concession-night-bg.webp': { backgroundPosition: 'center center', foregroundStyle: 'desk',    foregroundColor: '#0d0f14' },
}

export function getRoomTreatment(image: string): RoomTreatment {
  return ROOM_TREATMENTS[image] ?? ROOM_TREATMENTS['/oval-office-bg.webp']
}
