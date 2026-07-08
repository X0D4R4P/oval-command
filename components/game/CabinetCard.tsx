import Image from 'next/image'
import Link from 'next/link'
import { cn, AVATAR_COLORS } from '@/lib/utils'
import { MILESTONE_ALLY_THRESHOLD, MILESTONE_ESTRANGED_THRESHOLD, getMilestoneText, type MilestoneTier } from '@/lib/npc-milestones'
import { ActivateAbilityButton } from '@/components/game/ActivateAbilityButton'
import type { Npc } from '@/types/game'

interface CabinetCardProps {
  npc: Npc
  relationship: number
  milestoneTier?: MilestoneTier
  /** Dossier extras — only selectable-slot officials have these (see CabinetCandidate); every other NPC omits them and the dossier section just doesn't render. */
  goal?: string
  breakingPoint?: string
  observations?: string[]
  /** Cabinet Room "Discuss [Role]" link — omitted for non-fireable slots (VP, and every non-selectable NPC). */
  discussHref?: string
  /** Player-activated ability trigger (Take the Hit / Economic Briefing) — omitted for every NPC without one. */
  activation?: {
    gameId:   string
    slotId:   string
    eligible: boolean
    reason?:  string
  }
}

function relationshipTone(value: number, min: number, max: number): { label: string; color: string } {
  const pct = (value - min) / (max - min)
  if (pct >= MILESTONE_ALLY_THRESHOLD) return { label: 'Strong ally', color: 'text-[var(--color-good)]' }
  if (pct >= 0.45) return { label: 'Cordial', color: 'text-[var(--color-warn)]' }
  if (pct >= MILESTONE_ESTRANGED_THRESHOLD) return { label: 'Strained', color: 'text-[var(--color-warn)]' }
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

export function CabinetCard({ npc, relationship, milestoneTier, goal, breakingPoint, observations, discussHref, activation }: CabinetCardProps) {
  const { min, max } = npc.relationship
  const tone = relationshipTone(relationship, min, max)
  const barPercent = Math.max(2, Math.min(100, ((relationship - min) / (max - min)) * 100))
  const milestoneText = milestoneTier ? getMilestoneText(npc.id, milestoneTier) : null

  return (
    <div className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] p-4 backdrop-blur-sm">
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

      {milestoneText && (
        <div className="mt-2.5 border-t border-[var(--color-border)] pt-2.5">
          <span
            className={cn(
              'font-mono text-[10px] uppercase tracking-[0.06em]',
              milestoneTier === 'ally' ? 'text-[var(--color-good)]' : 'text-[var(--color-bad)]'
            )}
          >
            {milestoneTier === 'ally' ? '🤝 Milestone: Trusted Ally' : '⚠️ Milestone: Estranged'}
          </span>
          <p className="mt-1 text-[12px] leading-snug text-[var(--color-paper-dim)]">
            {milestoneText}
          </p>
        </div>
      )}

      {(goal || breakingPoint || (observations && observations.length > 0)) && (
        <div className="mt-2.5 space-y-1 border-t border-[var(--color-border)] pt-2.5">
          {goal && (
            <p className="text-[12px] text-[var(--color-paper-faint)]">
              <span className="font-mono uppercase tracking-[0.05em]">Wants:</span> {goal}
            </p>
          )}
          {breakingPoint && (
            <p className="text-[12px] text-[var(--color-paper-faint)]">
              <span className="font-mono uppercase tracking-[0.05em]">Won&rsquo;t:</span> {breakingPoint}
            </p>
          )}
          {observations && observations.length > 0 && (
            <div className="mt-1.5 space-y-1">
              {observations.map((line, i) => (
                <p key={i} className="text-[12px] italic leading-snug text-[var(--color-paper-dim)]">
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {discussHref && (
        <Link
          href={discussHref}
          className="mt-3 block rounded-sm border border-[var(--color-border-strong)] px-3 py-1.5 text-center font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-paper-dim)] transition-colors hover:border-[var(--color-brass-dim)] hover:text-[var(--color-brass)]"
        >
          Discuss →
        </Link>
      )}

      {activation && (
        <ActivateAbilityButton
          gameId={activation.gameId}
          slotId={activation.slotId}
          eligible={activation.eligible}
          reason={activation.reason}
          abilityName={npc.specialAbility.name}
        />
      )}
    </div>
  )
}
