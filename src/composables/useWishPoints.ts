import { isoDow, isoDate } from './useDateHelpers'
import type { WishRow } from '../types/wish.types'

export type ScoreRating = 'sehr-gut' | 'gut' | 'ausreichend' | 'unzureichend'

export interface WishScore {
  earned:     number
  target:     number    // expected points at given base
  percentage: number    // Math.round(earned / target * 100)
  rating:     ScoreRating
  label:      string
}

export interface PointsEntry {
  preferred:   number
  available:   number
  unavailable: number   // may be negative for deductions
}

export interface PointsRules {
  regular:     PointsEntry  // Mon–Thu, non-holiday
  unfavorable: PointsEntry  // Fri/Sat/Sun or holiday
}

export const DEFAULT_POINTS_RULES: PointsRules = {
  regular:     { preferred: 2, available: 1, unavailable: 0 },
  unfavorable: { preferred: 3, available: 2, unavailable: 0 },
}

const RATING_LABELS: Record<ScoreRating, string> = {
  'sehr-gut':    'Sehr gut',
  'gut':         'Gut',
  'ausreichend': 'Ausreichend',
  'unzureichend':'Unzureichend',
}

/**
 * Calculates a wish score for a date range.
 *
 * @param wishes     All WishRow entries (shift-specific rows are ignored)
 * @param from       Start of period, ISO 'YYYY-MM-DD'
 * @param to         End of period, ISO 'YYYY-MM-DD' (inclusive)
 * @param holidaySet Set of holiday ISO strings
 * @param base       Employment percentage (100 = full-time, 50 = half-time, …)
 * @param rules      Optional custom point values; defaults to DEFAULT_POINTS_RULES
 */
export function calcWishScore(
  wishes:     WishRow[],
  from:       string,
  to:         string,
  holidaySet: Set<string>,
  base:       number,
  rules:      PointsRules = DEFAULT_POINTS_RULES,
): WishScore {
  let earned = 0
  let expectedPoints = 0  // sum of "available" points = baseline for 100% base

  const cur = new Date(from + 'T00:00:00')
  const end = new Date(to   + 'T00:00:00')

  while (cur <= end) {
    const iso = isoDate(cur)
    const dow = isoDow(iso)  // 0=Mon … 6=Sun
    const isUnfavorable = dow >= 4 || holidaySet.has(iso)  // Fri=4, Sat=5, Sun=6

    // Only whole-day wishes count (shiftId === undefined)
    const row  = wishes.find(r => r.dayIso === iso && r.shiftId === undefined)
    const type = row?.type ?? 'available'

    const pts = isUnfavorable ? rules.unfavorable : rules.regular
    expectedPoints += pts.available

    if      (type === 'preferred')   earned += pts.preferred
    else if (type === 'available')   earned += pts.available
    else                              earned += pts.unavailable

    cur.setDate(cur.getDate() + 1)
  }

  const target     = Math.round(expectedPoints * (base / 100))
  const percentage = target > 0 ? Math.round((earned / target) * 100) : 0

  let rating: ScoreRating
  if      (percentage >= 100) rating = 'sehr-gut'
  else if (percentage >= 80)  rating = 'gut'
  else if (percentage >= 60)  rating = 'ausreichend'
  else                        rating = 'unzureichend'

  return { earned, target, percentage, rating, label: RATING_LABELS[rating] }
}
