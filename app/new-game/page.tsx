'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Seal } from '@/components/Seal'
import { PartyIcon } from '@/components/game/PartyIcon'
import type { Party, Difficulty, CreateGameResponse } from '@/types/game'

const PARTIES: { value: Party; label: string; description: string }[] = [
  { value: 'DEMOCRAT', label: 'Democratic', description: 'Stronger starting base support, lower starting congress lean' },
  { value: 'REPUBLICAN', label: 'Republican', description: 'Stronger starting base support, moderate congress lean' },
  { value: 'INDEPENDENT', label: 'Independent', description: 'No party machine — hardest mode, lowest starting support' },
]

export default function NewGamePage() {
  const router = useRouter()
  const [presidentName, setPresidentName] = useState('')
  const [party, setParty] = useState<Party>('DEMOCRAT')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmed = presidentName.trim()
    if (!trimmed) {
      setError('Enter a name for your presidency.')
      return
    }
    if (trimmed.length > 60) {
      setError('Name must be 60 characters or fewer.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presidentName: trimmed, party, difficulty }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Could not start a new term.')
      }

      const data: CreateGameResponse = await res.json()
      router.push(`/game/${data.game.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/dashboard"
          className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-paper-faint)] hover:text-[var(--color-paper)]"
        >
          ← Dashboard
        </Link>
        <div className="mt-4 text-center">
          <Seal size={36} className="mx-auto text-[var(--color-brass)]" />
          <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-brass)]">
            New Term
          </div>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-paper)]">
            Take the Oath of Office
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label htmlFor="presidentName" className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-paper-faint)]">
              President&rsquo;s Name
            </label>
            <input
              id="presidentName"
              type="text"
              value={presidentName}
              onChange={e => setPresidentName(e.target.value)}
              placeholder="e.g. Jordan Hayes"
              maxLength={60}
              className="mt-2 w-full rounded-sm border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-paper)] placeholder:text-[var(--color-paper-faint)] focus:border-[var(--color-brass)]"
            />
          </div>

          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-paper-faint)]">
              Party
            </span>
            <div className="mt-2 space-y-2">
              {PARTIES.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setParty(p.value)}
                  className={cn(
                    'w-full rounded-sm border px-4 py-3 text-left transition-colors',
                    party === p.value
                      ? 'border-[var(--color-brass)] bg-[var(--color-surface-2)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <PartyIcon party={p.value} size={20} />
                    <div className="text-sm font-medium text-[var(--color-paper)]">{p.label}</div>
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--color-paper-faint)]">{p.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty selector */}
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--color-paper-faint)]">
              Difficulty
            </label>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {([
                { value: 'easy',   label: 'Easy',   desc: 'Forgiving start' },
                { value: 'normal', label: 'Normal', desc: 'Balanced' },
                { value: 'hard',   label: 'Hard',   desc: 'Headwinds' },
                { value: 'expert', label: 'Expert', desc: 'Crisis from day one' },
              ] as const).map(d => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDifficulty(d.value)}
                  className={cn(
                    'rounded-sm border px-2 py-2.5 text-center transition-colors',
                    difficulty === d.value
                      ? 'border-[var(--color-brass)] bg-[var(--color-surface-2)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]'
                  )}
                >
                  <div className="text-sm font-medium text-[var(--color-paper)]">{d.label}</div>
                  <div className="mt-0.5 text-[10px] text-[var(--color-paper-faint)]">{d.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="rounded-sm bg-[var(--color-bad-dim)] px-3.5 py-2.5 text-sm text-[var(--color-bad)]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm border border-[var(--color-brass-dim)] bg-[var(--color-brass)] py-3 text-sm font-medium text-[var(--color-ink)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Preparing the briefing…' : 'Begin Your Term'}
          </button>
        </form>
      </div>
    </main>
  )
}
