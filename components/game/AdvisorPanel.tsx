'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn, AVATAR_COLORS } from '@/lib/utils'
import { NPCS } from '@/lib/game-engine'
import type { AdvisorRecommendation } from '@/lib/advisor-engine'

const SEVERITY_STYLE: Record<AdvisorRecommendation['severity'], { label: string; dot: string; border: string }> = {
  critical:    { label: 'Urgent',         dot: 'bg-[var(--color-bad)]',  border: 'border-l-[var(--color-bad)]' },
  warning:     { label: 'Worth watching', dot: 'bg-[var(--color-warn)]', border: 'border-l-[var(--color-warn)]' },
  opportunity: { label: 'Opportunity',    dot: 'bg-[var(--color-good)]', border: 'border-l-[var(--color-good)]' },
}

interface AdvisorPanelProps {
  recommendations: AdvisorRecommendation[]
  onProposeLaw?: (lawId: string) => void
}

export function AdvisorPanel({ recommendations, onProposeLaw }: AdvisorPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  if (recommendations.length === 0) return null

  return (
    <div className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)]">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-paper-faint)]">
          Cabinet Briefing
          {recommendations.some(r => r.severity === 'critical') && (
            <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-bad)] align-middle" />
          )}
        </span>
        <span className="font-mono text-[10px] text-[var(--color-paper-faint)]">
          {collapsed ? `Show (${recommendations.length})` : 'Hide'}
        </span>
      </button>

      {!collapsed && (
        <div className="space-y-0 border-t border-[var(--color-border)]">
          {recommendations.map(rec => (
            <AdvisorCard key={rec.id} rec={rec} onProposeLaw={onProposeLaw} />
          ))}
        </div>
      )}
    </div>
  )
}

function AdvisorCard({
  rec,
  onProposeLaw,
}: {
  rec: AdvisorRecommendation
  onProposeLaw?: (lawId: string) => void
}) {
  const npc = NPCS.find(n => n.id === rec.npcId)
  const style = SEVERITY_STYLE[rec.severity]
  const initials = rec.npcName.split(' ').map(w => w[0]).join('').slice(0, 2)

  return (
    <div className={cn('flex gap-3 border-l-2 px-4 py-3.5', style.border)}>
      <div className="flex-shrink-0">
        {npc?.image ? (
          <Image
            src={npc.image}
            alt={npc.shortName}
            width={32}
            height={32}
            className="h-8 w-8 rounded-sm object-cover"
          />
        ) : (
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full font-mono text-[11px] font-medium',
              AVATAR_COLORS[npc?.avatarColor ?? 'gray']
            )}
          >
            {initials}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--color-paper)]">{rec.npcName}</span>
          <span className={cn('h-1 w-1 rounded-full', style.dot)} />
          <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--color-paper-faint)]">
            {style.label}
          </span>
        </div>
        <p className="mt-1 text-sm font-medium leading-snug text-[var(--color-paper)]">{rec.headline}</p>
        <p className="mt-1 text-[13px] italic leading-snug text-[var(--color-paper-dim)]">
          &ldquo;{rec.detail}&rdquo;
        </p>
        {rec.suggestedAction && onProposeLaw && (
          <button
            onClick={() => onProposeLaw(rec.suggestedAction!.lawId)}
            className="mt-2 rounded-sm border border-[var(--color-brass-dim)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--color-brass)] transition-colors hover:bg-[var(--color-surface-2)]"
          >
            Review {rec.suggestedAction.lawTitle} →
          </button>
        )}
      </div>
    </div>
  )
}
