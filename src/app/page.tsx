'use client'

import { useEffect } from 'react'
import { usePantryStore } from '@/lib/stores/pantry'
import PantryGrid from '@/components/pantry/PantryGrid'
import Header from '@/components/ui/Header'
import ExpiryAlert from '@/components/pantry/ExpiryAlert'
import type { PantryLocation } from '@/types'

const LOCATION_META: Record<PantryLocation, { emoji: string; color: string }> = {
  fridge:   { emoji: '🧊', color: 'bg-sky-50 border-sky-200' },
  freezer:  { emoji: '❄️', color: 'bg-indigo-50 border-indigo-200' },
  cupboard: { emoji: '🗄️', color: 'bg-amber-50 border-amber-200' },
  spice_rack: { emoji: '🧂', color: 'bg-yellow-50 border-yellow-200' },
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function HomePage() {
  const { fetchItems, items } = usePantryStore()

  useEffect(() => { fetchItems() }, [])

  const expiringSoon = items.filter(item => {
    if (!item.expiry_date) return false
    const diff = new Date(item.expiry_date).getTime() - Date.now()
    return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000
  })

  const lowStock = items.filter(item => item.fullness <= item.low_stock_threshold)

  const counts = items.reduce((acc, item) => {
    acc[item.location] = (acc[item.location] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="min-h-screen bg-base-100 pb-28">
      <Header />
      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold">{getGreeting()}</h1>
          <p className="text-sm text-base-content/40 mt-0.5">
            {items.length === 0 ? 'Your kitchen is empty — add some items to get started.' :
              `You have ${items.length} item${items.length !== 1 ? 's' : ''} in your kitchen.`}
          </p>
        </div>

        {/* Kitchen at a glance */}
        {items.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5">
            {(Object.keys(LOCATION_META) as PantryLocation[]).map(loc => {
              const count = counts[loc] || 0
              const { emoji, color } = LOCATION_META[loc]
              return (
                <div key={loc} className={`rounded-2xl border p-3.5 ${color}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{emoji}</span>
                    <span className="text-sm font-semibold capitalize">{loc === 'spice_rack' ? 'Spice Rack' : loc}</span>
                  </div>
                  <p className="text-2xl font-bold font-mono mt-1">{count}</p>
                  <p className="text-xs text-base-content/40">item{count !== 1 ? 's' : ''}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* Alerts */}
        {expiringSoon.length > 0 && <ExpiryAlert items={expiringSoon} />}

        {lowStock.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-base-content/40 uppercase tracking-widest">Running low</h2>
            <div className="space-y-1.5">
              {lowStock.map(item => (
                <div key={item.id} className="flex items-center justify-between px-3 py-2 bg-base-200 rounded-xl">
                  <span className="text-sm font-medium">{item.name}</span>
                  <span className="text-xs font-mono text-warning">{Math.ceil(item.fullness * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full pantry */}
        <PantryGrid />
      </main>
    </div>
  )
}
