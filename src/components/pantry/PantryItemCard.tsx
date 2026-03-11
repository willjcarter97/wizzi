'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import FullnessBar from './FullnessBar'
import CategoryIcon from './CategoryIcon'
import UsageActionsSheet from './UsageActionsSheet'
import type { PantryItem } from '@/types'
import { formatDistanceToNow } from 'date-fns'

interface PantryItemCardProps { item: PantryItem }

const LOCATION_BORDER: Record<string, string> = {
  fridge:   'border-l-sky-400',
  freezer:  'border-l-indigo-400',
  cupboard: 'border-l-amber-400',
  spice_rack: 'border-l-yellow-400',
}

function ProductImage({ item }: { item: PantryItem }) {
  const [imgError, setImgError] = useState(false)
  if (item.image_url && !imgError) {
    return (
      <img
        src={item.image_url}
        alt={item.name}
        className="w-11 h-11 rounded-xl object-cover flex-shrink-0"
        onError={() => setImgError(true)}
      />
    )
  }
  return <CategoryIcon category={item.category} />
}

export default function PantryItemCard({ item }: PantryItemCardProps) {
  const [showActions, setShowActions] = useState(false)

  const isExpiringSoon = item.expiry_date && (() => {
    const diff = new Date(item.expiry_date!).getTime() - Date.now()
    return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000
  })()

  const border = LOCATION_BORDER[item.location] ?? 'border-l-base-300'

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className={`bg-base-100 border border-base-300 border-l-4 ${border} rounded-2xl cursor-pointer
          hover:shadow-md hover:-translate-y-px transition-all duration-150`}
        onClick={() => setShowActions(true)}
      >
        <div className="flex items-center gap-3 px-4 py-3.5">
          <ProductImage item={item} />

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-base-content truncate leading-tight">
                  {item.name}
                </h3>
                {item.brand && (
                  <p className="text-xs text-base-content/40 mt-0.5 truncate">{item.brand}</p>
                )}
              </div>
              <span className="text-xs font-mono text-base-content/40 whitespace-nowrap flex-shrink-0 mt-0.5">
                {item.quantity}{item.unit}
              </span>
            </div>

            <div className="mt-2.5">
              <FullnessBar itemId={item.id} fullness={item.fullness} interactive />
            </div>

            {item.expiry_date && (
              <div className="mt-1.5">
                {isExpiringSoon ? (
                  <span className="text-[10px] text-warning font-mono font-medium">
                    ⚠ expires {formatDistanceToNow(new Date(item.expiry_date), { addSuffix: true })}
                  </span>
                ) : (
                  <span className="text-[10px] text-base-content/30 font-mono">
                    exp {formatDistanceToNow(new Date(item.expiry_date), { addSuffix: true })}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showActions && (
          <UsageActionsSheet item={item} onClose={() => setShowActions(false)} />
        )}
      </AnimatePresence>
    </>
  )
}
