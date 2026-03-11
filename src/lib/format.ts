// Format a quantity for display — no ugly floats.
// 1000 → "1000", 1.5 → "1.5", 0.708888 → "0.7", 250.00 → "250"
export function formatQty(n: number): string {
  if (Number.isInteger(n)) return n.toString()
  // Round to at most 1 decimal place
  const rounded = Math.round(n * 10) / 10
  if (Number.isInteger(rounded)) return rounded.toString()
  return rounded.toFixed(1)
}
