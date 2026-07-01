interface SealProps {
  size?: number
  className?: string
}

/**
 * A stylized presidential seal — simplified eagle-in-circle emblem.
 *
 * Design constraints driven by actual rendered testing: this is used at
 * sizes from 14px (inline nav) up to 56px (legacy screen). The original
 * version packed in 13 small stars and thin double rings, which looked
 * fine in isolation at 120px but became an illegible smudge at real
 * usage sizes — verified by rendering to PNG at 18px and 56px and
 * visually inspecting the output. This version uses fewer, bolder
 * shapes (single ring, simplified wing/body silhouette with straight
 * angular strokes instead of curves) so the silhouette still reads
 * clearly at 14-18px, while remaining recognizable as an eagle rather
 * than the previous version's bee-like shape.
 */
export function Seal({ size = 32, className }: SealProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Single bold ring — reads clearly even at 14px, unlike the
          previous double-ring + 13-star treatment which vanished */}
      <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="2" opacity="0.85" />

      {/* Eagle: wide flat wingspan with angular feather notches, a
          short body, and a distinct head — silhouette-first design so
          it survives being shrunk to icon size */}
      <path
        d="
          M24 16
          L24 30
          M24 16
          L10 22
          L14 24
          L11 26
          L16 27
          L24 24
          M24 16
          L38 22
          L34 24
          L37 26
          L32 27
          L24 24
        "
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
      />
      {/* Head */}
      <circle cx="24" cy="13" r="2.6" fill="currentColor" />
      {/* Tail */}
      <path d="M24 30 L21 35 L24 33 L27 35 Z" fill="currentColor" opacity="0.9" />
    </svg>
  )
}
