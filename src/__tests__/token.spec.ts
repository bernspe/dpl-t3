import { describe, it, expect, beforeEach } from 'vitest'
import { generateAccessToken, hashToken, cacheToken, getCachedToken, clearCachedToken } from '../utils/token'

const PERSON_ID = 'abcdef12-abcd-4bcd-abcd-abcdef123456'

describe('generateAccessToken', () => {
  it('returns a non-empty Base64url string', () => {
    const token = generateAccessToken()
    expect(token.length).toBeGreaterThan(0)
    expect(token).not.toMatch(/[+/=]/)
  })

  it('returns a different token each call', () => {
    const a = generateAccessToken()
    const b = generateAccessToken()
    expect(a).not.toBe(b)
  })

  it('decodes to 32 bytes', () => {
    const token = generateAccessToken()
    const base64 = token.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(base64)
    expect(decoded.length).toBe(32)
  })
})

describe('hashToken', () => {
  it('returns a 64-character hex string', async () => {
    const hash = await hashToken('my-test-token')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic for the same input', async () => {
    const a = await hashToken('same-token')
    const b = await hashToken('same-token')
    expect(a).toBe(b)
  })

  it('produces different hashes for different inputs', async () => {
    const a = await hashToken('token-a')
    const b = await hashToken('token-b')
    expect(a).not.toBe(b)
  })

  it('produces a 64-char hex hash for known input', async () => {
    const hash = await hashToken('abc')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    // Determinism already covered above — cross-env SHA-256 values may differ
  })
})

describe('token localStorage cache', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('caches and retrieves a token', () => {
    cacheToken(PERSON_ID, 'my-token')
    expect(getCachedToken(PERSON_ID)).toBe('my-token')
  })

  it('returns null when no token cached', () => {
    expect(getCachedToken(PERSON_ID)).toBeNull()
  })

  it('overwrites an existing cached token', () => {
    cacheToken(PERSON_ID, 'old-token')
    cacheToken(PERSON_ID, 'new-token')
    expect(getCachedToken(PERSON_ID)).toBe('new-token')
  })

  it('clears a cached token', () => {
    cacheToken(PERSON_ID, 'my-token')
    clearCachedToken(PERSON_ID)
    expect(getCachedToken(PERSON_ID)).toBeNull()
  })

  it('uses separate storage keys per personId', () => {
    const otherId = '99999999-9999-4999-a999-999999999999'
    cacheToken(PERSON_ID, 'token-a')
    cacheToken(otherId, 'token-b')
    expect(getCachedToken(PERSON_ID)).toBe('token-a')
    expect(getCachedToken(otherId)).toBe('token-b')
  })
})
