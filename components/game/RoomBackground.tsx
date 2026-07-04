import type { CSSProperties } from 'react'

export interface RoomForeground {
  /** Which real object in that room's photo this echoes. */
  style: 'desk' | 'chairs' | 'columns'
  /** Base tone sampled from that specific photo (wood, fabric, marble, ...). */
  color: string
}

// Full-viewport photo backdrop for a room, with a flat uniform scrim so
// RoomNav/DashboardHeader/StatCards — which have no opaque background of
// their own and can end up anywhere in the viewport as the player scrolls —
// stay readable regardless of scroll position (a radial vignette leaves the
// edges too bright; see CrisisCard's original fix for this exact issue).
// The photo/wash/scrim layers are FLAT, spatially-uniform color — no
// gradients — so contrast is identical everywhere in the viewport regardless
// of scroll position. A gradient scrim would reintroduce exactly the "edges
// too bright" bug this was built to fix, just relocated to a different edge.
//
// The `foreground` element is different on purpose: it's a fixed decorative
// strip/frame (not behind any text), themed to a specific object already in
// that room's photo (the desk edge, the chair backs, the columns) so the
// room reads as something the player is sitting at/standing in, not a photo
// with a UI floating on top of it. Because RoomBackground's photo layer is
// `fixed` and page content scrolls normally past it, this foreground can't
// track a literal pixel in the photo as the user scrolls — instead it stays
// anchored at the edge of the viewport at all times, which is what keeps the
// "you are here" framing true regardless of scroll position.
export function RoomBackground({
  image,
  color,
  backgroundPosition = 'center center',
  foreground,
}: {
  image: string
  color?: string
  backgroundPosition?: string
  foreground?: RoomForeground
}) {
  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 -z-10 animate-room-breathe"
        style={{
          backgroundImage: `url(${image})`,
          backgroundSize: 'cover',
          backgroundPosition,
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* Room-color wash — warms the photo toward that room's own accent
          instead of a flat neutral dark, without affecting contrast (still
          flat/uniform, sits fully under the scrim below). */}
      {color && (
        <div
          className="pointer-events-none fixed inset-0 -z-10"
          style={{ background: `color-mix(in srgb, ${color} 16%, transparent)` }}
        />
      )}

      {/* Warm-toned (not cool-blue) uniform scrim. Slightly lower opacity
          than the original 0.78 — verified against the brightest plausible
          photo highlight (the diplomatic-office chandelier) still clearing
          WCAG AA for both DashboardHeader's title text and RoomNav's dimmer
          inactive-tab text. */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: 'rgba(10,7,4,0.70)' }}
      />

      {foreground?.style === 'desk' && <DeskEdge color={foreground.color} />}
      {foreground?.style === 'chairs' && <ChairBacks color={foreground.color} />}
      {foreground?.style === 'columns' && <ColumnFrame color={foreground.color} />}
    </>
  )
}

/** A wood-toned strip along the bottom of the viewport — the front edge of
 * the desk/table the player is looking across, with a lighter highlight
 * line where the edge would catch light. */
function DeskEdge({ color }: { color: string }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 h-24"
      style={{
        background: `linear-gradient(to bottom, transparent 0%, color-mix(in srgb, ${color} 55%, transparent) 30%, ${color} 100%)`,
        boxShadow: `inset 0 1px 0 0 color-mix(in srgb, ${color} 40%, white)`,
      }}
    />
  )
}

/** Darker, cooler band echoing the press room's chair backs, which sit much
 * closer to camera in that photo than any other room's foreground object. */
function ChairBacks({ color }: { color: string }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 h-20"
      style={{
        background: `linear-gradient(to bottom, transparent 0%, color-mix(in srgb, ${color} 60%, transparent) 35%, ${color} 100%)`,
      }}
    />
  )
}

/** Two vertical bars at the left/right edges echoing the bilateral column
 * symmetry already in the diplomatic-office and congress photos — frames
 * content between them instead of letting it float in open space. */
function ColumnFrame({ color }: { color: string }) {
  const side = (edge: 'left' | 'right') => ({
    [edge]: 0,
    background: `linear-gradient(to ${edge === 'left' ? 'right' : 'left'}, color-mix(in srgb, ${color} 35%, transparent), transparent)`,
  })
  return (
    <>
      <div className="pointer-events-none fixed inset-y-0 -z-10 hidden w-24 md:block" style={side('left')} />
      <div className="pointer-events-none fixed inset-y-0 -z-10 hidden w-24 md:block" style={side('right')} />
    </>
  )
}

/**
 * Warms a room's cards toward its own accent color via CSS custom-property
 * overrides — cascades to every shared component (StatCard, CabinetCard,
 * LawCard, etc.) that already reads var(--color-surface)/var(--color-border)
 * without needing to touch any of them individually. The surface mix stays
 * conservative (backgrounds this dark barely shift in perceived brightness
 * even at a heavier color mix, so text-on-card contrast is unaffected), but
 * borders — thin lines with no text to protect — take a much stronger mix
 * so the room's identity actually reads at a glance instead of disappearing.
 *
 * Surfaces are also nested through a second color-mix into ~88%/85% opacity
 * (not fully opaque) — paired with each card's own `backdrop-blur-sm` class,
 * this is the "frosted glass" effect: the room's photo genuinely shows
 * through the UI instead of sitting behind a flat opaque box. Blur is what
 * makes this safe — it homogenizes whatever photo detail is behind a card
 * before the semi-transparent tint is applied, so no sharp/bright photo
 * detail can poke through unpredictably.
 */
export function roomAccentStyle(color: string): CSSProperties {
  const surface = `color-mix(in srgb, #131825 82%, ${color} 18%)`
  const surface2 = `color-mix(in srgb, #1A2332 78%, ${color} 22%)`
  return {
    '--color-surface': `color-mix(in srgb, ${surface} 88%, transparent)`,
    '--color-surface-2': `color-mix(in srgb, ${surface2} 85%, transparent)`,
    '--color-border': `color-mix(in srgb, #2A3344 55%, ${color} 45%)`,
    '--color-border-strong': `color-mix(in srgb, #3D4A5C 50%, ${color} 50%)`,
  } as CSSProperties
}
