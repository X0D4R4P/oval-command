'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DashboardHeader } from '@/components/game/DashboardHeader'
import { TermProgress } from '@/components/game/TermProgress'
import { StatCard } from '@/components/game/StatCard'
import { CrisisCard } from '@/components/game/CrisisCard'
import { OutcomeCard } from '@/components/game/OutcomeCard'
import { LegacyScreen } from '@/components/game/LegacyScreen'
import { HeadlineTicker } from '@/components/game/HeadlineTicker'
import { ApprovalChart } from '@/components/game/ApprovalChart'
import { ConflictBanner } from '@/components/game/ConflictBanner'
import { SecondaryStats } from '@/components/game/SecondaryStats'
import { LegislativeAlert } from '@/components/game/LegislativeAlert'
import { RoomAtmosphere } from '@/components/game/RoomAtmosphere'
import { roomAccentStyle } from '@/components/game/RoomBackground'
import { getEventAccentColor } from '@/lib/event-backgrounds'
import { computeLegacyScore, checkGameOver } from '@/lib/game-engine'
import { getAdvisorRecommendations } from '@/lib/advisor-engine'
import type { Game, CrisisEvent, TurnResult, ProcessTurnResponse } from '@/types/game'

const DASHBOARD_STAT_KEYS = [
  'approval', 'economy', 'security', 'congressSupport',
  'debt', 'unrest', 'globalReputation', 'unemployment',
] as const

interface GameClientProps {
  initialGame: Game
  initialEvent: CrisisEvent | null
}

type ViewState =
  | { phase: 'briefing' }
  | { phase: 'outcome'; result: TurnResult; nextEvent: CrisisEvent | null }
  | { phase: 'gameover'; result: TurnResult }
  | { phase: 'loaded-gameover'; reason: import('@/types/game').GameOverReason }

export function GameClient({ initialGame, initialEvent }: GameClientProps) {
  const router = useRouter()
  const [game, setGame] = useState(initialGame)
  const [event, setEvent] = useState(initialEvent)

  // If the player navigates here for a game that's already finished
  // (e.g. clicking a COMPLETE/GAMEOVER card from the dashboard), the view
  // must start on the gameover screen rather than defaulting to 'briefing'
  // — which previously showed an empty "no briefing available" state
  // instead of the player's actual final legacy score and verdict.
  const initialGameOverReason = initialGame.status !== 'ACTIVE'
    ? (checkGameOver(initialGame) ?? 'TERM_COMPLETE') // defensive fallback; should always resolve in practice
    : null
  const [view, setView] = useState<ViewState>(
    initialGameOverReason ? { phase: 'loaded-gameover', reason: initialGameOverReason } : { phase: 'briefing' }
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Recomputed live from current game state every render — pure function,
  // no API round-trip needed, same pattern as the legacy score import.
  const advisorRecommendations = getAdvisorRecommendations(game)

  async function handleChoice(choiceIndex: number) {
    if (!event || submitting) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/game/${game.id}/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id, choiceIndex }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'The decision could not be processed.')
      }

      const data: ProcessTurnResponse = await res.json()
      setGame(data.result.updatedGame)

      if (data.result.gameOver) {
        setView({ phase: 'gameover', result: data.result })
      } else {
        setView({ phase: 'outcome', result: data.result, nextEvent: data.nextEvent ?? null })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleContinue() {
    if (view.phase !== 'outcome') return
    setEvent(view.nextEvent)
    setView({ phase: 'briefing' })
  }

  if (view.phase === 'gameover' || view.phase === 'loaded-gameover') {
    const legacy = computeLegacyScore(game)
    const reason = view.phase === 'gameover' ? view.result.gameOver! : view.reason
    const archetype = view.phase === 'gameover' ? view.result.archetype : undefined
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <RoomAtmosphere color="var(--color-brass)" />
        <LegacyScreen
          legacy={legacy}
          reason={reason}
          presidentName={game.presidentName}
          archetype={archetype}
          onNewGame={() => router.push('/new-game')}
        />
        {game.approvalHistory.length >= 2 && (
          <div className="mt-4">
            <ApprovalChart approvalHistory={game.approvalHistory} />
          </div>
        )}
      </main>
    )
  }

  const accentColor = event ? getEventAccentColor(event.category) : 'var(--color-brass)'

  return (
    <main className="mx-auto max-w-2xl px-6 py-10" style={roomAccentStyle(accentColor)}>
      <RoomAtmosphere color="var(--color-brass)" />
      <DashboardHeader
        presidentName={game.presidentName}
        party={game.party}
        currentMonth={game.currentMonth}
        approval={game.stats.approval}
      />

      <div className="mt-5">
        <TermProgress currentMonth={game.currentMonth} />
      </div>

      {game.activeConflicts.length > 0 && (
        <div className="mt-4">
          <ConflictBanner conflicts={game.activeConflicts} currentMonth={game.currentMonth} />
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {DASHBOARD_STAT_KEYS.map(key => (
          <StatCard key={key} statKey={key} value={game.stats[key]} />
        ))}
      </div>

      {game.approvalHistory.length >= 2 && (
        <div className="mt-4">
          <ApprovalChart approvalHistory={game.approvalHistory} />
        </div>
      )}

      <div className="mt-4">
        <SecondaryStats stats={game.stats} />
      </div>
      {view.phase === 'outcome' && view.result.headlines.length > 0 && (
        <div className="mt-4">
          <HeadlineTicker headlines={view.result.headlines} />
        </div>
      )}

      {view.phase === 'briefing' && (
        <div className="mt-4">
          <LegislativeAlert game={game} />
        </div>
      )}

      {view.phase === 'briefing' && advisorRecommendations.length > 0 && (
        <div className="mt-4">
          <Link
            href={`/game/${game.id}/cabinet`}
            className="block rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-paper-dim)] transition-colors hover:border-[var(--color-brass-dim)] hover:text-[var(--color-paper)]"
          >
            {advisorRecommendations.length} advisor{advisorRecommendations.length > 1 ? 's have' : ' has'} something to say — visit the Cabinet Room →
          </Link>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-sm bg-[var(--color-bad-dim)] px-3.5 py-2.5 text-sm text-[var(--color-bad)]">
          {error}
        </p>
      )}

      {view.phase === 'briefing' && (
        <div className="mt-4 rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-paper-faint)]">
            This Month
          </div>
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-paper)]">Respond to Briefing</span>
              <span className={event ? 'text-[var(--color-warn)]' : 'text-[var(--color-paper-faint)]'}>
                {event ? 'Pending' : 'None this month'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-paper)]">Propose Legislation</span>
              <Link
                href={`/game/${game.id}/congress`}
                className="text-[var(--color-brass)] hover:underline"
              >
                Congress →
              </Link>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-[var(--color-paper-faint)]">
            Taking either action advances to next month.
          </p>
        </div>
      )}

      <div className="mt-6">
        {view.phase === 'briefing' && event && (
          <CrisisCard
            event={event}
            month={game.currentMonth}
            gameId={game.id}
            flags={game.flags}
            onChoose={handleChoice}
            disabled={submitting}
          />
        )}

        {view.phase === 'briefing' && !event && (
          <div className="rounded-sm border border-dashed border-[var(--color-border-strong)] px-6 py-10 text-center text-sm text-[var(--color-paper-dim)]">
            No briefing available this month. The administration proceeds quietly.
          </div>
        )}

        {view.phase === 'outcome' && (
          <OutcomeCard
            narrative={view.result.log.narrative ?? ''}
            effects={view.result.log.statDeltas}
            npcReactions={view.result.npcReactions}
            onContinue={handleContinue}
            nextMonth={view.result.updatedGame.currentMonth}
            isGameOver={false}
          />
        )}
      </div>
    </main>
  )
}


