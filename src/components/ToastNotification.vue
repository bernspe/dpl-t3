<template>
  <Teleport to="body">
    <TransitionGroup tag="div" name="toast" class="toast-stack" aria-live="polite">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="toast"
        :class="`toast--${t.kind}`"
        @click="dismiss(t.id)"
      >
        <span class="toast-icon">{{ ICONS[t.kind] }}</span>
        <span class="toast-msg">{{ t.message }}</span>
        <button class="toast-close" aria-label="Schließen">×</button>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script setup lang="ts">
import { useToast } from '../composables/useToast'

const { toasts, dismiss } = useToast()

const ICONS: Record<string, string> = {
  info:    'ℹ',
  success: '✓',
  warning: '⚠',
  undo:    '↩',
  redo:    '↪',
}
</script>

<style scoped>
.toast-stack {
  position: fixed;
  bottom: 24px;
  left: 50%;
  translate: -50% 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 9000;
  pointer-events: none;
  align-items: center;
}

.toast {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 13px; font-weight: 500;
  min-width: 220px; max-width: 420px;
  box-shadow: 0 4px 20px rgba(0,0,0,.18);
  cursor: pointer;
  pointer-events: all;
  border: 1px solid transparent;
  background: #fff;
  color: #111;
  border-color: #e5e7eb;
}

.toast--undo, .toast--redo { background: #f8fafc; border-color: #6366f1; color: #312e81; }
.toast--success             { background: #f0fdf4; border-color: #22c55e; color: #14532d; }
.toast--warning             { background: #fef2f2; border-color: #ef4444; color: #7f1d1d; }

.toast-icon  { font-size: 15px; flex-shrink: 0; }
.toast-msg   { flex: 1; line-height: 1.4; }
.toast-close {
  background: none; border: none; cursor: pointer;
  color: inherit; opacity: .5; font-size: 18px; padding: 0; line-height: 1;
  flex-shrink: 0;
}
.toast-close:hover { opacity: 1; }

.toast-enter-active { transition: all .25s cubic-bezier(.16,1,.3,1); }
.toast-leave-active { transition: all .2s ease-in; }
.toast-enter-from   { opacity: 0; translate: 0 16px; }
.toast-leave-to     { opacity: 0; translate: 0 8px; scale: .96; }
.toast-move         { transition: translate .25s ease; }
</style>
