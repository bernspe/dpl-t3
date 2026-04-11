import { describe, it, expect } from 'vitest'
import { calcWishScore } from '../composables/useWishPoints'
import type { PointsRules } from '../composables/useWishPoints'
import type { WishRow } from '../types/wish.types'

// Test week: 2024-01-08 (Mon) – 2024-01-14 (Sun), no holidays
// Regular days: Mon–Thu (4 days), expected = 4×1 = 4 pts
// Unfavorable: Fri–Sun  (3 days), expected = 3×2 = 6 pts
// Total expected (base 100) = 10 pts

const FROM = '2024-01-08'
const TO   = '2024-01-14'
const NO_HOLIDAYS = new Set<string>()

function wish(dayIso: string, type: 'preferred' | 'unavailable', id = dayIso): WishRow {
  return { id, dayIso, type }
}

describe('calcWishScore', () => {
  it('all available (no wishes) at base 100 → earned = target = 10, 100%, sehr-gut', () => {
    const s = calcWishScore([], FROM, TO, NO_HOLIDAYS, 100)
    expect(s.earned).toBe(10)
    expect(s.target).toBe(10)
    expect(s.percentage).toBe(100)
    expect(s.rating).toBe('sehr-gut')
  })

  it('all preferred at base 100 → earned = 4×2 + 3×3 = 17, 170%, sehr-gut', () => {
    const days = ['2024-01-08','2024-01-09','2024-01-10','2024-01-11',
                  '2024-01-12','2024-01-13','2024-01-14']
    const wishes = days.map(d => wish(d, 'preferred'))
    const s = calcWishScore(wishes, FROM, TO, NO_HOLIDAYS, 100)
    expect(s.earned).toBe(17)
    expect(s.target).toBe(10)
    expect(s.rating).toBe('sehr-gut')
  })

  it('all unavailable at base 100 → earned = 0, 0%, unzureichend', () => {
    const days = ['2024-01-08','2024-01-09','2024-01-10','2024-01-11',
                  '2024-01-12','2024-01-13','2024-01-14']
    const wishes = days.map(d => wish(d, 'unavailable'))
    const s = calcWishScore(wishes, FROM, TO, NO_HOLIDAYS, 100)
    expect(s.earned).toBe(0)
    expect(s.percentage).toBe(0)
    expect(s.rating).toBe('unzureichend')
  })

  it('base 50 scales target to half → target = 5', () => {
    const s = calcWishScore([], FROM, TO, NO_HOLIDAYS, 50)
    expect(s.target).toBe(5)
    expect(s.percentage).toBe(200) // 10 earned / 5 target
    expect(s.rating).toBe('sehr-gut')
  })

  it('Mon–Thu available, Fri–Sun unavailable → earned = 4, percentage = 40%, unzureichend', () => {
    const wishes = ['2024-01-12','2024-01-13','2024-01-14'].map(d => wish(d, 'unavailable'))
    const s = calcWishScore(wishes, FROM, TO, NO_HOLIDAYS, 100)
    expect(s.earned).toBe(4)
    expect(s.percentage).toBe(40)
    expect(s.rating).toBe('unzureichend')
  })

  it('holiday counts as unfavorable → same as Saturday', () => {
    // Mon 2024-01-08 is a holiday in this test
    const holidays = new Set(['2024-01-08'])
    const s = calcWishScore([], FROM, TO, holidays, 100)
    // Mon becomes unfavorable (2 pts instead of 1), so expected = 3×1 + 4×2 = 3+8 = 11
    expect(s.earned).toBe(11)
    expect(s.target).toBe(11)
  })

  it('ausreichend: earned about 80% of target', () => {
    // Make Fri–Sun unavailable: earned = 4, target = 10, 40% → unzureichend
    // Make only Sat+Sun unavailable: earned = 4+2+0+0 = 4+2 = 6... let me calc:
    // Mon-Fri available: 1+1+1+1+2 = 6, Sat+Sun unavailable: 0+0 = 0 → earned=6, pct=60, ausreichend
    const wishes = ['2024-01-13','2024-01-14'].map(d => wish(d, 'unavailable'))
    const s = calcWishScore(wishes, FROM, TO, NO_HOLIDAYS, 100)
    expect(s.earned).toBe(6)
    expect(s.percentage).toBe(60)
    expect(s.rating).toBe('ausreichend')
  })

  it('gut: earned ~90% of target', () => {
    // Make only Sun unavailable: Mon-Sat available = 1+1+1+1+2+2 = 8, Sun unavailable = 0 → earned=8, pct=80%
    const wishes = [wish('2024-01-14', 'unavailable')]
    const s = calcWishScore(wishes, FROM, TO, NO_HOLIDAYS, 100)
    expect(s.earned).toBe(8)
    expect(s.percentage).toBe(80)
    expect(s.rating).toBe('gut')
  })

  it('shift-specific wishes are ignored in day-level calculation', () => {
    const shiftWish: WishRow = { id: '1', dayIso: '2024-01-08', shiftId: 'early', type: 'unavailable' }
    const s = calcWishScore([shiftWish], FROM, TO, NO_HOLIDAYS, 100)
    // Should be same as no wishes (shift-specific ignored)
    expect(s.earned).toBe(10)
  })

  it('single day range', () => {
    // Just Mon 2024-01-08 (regular), base 100, no wishes → earned=1, target=1
    const s = calcWishScore([], '2024-01-08', '2024-01-08', NO_HOLIDAYS, 100)
    expect(s.earned).toBe(1)
    expect(s.target).toBe(1)
    expect(s.percentage).toBe(100)
  })

  describe('custom rules', () => {
    const customRules: PointsRules = {
      regular:     { preferred: 3, available: 2, unavailable: -1 },
      unfavorable: { preferred: 5, available: 4, unavailable: -2 },
    }

    it('applies custom point values', () => {
      // All available: Mon-Thu 4×2=8, Fri-Sun 3×4=12 → earned=20, target=20
      const s = calcWishScore([], FROM, TO, NO_HOLIDAYS, 100, customRules)
      expect(s.earned).toBe(20)
      expect(s.target).toBe(20)
      expect(s.percentage).toBe(100)
    })

    it('negative unavailable points are deducted', () => {
      // All unavailable: Mon-Thu 4×(-1)=-4, Fri-Sun 3×(-2)=-6 → earned=-10
      const days = ['2024-01-08','2024-01-09','2024-01-10','2024-01-11',
                    '2024-01-12','2024-01-13','2024-01-14']
      const wishes = days.map(d => wish(d, 'unavailable'))
      const s = calcWishScore(wishes, FROM, TO, NO_HOLIDAYS, 100, customRules)
      expect(s.earned).toBe(-10)
      expect(s.rating).toBe('unzureichend')
    })

    it('preferred uses custom preferred points', () => {
      // Mon preferred: 3 pts (custom) vs 2 pts (default)
      const s = calcWishScore([wish('2024-01-08', 'preferred')], '2024-01-08', '2024-01-08', NO_HOLIDAYS, 100, customRules)
      expect(s.earned).toBe(3)
    })
  })
})
