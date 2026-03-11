'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Trash2, ChefHat, Minus, X, Pencil } from 'lucide-react'
import { usePantryStore } from '@/lib/stores/pantry'
import toast from 'react-hot-toast'
import type { PantryItem, PantryLocation, PantryUnit } from '@/types'
import FullnessBar from './FullnessBar'
import CategoryIcon from './CategoryIcon'

interface UsageActionsSheetProps { item: PantryItem; onClose: () => void }

const REASONS = ['Expired', 'Gone off', 'Forgot about it', 'Wrong item']
const LOCATIONS: PantryLocation[] = ['fridge', 'freezer', 'cupboard', 'counter']
const UNITS: PantryUnit[] = ['units', 'g', 'kg', 'ml', 'l', 'tbsp', 'tsp', 'cups', 'portions']

const LOC_ACTIVE: Record<PantryLocation, string> = {
  fridge: 'btn-info', freezer: 'btn-primary', cupboard: 'btn-warning', counter: 'btn-secondary',
}

export default function UsageActionsSheet({ item, onClose }: UsageActionsSheetProps) {
  const { logUsage, removeItem, fetchItems } = usePantryStore()
  const [view, setView] = useState<'main' | 'threw_out' | 'used' | 'edit'>('main')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  // Edit form state
  const [editName, setEditName] = useState(item.name)
  const [editBrand, setEditBrand] = useState(item.brand || '')
  const [editLocation, setEditLocation] = useState<PantryLocation>(item.location)
  const [editQuantity, setEditQuantity] = useState(item.quantity)
  const [editUnit, setEditUnit] = useState<PantryUnit>(item.unit)
  const [editExpiry, setEditExpiry] = useState(item.expiry_date?.split('T')[0] || '')

  const handleThrewOut = async () => {
    setLoading(true)
    await logUsage({
      pantry_item_id: item.id,
      pantry_item_name: item.name,
      action: 'threw_out',
      quantity_change: -item.quantity,
      reason: reason || 'no reason given',
      logged_by: 'household',
    })
    await removeItem(item.id)
    toast.success(`Removed ${item.name}`)
    setLoading(false)
    onClose()
  }

  const handleSaveEdit = async () => {
    if (!editName.trim()) { toast.error('Name is required'); return }
    setLoading(true)
    try {
      await fetch(`/api/pantry/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          brand: editBrand.trim() || null,
          location: editLocation,
          quantity: editQuantity,
          unit: editUnit,
          expiry_date: editExpiry || null,
        }),
      })
      await fetchItems()
      toast.success('Updated')
      onClose()
    } catch {
      toast.error('Failed to update')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <motion.div
        className="fixed inset-0 bg-black/30 z-50 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />

      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50 bg-base-100 rounded-t-3xl border-t border-base-300 p-6 pb-10 max-w-2xl mx-auto shadow-xl"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
      >
        <div className="w-10 h-1 bg-base-300 rounded-full mx-auto mb-5" />

        {view === 'main' && (
          <>
            <div className="flex items-center gap-3 mb-5">
              <CategoryIcon category={item.category} />
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-lg text-base-content truncate">{item.name}</h2>
                {item.brand && <p className="text-xs text-base-content/40 mt-0.5">{item.brand}</p>}
              </div>
              <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
                <X size={16} />
              </button>
            </div>

            <div className="mb-6">
              <FullnessBar itemId={item.id} fullness={item.fullness} interactive />
              <p className="text-xs text-base-content/40 font-mono mt-1.5">
                {item.quantity}{item.unit} remaining · {item.location}
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setView('used')}
                className="btn btn-ghost w-full justify-start gap-3 h-auto py-3.5 rounded-2xl border border-base-200 hover:bg-base-200"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Minus size={17} className="text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Used some</p>
                  <p className="text-xs text-base-content/40 font-normal">Drag the bar to set the new level</p>
                </div>
              </button>

              <button
                onClick={() => { onClose(); window.location.href = '/cook?item=' + item.id }}
                className="btn btn-ghost w-full justify-start gap-3 h-auto py-3.5 rounded-2xl border border-base-200 hover:bg-base-200"
              >
                <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center flex-shrink-0">
                  <ChefHat size={17} className="text-success" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Cooked with this</p>
                  <p className="text-xs text-base-content/40 font-normal">Log a recipe, deducts all ingredients</p>
                </div>
              </button>

              <button
                onClick={() => setView('threw_out')}
                className="btn btn-ghost w-full justify-start gap-3 h-auto py-3.5 rounded-2xl border border-base-200 hover:bg-base-200"
              >
                <div className="w-9 h-9 rounded-xl bg-error/10 flex items-center justify-center flex-shrink-0">
                  <Trash2 size={17} className="text-error" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Threw out</p>
                  <p className="text-xs text-base-content/40 font-normal">Removes it and logs it as waste</p>
                </div>
              </button>

              <button
                onClick={() => setView('edit')}
                className="btn btn-ghost w-full justify-start gap-3 h-auto py-3.5 rounded-2xl border border-base-200 hover:bg-base-200"
              >
                <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center flex-shrink-0">
                  <Pencil size={17} className="text-warning" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Edit details</p>
                  <p className="text-xs text-base-content/40 font-normal">Change name, expiry, location, quantity</p>
                </div>
              </button>
            </div>
          </>
        )}

        {view === 'threw_out' && (
          <div className="space-y-5">
            <button onClick={() => setView('main')} className="btn btn-ghost btn-sm gap-1.5 -ml-2">
              <X size={13} /> Back
            </button>
            <div>
              <h2 className="font-bold text-lg">Throw out {item.name}?</h2>
              <p className="text-sm text-base-content/50 mt-1">Removed and logged as waste.</p>
            </div>
            <div>
              <p className="text-xs text-base-content/40 uppercase tracking-widest mb-2">Reason (optional)</p>
              <div className="flex gap-2 flex-wrap">
                {REASONS.map(r => (
                  <button
                    key={r}
                    onClick={() => setReason(reason === r ? '' : r)}
                    className={`btn btn-sm rounded-full ${reason === r ? 'btn-error btn-outline' : 'btn-ghost border border-base-300'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleThrewOut} disabled={loading} className="btn btn-error w-full rounded-2xl">
              {loading ? <span className="loading loading-spinner loading-sm" /> : `Remove ${item.name}`}
            </button>
          </div>
        )}

        {view === 'used' && (
          <div className="space-y-5">
            <button onClick={() => setView('main')} className="btn btn-ghost btn-sm gap-1.5 -ml-2">
              <X size={13} /> Back
            </button>
            <div>
              <h2 className="font-bold text-lg">Adjust {item.name}</h2>
              <p className="text-sm text-base-content/50 mt-0.5">Drag the bar to show how much is left.</p>
            </div>
            <div className="py-2">
              <FullnessBar itemId={item.id} fullness={item.fullness} interactive />
            </div>
            <button onClick={onClose} className="btn btn-neutral w-full rounded-2xl">Done</button>
          </div>
        )}

        {view === 'edit' && (
          <div className="space-y-4">
            <button onClick={() => setView('main')} className="btn btn-ghost btn-sm gap-1.5 -ml-2">
              <X size={13} /> Back
            </button>
            <h2 className="font-bold text-lg">Edit {item.name}</h2>

            <fieldset className="fieldset">
              <legend className="fieldset-legend text-xs">Name</legend>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                className="input input-bordered w-full" />
            </fieldset>

            <fieldset className="fieldset">
              <legend className="fieldset-legend text-xs">Brand (optional)</legend>
              <input type="text" value={editBrand} onChange={e => setEditBrand(e.target.value)}
                placeholder="e.g. Oatly" className="input input-bordered w-full" />
            </fieldset>

            <div>
              <p className="fieldset-legend text-xs mb-2">Location</p>
              <div className="flex gap-2 flex-wrap">
                {LOCATIONS.map(loc => (
                  <button key={loc} onClick={() => setEditLocation(loc)}
                    className={`btn btn-sm rounded-xl capitalize ${editLocation === loc ? `${LOC_ACTIVE[loc]} btn-outline` : 'btn-ghost border border-base-300'}`}>
                    {loc}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <fieldset className="fieldset flex-1">
                <legend className="fieldset-legend text-xs">Quantity</legend>
                <input type="number" value={editQuantity} onChange={e => setEditQuantity(Number(e.target.value))}
                  min={0} step={0.1} className="input input-bordered w-full" />
              </fieldset>
              <fieldset className="fieldset flex-1">
                <legend className="fieldset-legend text-xs">Unit</legend>
                <select value={editUnit} onChange={e => setEditUnit(e.target.value as PantryUnit)}
                  className="select select-bordered w-full">
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </fieldset>
            </div>

            <fieldset className="fieldset">
              <legend className="fieldset-legend text-xs">Expiry date</legend>
              <input type="date" value={editExpiry} onChange={e => setEditExpiry(e.target.value)}
                className="input input-bordered w-full" />
            </fieldset>

            <button onClick={handleSaveEdit} disabled={loading || !editName.trim()}
              className="btn btn-primary w-full rounded-2xl mt-2">
              {loading ? <span className="loading loading-spinner loading-sm" /> : 'Save changes'}
            </button>
          </div>
        )}
      </motion.div>
    </>
  )
}
