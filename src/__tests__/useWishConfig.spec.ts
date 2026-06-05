/**
 * Tests for src/composables/useWishConfig.ts
 *
 * A. fetchPlanConfig — network fetch behaviour
 *    A1  returns PlanConfig on success
 *    A2  returns null on 404
 *    A3  returns null on non-ok response
 *    A4  returns null on network error
 *    A5  returns null when response has ok:false
 *    A6  calls correct URL with planId param and no month/token params
 *    A7  accepts custom apiBase
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchPlanConfig, type PlanConfig } from '../composables/useWishConfig'

const PLAN_ID = 'plan-test-123'

const VALID_CONFIG: PlanConfig = {
  v: 1,
  planId: PLAN_ID,
  updatedAt: '2026-07-01T10:00:00Z',
  shiftTypes: [
    { id: 'F', name: 'Frühschicht', code: 'F', color: '#fbbf24', timeStart: '06:00', timeEnd: '14:00' },
    { id: 'N', name: 'Nachtschicht', code: 'N', color: '#2563eb', timeStart: '22:00', timeEnd: '06:00' },
  ],
  holidays: ['2026-07-01'],
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('A · fetchPlanConfig', () => {
  it('A1: returns PlanConfig on 200 OK', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(VALID_CONFIG),
    }))

    const result = await fetchPlanConfig(PLAN_ID)
    expect(result).not.toBeNull()
    expect(result!.planId).toBe(PLAN_ID)
    expect(result!.shiftTypes).toHaveLength(2)
    expect(result!.holidays).toEqual(['2026-07-01'])
  })

  it('A2: returns null on 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    expect(await fetchPlanConfig(PLAN_ID)).toBeNull()
  })

  it('A3: returns null on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    expect(await fetchPlanConfig(PLAN_ID)).toBeNull()
  })

  it('A4: returns null when fetch throws (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await fetchPlanConfig(PLAN_ID)).toBeNull()
  })

  it('A5: returns null when response has ok:false error body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({ ok: false, error: 'not_found' }),
    }))
    expect(await fetchPlanConfig(PLAN_ID)).toBeNull()
  })

  it('A6: calls load-plan-config.php with planId — no token, no month', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve(VALID_CONFIG),
    })
    vi.stubGlobal('fetch', fetchMock)

    await fetchPlanConfig(PLAN_ID, 'https://example.com')

    const calledUrl = fetchMock.mock.calls[0]?.[0] as string
    expect(calledUrl).toContain('load-plan-config.php')
    expect(calledUrl).toContain(`planId=${PLAN_ID}`)
    expect(calledUrl).not.toContain('token=')
    expect(calledUrl).not.toContain('month=')
  })

  it('A7: uses custom apiBase when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve(VALID_CONFIG),
    })
    vi.stubGlobal('fetch', fetchMock)

    await fetchPlanConfig(PLAN_ID, 'https://custom.server.test')

    const calledUrl = fetchMock.mock.calls[0]?.[0] as string
    expect(calledUrl).toContain('https://custom.server.test')
  })
})
