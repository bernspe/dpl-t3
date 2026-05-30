export function generateAccessToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

const storageKey = (personId: string) => `sc_token_${personId}`

export function cacheToken(personId: string, token: string): void {
  localStorage.setItem(storageKey(personId), token)
}

export function getCachedToken(personId: string): string | null {
  return localStorage.getItem(storageKey(personId))
}

export function clearCachedToken(personId: string): void {
  localStorage.removeItem(storageKey(personId))
}
