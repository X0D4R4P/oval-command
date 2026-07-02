import { redirect } from 'next/navigation'
import { auth, signIn } from '@/lib/auth'
import { Seal } from '@/components/Seal'

export default async function LoginPage() {
  const session = await auth()
  if (session?.user) {
    redirect('/dashboard')
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6">

      {/* Background oval office atmosphere — subtle radial gradient */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_60%,#1a2235_0%,#0B0E14_70%)]" />

      {/* Decorative columns */}
      <div className="pointer-events-none absolute bottom-0 left-8 top-0 w-px bg-gradient-to-b from-transparent via-[var(--color-border)] to-transparent opacity-40" />
      <div className="pointer-events-none absolute bottom-0 right-8 top-0 w-px bg-gradient-to-b from-transparent via-[var(--color-border)] to-transparent opacity-40" />

      <div className="relative w-full max-w-sm">
        <div className="text-center">
          <Seal size={56} className="mx-auto text-[var(--color-brass)]" />
          <div className="mt-5 font-mono text-[10px] uppercase tracking-[0.35em] text-[var(--color-brass)]">
            Oval Command
          </div>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight text-[var(--color-paper)]">
            You are the President.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-paper-dim)]">
            Every decision has consequences.<br />A four-year term. No perfect answers.
          </p>
        </div>

        <div className="mt-10 space-y-3">
          {/* Guest play — creates an anonymous session, no OAuth required */}
          <form
            action={async () => {
              'use server'
              await signIn('guest', { redirectTo: '/new-game' })
            }}
          >
            <button
              type="submit"
              className="block w-full rounded-sm border border-[var(--color-brass-dim)] bg-[var(--color-brass)] py-3.5 text-center text-sm font-semibold text-[var(--color-ink)] transition-opacity hover:opacity-90"
            >
              Play Now — No Sign-In Required
            </button>
          </form>

          <div className="relative flex items-center gap-3 py-1">
            <div className="flex-1 border-t border-[var(--color-border)]" />
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-paper-faint)]">or save your legacy</span>
            <div className="flex-1 border-t border-[var(--color-border)]" />
          </div>

          <form
            action={async () => {
              'use server'
              await signIn('github', { redirectTo: '/dashboard' })
            }}
          >
            <button
              type="submit"
              className="w-full rounded-sm border border-[var(--color-border-strong)] bg-[var(--color-surface)] py-3 text-sm font-medium text-[var(--color-paper)] transition-colors hover:bg-[var(--color-surface-2)]"
            >
              Continue with GitHub
            </button>
          </form>

          <form
            action={async () => {
              'use server'
              await signIn('google', { redirectTo: '/dashboard' })
            }}
          >
            <button
              type="submit"
              className="w-full rounded-sm border border-[var(--color-border-strong)] bg-[var(--color-surface)] py-3 text-sm font-medium text-[var(--color-paper)] transition-colors hover:bg-[var(--color-surface-2)]"
            >
              Continue with Google
            </button>
          </form>
        </div>

        <p className="mt-8 text-center font-mono text-[10px] text-[var(--color-paper-faint)]">
          Sign in to save your legacy score and compare terms
        </p>
      </div>
    </main>
  )
}
