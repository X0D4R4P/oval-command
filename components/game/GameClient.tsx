'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ShieldAlert, Gavel, Megaphone } from 'lucide-react'
import { TermProgress } from '@/components/game/TermProgress'
import { CrisisCard } from '@/components/game/CrisisCard'
import { OutcomeCard } from '@/components/game/OutcomeCard'
import { LegacyScreen } from '@/components/game/LegacyScreen'
import { HeadlineTicker } from '@/components/game/HeadlineTicker'
import { ApprovalChart } from '@/components/game/ApprovalChart'
import { ConflictBanner } from '@/components/game/ConflictBanner'
import { RoomAtmosphere } from '@/components/game/RoomAtmosphere'
import { RoomBackground, roomAccentStyle } from '@/components/game/RoomBackground'
import { AchievementUnlockToast } from '@/components/game/AchievementUnlockToast'
import { ApprovalGauge } from '@/components/game/ApprovalGauge'
import { ActionCard, type ActionCardTag } from '@/components/game/ActionCard'
import { PresidentialInbox } from '@/components/game/PresidentialInbox'
import { DailyBrief } from '@/components/game/DailyBrief'
import { OnboardingWelcome } from '@/components/game/OnboardingWelcome'
import { GuestExpiryWarning } from '@/components/game/GuestExpiryWarning'
import { getEventAccentColor, getRoomTreatment } from '@/lib/event-backgrounds'
import { computeLegacyScore, checkGameOver, isBreakingEvent, computePassProbability, NPCS } from '@/lib/game-engine'
import { getLegislativeOpportunity } from '@/lib/law-engine'
import { getAdvisorRecommendations } from '@/lib/advisor-engine'
import { computeStatTrend, getTopMovers } from '@/lib/stat-trends'
import { cn, monthToDate, AVATAR_COLORS } from '@/lib/utils'
import type { InactivityWarning } from '@/lib/guest-cleanup'
import type { PresidentialArchetype } from '@/lib/archetype-engine'
import type { Game, GameLog, CrisisEvent, TurnResult, ProcessTurnResponse } from '@/types/game'

interface GameClientProps {
  initialGame: Game
  initialEvent: CrisisEvent | null
  recentLogs: GameLog[]
  inactivityWarning: InactivityWarning | null
  githubEnabled: boolean
  googleEnabled: boolean
  finishedGameArchetype?: PresidentialArchetype
}

type ViewState =
  | { phase: 'briefing' }
  | { phase: 'outcome'; result: TurnResult; nextEvent: CrisisEvent | null }
  | { phase: 'gameover'; result: TurnResult }
  | { phase: 'loaded-gameover'; reason: import('@/types/game').GameOverReason }

const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-[var(--color-bad)]',
  warning: 'bg-[var(--color-warn)]',
  opportunity: 'bg-[var(--color-good)]',
}

export function GameClient({ initialGame, initialEvent, recentLogs: initialRecentLogs, inactivityWarning, githubEnabled, googleEnabled, finishedGameArchetype }: GameClientProps) {
  const router = useRouter()
  const [game, setGame] = useState(initialGame)
  const [event, setEvent] = useState(initialEvent)
  // A crisis-choice turn updates game state without a full page navigation
  // (unlike Congress/Press Room, which route away and back), so the
  // server-fetched recentLogs prop would otherwise go stale the moment a
  // turn completes — the gauge's "this month" delta and top movers would
  // silently keep reflecting last month's turn. Kept as state and
  // prepended to on every successful turn.
  const [recentLogs, setRecentLogs] = useState(initialRecentLogs)

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
      const { nextEvent, ...result } = data
      setGame(result.game)
      setRecentLogs(prev => [
        { ...result.log, id: `pending-${result.log.month}`, createdAt: new Date().toISOString() },
        ...prev,
      ].slice(0, 8))

      if (result.gameOver) {
        setView({ phase: 'gameover', result })
      } else {
        setView({ phase: 'outcome', result, nextEvent: nextEvent ?? null })
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
    const archetype = view.phase === 'gameover' ? view.result.archetype : finishedGameArchetype
    const gameoverTreatment = getRoomTreatment('/oval-office-bg.webp')
    return (
      <main className="mx-auto max-w-3xl px-6 py-12" style={roomAccentStyle('var(--color-brass)')}>
        <RoomBackground
          image="/oval-office-bg.webp"
          color="var(--color-brass)"
          backgroundPosition={gameoverTreatment.backgroundPosition}
          foreground={{ style: gameoverTreatment.foregroundStyle, color: gameoverTreatment.foregroundColor }}
        />
        <LegacyScreen
          legacy={legacy}
          reason={reason}
          presidentName={game.presidentName}
          archetype={archetype}
          passedLaws={game.passedLaws}
          onNewGame={() => router.push('/new-game')}
        />
        {view.phase === 'gameover' && (view.result.newAchievements?.length ?? 0) > 0 && (
          <div className="mt-4">
            <AchievementUnlockToast achievements={view.result.newAchievements ?? []} />
          </div>
        )}
        {game.approvalHistory.length >= 2 && (
          <div className="mt-4">
            <ApprovalChart approvalHistory={game.approvalHistory} />
          </div>
        )}
      </main>
    )
  }

  const accentColor = event ? getEventAccentColor(event.category) : 'var(--color-brass)'

  // ── Trend data for the gauge + Daily Brief (derived from GameLog, no
  // schema change — see lib/stat-trends.ts) ──────────────────────────
  const approvalTrend = computeStatTrend(game.stats.approval, recentLogs, 'approval')
  const topMovers = getTopMovers(recentLogs, 3).filter(m => m.key !== 'approval')

  // ── Action-card status, each derived from data already computed
  // elsewhere on this page — no new engine logic ─────────────────────
  const crisisTag: ActionCardTag | undefined = event ? 'Required' : undefined
  const crisisPriority = event
    ? (isBreakingEvent(event) || event.category === 'scandal' || event.category === 'security' ? 'High Priority' : 'Standard priority')
    : undefined

  const opportunity = getLegislativeOpportunity(game)
  const lawTag: ActionCardTag | undefined = opportunity ? 'Recommended' : undefined
  const lawDetail = opportunity?.suggested
    ? `${Math.round(computePassProbability(opportunity.suggested, game))}% chance of passage`
    : undefined
  const lawLabel = opportunity?.suggested ? opportunity.suggested.shortTitle : 'Review available bills'

  const showElectionCountdown = game.currentMonth >= 40
  const monthLabel = monthToDate(game.currentMonth)

  const topAdvisorRec = advisorRecommendations[0]
  const topAdvisorNpc = topAdvisorRec ? NPCS.find(n => n.id === topAdvisorRec.npcId) : undefined

  return (
    <main className="mx-auto max-w-3xl px-6 py-10" style={roomAccentStyle(accentColor)}>
      <RoomAtmosphere color="var(--color-brass)" />

      {view.phase === 'briefing' && (
        <DailyBrief
          gameId={game.id}
          month={game.currentMonth}
          monthLabel={monthLabel}
          approvalDelta={approvalTrend.deltaFromLastMonth}
          topMovers={topMovers}
          pendingCrisisTitle={event?.title ?? null}
        />
      )}

      {/* 1. Greeting — no data of its own, just orients the player */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-brass)]">
          Good Morning, Mr. President
        </div>
        <p className="mt-1 text-sm text-[var(--color-paper-faint)]">{monthLabel}</p>
      </div>

      {view.phase === 'briefing' && (
        <div className="mt-4">
          <OnboardingWelcome />
        </div>
      )}

      {view.phase === 'briefing' && inactivityWarning && (
        <div className="mt-4">
          <GuestExpiryWarning warning={inactivityWarning} githubEnabled={githubEnabled} googleEnabled={googleEnabled} />
        </div>
      )}

      <div className="mt-4">
        <TermProgress currentMonth={game.currentMonth} />
      </div>

      {game.activeConflicts.length > 0 && (
        <div className="mt-4">
          <ConflictBanner conflicts={game.activeConflicts} currentMonth={game.currentMonth} />
        </div>
      )}

      {/* 2. Approval gauge — the Oval Office's focal element */}
      <div className="mt-8">
        <ApprovalGauge
          approval={game.stats.approval}
          deltaFromLastMonth={approvalTrend.deltaFromLastMonth}
          topMovers={topMovers}
        />
        <div className="mt-3 text-center">
          <Link
            href={`/game/${game.id}/overview`}
            className="font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--color-paper-faint)] hover:text-[var(--color-brass)]"
          >
            View Government Overview →
          </Link>
        </div>
      </div>

      {view.phase === 'outcome' && view.result.headlines.length > 0 && (
        <div className="mt-6">
          <HeadlineTicker headlines={view.result.headlines} />
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-sm bg-[var(--color-bad-dim)] px-3.5 py-2.5 text-sm text-[var(--color-bad)]">
          {error}
        </p>
      )}

      {/* 3. Choose Your Presidential Action — visually distinct from the
          bottom nav's free room navigation: these are the things that
          consume this month's turn. The live crisis briefing renders
          directly beneath its own card (not after the other two cards and
          the advisor/inbox sections) so responding to it doesn't feel
          disconnected from choosing to. */}
      {view.phase === 'briefing' && (
        <div className="mt-8">
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--color-paper-faint)]">
            Choose Your Presidential Action
          </div>
          <div className="mt-3">
            <ActionCard
              icon={ShieldAlert}
              title="Respond to Crisis"
              label={event ? event.title : 'No briefing this month'}
              detail={crisisPriority}
              tag={crisisTag}
              href={`/game/${game.id}`}
            />
          </div>

          {event && (
            <div className="mt-3">
              <CrisisCard
                event={event}
                month={game.currentMonth}
                gameId={game.id}
                flags={game.flags}
                onChoose={handleChoice}
                disabled={submitting}
              />
            </div>
          )}

          <div className="mt-5 space-y-2.5">
            <ActionCard
              icon={Gavel}
              title="Propose Legislation"
              label={lawLabel}
              detail={lawDetail}
              tag={lawTag}
              href={`/game/${game.id}/congress`}
            />
            <ActionCard
              icon={Megaphone}
              title="Address the Nation"
              label="Deliver a speech to shape public opinion"
              tag="Optional"
              href={`/game/${game.id}/history`}
            />
          </div>
        </div>
      )}

      {/* 4. Advisor recommendation preview — rendered conversationally */}
      {view.phase === 'briefing' && topAdvisorRec && (
        <div className="mt-6">
          <Link
            href={`/game/${game.id}/cabinet`}
            className={cn(
              'block rounded-sm border border-l-2 bg-[var(--color-surface)] px-4 py-3.5 backdrop-blur-sm transition-colors hover:border-[var(--color-brass-dim)]',
              'border-[var(--color-border)]'
            )}
            style={{ borderLeftColor: `var(--color-${topAdvisorRec.severity === 'critical' ? 'bad' : topAdvisorRec.severity === 'warning' ? 'warn' : 'good'})` }}
          >
            <div className="flex items-start gap-3">
              {topAdvisorNpc?.image ? (
                <Image
                  src={topAdvisorNpc.image}
                  alt={topAdvisorNpc.shortName}
                  width={32}
                  height={32}
                  className="h-8 w-8 flex-shrink-0 rounded-sm object-cover"
                />
              ) : (
                <div className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-medium', AVATAR_COLORS[topAdvisorNpc?.avatarColor ?? 'gray'])}>
                  {topAdvisorRec.npcName.split(' ').map(w => w[0]).join('').slice(0, 2)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-[var(--color-brass)]">{topAdvisorRec.npcName}</span>
                <p className="mt-1 text-sm italic leading-snug text-[var(--color-paper-dim)]">
                  “{topAdvisorRec.detail}”
                </p>
                <span className="mt-1.5 inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.05em] text-[var(--color-paper-faint)]">
                  <span className={cn('h-1.5 w-1.5 rounded-full', SEVERITY_DOT[topAdvisorRec.severity])} />
                  {topAdvisorRec.severity}
                </span>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* 5. Inbox Summary */}
      {view.phase === 'briefing' && (
        <div className="mt-6">
          <PresidentialInbox
            gameId={game.id}
            hasPendingCrisis={Boolean(event)}
            advisorMemoCount={advisorRecommendations.length}
            hasCongressionalUpdate={Boolean(opportunity)}
            showElectionCountdown={showElectionCountdown}
          />
        </div>
      )}

      <div className="mt-6">
        {view.phase === 'outcome' && (
          <OutcomeCard
            narrative={view.result.log.narrative ?? ''}
            effects={view.result.log.statDeltas}
            npcReactions={view.result.npcReactions}
            onContinue={handleContinue}
            nextMonth={view.result.game.currentMonth}
            isGameOver={false}
          />
        )}
      </div>
    </main>
  )
}
