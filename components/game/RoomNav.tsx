'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Landmark, ShieldAlert, Users, Gavel, Newspaper, Globe2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// Shell-only room nav. No new game logic — just a persistent way to move
// between the existing screens, framed as rooms in the White House.
// Explicitly "free navigation": visiting a room never costs a turn, unlike
// the monthly-action cards on the Oval Office.
interface RoomDef {
  id: string
  label: string
  icon: typeof Landmark
  href: (gameId: string) => string
}

const ROOMS: RoomDef[] = [
  { id: 'oval-office', label: 'Oval', icon: Landmark, href: (id) => `/game/${id}` },
  { id: 'situation-room', label: 'Situation', icon: ShieldAlert, href: (id) => `/game/${id}/situation-room` },
  { id: 'cabinet', label: 'Cabinet', icon: Users, href: (id) => `/game/${id}/cabinet` },
  { id: 'congress', label: 'Congress', icon: Gavel, href: (id) => `/game/${id}/congress` },
  { id: 'press-room', label: 'Press', icon: Newspaper, href: (id) => `/game/${id}/history` },
  { id: 'diplomatic-office', label: 'Diplomatic', icon: Globe2, href: (id) => `/game/${id}/diplomatic-office` },
]

interface BreakingEvent {
  id: string
  title: string
}

export function RoomNav({ gameId, breakingEvent }: { gameId: string; breakingEvent?: BreakingEvent | null }) {
  const pathname = usePathname()
  const ovalOfficeHref = `/game/${gameId}`
  const isOvalOffice = pathname === ovalOfficeHref

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40">
      {breakingEvent && !isOvalOffice && (
        <Link
          href={ovalOfficeHref}
          className="flex animate-pulse items-center justify-between border-t border-[var(--color-bad)] bg-[var(--color-bad-dim)]/90 px-4 py-2 backdrop-blur-sm transition-opacity hover:opacity-90"
        >
          <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-[var(--color-bad)]">
            🚨 Breaking: {breakingEvent.title}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--color-bad)]">
            Respond →
          </span>
        </Link>
      )}

      <div className="flex items-center justify-around gap-1 border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 px-1.5 py-2 backdrop-blur-md">
        {ROOMS.map(room => {
          const href = room.href(gameId)
          const isActive = room.id === 'oval-office'
            ? isOvalOffice
            : pathname.startsWith(href)
          const Icon = room.icon

          return (
            <Link
              key={room.id}
              href={href}
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full px-2 py-1.5 transition-colors',
                isActive
                  ? 'bg-[var(--color-brass)] text-[var(--color-ink)]'
                  : 'text-[var(--color-paper-faint)] hover:text-[var(--color-paper)]'
              )}
            >
              <Icon size={18} strokeWidth={isActive ? 2.25 : 1.75} />
              <span className="truncate font-mono text-[9px] uppercase tracking-[0.03em]">
                {room.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
