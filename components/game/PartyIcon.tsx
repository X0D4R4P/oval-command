import Image from 'next/image'
import type { Party } from '@/types/game'

const PARTY_ICON: Record<Party, string> = {
  DEMOCRAT:    '/party/democrat.png',
  REPUBLICAN:  '/party/republican.png',
  INDEPENDENT: '/party/independent.png',
}

const PARTY_LABEL: Record<Party, string> = {
  DEMOCRAT:    'Democratic',
  REPUBLICAN:  'Republican',
  INDEPENDENT: 'Independent',
}

interface PartyIconProps {
  party: Party
  size?: number
  showLabel?: boolean
  className?: string
}

export function PartyIcon({ party, size = 20, showLabel = false, className }: PartyIconProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ''}`}>
      <Image
        src={PARTY_ICON[party]}
        alt={PARTY_LABEL[party]}
        width={size}
        height={size}
        className="object-contain"
        style={{ width: size, height: size }}
      />
      {showLabel && (
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-paper-faint)]">
          {PARTY_LABEL[party]}
        </span>
      )}
    </span>
  )
}
