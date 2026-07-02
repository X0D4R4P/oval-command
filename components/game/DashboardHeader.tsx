import Link from 'next/link'
import { monthToDate, getTermYear } from '@/lib/utils'
import { Seal } from '@/components/Seal'
import { PartyIcon } from '@/components/game/PartyIcon'
import type { Party } from '@/types/game'

interface DashboardHeaderProps {
  presidentName: string
  party: Party
  currentMonth: number
  approval: number
}

export function DashboardHeader({ presidentName, party, currentMonth, approval }: DashboardHeaderProps) {
  return (
    <header className="flex items-start justify-between border-b border-[var(--color-border)] pb-5">
      <div>
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-[var(--color-brass)] hover:underline"
        >
          <Seal size={14} />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em]">Oval Command</span>
        </Link>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-paper)]">
          President {presidentName}
        </h1>
        <div className="mt-0.5 flex items-center gap-1.5">
          <PartyIcon party={party} size={14} />
          <p className="text-sm text-[var(--color-paper-faint)]">
            {monthToDate(currentMonth)} · Year {getTermYear(currentMonth)} of Term
          </p>
        </div>
        {currentMonth >= 40 && (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-warn)]">
            🗳️ {currentMonth >= 48 ? 'Election Day' : `${48 - currentMonth} months to Election Day`}
          </p>
        )}
      </div>
      <div className="text-right">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-paper-faint)]">
          Approval Rating
        </div>
        <div className="mt-1 font-mono text-3xl font-medium tabular-nums text-[var(--color-paper)]">
          {Math.round(approval)}%
        </div>
      </div>
    </header>
  )
}
