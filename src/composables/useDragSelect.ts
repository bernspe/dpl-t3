import { ref } from 'vue'

export function useDragSelect(onComplete: (days: string[]) => void) {
  const isDragging  = ref(false)
  const draggedDays = ref<Set<string>>(new Set())

  function startDrag(dayIso: string): void {
    isDragging.value = true
    draggedDays.value = new Set([dayIso])
  }

  function addToSelection(dayIso: string): void {
    if (!isDragging.value) return
    draggedDays.value.add(dayIso)
  }

  function endDrag(): void {
    if (!isDragging.value) return
    const days = Array.from(draggedDays.value)
    isDragging.value  = false
    draggedDays.value = new Set()
    onComplete(days)
  }

  return { isDragging, draggedDays, startDrag, addToSelection, endDrag }
}
