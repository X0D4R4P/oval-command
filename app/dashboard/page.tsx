import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { monthToDate } from '@/lib/utils'
import { SiteNav } from '@/components/SiteNav'
import { PartyIcon } from '@/components/game/PartyIcon'
import type { Party } from '@/types/game'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const games = await prisma.game.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      presidentName: true,
      party: true,
      difficulty: true,
      currentMonth: true,
      status: true,
      legacyScore: true,
      updatedAt: true,
    },
  })

  type GameSummary = (typeof games)[number]
  const hasGames = games.length > 0

  if (!hasGames) {
    return <OvalOfficeEntry />
  }

  return (
    <>
      <SiteNav userName={session.user.name} userImage={session.user.image} />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-brass)]">
            Oval Command
          </div>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-paper)]">
            Your Administrations
          </h1>
        </div>

        <div className="space-y-3">
          {(games as GameSummary[]).map((game) => (
            <Link
              key={game.id}
              href={`/game/${game.id}`}
              className="block rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 transition-colors hover:border-[var(--color-border-strong)]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-[var(--color-paper)]">
                    President {game.presidentName}
                  </span>
                  <PartyIcon party={game.party as Party} size={16} showLabel className="ml-2" />
                </div>
                <StatusPill status={game.status} legacyScore={game.legacyScore} />
              </div>
              <p className="mt-1 text-xs text-[var(--color-paper-faint)]">
                {game.status === 'ACTIVE'
                  ? `${monthToDate(game.currentMonth)} · Month ${game.currentMonth} of 48`
                  : `Term ended at month ${game.currentMonth}`}
                {game.difficulty && game.difficulty !== 'normal' && (
                  <span className="ml-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--color-warn)]">
                    · {game.difficulty}
                  </span>
                )}
              </p>
            </Link>
          ))}

          <Link
            href="/new-game"
            className="block rounded-sm border border-dashed border-[var(--color-border-strong)] px-5 py-4 text-center text-sm text-[var(--color-paper-faint)] transition-colors hover:border-[var(--color-brass-dim)] hover:text-[var(--color-brass)]"
          >
            + Begin a New Term
          </Link>
        </div>
      </main>
    </>
  )
}

function OvalOfficeEntry() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      fontFamily: 'Georgia, serif',
    }}>
      {/* Background image */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'url(/oval-office-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
      }} />

      {/* Dark overlay to make text readable — darkest in center where text sits */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse 65% 50% at 50% 52%, rgba(3,5,10,0.78) 0%, rgba(3,5,10,0.45) 60%, rgba(3,5,10,0.25) 100%)',
      }} />

      {/* Edge vignette */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(120% 90% at 50% 50%, transparent 40%, rgba(2,3,7,0.7) 80%, rgba(2,3,7,0.92) 100%)',
      }} />

      {/* Centered text overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '20px',
      }}>
        <div style={{
          color: '#B8915A',
          fontFamily: 'monospace',
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.35em',
          marginBottom: 14,
        }}>
          January 20th · Inauguration Day
        </div>

        <h1 style={{
          color: '#E8E4D9',
          fontSize: 'clamp(26px, 4vw, 48px)',
          fontWeight: 600,
          lineHeight: 1.2,
          marginBottom: 14,
          textShadow: '0 2px 20px rgba(0,0,0,0.8)',
        }}>
          Welcome to the Oval Office,<br />Mr. President.
        </h1>

        {/* Brass rule */}
        <div style={{ width: 48, height: 1, background: '#B8915A', margin: '4px auto 18px' }} />

        <p style={{
          color: '#A8A398',
          fontSize: 15,
          lineHeight: 1.75,
          marginBottom: 32,
          maxWidth: 420,
          textShadow: '0 1px 8px rgba(0,0,0,0.9)',
        }}>
          The world is watching. Your cabinet is assembled.<br />
          The first crisis briefing is already on your desk.
        </p>

        <a
          href="/new-game"
          style={{
            display: 'inline-block',
            background: '#B8915A',
            color: '#0B0E14',
            padding: '14px 44px',
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textDecoration: 'none',
            borderRadius: 2,
            border: '1px solid #8A6B3F',
            marginBottom: 14,
          }}
        >
          Take the Oath of Office
        </a>

        <p style={{
          color: '#6B6860',
          fontFamily: 'monospace',
          fontSize: 10,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
        }}>
          48 Months · Infinite Consequences
        </p>
      </div>
    </div>
  )
}

function StatusPill({ status, legacyScore }: { status: string; legacyScore: number | null }) {
  if (status === 'ACTIVE') {
    return (
      <span className="rounded-full bg-[var(--color-good-dim)] px-2.5 py-0.5 font-mono text-[10px] text-[var(--color-good)]">
        In Progress
      </span>
    )
  }
  return (
    <span className="rounded-full bg-[var(--color-surface-2)] px-2.5 py-0.5 font-mono text-[10px] text-[var(--color-paper-dim)]">
      {status === 'COMPLETE' ? `Legacy: ${legacyScore ?? '—'}` : 'Ended'}
    </span>
  )
}
