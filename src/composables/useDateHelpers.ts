import type { CalendarDay } from '../types/wish.types'

export const WEEKDAY_LABELS = ['Mo','Di','Mi','Do','Fr','Sa','So'] as const
export const MONTH_NAMES = [
  'Januar','Februar','März','April','Mai','Juni',
  'Juli','August','September','Oktober','November','Dezember',
] as const

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

const WEEKDAY_LONG = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'] as const

/** "Montag, 15. Januar 2024" */
export function formatDay(iso: string): string {
  const d   = new Date(iso + 'T00:00:00')
  const dow = (d.getDay() || 7) - 1
  return `${WEEKDAY_LONG[dow]}, ${d.getDate()}. ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
}

/** "15.–17. Januar 2024" or "30. Januar – 2. Februar 2024" */
export function formatDayRange(isoList: string[]): string {
  if (isoList.length === 0) return ''
  const sorted = [...isoList].sort()
  const first  = new Date(sorted[0]!  + 'T00:00:00')
  const last   = new Date(sorted[sorted.length - 1]! + 'T00:00:00')
  if (first.getTime() === last.getTime()) return formatDay(sorted[0]!)
  const sameMonth = first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()
  if (sameMonth) {
    return `${first.getDate()}.–${last.getDate()}. ${MONTH_NAMES[first.getMonth()]} ${first.getFullYear()}`
  }
  return `${first.getDate()}. ${MONTH_NAMES[first.getMonth()]} – ${last.getDate()}. ${MONTH_NAMES[last.getMonth()]} ${last.getFullYear()}`
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
