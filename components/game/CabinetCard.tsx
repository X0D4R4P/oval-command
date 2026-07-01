import Image from 'next/image'
import { cn, AVATAR_COLORS } from '@/lib/utils'
import type { Npc } from '@/types/game'

interface CabinetCardProps {
  npc: Npc
  relationship: number
}

function relationshipTone(value: number, min: number, max: number): { label: string; color: string } {
  const pct = (value - min) / (max - min)
  if (pct >= 0.7) return { label: 'Strong ally', color: 'text-[var(--color-good)]' }
  if (pct >= 0.45) return { label: 'Cordial', color: 'text-[var(--color-warn)]' }
  if (pct >= 0.25) return { label: 'Strained', color: 'text-[var(--color-warn)]' }
  return { label: 'Hostile', color: 'text-[var(--color-bad)]' }
}

const FACTION_LABEL: Record<Npc['faction'], string> = {
  inner_circle: 'Inner Circle',
  cabinet: 'Cabinet',
  congress: 'Congress',
  opposition: 'Opposition',
  media: 'Media',
  international: 'International',
  civil_society: 'Civil Society',
}

export function CabinetCard({ npc, relationship }: CabinetCardProps) {
  const { min, max } = npc.relationship
  const tone = relationshipTone(relationship, min, max)
  const barPercent = Math.max(2, Math.min(100, ((relationship - min) / (max - min)) * 100))

  return (
    <div className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {npc.image ? (
            <Image
              src={npc.image}
              alt={npc.shortName}
              width={56}
              height={56}
              className="h-14 w-14 rounded-sm object-cover"
            />
          ) : (
            <div
              className={cn(
                'flex h-14 w-14 items-center justify-center rounded-sm font-mono text-sm font-medium',
                AVATAR_COLORS[npc.avatarColor] ?? AVATAR_COLORS.gray
              )}
            >
              {npc.avatar}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-[var(--color-paper)]">{npc.shortName}</span>
            <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--color-paper-faint)]">
              {FACTION_LABEL[npc.faction]}
            </span>
          </div>
          <p className="text-xs text-[var(--color-paper-faint)]">{npc.role}</p>
        </div>
      </div>

      <p className="mt-3 text-[13px] italic leading-snug text-[var(--color-paper-dim)]">
        {npc.personality.archetype}
      </p>

      <div className="mt-3 flex items-center justify-between">
        <span className={cn('font-mono text-xs font-medium', tone.color)}>{tone.label}</span>
        <span className="font-mono text-[11px] tabular-nums text-[var(--color-paper-faint)]">
          {Math.round(relationship)} / {max}
        </span>
      </div>
      <div className="mt-1.5 h-[3px] w-full rounded-full bg-[var(--color-border)]">
        <div
          className={cn('h-full rounded-full transition-all duration-500', tone.color.replace('text-', 'bg-'))}
          style={{ width: `${barPercent}%` }}
        />
      </div>
    </div>
  )
}
