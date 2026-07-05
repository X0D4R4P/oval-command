import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ActionCardTag = 'Required' | 'Recommended' | 'Optional'

const TAG_CLASSES: Record<ActionCardTag, string> = {
  Required:    'text-[var(--color-bad)] bg-[var(--color-bad-dim)]',
  Recommended: 'text-[var(--color-brass)] bg-[var(--color-brass)]/15',
  Optional:    'text-[var(--color-cat-security)] bg-[var(--color-cat-security)]/15',
}

// Left accent stripe + border treatment per tag — deliberately higher-
// contrast than a flat card so "Required" reads as unmissable and
// "Optional" recedes, rather than all three cards blending together.
// Both border-left-color and the darker Required background are applied
// via inline style, not Tailwind's `border-l-[...]` utility: Tailwind's
// generated `border-[...]` (all-sides) and `border-l-[...]` (left-only)
// utilities have equal specificity, and the all-sides one was winning
// the cascade regardless of className order, silently making every
// stripe the same neutral border color.
const BORDER_COLOR: Record<ActionCardTag | 'none', string> = {
  Required:    'var(--color-bad)',
  Recommended: 'var(--color-brass)',
  Optional:    'var(--color-cat-security)',
  none:        'var(--color-border)',
}

interface ActionCardProps {
  icon: LucideIcon
  title: string
  label: string
  detail?: string
  tag?: ActionCardTag
  href: string
}

/**
 * One of the three monthly-action shortcut cards on the Oval Office —
 * deliberately distinct from the bottom nav's free room navigation:
 * these cards represent the thing that consumes this month's turn.
 * Each shows a one-line status (what's pending, and how urgent/likely it
 * is) pulled from data already computed on the page, not new engine logic.
 */
export function ActionCard({ icon: Icon, title, label, detail, tag, href }: ActionCardProps) {
  const key = tag ?? 'none'
  return (
    <Link
      href={href}
      className={cn(
        'block rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] py-5 pl-4 pr-4 shadow-[0_6px_16px_rgba(0,0,0,0.25)] backdrop-blur-sm transition-colors hover:border-[var(--color-brass-dim)]',
        tag && 'border-l-4'
      )}
      style={{
        borderLeftColor: BORDER_COLOR[key],
        backgroundColor: tag === 'Required' ? 'color-mix(in srgb, var(--color-surface) 82%, black)' : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Icon size={20} className="text-[var(--color-brass)]" strokeWidth={1.75} />
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-paper)]">
            {title}
          </span>
        </div>
        {tag && (
          <span className={cn('shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.05em]', TAG_CLASSES[tag])}>
            {tag}
          </span>
        )}
      </div>
      <p className="mt-2 pl-[29px] text-[15px] text-[var(--color-paper-dim)]">{label}</p>
      {detail && (
        <p className="mt-1 pl-[29px] font-mono text-[11px] text-[var(--color-paper-faint)]">{detail}</p>
      )}
    </Link>
  )
}
