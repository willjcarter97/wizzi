'use client'

import Image from 'next/image'
import { usePantryStore } from '@/lib/stores/pantry'

export default function Header() {
  const { items } = usePantryStore()
  const lowStockCount = items.filter(i => i.fullness <= i.low_stock_threshold).length

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="navbar bg-base-100/90 backdrop-blur-md border-b border-base-300 sticky top-0 z-40 px-4 min-h-14">
      <div className="navbar-start">
        <Image src="/logo.png" alt="WizziList" height={32} width={105} className="h-8 w-auto" priority />
      </div>

      <div className="navbar-end gap-3">
        <span className="text-xs text-base-content/40 font-mono hidden sm:block">{today}</span>
        {lowStockCount > 0 && (
          <div className="badge badge-warning gap-1 font-mono text-xs">
            {lowStockCount} low
          </div>
        )}
      </div>
    </div>
  )
}
