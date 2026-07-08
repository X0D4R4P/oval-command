import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { EventCategory } from '@/types/game'

const CATEGORY_CONFIG: Record<EventCategory, { label: string; color: string; icon: string }> = {
  security:  { label: 'Security',  color: 'var(--color-cat-security)',  icon: '/icons/cat_security.png' },
  economy:   { label: 'Economy',   color: 'var(--color-cat-economy)',   icon: '/icons/cat_economy.png' },
  disaster:  { label: 'Disaster',  color: 'var(--color-cat-disaster)',  icon: '/icons/cat_disaster.png' },
  military:  { label: 'Military',  color: 'var(--color-cat-military)',  icon: '/icons/cat_military.png' },
  scandal:   { label: 'Scandal',   color: 'var(--color-cat-scandal)',   icon: '/icons/cat_scandal.png' },
  congress:  { label: 'Congress',  color: 'var(--color-cat-congress)',  icon: '/icons/cat_congress.png' },
  social:    { label: 'Social',    color: 'var(--color-cat-social)',    icon: '/icons/cat_social.png' },
  diplomacy: { label: 'Diplomacy', color: 'var(--color-cat-diplomacy)', icon: '/icons/cat_diplomacy.png' },
  // No dedicated icon/color pair exists for personnel scenes yet — reuses
  // Congress's icon (closest "people/institutions" fit) and the brass
  // accent already used for inner-circle/administration contexts
  // elsewhere, rather than blocking on new art.
  personnel: { label: 'Personnel', color: 'var(--color-brass)', icon: '/icons/cat_congress.png' },
}

export function CategoryTag({ category, className }: { category: EventCategory; className?: string }) {
  const config = CATEGORY_CONFIG[category]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.1em]',
        className
      )}
      style={{ color: config.color }}
    >
      <Image
        src={config.icon}
        alt={config.label}
        width={12}
        height={12}
        className="h-3 w-3 object-contain"
      />
      {config.label}
    </span>
  )
}
