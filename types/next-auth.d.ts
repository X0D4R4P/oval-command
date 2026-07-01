import type { DefaultSession } from 'next-auth'

// Augment the built-in session type so session.user.id is always typed
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
    } & DefaultSession['user']
  }
}
