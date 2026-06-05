/**
 * useWishConfig – fetches the plan configuration (shift types + holidays)
 * that ShiftCraft pushes to the WishCraft server before sending invite links.
 *
 * The endpoint is unauthenticated (shift types and holidays are not sensitive).
 * Falls back gracefully: null = no config on server, use URL-param shifts instead.
 */

const API_BASE = import.meta.env.VITE_WISHCRAFT_API_URL ?? 'https://wishcraft.renecol.org'

// ─── Types (mirror of ShiftCraft's PlanConfig) ────────────────────────────────

export interface PlanConfigShiftType {
  id: string
  name: string
  code: string
  color: string
  timeStart: string
  timeEnd: string
}

export interface PlanConfig {
  v: 1
  planId: string
  updatedAt: string
  shiftTypes: PlanConfigShiftType[]
  holidays: string[]   // ISO dates: "YYYY-MM-DD"
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchPlanConfig(
  planId: string,
  apiBase = API_BASE,
): Promise<PlanConfig | null> {
  try {
    const url = new URL(`${apiBase}/api/load-plan-config.php`)
    url.searchParams.set('planId', planId)

    const res = await fetch(url.toString())
    if (!res.ok) return null

    const data = await res.json() as PlanConfig & { ok?: boolean; error?: string }
    // load-plan-config.php returns the config directly (not wrapped in { data: ... })
    if (data.ok === false) return null
    if (!data.planId || !Array.isArray(data.shiftTypes)) return null

    return data as PlanConfig
  } catch {
    return null
  }
}
