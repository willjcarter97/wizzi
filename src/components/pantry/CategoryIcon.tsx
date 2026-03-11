'use client'

import type { LucideIcon } from 'lucide-react'
import {
  Milk, Beef, Fish, Egg, Apple, Carrot, Wheat, Coffee,
  Wine, Cookie, Sandwich, Soup, IceCream, Pill, Droplets, Nut, Flame, ShoppingBag,
} from 'lucide-react'

interface CategoryConfig { icon: LucideIcon; bg: string; colour: string }

const CATEGORY_MAP: { keywords: string[]; config: CategoryConfig }[] = [
  { keywords: ['dairy','milk','cheese','yogurt','cream','butter'],
    config: { icon: Milk,      bg: 'bg-sky-50',     colour: 'text-sky-500'    } },
  { keywords: ['meat','beef','chicken','pork','lamb','poultry','sausage','bacon'],
    config: { icon: Beef,      bg: 'bg-red-50',     colour: 'text-red-500'    } },
  { keywords: ['fish','seafood','salmon','tuna','prawn','shrimp'],
    config: { icon: Fish,      bg: 'bg-cyan-50',    colour: 'text-cyan-500'   } },
  { keywords: ['egg'],
    config: { icon: Egg,       bg: 'bg-yellow-50',  colour: 'text-yellow-600' } },
  { keywords: ['fruit','apple','banana','berry','citrus','orange','lemon'],
    config: { icon: Apple,     bg: 'bg-green-50',   colour: 'text-green-500'  } },
  { keywords: ['vegetable','produce','carrot','broccoli','salad','greens','herb'],
    config: { icon: Carrot,    bg: 'bg-emerald-50', colour: 'text-emerald-500'} },
  { keywords: ['grain','pasta','rice','bread','flour','cereal','oat','wheat','noodle'],
    config: { icon: Wheat,     bg: 'bg-amber-50',   colour: 'text-amber-600'  } },
  { keywords: ['coffee','tea','cocoa','hot drink'],
    config: { icon: Coffee,    bg: 'bg-orange-50',  colour: 'text-orange-700' } },
  { keywords: ['beverage','drink','juice','water','soda','soft drink'],
    config: { icon: Droplets,  bg: 'bg-blue-50',    colour: 'text-blue-500'   } },
  { keywords: ['wine','beer','alcohol','spirit','liquor'],
    config: { icon: Wine,      bg: 'bg-purple-50',  colour: 'text-purple-500' } },
  { keywords: ['snack','crisp','chip','biscuit','cookie','chocolate','sweet','candy'],
    config: { icon: Cookie,    bg: 'bg-pink-50',    colour: 'text-pink-500'   } },
  { keywords: ['sandwich','wrap','burger','ready meal','deli'],
    config: { icon: Sandwich,  bg: 'bg-orange-50',  colour: 'text-orange-500' } },
  { keywords: ['soup','broth','stock','stew','sauce','condiment','ketchup','mustard'],
    config: { icon: Soup,      bg: 'bg-red-50',     colour: 'text-red-400'    } },
  { keywords: ['frozen','ice cream','gelato'],
    config: { icon: IceCream,  bg: 'bg-indigo-50',  colour: 'text-indigo-400' } },
  { keywords: ['oil','vinegar','dressing'],
    config: { icon: Flame,     bg: 'bg-yellow-50',  colour: 'text-yellow-500' } },
  { keywords: ['nut','seed','almond','walnut','peanut','cashew'],
    config: { icon: Nut,       bg: 'bg-amber-50',   colour: 'text-amber-700'  } },
  { keywords: ['supplement','vitamin','medicine','pill'],
    config: { icon: Pill,      bg: 'bg-teal-50',    colour: 'text-teal-500'   } },
]

const DEFAULT: CategoryConfig = { icon: ShoppingBag, bg: 'bg-base-200', colour: 'text-base-content/40' }

function get(category: string): CategoryConfig {
  const lower = category.toLowerCase()
  for (const { keywords, config } of CATEGORY_MAP) {
    if (keywords.some(kw => lower.includes(kw))) return config
  }
  return DEFAULT
}

interface CategoryIconProps { category: string; size?: number; className?: string }

export default function CategoryIcon({ category, size = 17, className = '' }: CategoryIconProps) {
  const { icon: Icon, bg, colour } = get(category)
  return (
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${bg} ${className}`}>
      <Icon size={size} className={colour} strokeWidth={1.75} />
    </div>
  )
}
