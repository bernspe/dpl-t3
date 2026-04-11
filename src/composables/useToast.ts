import { ref, readonly } from 'vue'

export type ToastKind = 'info' | 'success' | 'warning' | 'undo' | 'redo'

export interface Toast {
  id:      number
  message: string
  kind:    ToastKind
}

// Module-level singleton — one toast queue shared across the whole app
const toasts = ref<Toast[]>([])
let   nextId  = 0

export function useToast() {
  function show(message: string, kind: ToastKind = 'info', duration = 3000): void {
    const id = ++nextId
    toasts.value.push({ id, message, kind })
    setTimeout(() => dismiss(id), duration)
  }

  function dismiss(id: number): void {
    const idx = toasts.value.findIndex(t => t.id === id)
    if (idx !== -1) toasts.value.splice(idx, 1)
  }

  return {
    toasts: readonly(toasts),
    show,
    dismiss,
  }
}
