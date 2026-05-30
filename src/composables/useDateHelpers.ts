import type { CalendarDay } from '../types/wish.types'

// Monday-anchored weekday labels for a given locale (short form)
// Uses a fixed Monday as anchor: 2024-01-01 is a Monday
export function getWeekdayLabels(locale: string): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, 1 + i)
    return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d)
  })
}

export function isoDate(d: Date): string {
  const year  = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day   = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Monday of the week that contains `from`, shifted by `offsetWeeks` */
export function getWeekStart(from: Date, offsetWeeks = 0): Date {
  const d   = new Date(from)
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1 + offsetWeeks * 7)
  d.setHours(0, 0, 0, 0)
  return d
}

export function weekNumber(d: Date): number {
  const jan1 = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7)
}

/** ISO weekday index 0=Mon … 6=Sun from an ISO date string */
export function isoDow(iso: string): number {
  return (new Date(iso + 'T00:00:00').getDay() + 6) % 7
}

/** Returns the first day of the month offset by `offsetMonths` from `base` */
export function getMonthStart(base: Date, offsetMonths = 0): Date {
  const d = new Date(base.getFullYear(), base.getMonth() + offsetMonths, 1)
  d.setHours(0, 0, 0, 0)
  return d
}

/** "Monday, 15 January 2024" / "Montag, 15. Januar 2024" */
export function formatDay(iso: string, locale: string): string {
  const d = new Date(iso + 'T00:00:00')
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(d)
}

/** "15.–17. Januar 2024" / "Jan 15–17, 2024" */
export function formatDayRange(isoList: string[], locale: string): string {
  if (isoList.length === 0) return ''
  const sorted = [...isoList].sort()
  const first  = new Date(sorted[0]!  + 'T00:00:00')
  const last   = new Date(sorted[sorted.length - 1]! + 'T00:00:00')
  if (first.getTime() === last.getTime()) return formatDay(sorted[0]!, locale)
  // Use Intl.DateTimeFormat range if available, otherwise fallback
  try {
    const fmt = new (Intl as any).DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' })
    if (typeof fmt.formatRange === 'function') return fmt.formatRange(first, last)
  } catch { /* fallback below */ }
  const mo = new Intl.DateTimeFormat(locale, { month: 'long' })
  const sameMonth = first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()
  if (sameMonth) {
    return `${first.getDate()}–${last.getDate()}. ${mo.format(first)} ${first.getFullYear()}`
  }
  return `${first.getDate()}. ${mo.format(first)} – ${last.getDate()}. ${mo.format(last)} ${last.getFullYear()}`
}

/** "Januar 2024" / "January 2024" */
export function formatMonthLabel(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(d)
}

export function buildCalendarDays(monthStart: Date, todayIso: string): CalendarDay[] {
  const pad      = (monthStart.getDay() || 7) - 1
  const calStart = new Date(monthStart)
  calStart.setDate(calStart.getDate() - pad)

  return Array.from({ length: 35 }, (_, i) => {
    const d   = new Date(calStart)
    d.setDate(d.getDate() + i)
    const iso      = isoDate(d)
    const dow      = (d.getDay() || 7) - 1
    const inMonth  = d.getMonth() === monthStart.getMonth()
    return {
      iso,
      key: iso,
      dayNum:         d.getDate(),
      isToday:        iso === todayIso,
      isWeekend:      dow >= 5,
      inCurrentMonth: inMonth,
    }
  })
}
