import Link from 'next/link'
import { signOut } from '@/lib/auth'
import { Seal } from '@/components/Seal'

interface SiteNavProps {
  userName?: string | null
  userImage?: string | null
}

export function SiteNav({ userName, userImage }: SiteNavProps) {
  return (
    <header className="border-b border-[var(--color-border)]">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-3.5">
        <Link href="/dashboard" className="flex items-center gap-2 text-[var(--color-brass)]">
          <Seal size={18} />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em]">Oval Command</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/achievements"
            className="font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--color-paper-faint)] transition-colors hover:text-[var(--color-brass)]"
          >
            Achievements
          </Link>

          {userName && (
            <div className="flex items-center gap-2">
              {userImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={userImage} alt="" className="h-6 w-6 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-surface-2)] font-mono text-[10px] text-[var(--color-paper-dim)]">
                  {userName[0]?.toUpperCase()}
                </div>
              )}
              <span className="hidden text-xs text-[var(--color-paper-dim)] sm:inline">{userName}</span>
            </div>
          )}

          <form
            action={async () => {
              'use server'
              await signOut({ redirectTo: '/login' })
            }}
          >
            <button
              type="submit"
              className="rounded-sm border border-[var(--color-border-strong)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--color-paper-faint)] transition-colors hover:border-[var(--color-brass-dim)] hover:text-[var(--color-paper)]"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
