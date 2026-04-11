/** Gregorian Easter Sunday algorithm */
function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day   = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function shift(base: Date, days: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function fixed(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Returns ISO date strings for German federal holidays (all Bundesländer).
 * Pass additional state-specific dates via `extra`.
 */
export function getGermanFederalHolidays(year: number, extra: string[] = []): string[] {
  const easter = easterSunday(year)
  return [
    fixed(year,  1,  1),          // Neujahr
    shift(easter, -2),             // Karfreitag
    shift(easter,  1),             // Ostermontag
    fixed(year,  5,  1),          // Tag der Arbeit
    shift(easter, 39),             // Christi Himmelfahrt
    shift(easter, 50),             // Pfingstmontag
    fixed(year, 10,  3),          // Tag der Deutschen Einheit
    fixed(year, 12, 25),          // 1. Weihnachtstag
    fixed(year, 12, 26),          // 2. Weihnachtstag
    ...extra,
  ]
}

/**
 * Common Austrian public holidays (all Bundesländer).
 */
export function getAustrianHolidays(year: number, extra: string[] = []): string[] {
  const easter = easterSunday(year)
  return [
    fixed(year,  1,  1),          // Neujahr
    fixed(year,  1,  6),          // Heilige Drei Könige
    shift(easter,  1),             // Ostermontag
    fixed(year,  5,  1),          // Staatsfeiertag
    shift(easter, 39),             // Christi Himmelfahrt
    shift(easter, 50),             // Pfingstmontag
    shift(easter, 60),             // Fronleichnam
    fixed(year,  8, 15),          // Mariä Himmelfahrt
    fixed(year, 10, 26),          // Nationalfeiertag
    fixed(year, 11,  1),          // Allerheiligen
    fixed(year, 12,  8),          // Mariä Empfängnis
    fixed(year, 12, 25),          // Christtag
    fixed(year, 12, 26),          // Stefanitag
    ...extra,
  ]
}
