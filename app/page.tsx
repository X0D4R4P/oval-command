// Root page — redirects based on auth state.
// Phase 1 UI will replace this with the landing / dashboard router.
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export default async function RootPage() {
  const session = await auth()
  if (session?.user) {
    redirect('/dashboard')
  }
  redirect('/login')
}
