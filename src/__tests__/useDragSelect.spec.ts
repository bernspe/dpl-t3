import { describe, it, expect, vi } from 'vitest'
import { useDragSelect } from '@/composables/useDragSelect'

describe('useDragSelect', () => {
  it('isDragging is false initially', () => {
    const { isDragging } = useDragSelect(vi.fn())
    expect(isDragging.value).toBe(false)
  })

  it('draggedDays is empty initially', () => {
    const { draggedDays } = useDragSelect(vi.fn())
    expect(draggedDays.value.size).toBe(0)
  })

  it('startDrag sets isDragging to true', () => {
    const { isDragging, startDrag } = useDragSelect(vi.fn())
    startDrag('2024-01-15')
    expect(isDragging.value).toBe(true)
  })

  it('startDrag adds the first day to draggedDays', () => {
    const { draggedDays, startDrag } = useDragSelect(vi.fn())
    startDrag('2024-01-15')
    expect(draggedDays.value.has('2024-01-15')).toBe(true)
  })

  it('addToSelection adds day while dragging', () => {
    const { draggedDays, startDrag, addToSelection } = useDragSelect(vi.fn())
    startDrag('2024-01-15')
    addToSelection('2024-01-16')
    addToSelection('2024-01-17')
    expect(draggedDays.value.size).toBe(3)
  })

  it('addToSelection does nothing when not dragging', () => {
    const { draggedDays, addToSelection } = useDragSelect(vi.fn())
    addToSelection('2024-01-15')
    expect(draggedDays.value.size).toBe(0)
  })

  it('addToSelection does not add duplicate days', () => {
    const { draggedDays, startDrag, addToSelection } = useDragSelect(vi.fn())
    startDrag('2024-01-15')
    addToSelection('2024-01-15')
    expect(draggedDays.value.size).toBe(1)
  })

  it('endDrag calls onComplete with collected days', () => {
    const onComplete = vi.fn()
    const { startDrag, addToSelection, endDrag } = useDragSelect(onComplete)
    startDrag('2024-01-15')
    addToSelection('2024-01-16')
    endDrag()
    expect(onComplete).toHaveBeenCalledWith(['2024-01-15', '2024-01-16'])
  })

  it('endDrag resets isDragging to false', () => {
    const { isDragging, startDrag, endDrag } = useDragSelect(vi.fn())
    startDrag('2024-01-15')
    endDrag()
    expect(isDragging.value).toBe(false)
  })

  it('endDrag resets draggedDays to empty', () => {
    const { draggedDays, startDrag, endDrag } = useDragSelect(vi.fn())
    startDrag('2024-01-15')
    endDrag()
    expect(draggedDays.value.size).toBe(0)
  })

  it('endDrag without startDrag does nothing', () => {
    const onComplete = vi.fn()
    const { endDrag } = useDragSelect(onComplete)
    endDrag()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('endDrag with single day still calls onComplete', () => {
    const onComplete = vi.fn()
    const { startDrag, endDrag } = useDragSelect(onComplete)
    startDrag('2024-01-15')
    endDrag()
    expect(onComplete).toHaveBeenCalledWith(['2024-01-15'])
  })
})
