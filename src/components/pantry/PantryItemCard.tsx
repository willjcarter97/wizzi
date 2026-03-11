'use client'

import { useState } from 'react'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import FullnessBar from './FullnessBar'
import CategoryIcon from './CategoryIcon'
import UsageActionsSheet from './UsageActionsSheet'
import { usePantryStore } from '@/lib/stores/pantry'
import { formatQty } from '@/lib/format'
import toast from 'react-hot-toast'
import type { PantryItem } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { Trash2, Pencil, Minus, AlertTriangle } from 'lucide-react'

interface PantryItemCardProps { item: PantryItem }

const LOCATION_BORDER: Record<string, string> = {
  fridge:   'border-l-sky-400',
  freezer:  'border-l-indigo-400',
  cupboard: 'border-l-amber-400',
  spice_rack: 'border-l-yellow-400',
}

const SWIPE_THRESHOLD = 50
const ACTION_WIDTH = 180

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
  const { logUsage, removeItem, updateFullness } = usePantryStore()
  const [showActions, setShowActions] = useState(false)
  const [swiped, setSwiped] = useState(false)
  const [usedMode, setUsedMode] = useState(false)
  const [usedAmount, setUsedAmount] = useState('')
  const [confirmAllGone, setConfirmAllGone] = useState(false)
  const [loading, setLoading] = useState(false)

  const isExpiringSoon = item.expiry_date && (() => {
    const diff = new Date(item.expiry_date!).getTime() - Date.now()
    return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000
  })()

  const border = LOCATION_BORDER[item.location] ?? 'border-l-base-300'

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    setSwiped(info.offset.x < -SWIPE_THRESHOLD)
  }

  const closeSwipe = () => {
    setSwiped(false)
    setUsedMode(false)
    setUsedAmount('')
    setConfirmAllGone(false)
  }

  const handleDelete = async () => {
    setLoading(true)
    await logUsage({
      pantry_item_id: item.id,
      pantry_item_name: item.name,
      action: 'threw_out',
      quantity_change: -item.quantity,
      reason: 'Removed via swipe',
      logged_by: 'household',
    })
    await removeItem(item.id)
    toast.success(`Removed ${item.name}`)
    setLoading(false)
  }

  const handleEdit = () => {
    closeSwipe()
    setShowActions(true)
  }

  const submitUsedAmount = async () => {
    const amount = parseFloat(usedAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    if (amount >= item.quantity) {
      setConfirmAllGone(true)
      return
    }
    setLoading(true)
    const newQuantity = item.quantity - amount
    const newFullness = newQuantity / item.max_quantity
    await logUsage({
      pantry_item_id: item.id,
      pantry_item_name: item.name,
      action: 'used',
      quantity_change: -amount,
      logged_by: 'household',
    })
    await updateFullness(item.id, newFullness)
    toast.success(`Used ${formatQty(amount)}${item.unit} of ${item.name}`)
    setLoading(false)
    closeSwipe()
  }

  const handleAllGone = async () => {
    setLoading(true)
    await logUsage({
      pantry_item_id: item.id,
      pantry_item_name: item.name,
      action: 'used',
      quantity_change: -item.quantity,
      logged_by: 'household',
    })
    await removeItem(item.id)
    toast.success(`${item.name} all used up`)
    setLoading(false)
  }

  // Close swiped state when user interacts elsewhere
  // We register a one-time click listener on the document when swiped opens
  const closeSwiped = () => { if (swiped) closeSwipe() }

  return (
    <>
      {/* Backdrop — catches taps anywhere else to close swipe */}
      {swiped && (
        <div className="fixed inset-0 z-[5]" onClick={closeSwiped} />
      )}

      <div className="relative overflow-hidden rounded-2xl">
        {/* Action blocks behind the card — overshoot left by 20px so they tuck under the card's rounded edge */}
        <div className="absolute inset-y-0 right-0 flex rounded-2xl overflow-hidden"
          style={{ width: ACTION_WIDTH + 20 }}>
          <button
            onClick={() => setUsedMode(true)}
            className="flex-1 flex flex-col items-center justify-center gap-1 bg-primary/10 hover:bg-primary/20 transition-colors pl-5"
          >
            <Minus size={18} className="text-primary" />
            <span className="text-[10px] font-semibold text-primary">Used</span>
          </button>
          <button
            onClick={handleEdit}
            className="flex-1 flex flex-col items-center justify-center gap-1 bg-warning/10 hover:bg-warning/20 transition-colors"
          >
            <Pencil size={18} className="text-warning" />
            <span className="text-[10px] font-semibold text-warning">Edit</span>
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 flex flex-col items-center justify-center gap-1 bg-error/10 hover:bg-error/20 transition-colors"
          >
            <Trash2 size={18} className="text-error" />
            <span className="text-[10px] font-semibold text-error">Bin</span>
          </button>
        </div>

        {/* The card — slides left to reveal actions */}
        <motion.div
          drag={swiped ? false : "x"}
          dragConstraints={{ left: -ACTION_WIDTH, right: 0 }}
          dragElastic={0.15}
          dragDirectionLock
          onDragEnd={handleDragEnd}
          animate={{ x: swiped ? -ACTION_WIDTH : 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 400 }}
          className={`bg-base-100 border border-base-300 border-l-4 ${border} rounded-2xl relative z-10 touch-pan-y`}
          onClick={() => {
            if (swiped) closeSwipe()
            else setShowActions(true)
          }}
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
                  {formatQty(item.quantity)}{item.unit}
                </span>
              </div>

              <div className="mt-2.5">
                <FullnessBar itemId={item.id} fullness={item.fullness} />
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
      </div>

      {/* "Used some" inline panel */}
      <AnimatePresence>
        {swiped && usedMode && !confirmAllGone && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            className="overflow-hidden"
          >
            <div className="bg-base-200 rounded-2xl p-4 mt-1 space-y-3">
              <p className="text-sm font-semibold">How much did you use?</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={usedAmount}
                  onChange={e => setUsedAmount(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submitUsedAmount() }}
                  placeholder={`e.g. ${formatQty(Math.round(item.quantity * 0.25) || 1)}`}
                  min={0.1}
                  step={0.1}
                  className="input input-bordered flex-1 font-mono"
                  autoFocus
                />
                <span className="text-sm text-base-content/50 font-medium">{item.unit}</span>
              </div>
              <p className="text-xs text-base-content/40">
                {formatQty(item.quantity)}{item.unit} remaining
              </p>
              <div className="flex gap-2">
                <button onClick={() => { setUsedMode(false); setUsedAmount('') }}
                  className="btn btn-ghost btn-sm flex-1 rounded-xl">Cancel</button>
                <button onClick={submitUsedAmount} disabled={loading || !usedAmount}
                  className="btn btn-primary btn-sm flex-1 rounded-xl">
                  {loading ? <span className="loading loading-spinner loading-xs" /> : 'Confirm'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* "All gone?" confirmation */}
      <AnimatePresence>
        {confirmAllGone && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            className="overflow-hidden"
          >
            <div className="bg-warning/10 border border-warning/20 rounded-2xl p-4 mt-1 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-warning flex-shrink-0" />
                <p className="text-sm font-semibold">
                  That's more than the {formatQty(item.quantity)}{item.unit} left. All gone?
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setConfirmAllGone(false)}
                  className="btn btn-ghost btn-sm flex-1 rounded-xl">Go back</button>
                <button onClick={handleAllGone} disabled={loading}
                  className="btn btn-warning btn-sm flex-1 rounded-xl">
                  {loading ? <span className="loading loading-spinner loading-xs" /> : 'Yes, all used up'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full actions sheet */}
      <AnimatePresence>
        {showActions && (
          <UsageActionsSheet item={item} onClose={() => setShowActions(false)} />
        )}
      </AnimatePresence>
    </>
  )
}
