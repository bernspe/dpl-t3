export type WishType = 'preferred' | 'unavailable'

export interface WishRow {
  id: string
  dayIso: string     // 'YYYY-MM-DD'
  shiftId?: string   // undefined = whole-day wish
  type: WishType
  note?: string
}

export interface CalendarDay {
  iso: string
  key: string
  dayNum: number
  isToday: boolean
  isWeekend: boolean
  inCurrentMonth: boolean
}

export interface SimpleShift {
  id: string
  name: string
  color: string
}

export interface WishRequest {
  from: string   // 'YYYY-MM-DD'
  to:   string   // 'YYYY-MM-DD'
}
