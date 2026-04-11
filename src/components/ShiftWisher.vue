<template>
  <div class="shift-wisher">
    <!-- Toolbar -->
    <div class="sw-toolbar">
      <span class="sw-title">{{ title }}</span>
      <span v-if="wishRequestLabel" class="sw-request-range">📅 {{ wishRequestLabel }}</span>
      <div class="sw-actions">
        <button
          data-testid="btn-undo"
          class="sw-btn"
          :disabled="!canUndo"
          title="Rückgängig (Ctrl+Z)"
          @click="doUndo"
        >↩ Undo</button>
        <button
          data-testid="btn-redo"
          class="sw-btn"
          :disabled="!canRedo"
          title="Wiederholen (Ctrl+Shift+Z)"
          @click="doRedo"
        >↪ Redo</button>
        <button class="sw-btn" @click="goToToday">Heute</button>
      </div>
    </div>

    <!-- Legend -->
    <div class="sw-legend">
      <span class="legend-item legend--preferred">★ Bevorzugt</span>
      <span class="legend-item legend--unavailable">✗ Nicht verfügbar</span>
      <span class="legend-item">□ Verfügbar (Standard)</span>
      <span v-if="holidays && holidays.length > 0" class="legend-item legend--holiday">◆ Feiertag</span>
    </div>

    <!-- Scrollable calendar container -->
    <div ref="containerRef" class="sw-scroll">
      <div ref="topSentinel" class="sentinel" />

      <div
        v-for="month in visibleMonths"
        :key="isoDate(month)"
        :data-month="isoDate(month)"
        class="sw-month-block"
      >
        <div class="sw-month-header">{{ monthLabel(month) }}</div>
        <CalendarView
          :month-start="month"
          :today-iso="todayIso"
          :holidays="holidays"
          :wish-request="wishRequest"
          :shift-catalog="shifts"
          @cycle-wish="onCycleWish"
          @multi-select="onMultiSelect"
          @edit-note="onEditNote"
        />
      </div>

      <div ref="bottomSentinel" class="sentinel" />
    </div>

    <WishModal
      v-if="showModal"
      :days="modalDays"
      :shifts="shifts"
      @apply="onModalApply"
      @cancel="onModalCancel"
    />

    <NotePopover
      v-if="notePopover"
      :day-iso="notePopover.dayIso"
      :note="notePopover.note"
      :anchor-rect="notePopover.anchorRect"
      :shifts="shifts"
      @save="onNoteSave"
      @close="notePopover = null"
    />

    <ToastNotification />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import CalendarView        from './CalendarView.vue'
import ToastNotification   from './ToastNotification.vue'
import WishModal           from './WishModal.vue'
import NotePopover         from './NotePopover.vue'
import { useWishStore }    from '../composables/useWishStore'
import { useInfiniteScroll } from '../composables/useInfiniteScroll'
import { useToast }        from '../composables/useToast'
import { isoDate, formatDayRange } from '../composables/useDateHelpers'
import type { SimpleShift, WishRow, WishType, WishRequest } from '../types/wish.types'

const props = defineProps<{
  personId?:    string
  title?:       string
  shifts?:      SimpleShift[]
  holidays?:    string[]
  wishRequest?: WishRequest
}>()

const title           = computed(() => props.title ?? 'Schichtwünsche')
const wishRequestLabel = computed(() =>
  props.wishRequest
    ? formatDayRange([props.wishRequest.from, props.wishRequest.to])
    : null
)

const emit = defineEmits<{
  'update:wishes': [WishRow[]]
}>()

const store = useWishStore()
const { canUndo, canRedo, undo, redo, cycleWish, bulkSetWish, replaceShiftConstraint, clearShiftConstraints, setNote, getNote, getWishType, wishes } = store

// ── Modal state ───────────────────────────────────────────────────────────────
const showModal  = ref(false)
const modalDays  = ref<string[]>([])

// ── Note popover state ────────────────────────────────────────────────────────
const notePopover = ref<{ dayIso: string; shiftId?: string; note: string; anchorRect?: DOMRect } | null>(null)
const { containerRef, topSentinel, bottomSentinel, visibleMonths, todayIso, monthLabel, goToToday, scrollToDate } =
  useInfiniteScroll()
const toast = useToast()

function onCycleWish(dayIso: string, shiftId?: string): void {
  cycleWish(dayIso, shiftId)
}

function onMultiSelect(days: string[]): void {
  modalDays.value = days
  showModal.value = true
}

function onEditNote(dayIso: string, shiftId: string | undefined, anchorRect: DOMRect): void {
  notePopover.value = { dayIso, shiftId, note: getNote(dayIso, shiftId) ?? '', anchorRect }
}

function onNoteSave(note: string, shiftId?: string): void {
  if (!notePopover.value) return
  const { dayIso } = notePopover.value
  if (shiftId !== undefined) {
    replaceShiftConstraint(dayIso, shiftId, note || undefined)
  } else {
    clearShiftConstraints(dayIso)
    setNote(dayIso, note)
  }
  notePopover.value = null
}

function onModalApply(type: WishType | 'available', note?: string, shiftId?: string): void {
  bulkSetWish(modalDays.value, type, shiftId, note)
  showModal.value = false
  modalDays.value = []
}

function onModalCancel(): void {
  showModal.value = false
  modalDays.value = []
}

function doUndo(): void {
  undo()
  toast.show('Rückgängig gemacht', 'undo')
}

function doRedo(): void {
  redo()
  toast.show('Wiederholt', 'redo')
}

// Emit wishes whenever they change
watch(wishes, (val) => {
  emit('update:wishes', [...val])
}, { deep: true })

// Keyboard shortcuts
function onKeyDown(e: KeyboardEvent): void {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault()
    if (e.shiftKey) { doRedo() } else { doUndo() }
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  if (props.wishRequest) scrollToDate(props.wishRequest.from)
})
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
</script>

<style scoped>
.shift-wisher {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family: system-ui, sans-serif;
  color: #111827;
}

.sw-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
  flex-shrink: 0;
}
.sw-title { font-weight: 700; font-size: 15px; }
.sw-request-range {
  font-size: 12px;
  font-weight: 600;
  color: #1d4ed8;
  background: #eff6ff;
  border: 1px solid #93c5fd;
  border-radius: 999px;
  padding: 2px 10px;
}
.sw-actions { display: flex; gap: 8px; }

.sw-btn {
  padding: 5px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f9fafb;
  font-size: 13px;
  cursor: pointer;
  transition: background .1s;
}
.sw-btn:hover:not(:disabled) { background: #f3f4f6; }
.sw-btn:disabled { opacity: .4; cursor: default; }

.sw-legend {
  display: flex;
  gap: 16px;
  padding: 6px 16px;
  font-size: 12px;
  border-bottom: 1px solid #f3f4f6;
  background: #fafafa;
  flex-shrink: 0;
}
.legend-item { display: flex; align-items: center; gap: 4px; color: #6b7280; }
.legend--preferred   { color: #15803d; }
.legend--unavailable { color: #b91c1c; }
.legend--holiday     { color: #c2410c; }

.sw-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.sentinel { height: 1px; }

.sw-month-block { margin-bottom: 28px; }
.sw-month-header {
  font-size: 16px;
  font-weight: 700;
  color: #374151;
  margin-bottom: 8px;
}
</style>
