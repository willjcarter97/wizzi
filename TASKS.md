# Tasks

Track what's been done, what's in progress, and what's next.
Mark items: `[x]` done, `[-]` in progress, `[ ]` to do.

---

## Completed

- [x] Improve loading states and skeleton screens (recipe book)
- [x] Add empty-state illustrations (recipe book)
- [x] Recipe images via Pexels API
- [x] Recipe book restyle with food photos
- [x] Unified recipe categories (snack/quick/proper/batch)
- [x] Auto-search on category tap
- [x] Fix DaisyUI v5 fieldset classes (replaced with plain Tailwind)
- [x] Recipe scaling (servings +/- with ingredient recalculation)
- [x] Recipe editing (full edit modal)
- [x] Recipe import from pasted text
- [x] Recipe import from URL
- [x] No em dashes in Claude output
- [x] Nav rename (Recipes / Saved)
- [x] Batch cook = 10 portions
- [x] DB migration for meal_type categories

## Polish & UX improvements

- [ ] Review and refine mobile responsiveness across all pages
- [ ] Add pull-to-refresh on pantry grid
- [ ] Animate sheet open/close transitions (Framer Motion)
- [ ] Haptic feedback on fullness bar drag (mobile)

## Visual consistency

- [ ] Audit colour usage - ensure all components use DaisyUI theme tokens consistently
- [ ] Review typography hierarchy (headings, labels, body text)
- [ ] Ensure all icons are consistent size and weight (Lucide)
- [ ] Dark mode support (optional)

## Features to refine

- [ ] Daily plan - show "refresh" affordance, loading state
- [ ] Cook flow - improve ingredient match preview UX
- [ ] Voice input - add visual waveform or level indicator while recording
- [ ] Barcode scanner - handle "product not found" gracefully with manual fallback
- [ ] Expiry alerts - make dismissible, add notification badge to header

## Data & reliability

- [ ] Offline support (service worker caching, IndexedDB fallback)
- [ ] Optimistic updates on fullness bar drag
- [ ] Error boundaries for API failures
- [ ] Input validation on add-item form (Zod or manual)

## Housekeeping

- [ ] Remove unused code and dead imports
- [ ] Ensure no console.log statements in production
- [ ] Accessibility audit (focus management, ARIA labels, contrast)
- [ ] Performance check (bundle size, image optimization)
