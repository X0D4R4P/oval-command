import { HeartPulse, Landmark, Leaf, Shield, Cpu, GraduationCap, Scale, Building2, HandHeart } from 'lucide-react'
import type { LawSector } from '@/types/game'

export interface LawSectorMeta {
  label: string
  icon:  typeof HeartPulse
  color: string
}

// Centralizes sector display metadata the same way CategoryTag.tsx
// centralizes EventCategory metadata — one place to look up label/icon/color
// for the industry/subject-matter taxonomy (distinct from LawCategory,
// which is ideology-driven and still powers headline flavor + achievements).
export const LAW_SECTOR_META: Record<LawSector, LawSectorMeta> = {
  healthcare:            { label: 'Healthcare',     icon: HeartPulse,     color: 'var(--color-sector-healthcare)' },
  economy_finance:       { label: 'Economy',        icon: Landmark,       color: 'var(--color-sector-economy)' },
  energy_environment:    { label: 'Energy',         icon: Leaf,           color: 'var(--color-sector-energy)' },
  defense_security:      { label: 'Defense',        icon: Shield,         color: 'var(--color-sector-defense)' },
  technology:            { label: 'Technology',     icon: Cpu,            color: 'var(--color-sector-technology)' },
  education:             { label: 'Education',      icon: GraduationCap,  color: 'var(--color-sector-education)' },
  justice_civil_rights:  { label: 'Justice',        icon: Scale,          color: 'var(--color-sector-justice)' },
  infrastructure:        { label: 'Infrastructure', icon: Building2,      color: 'var(--color-sector-infrastructure)' },
  social_services:       { label: 'Social Services', icon: HandHeart,     color: 'var(--color-sector-social)' },
}

export const LAW_SECTORS = Object.keys(LAW_SECTOR_META) as LawSector[]
