import type { Metadata } from 'next'
import { Source_Serif_4, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif',
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
      className={`${sourceSerif.variable} ${inter.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="min-h-full antialiased">{children}</body>
    </html>
  )
}
