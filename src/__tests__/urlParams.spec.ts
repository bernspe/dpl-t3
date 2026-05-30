import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  isUUID,
  isYearMonth,
  lastDayOfMonth,
  parseContextParams,
  encodeShifts,
  buildInviteLink,
} from '../utils/urlParams'
import type { SimpleShift } from '../types/wish.types'

// ── isUUID ────────────────────────────────────────────────────────────────────

describe('isUUID', () => {
  it('accepts valid v4 UUIDs', () => {
    expect(isUUID('12345678-1234-4234-a234-123456789abc')).toBe(true)
    expect(isUUID('00000000-0000-4000-8000-000000000000')).toBe(true)
    expect(isUUID('FFFFFFFF-FFFF-4FFF-BFFF-FFFFFFFFFFFF')).toBe(true)
  })

  it('rejects non-v4 UUIDs', () => {
    expect(isUUID('12345678-1234-3234-a234-123456789abc')).toBe(false) // v3
    expect(isUUID('12345678-1234-1234-a234-123456789abc')).toBe(false) // v1
  })

  it('rejects path traversal and arbitrary strings', () => {
    expect(isUUID('../../etc/passwd')).toBe(false)
    expect(isUUID('')).toBe(false)
    expect(isUUID('not-a-uuid')).toBe(false)
    expect(isUUID('12345678-1234-4234-a234-123456789ab')).toBe(false) // too short
  })
})

// ── isYearMonth ───────────────────────────────────────────────────────────────

describe('isYearMonth', () => {
  it('accepts valid YYYY-MM strings', () => {
    expect(isYearMonth('2026-01')).toBe(true)
    expect(isYearMonth('2026-07')).toBe(true)
    expect(isYearMonth('2026-12')).toBe(true)
    expect(isYearMonth('1999-06')).toBe(true)
  })

  it('rejects invalid formats', () => {
    expect(isYearMonth('2026-13')).toBe(false)
    expect(isYearMonth('2026-00')).toBe(false)
    expect(isYearMonth('26-07')).toBe(false)
    expect(isYearMonth('../../')).toBe(false)
    expect(isYearMonth('')).toBe(false)
    expect(isYearMonth('2026-7')).toBe(false)
  })
})

// ── lastDayOfMonth ────────────────────────────────────────────────────────────

describe('lastDayOfMonth', () => {
  it('returns correct last day for regular months', () => {
    expect(lastDayOfMonth('2026-01')).toBe('2026-01-31')
    expect(lastDayOfMonth('2026-04')).toBe('2026-04-30')
    expect(lastDayOfMonth('2026-07')).toBe('2026-07-31')
    expect(lastDayOfMonth('2026-12')).toBe('2026-12-31')
  })

  it('handles February in non-leap year', () => {
    expect(lastDayOfMonth('2026-02')).toBe('2026-02-28')
  })

  it('handles February in leap year', () => {
    expect(lastDayOfMonth('2024-02')).toBe('2024-02-29')
  })
})

// ── encodeShifts / round-trip ─────────────────────────────────────────────────

describe('encodeShifts', () => {
  const shifts: SimpleShift[] = [
    { id: 'F', name: 'Frühschicht', color: 'green' },
    { id: 'N', name: 'Nachtschicht', color: 'red' },
  ]

  it('produces a non-empty Base64url string', () => {
    const encoded = encodeShifts(shifts)
    expect(encoded).toBeTruthy()
    expect(encoded).not.toMatch(/[+/=]/)
  })

  it('round-trips through atob', () => {
    const encoded = encodeShifts(shifts)
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = JSON.parse(atob(base64)) as SimpleShift[]
    expect(decoded).toEqual(shifts)
  })
})

// ── parseContextParams ────────────────────────────────────────────────────────

const VALID_PLAN_ID   = '12345678-1234-4234-a234-123456789abc'
const VALID_PERSON_ID = 'abcdef12-abcd-4bcd-abcd-abcdef123456'
const VALID_MONTH     = '2026-07'
const VALID_TOKEN     = 'my-secret-token'

function setSearch(params: Record<string, string>): void {
  const sp = new URLSearchParams(params)
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search: '?' + sp.toString() },
    writable: true,
  })
}

describe('parseContextParams', () => {
  beforeEach(() => {
    setSearch({
      planId:   VALID_PLAN_ID,
      personId: VALID_PERSON_ID,
      month:    VALID_MONTH,
      token:    VALID_TOKEN,
    })
  })

  it('returns a ContextParams object when all required params are valid', () => {
    const result = parseContextParams()
    expect(result).not.toBeNull()
    expect(result!.planId).toBe(VALID_PLAN_ID)
    expect(result!.personId).toBe(VALID_PERSON_ID)
    expect(result!.month).toBe(VALID_MONTH)
    expect(result!.token).toBe(VALID_TOKEN)
  })

  it('returns null when planId is missing', () => {
    setSearch({ personId: VALID_PERSON_ID, month: VALID_MONTH, token: VALID_TOKEN })
    expect(parseContextParams()).toBeNull()
  })

  it('returns null when planId is invalid UUID', () => {
    setSearch({ planId: 'not-a-uuid', personId: VALID_PERSON_ID, month: VALID_MONTH, token: VALID_TOKEN })
    expect(parseContextParams()).toBeNull()
  })

  it('returns null when month is invalid', () => {
    setSearch({ planId: VALID_PLAN_ID, personId: VALID_PERSON_ID, month: '2026-13', token: VALID_TOKEN })
    expect(parseContextParams()).toBeNull()
  })

  it('returns null when token is empty', () => {
    setSearch({ planId: VALID_PLAN_ID, personId: VALID_PERSON_ID, month: VALID_MONTH, token: '' })
    expect(parseContextParams()).toBeNull()
  })

  it('parses optional name and deadline', () => {
    setSearch({
      planId: VALID_PLAN_ID, personId: VALID_PERSON_ID, month: VALID_MONTH, token: VALID_TOKEN,
      name: 'Maria', deadline: '2026-07-20',
    })
    const result = parseContextParams()!
    expect(result.name).toBe('Maria')
    expect(result.deadline).toBe('2026-07-20')
  })

  it('parses encoded shifts', () => {
    const shifts: SimpleShift[] = [{ id: 'F', name: 'Frühschicht', color: 'green' }]
    const encoded = btoa(JSON.stringify(shifts)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    setSearch({
      planId: VALID_PLAN_ID, personId: VALID_PERSON_ID, month: VALID_MONTH, token: VALID_TOKEN,
      shifts: encoded,
    })
    const result = parseContextParams()!
    expect(result.shifts).toEqual(shifts)
  })

  it('ignores malformed shifts gracefully', () => {
    setSearch({
      planId: VALID_PLAN_ID, personId: VALID_PERSON_ID, month: VALID_MONTH, token: VALID_TOKEN,
      shifts: 'NOT_VALID_BASE64!!!',
    })
    const result = parseContextParams()!
    expect(result.shifts).toBeUndefined()
  })
})

// ── buildInviteLink ───────────────────────────────────────────────────────────

describe('buildInviteLink', () => {
  it('builds a URL with all required params', () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, origin: 'https://example.com' },
      writable: true,
    })
    const link = buildInviteLink({
      planId: VALID_PLAN_ID, personId: VALID_PERSON_ID, month: VALID_MONTH, token: VALID_TOKEN,
    })
    expect(link).toContain('planId=' + VALID_PLAN_ID)
    expect(link).toContain('personId=' + VALID_PERSON_ID)
    expect(link).toContain('month=' + VALID_MONTH)
    expect(link).toContain('token=' + VALID_TOKEN)
  })
})
