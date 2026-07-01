import { redirect } from 'next/navigation'
import { auth, signIn } from '@/lib/auth'
import { Seal } from '@/components/Seal'

export default async function LoginPage() {
  const session = await auth()
  if (session?.user) {
    redirect('/dashboard')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <Seal size={44} className="mx-auto text-[var(--color-brass)]" />
          <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-brass)]">
            Oval Command
          </div>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight text-[var(--color-paper)]">
            You are the President.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-paper-dim)]">
            Every decision has consequences. A four-year term. No perfect answers.
          </p>
        </div>

        <div className="mt-9 space-y-3">
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
        </div>

        <p className="mt-8 text-center font-mono text-[11px] text-[var(--color-paper-faint)]">
          A presidential strategy simulation
        </p>
      </div>
    </main>
  )
}
