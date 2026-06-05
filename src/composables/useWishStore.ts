import { ref, readonly, computed } from 'vue'
import type { WishRow, WishType } from '../types/wish.types'

const CAPACITY = 50

// ── Module-level singleton ────────────────────────────────────────────────────
const wishes  = ref<WishRow[]>([])
const _past   = ref<string[]>([])   // JSON snapshots for undo
const _future = ref<string[]>([])   // JSON snapshots for redo
let   _paused = false
let   _nextId = 0

const canUndo = computed(() => _past.value.length > 0)
const canRedo = computed(() => _future.value.length > 0)

function _snapshot(): void {
  if (_paused) return
  _past.value.push(JSON.stringify(wishes.value))
  if (_past.value.length > CAPACITY) _past.value.shift()
  _future.value = []
}

// ── Public API ────────────────────────────────────────────────────────────────

export function useWishStore() {
  function getWishType(dayIso: string, shiftId?: string): WishType | 'available' {
    const w = wishes.value.find(r =>
      r.dayIso === dayIso && r.shiftId === shiftId
    )
    return w ? w.type : 'available'
  }

  function setWish(dayIso: string, type: WishType, shiftId?: string): void {
    _snapshot()
    const idx = wishes.value.findIndex(r =>
      r.dayIso === dayIso && r.shiftId === shiftId
    )
    if (idx !== -1) {
      wishes.value[idx] = { ...wishes.value[idx]!, type }
    } else {
      wishes.value.push({ id: String(++_nextId), dayIso, shiftId, type })
    }
  }

  function clearWish(dayIso: string, shiftId?: string): void {
    const idx = wishes.value.findIndex(r =>
      r.dayIso === dayIso && r.shiftId === shiftId
    )
    if (idx === -1) return
    _snapshot()
    wishes.value.splice(idx, 1)
  }

  function cycleWish(dayIso: string, shiftId?: string): void {
    const current = getWishType(dayIso, shiftId)
    _snapshot()
    if (current === 'available') {
      const idx = wishes.value.findIndex(r =>
        r.dayIso === dayIso && r.shiftId === shiftId
      )
      if (idx !== -1) {
        wishes.value[idx] = { ...wishes.value[idx]!, type: 'preferred' }
      } else {
        wishes.value.push({ id: String(++_nextId), dayIso, shiftId, type: 'preferred' })
      }
    } else if (current === 'preferred') {
      const idx = wishes.value.findIndex(r =>
        r.dayIso === dayIso && r.shiftId === shiftId
      )
      wishes.value[idx] = { ...wishes.value[idx]!, type: 'unavailable' }
    } else {
      const idx = wishes.value.findIndex(r =>
        r.dayIso === dayIso && r.shiftId === shiftId
      )
      wishes.value.splice(idx, 1)
    }
  }

  function undo(): void {
    if (_past.value.length === 0) return
    _future.value.push(JSON.stringify(wishes.value))
    wishes.value = JSON.parse(_past.value.pop()!)
  }

  function redo(): void {
    if (_future.value.length === 0) return
    _past.value.push(JSON.stringify(wishes.value))
    wishes.value = JSON.parse(_future.value.pop()!)
  }

  function pause():  void { _paused = true  }
  function resume(): void { _paused = false }

  function getNote(dayIso: string, shiftId?: string): string | undefined {
    return wishes.value.find(r => r.dayIso === dayIso && r.shiftId === shiftId)?.note
  }

  /** True if any wish for this day has a note, regardless of shiftId */
  function hasAnyNote(dayIso: string): boolean {
    return wishes.value.some(r => r.dayIso === dayIso && !!r.note)
  }

  /** True if any wish for this day targets a specific shift */
  function hasShiftConstraint(dayIso: string): boolean {
    return wishes.value.some(r => r.dayIso === dayIso && r.shiftId !== undefined)
  }

  /** Update only the note field of an existing wish. No-op if wish doesn't exist. */
  function setNote(dayIso: string, note: string, shiftId?: string): void {
    const idx = wishes.value.findIndex(r => r.dayIso === dayIso && r.shiftId === shiftId)
    if (idx === -1) return
    _snapshot()
    const trimmed = note.trim()
    wishes.value[idx] = { ...wishes.value[idx]!, note: trimmed || undefined }
  }

  /** Apply one wish type to multiple days — counts as a single undo step */
  function bulkSetWish(days: string[], type: WishType | 'available', shiftId?: string, note?: string): void {
    _snapshot()           // one undo snapshot for the whole batch
    _paused = true
    for (const dayIso of days) {
      const idx = wishes.value.findIndex(r =>
        r.dayIso === dayIso && r.shiftId === shiftId
      )
      if (type === 'available') {
        if (idx !== -1) wishes.value.splice(idx, 1)
      } else {
        if (idx !== -1) {
          wishes.value[idx] = { ...wishes.value[idx]!, type, note: note ?? wishes.value[idx]!.note }
        } else {
          wishes.value.push({ id: String(++_nextId), dayIso, shiftId, type, note })
        }
      }
    }
    _paused = false
  }

  /** Remove all shift-specific wishes for a day. Counts as a single undo step. */
  function clearShiftConstraints(dayIso: string): void {
    const has = wishes.value.some(r => r.dayIso === dayIso && r.shiftId !== undefined)
    if (!has) return
    _snapshot()
    _paused = true
    for (let i = wishes.value.length - 1; i >= 0; i--) {
      if (wishes.value[i]!.dayIso === dayIso && wishes.value[i]!.shiftId !== undefined) {
        wishes.value.splice(i, 1)
      }
    }
    _paused = false
  }

  /**
   * Replace all shift-specific wishes for a day with a single new one.
   * Counts as a single undo step.
   */
  function replaceShiftConstraint(dayIso: string, shiftId: string, note?: string): void {
    _snapshot()
    _paused = true
    // Remove every existing shift-specific wish for this day
    for (let i = wishes.value.length - 1; i >= 0; i--) {
      const r = wishes.value[i]!
      if (r.dayIso === dayIso && r.shiftId !== undefined) {
        wishes.value.splice(i, 1)
      }
    }
    // Inherit wish type from whole-day entry, default to 'preferred'
    const wholeDayWish = wishes.value.find(r => r.dayIso === dayIso && r.shiftId === undefined)
    const type: WishType = (wholeDayWish?.type) ?? 'preferred'
    wishes.value.push({ id: String(++_nextId), dayIso, shiftId, type, note: note || undefined })
    _paused = false
  }

  /** Bulk-load wishes without creating undo history entries */
  function loadWishes(rows: WishRow[]): void {
    _paused = true
    wishes.value = [...rows]
    _paused = false
  }

  /**
   * Merge server-loaded wishes for a single month into the store.
   * Existing wishes for that month (user may have already edited them) are kept;
   * only days not yet present in the store receive new entries from the server.
   */
  function mergeWishesForMonth(rows: WishRow[], month: string): void {
    _paused = true
    for (const row of rows) {
      if (!row.dayIso.startsWith(month)) continue
      const exists = wishes.value.some(
        r => r.dayIso === row.dayIso && r.shiftId === row.shiftId
      )
      if (!exists) {
        wishes.value.push({ ...row, id: String(++_nextId) })
      }
    }
    _paused = false
  }

  /** Clear all wishes AND history — for reset / testing */
  function clearAll(): void {
    _paused = true
    wishes.value  = []
    _past.value   = []
    _future.value = []
    _paused = false
  }

  return {
    wishes: readonly(wishes),
    getWishType,
    getNote,
    hasAnyNote,
    hasShiftConstraint,
    setWish,
    setNote,
    bulkSetWish,
    clearWish,
    cycleWish,
    clearShiftConstraints,
    replaceShiftConstraint,
    loadWishes,
    mergeWishesForMonth,
    clearAll,
    undo,
    redo,
    canUndo,
    canRedo,
    pause,
    resume,
  }
}
