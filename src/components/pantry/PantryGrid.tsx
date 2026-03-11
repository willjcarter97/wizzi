'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { usePantryStore } from '@/lib/stores/pantry'
import PantryItemCard from './PantryItemCard'
import type { PantryLocation } from '@/types'

const LOCATION_ORDER: PantryLocation[] = ['fridge', 'freezer', 'cupboard', 'spice_rack']

const LOCATION_META: Record<PantryLocation, { label: string; dot: string }> = {
  fridge:   { label: 'Fridge',   dot: 'bg-sky-400'    },
  freezer:  { label: 'Freezer',  dot: 'bg-indigo-400' },
  cupboard: { label: 'Cupboard', dot: 'bg-amber-400'  },
  spice_rack: { label: 'Spice Rack', dot: 'bg-yellow-400' },
}

export default function PantryGrid() {
  const { items, isLoading } = usePantryStore()

  const grouped = useMemo(() => {
    return LOCATION_ORDER
      .map(location => ({
        location,
        meta: LOCATION_META[location],
        items: items.filter(i => i.location === location),
      }))
      .filter(g => g.items.length > 0)
  }, [items])

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(n => (
          <div key={n} className="space-y-2">
            <div className="skeleton h-4 w-24 rounded" />
            {[1, 2].map(m => (
              <div key={m} className="skeleton h-20 w-full rounded-2xl" />
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (!items.length) {
    return (
      <div className="text-center py-20">
        <p className="text-2xl font-semibold text-base-content/20">Empty pantry</p>
        <p className="text-sm text-base-content/30 mt-1">Scan a barcode or use voice to add items.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {grouped.map((group, i) => (
        <motion.section
          key={group.location}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
        >
          {/* Section header */}
          <div className="flex items-center gap-2 mb-3">
            <span className={`w-2 h-2 rounded-full ${group.meta.dot}`} />
            <h2 className="text-xs font-semibold text-base-content/50 uppercase tracking-widest">
              {group.meta.label}
            </h2>
            <div className="flex-1 h-px bg-base-300" />
            <span className="text-xs font-mono text-base-content/30">{group.items.length}</span>
          </div>

          <div className="space-y-2">
            {group.items.map(item => (
              <PantryItemCard key={item.id} item={item} />
            ))}
          </div>
        </motion.section>
      ))}
    </div>
  )
}
