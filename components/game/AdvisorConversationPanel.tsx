'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { cn, AVATAR_COLORS } from '@/lib/utils'
import { getLawById } from '@/lib/law-engine'
import { buildAdvisorConversation } from '@/lib/advisor-conversation'
import type { AdvisorRecommendation } from '@/lib/advisor-engine'
import type { Npc } from '@/types/game'

const SEVERITY_STYLE: Record<AdvisorRecommendation['severity'], { label: string; dot: string; border: string }> = {
  critical:    { label: 'Urgent',         dot: 'bg-[var(--color-bad)]',  border: 'border-l-[var(--color-bad)]' },
  warning:     { label: 'Worth watching', dot: 'bg-[var(--color-warn)]', border: 'border-l-[var(--color-warn)]' },
  opportunity: { label: 'Opportunity',    dot: 'bg-[var(--color-good)]', border: 'border-l-[var(--color-good)]' },
}

type ReplyKey = 'tellMeMore' | 'options' | 'risks' | 'canThisWait'

const REPLIES: { key: ReplyKey; label: string }[] = [
  { key: 'tellMeMore', label: 'Tell me more.' },
  { key: 'options', label: 'What are our options?' },
  { key: 'risks', label: 'What are the risks?' },
  { key: 'canThisWait', label: 'Can this wait?' },
]

interface AdvisorConversationPanelProps {
  recommendations: AdvisorRecommendation[]
  gameId: string
  roster: Npc[]
}

export function AdvisorConversationPanel({ recommendations, gameId, roster }: AdvisorConversationPanelProps) {
  const [revealed, setRevealed] = useState<Record<string, Set<ReplyKey>>>({})

  function reveal(recId: string, key: ReplyKey) {
    setRevealed(prev => {
      const current = new Set(prev[recId] ?? [])
      current.add(key)
      return { ...prev, [recId]: current }
    })
  }

  return (
    <div className="space-y-3">
      {recommendations.map(rec => (
        <AdvisorConversationCard
          key={rec.id}
          rec={rec}
          gameId={gameId}
          roster={roster}
          revealedKeys={revealed[rec.id] ?? new Set()}
          onReveal={key => reveal(rec.id, key)}
        />
      ))}
    </div>
  )
}

function AdvisorConversationCard({
  rec,
  gameId,
  roster,
  revealedKeys,
  onReveal,
}: {
  rec: AdvisorRecommendation
  gameId: string
  roster: Npc[]
  revealedKeys: Set<ReplyKey>
  onReveal: (key: ReplyKey) => void
}) {
  const router = useRouter()
  const npc = roster.find(n => n.id === rec.npcId)
  const style = SEVERITY_STYLE[rec.severity]
  const initials = rec.npcName.split(' ').map(w => w[0]).join('').slice(0, 2)
  const law = rec.suggestedAction ? getLawById(rec.suggestedAction.lawId) : undefined
  const content = buildAdvisorConversation(rec, law)

  return (
    <div className={cn('flex gap-3 rounded-sm border border-[var(--color-border)] border-l-2 bg-[var(--color-surface)] px-4 py-3.5 backdrop-blur-sm', style.border)}>
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
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--color-paper)]">{rec.npcName}</span>
          <span className={cn('h-1 w-1 rounded-full', style.dot)} />
          <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--color-paper-faint)]">
            {style.label}
          </span>
        </div>
        <p className="mt-1 text-sm font-medium leading-snug text-[var(--color-paper)]">{rec.headline}</p>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {REPLIES.map(reply => (
            <button
              key={reply.key}
              onClick={() => onReveal(reply.key)}
              className={cn(
                'rounded-sm border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.05em] transition-colors',
                revealedKeys.has(reply.key)
                  ? 'border-[var(--color-border)] text-[var(--color-paper-faint)]'
                  : 'border-[var(--color-border-strong)] text-[var(--color-paper-dim)] hover:border-[var(--color-brass-dim)] hover:text-[var(--color-paper)]'
              )}
            >
              {reply.label}
            </button>
          ))}
        </div>

        {revealedKeys.size > 0 && (
          <div className="mt-2.5 space-y-1.5 border-l border-[var(--color-border)] pl-3">
            {REPLIES.filter(r => revealedKeys.has(r.key)).map(reply => (
              <p key={reply.key} className="text-[13px] italic leading-snug text-[var(--color-paper-dim)]">
                &ldquo;{content[reply.key]}&rdquo;
              </p>
            ))}
          </div>
        )}

        <div className="mt-3">
          {rec.suggestedAction ? (
            <button
              onClick={() => router.push(`/game/${gameId}/congress?highlight=${rec.suggestedAction!.lawId}`)}
              className="rounded-sm border border-[var(--color-brass-dim)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--color-brass)] transition-colors hover:bg-[var(--color-surface-2)] hover:backdrop-blur-sm"
            >
              Prepare a recommendation →
            </button>
          ) : (
            <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--color-paper-faint)]">
              No specific bill to act on yet.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
