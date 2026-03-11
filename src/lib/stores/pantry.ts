import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import type { PantryItem, PantryStore, UsageLog } from '@/types'

// The pantry store is the single source of truth for pantry state on the client.
// It reads from Supabase and exposes mutations that write back.
// Fullness is a computed column in the DB, so we just refetch after mutations.
export const usePantryStore = create<PantryStore>((set, get) => ({
  items: [],
  isLoading: false,
  error: null,

  fetchItems: async () => {
    set({ isLoading: true, error: null })
    const supabase = createClient()

    const { data, error } = await supabase
      .from('pantry_items')
      .select('*')
      .order('location')
      .order('name')

    if (error) {
      set({ error: error.message, isLoading: false })
      return
    }

    set({ items: data as PantryItem[], isLoading: false })
  },

  addItem: async (item) => {
    const supabase = createClient()

    const { error } = await supabase
      .from('pantry_items')
      .insert([item])

    if (error) {
      set({ error: error.message })
      return
    }

    // Refetch so we get the server-computed fullness column
    await get().fetchItems()
  },

  // Updates fullness by recalculating quantity from the new fullness value.
  // We store fullness as a computed column, so we update quantity directly.
  updateFullness: async (id: string, fullness: number) => {
    const supabase = createClient()
    const item = get().items.find(i => i.id === id)
    if (!item) return

    const newQuantity = fullness * item.max_quantity

    const { error } = await supabase
      .from('pantry_items')
      .update({ quantity: newQuantity })
      .eq('id', id)

    if (error) {
      set({ error: error.message })
      return
    }

    // Optimistic update for instant UI feedback
    set(state => ({
      items: state.items.map(i =>
        i.id === id ? { ...i, quantity: newQuantity, fullness } : i
      ),
    }))
  },

  logUsage: async (log: Omit<UsageLog, 'id' | 'logged_at'>) => {
    const supabase = createClient()

    const { error: logError } = await supabase
      .from('usage_logs')
      .insert([log])

    if (logError) {
      set({ error: logError.message })
      return
    }

    // Apply the quantity change to the pantry item
    if (log.pantry_item_id && log.quantity_change !== 0) {
      const item = get().items.find(i => i.id === log.pantry_item_id)
      if (item) {
        const newQuantity = Math.max(0, item.quantity + log.quantity_change)
        const { error: updateError } = await supabase
          .from('pantry_items')
          .update({ quantity: newQuantity })
          .eq('id', log.pantry_item_id)

        if (!updateError) {
          const newFullness = newQuantity / item.max_quantity
          set(state => ({
            items: state.items.map(i =>
              i.id === log.pantry_item_id
                ? { ...i, quantity: newQuantity, fullness: newFullness }
                : i
            ),
          }))
        }
      }
    }
  },

  removeItem: async (id: string) => {
    const supabase = createClient()

    const { error } = await supabase
      .from('pantry_items')
      .delete()
      .eq('id', id)

    if (error) {
      set({ error: error.message })
      return
    }

    set(state => ({ items: state.items.filter(i => i.id !== id) }))
  },
}))
