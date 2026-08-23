import {
  UtensilsCrossed,
  Coffee,
  Scissors,
  ShoppingBag,
  BedDouble,
  Store,
  Sparkles,
  Heart,
  Plus,
  Compass,
  BriefcaseBusiness,
  type LucideIcon,
} from 'lucide-react'

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  UtensilsCrossed,
  Coffee,
  Scissors,
  ShoppingBag,
  BedDouble,
  Store,
  Sparkles,
  Heart,
  Plus,
  Compass,
  BriefcaseBusiness,
}

export function categoryIcon(name: string | undefined | null): LucideIcon {
  return (name && CATEGORY_ICONS[name]) || Store
}
