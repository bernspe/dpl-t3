import { describe, it, expect, beforeEach } from 'vitest'
import { useWishStore } from '@/composables/useWishStore'

// Reset module state between tests by re-importing a fresh store
// Since the store is a module-level singleton, we clear wishes manually
describe('useWishStore', () => {
  let store: ReturnType<typeof useWishStore>

  beforeEach(() => {
    store = useWishStore()
    // Clear all wishes between tests
    store.clearAll()
  })

  it('initially has empty wishes', () => {
    expect(store.wishes.value).toHaveLength(0)
  })

  it('getWishType returns "available" for unknown day', () => {
    expect(store.getWishType('2024-01-15')).toBe('available')
  })

  it('setWish adds a WishRow', () => {
    store.setWish('2024-01-15', 'preferred')
    expect(store.wishes.value).toHaveLength(1)
  })

  it('getWishType returns correct type after setWish', () => {
    store.setWish('2024-01-15', 'preferred')
    expect(store.getWishType('2024-01-15')).toBe('preferred')
  })

  it('setWish with unavailable works', () => {
    store.setWish('2024-01-15', 'unavailable')
    expect(store.getWishType('2024-01-15')).toBe('unavailable')
  })

  it('setWish on same day overwrites previous entry', () => {
    store.setWish('2024-01-15', 'preferred')
    store.setWish('2024-01-15', 'unavailable')
    expect(store.wishes.value).toHaveLength(1)
    expect(store.getWishType('2024-01-15')).toBe('unavailable')
  })

  it('clearWish removes the entry', () => {
    store.setWish('2024-01-15', 'preferred')
    store.clearWish('2024-01-15')
    expect(store.wishes.value).toHaveLength(0)
    expect(store.getWishType('2024-01-15')).toBe('available')
  })

  it('clearWish on non-existent day does nothing', () => {
    store.clearWish('2024-01-15')
    expect(store.wishes.value).toHaveLength(0)
  })

  describe('cycleWish', () => {
    it('cycles available → preferred', () => {
      store.cycleWish('2024-01-15')
      expect(store.getWishType('2024-01-15')).toBe('preferred')
    })

    it('cycles preferred → unavailable', () => {
      store.setWish('2024-01-15', 'preferred')
      store.cycleWish('2024-01-15')
      expect(store.getWishType('2024-01-15')).toBe('unavailable')
    })

    it('cycles unavailable → available (clears entry)', () => {
      store.setWish('2024-01-15', 'unavailable')
      store.cycleWish('2024-01-15')
      expect(store.getWishType('2024-01-15')).toBe('available')
      expect(store.wishes.value).toHaveLength(0)
    })
  })

  describe('shift-level wishes', () => {
    it('setWish with shiftId stores a shift-level wish', () => {
      store.setWish('2024-01-15', 'preferred', 'shift-1')
      expect(store.wishes.value).toHaveLength(1)
      expect(store.wishes.value[0]!.shiftId).toBe('shift-1')
    })

    it('shift-level wish is distinct from whole-day wish', () => {
      store.setWish('2024-01-15', 'preferred', 'shift-1')
      store.setWish('2024-01-15', 'unavailable')
      expect(store.wishes.value).toHaveLength(2)
      expect(store.getWishType('2024-01-15', 'shift-1')).toBe('preferred')
      expect(store.getWishType('2024-01-15')).toBe('unavailable')
    })

    it('cycleWish with shiftId cycles independently', () => {
      store.cycleWish('2024-01-15', 'shift-1')
      expect(store.getWishType('2024-01-15', 'shift-1')).toBe('preferred')
      expect(store.getWishType('2024-01-15')).toBe('available')
    })
  })

  describe('undo/redo', () => {
    it('canUndo is false initially', () => {
      expect(store.canUndo.value).toBe(false)
    })

    it('canUndo is true after cycleWish', () => {
      store.cycleWish('2024-01-15')
      expect(store.canUndo.value).toBe(true)
    })

    it('undo reverts last cycleWish', () => {
      store.cycleWish('2024-01-15')
      store.undo()
      expect(store.getWishType('2024-01-15')).toBe('available')
    })

    it('canRedo is true after undo', () => {
      store.cycleWish('2024-01-15')
      store.undo()
      expect(store.canRedo.value).toBe(true)
    })

    it('redo re-applies undone change', () => {
      store.cycleWish('2024-01-15')
      store.undo()
      store.redo()
      expect(store.getWishType('2024-01-15')).toBe('preferred')
    })
  })

  describe('bulkSetWish', () => {
    it('sets the same wish type on multiple days', () => {
      store.bulkSetWish(['2024-01-15', '2024-01-16', '2024-01-17'], 'preferred')
      expect(store.getWishType('2024-01-15')).toBe('preferred')
      expect(store.getWishType('2024-01-16')).toBe('preferred')
      expect(store.getWishType('2024-01-17')).toBe('preferred')
    })

    it('overwrites existing wishes for those days', () => {
      store.setWish('2024-01-15', 'preferred')
      store.bulkSetWish(['2024-01-15'], 'unavailable')
      expect(store.getWishType('2024-01-15')).toBe('unavailable')
    })

    it('clears wishes when type is "available"', () => {
      store.setWish('2024-01-15', 'preferred')
      store.setWish('2024-01-16', 'unavailable')
      store.bulkSetWish(['2024-01-15', '2024-01-16'], 'available')
      expect(store.getWishType('2024-01-15')).toBe('available')
      expect(store.getWishType('2024-01-16')).toBe('available')
      expect(store.wishes.value).toHaveLength(0)
    })

    it('counts as one undo step for all days', () => {
      store.bulkSetWish(['2024-01-15', '2024-01-16', '2024-01-17'], 'preferred')
      store.undo()
      expect(store.getWishType('2024-01-15')).toBe('available')
      expect(store.getWishType('2024-01-16')).toBe('available')
      expect(store.getWishType('2024-01-17')).toBe('available')
    })

    it('passes note to all WishRows when provided', () => {
      store.bulkSetWish(['2024-01-15', '2024-01-16'], 'preferred', undefined, 'Urlaub')
      expect(store.getNote('2024-01-15')).toBe('Urlaub')
      expect(store.getNote('2024-01-16')).toBe('Urlaub')
    })
  })

  describe('setNote', () => {
    it('updates the note of an existing wish', () => {
      store.setWish('2024-01-15', 'preferred')
      store.setNote('2024-01-15', 'Krank')
      expect(store.getNote('2024-01-15')).toBe('Krank')
    })

    it('does nothing when no wish exists for that day', () => {
      store.setNote('2024-01-15', 'Krank')
      expect(store.wishes.value).toHaveLength(0)
    })

    it('clears the note when empty string is passed', () => {
      store.setWish('2024-01-15', 'preferred')
      store.setNote('2024-01-15', 'Krank')
      store.setNote('2024-01-15', '')
      expect(store.getNote('2024-01-15')).toBeUndefined()
    })

    it('creates an undo snapshot', () => {
      store.setWish('2024-01-15', 'preferred')
      store.clearAll()  // reset undo history
      store.setWish('2024-01-15', 'preferred')
      store.setNote('2024-01-15', 'Krank')
      store.undo()
      expect(store.getNote('2024-01-15')).toBeUndefined()
    })
  })

  describe('getNote', () => {
    it('returns undefined for a day with no wish', () => {
      expect(store.getNote('2024-01-15')).toBeUndefined()
    })

    it('returns undefined for a wish with no note', () => {
      store.setWish('2024-01-15', 'preferred')
      expect(store.getNote('2024-01-15')).toBeUndefined()
    })
  })
})
