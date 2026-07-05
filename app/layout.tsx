import type { Metadata } from 'next'
import { Cinzel, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

// Ceremonial/presidential display face — engraved-monument, official-seal
// feel for section titles and historic moments (Legacy screen, Daily
// Brief, room names, "You are the President."). Used sparingly by design;
// Inter carries the other ~90% of the UI.
const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
  weight: ['500', '600', '700'],
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
})

export const metadata: Metadata = {
  title: 'Oval Command',
  description: 'You are the President. Every decision has consequences.',
  icons: {
    icon: '/favicon.png',
  },
  openGraph: {
    title: 'Oval Command',
    description: 'A presidential strategy simulation.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${cinzel.variable} ${inter.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="min-h-full antialiased">{children}</body>
    </html>
  )
}
