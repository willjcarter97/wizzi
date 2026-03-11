'use client'

import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import type { PantryItem } from '@/types'

interface ExpiryAlertProps { items: PantryItem[] }

export default function ExpiryAlert({ items }: ExpiryAlertProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="alert alert-warning rounded-2xl"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <div>
        <p className="font-semibold text-sm">Use these soon</p>
        <div className="mt-1 space-y-0.5">
          {items.map(item => (
            <p key={item.id} className="text-xs">
              <span className="font-medium">{item.name}</span>
              {item.expiry_date && (
                <span className="opacity-70 ml-1.5">
                  — expires {formatDistanceToNow(new Date(item.expiry_date), { addSuffix: true })}
                </span>
              )}
            </p>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
