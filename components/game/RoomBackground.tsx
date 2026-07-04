import type { CSSProperties } from 'react'

// Full-viewport photo backdrop for a room, with a flat uniform scrim so
// RoomNav/DashboardHeader/StatCards — which have no opaque background of
// their own and can end up anywhere in the viewport as the player scrolls —
// stay readable regardless of scroll position (a radial vignette leaves the
// edges too bright; see CrisisCard's original fix for this exact issue).
// Every layer here is a FLAT, spatially-uniform color — no gradients — so
// contrast is identical everywhere in the viewport regardless of scroll
// position. A gradient scrim would reintroduce exactly the "edges too
// bright" bug this was built to fix, just relocated to a different edge.
export function RoomBackground({ image, color }: { image: string; color?: string }) {
  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          backgroundImage: `url(${image})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
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
 */
export function roomAccentStyle(color: string): CSSProperties {
  return {
    '--color-surface': `color-mix(in srgb, #131825 82%, ${color} 18%)`,
    '--color-surface-2': `color-mix(in srgb, #1A2332 78%, ${color} 22%)`,
    '--color-border': `color-mix(in srgb, #2A3344 55%, ${color} 45%)`,
    '--color-border-strong': `color-mix(in srgb, #3D4A5C 50%, ${color} 50%)`,
  } as CSSProperties
}
