'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface ShareButtonProps {
  text: string
  className?: string
}

export function ShareButton({ text, className }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleClick(e: React.MouseEvent) {
    // Guards against sitting inside a wrapping <Link> (e.g. PresidencyCard)
    // — a plain click here should copy text, not also trigger navigation.
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API can fail (permissions, insecure context) — a low-
      // stakes convenience action isn't worth surfacing an error for.
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'rounded-full border border-[var(--color-border-strong)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--color-paper-faint)] transition-colors hover:border-[var(--color-brass-dim)] hover:text-[var(--color-brass)]',
        className
      )}
    >
      {copied ? 'Copied!' : 'Share'}
    </button>
  )
}
