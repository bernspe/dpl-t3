import { describe, it, expect } from 'vitest'
import {
  isoDate,
  buildCalendarDays,
  isoDow,
  WEEKDAY_LABELS,
  MONTH_NAMES,
} from '@/composables/useDateHelpers'

describe('isoDate', () => {
  it('returns YYYY-MM-DD format', () => {
    const d = new Date(2024, 0, 15) // Jan 15 2024 local
    expect(isoDate(d)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('returns correct date for Jan 1 2024', () => {
    const d = new Date('2024-01-01T12:00:00')
    expect(isoDate(d)).toBe('2024-01-01')
  })
})

describe('isoDow', () => {
  it('returns 0 for Monday 2024-01-01', () => {
    expect(isoDow('2024-01-01')).toBe(0)
  })

  it('returns 6 for Sunday 2024-01-07', () => {
    expect(isoDow('2024-01-07')).toBe(6)
  })

  it('returns 4 for Friday 2024-01-05', () => {
    expect(isoDow('2024-01-05')).toBe(4)
  })
})

describe('buildCalendarDays', () => {
  const monthStart = new Date(2024, 0, 1) // January 2024 — starts on Monday
  const todayIso = '2024-01-15'
  const days = buildCalendarDays(monthStart, todayIso)

  it('returns exactly 35 entries', () => {
    expect(days).toHaveLength(35)
  })

  it('first entry is always a Monday (dow 0)', () => {
    expect(isoDow(days[0]!.iso)).toBe(0)
  })

  it('marks today correctly', () => {
    const today = days.find(d => d.iso === todayIso)
    expect(today).toBeDefined()
    expect(today!.isToday).toBe(true)
  })

  it('non-today days have isToday=false', () => {
    const nonToday = days.filter(d => d.iso !== todayIso)
    expect(nonToday.every(d => !d.isToday)).toBe(true)
  })

  it('Saturdays have isWeekend=true', () => {
    // 2024-01-06 is a Saturday
    const sat = days.find(d => d.iso === '2024-01-06')
    expect(sat).toBeDefined()
    expect(sat!.isWeekend).toBe(true)
  })

  it('Sundays have isWeekend=true', () => {
    // 2024-01-07 is a Sunday
    const sun = days.find(d => d.iso === '2024-01-07')
    expect(sun).toBeDefined()
    expect(sun!.isWeekend).toBe(true)
  })

  it('weekdays have isWeekend=false', () => {
    // 2024-01-08 is a Monday
    const mon = days.find(d => d.iso === '2024-01-08')
    expect(mon).toBeDefined()
    expect(mon!.isWeekend).toBe(false)
  })

  it('days outside the given month have inCurrentMonth=false', () => {
    // buildCalendarDays for Feb 2024 — Jan days before it should be out-of-month
    const febStart = new Date(2024, 1, 1) // Feb 2024 starts on Thursday
    const febDays = buildCalendarDays(febStart, '2024-02-15')
    // First few days are Jan days (padding)
    const outOfMonth = febDays.filter(d => !d.inCurrentMonth)
    expect(outOfMonth.length).toBeGreaterThan(0)
    outOfMonth.forEach(d => {
      expect(d.iso.startsWith('2024-01') || d.iso.startsWith('2024-03')).toBe(true)
    })
  })

  it('days inside the given month have inCurrentMonth=true', () => {
    const inMonth = days.filter(d => d.inCurrentMonth)
    expect(inMonth).toHaveLength(31) // January has 31 days
    inMonth.forEach(d => {
      expect(d.iso.startsWith('2024-01')).toBe(true)
    })
  })

  it('each entry has iso and dayNum', () => {
    days.forEach(d => {
      expect(d.iso).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(typeof d.dayNum).toBe('number')
    })
  })
})

describe('constants', () => {
  it('WEEKDAY_LABELS has 7 entries', () => {
    expect(WEEKDAY_LABELS).toHaveLength(7)
  })

  it('MONTH_NAMES has 12 entries', () => {
    expect(MONTH_NAMES).toHaveLength(12)
  })
})
