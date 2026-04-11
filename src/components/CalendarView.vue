<template>
  <div class="calendar-view">
    <!-- Weekday header -->
    <div class="cal-header">
      <div v-for="label in WEEKDAY_LABELS" :key="label" class="cal-weekday">{{ label }}</div>
    </div>

    <!-- Day grid -->
    <div
      class="cal-body"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
      @touchmove.prevent="onTouchMove"
      @touchend="onTouchEnd"
    >
      <div
        v-for="day in calendarDays"
        :key="day.key"
        data-testid="cal-day"
        :data-iso="day.iso"
        class="cal-day"
        :class="[
          {
            'in-month':   day.inCurrentMonth,
            today:        day.isToday,
            weekend:      day.isWeekend,
            holiday:      holidaySet.has(day.iso),
            'in-request': inRequest(day.iso),
            selecting:    isDragging && draggedDays.has(day.iso),
          },
          !shifts || shifts.length === 0 ? wishClass(day.iso) : '',
        ]"
        :data-today="day.isToday ? 'true' : undefined"
        @mousedown.prevent="onMouseDown(day.iso)"
        @mouseenter="onMouseEnter(day.iso)"
        @click="onDayClick(day.iso)"
        @touchstart.prevent="onTouchStart(day.iso)"
      >
        <div class="cal-day-num">{{ day.dayNum }}</div>

        <!-- Shift-level rows (if shifts provided) -->
        <template v-if="shifts && shifts.length > 0">
          <div
            v-for="shift in shifts"
            :key="shift.id"
            class="cal-shift-row"
            :class="wishClass(day.iso, shift.id)"
            @click.stop="emit('cycleWish', day.iso, shift.id)"
          >
            <span class="cal-shift-label" :style="{ color: shift.color }">{{ shift.name }}</span>
            <span class="wish-badge">{{ wishBadge(day.iso, shift.id) }}</span>
          </div>
        </template>

        <!-- Whole-day wish badge + note controls (no shifts) -->
        <template v-else>
          <div v-if="getWishType(day.iso) !== 'available'" class="wish-row">
            <span class="wish-badge">{{ wishBadge(day.iso) }}</span>
            <span
              v-if="hasAnyNote(day.iso) || hasShiftConstraint(day.iso)"
              data-testid="note-indicator"
              class="note-dot"
              :title="hasShiftConstraint(day.iso) ? 'Diensteinschränkung gesetzt' : 'Notiz vorhanden'"
            >●</span>
            <button
              data-testid="note-btn"
              class="note-btn"
              title="Notiz bearbeiten"
              @touchstart.stop
              @click.stop="onNoteClick(day.iso, $event)"
            >✎</button>
          </div>

          <!-- Bottom info: note preview + shift constraints -->
          <div v-if="notePreview(day.iso) || shiftWishes(day.iso).length > 0" class="cell-info">
            <div v-if="notePreview(day.iso)" class="cell-note">{{ notePreview(day.iso) }}</div>
            <div
              v-for="sw in shiftWishes(day.iso)"
              :key="sw.shiftId"
              class="cell-shift"
              :style="{ color: shiftColor(sw.shiftId!) }"
            >{{ WISH_SYMBOL[sw.type] }} {{ shiftName(sw.shiftId!) }}</div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { buildCalendarDays, WEEKDAY_LABELS } from '../composables/useDateHelpers'
import { useWishStore } from '../composables/useWishStore'
import { useDragSelect } from '../composables/useDragSelect'
import type { SimpleShift, WishRequest, WishType } from '../types/wish.types'

const props = defineProps<{
  monthStart:    Date
  todayIso:      string
  shifts?:       SimpleShift[]
  holidays?:     string[]
  wishRequest?:  WishRequest
  shiftCatalog?: SimpleShift[]
}>()

const emit = defineEmits<{
  cycleWish:   [dayIso: string, shiftId?: string]
  multiSelect: [days: string[]]
  editNote:    [dayIso: string, shiftId: string | undefined, anchorRect: DOMRect]
}>()

const { getWishType, getNote, hasAnyNote, hasShiftConstraint, wishes } = useWishStore()

const WISH_SYMBOL: Record<WishType, string> = { preferred: '★', unavailable: '✗' }

function shiftWishes(dayIso: string) {
  return wishes.value.filter(r => r.dayIso === dayIso && r.shiftId !== undefined)
}
function shiftName(shiftId: string): string {
  return props.shiftCatalog?.find(s => s.id === shiftId)?.name ?? shiftId
}
function shiftColor(shiftId: string): string {
  return props.shiftCatalog?.find(s => s.id === shiftId)?.color ?? '#6b7280'
}
function notePreview(dayIso: string): string {
  const n = getNote(dayIso)
  return n ? (n.length > 18 ? n.slice(0, 17) + '…' : n) : ''
}

const calendarDays  = computed(() => buildCalendarDays(props.monthStart, props.todayIso))
const holidaySet    = computed(() => new Set(props.holidays ?? []))
const inRequest     = (iso: string) =>
  !!props.wishRequest && iso >= props.wishRequest.from && iso <= props.wishRequest.to

// Prevent the click event that fires after a multi-day drag from cycling the last cell
let _suppressNextClick = false

const { isDragging, draggedDays, startDrag, addToSelection, endDrag } = useDragSelect((days) => {
  if (days.length > 1) {
    _suppressNextClick = true
    emit('multiSelect', days)
    // Reset after the click event fires (same tick, before microtasks)
    setTimeout(() => { _suppressNextClick = false }, 0)
  }
  // 1 day: do nothing — desktop `@click` handles it; touch handled in onTouchEnd
})

// ── Mouse handlers ─────────────────────────────────────────────────────────────

function onMouseDown(iso: string): void { startDrag(iso) }

function onMouseEnter(iso: string): void {
  if (isDragging.value) addToSelection(iso)
}

function onMouseUp(): void {
  if (isDragging.value) endDrag()
}

function onDayClick(iso: string): void {
  if (_suppressNextClick) { _suppressNextClick = false; return }
  emit('cycleWish', iso)
}

// ── Touch handlers ─────────────────────────────────────────────────────────────

function onTouchStart(iso: string): void {
  startDrag(iso)
  // Note: touchstart.prevent blocks the synthetic click, so onTouchEnd must
  // handle single-tap cycling manually.
}

function onTouchMove(e: TouchEvent): void {
  if (!isDragging.value) return
  const touch = e.touches[0]
  if (!touch) return
  const el    = document.elementFromPoint(touch.clientX, touch.clientY)
  const dayEl = el?.closest<HTMLElement>('[data-iso]')
  if (dayEl?.dataset.iso) addToSelection(dayEl.dataset.iso)
}

function onTouchEnd(): void {
  if (!isDragging.value) return
  const days        = Array.from(draggedDays.value)
  const isSingleTap = days.length === 1
  endDrag()   // calls onComplete → emits multiSelect for >1 days
  if (isSingleTap) emit('cycleWish', days[0]!)
}

function onNoteClick(iso: string, e: MouseEvent): void {
  const rect = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-iso]')!.getBoundingClientRect()
  emit('editNote', iso, undefined, rect)
}

// ── Visual helpers ─────────────────────────────────────────────────────────────

function wishClass(dayIso: string, shiftId?: string): string {
  const t = getWishType(dayIso, shiftId)
  if (t === 'preferred')   return 'wish--preferred'
  if (t === 'unavailable') return 'wish--unavailable'
  return ''
}

const BADGES: Record<string, string> = { preferred: '★', unavailable: '✗' }

function wishBadge(dayIso: string, shiftId?: string): string {
  return BADGES[getWishType(dayIso, shiftId)] ?? ''
}
</script>

<style scoped>
.calendar-view { user-select: none; }

.cal-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  margin-bottom: 4px;
}
.cal-weekday {
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  color: #6b7280;
  text-transform: uppercase;
  padding: 4px 0;
}

.cal-body {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 3px;
  touch-action: none;
}

.cal-day {
  min-height: 56px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 4px 5px;
  cursor: pointer;
  transition: border-color .12s, background .12s;
  font-size: 12px;
}
.cal-day:not(.in-month)    { opacity: .35; pointer-events: none; }
.cal-day.today             { border-color: #6366f1; background: #eef2ff; }
.cal-day.weekend           { background: #f3f4f6; }
.cal-day.holiday            { background: #fff7ed; border-color: #fed7aa; }
.cal-day.holiday .cal-day-num { color: #c2410c; }
.cal-day.in-request {
  outline: 2px solid #3b82f6;
  outline-offset: -2px;
}
.cal-day:hover             { border-color: #9ca3af; }

/* Wish state coloring */
.cal-day.wish--preferred   { background: #bbf7d0; border-color: #16a34a; }
.cal-day.wish--unavailable { background: #fecaca; border-color: #dc2626; }

/* Drag-selection highlight */
.cal-day.selecting {
  outline: 2px solid #6366f1;
  outline-offset: -2px;
  background: #eef2ff;
}

.cal-day-num {
  font-size: 11px;
  font-weight: 700;
  color: #6b7280;
  margin-bottom: 2px;
}
.cal-day.today .cal-day-num { color: #6366f1; }

/* Shift rows */
.cal-shift-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 4px;
  padding: 1px 3px;
  margin-top: 2px;
  border: 1px solid transparent;
  background: #f3f4f6;
  cursor: pointer;
  font-size: 10px;
}
.cal-shift-row:hover                   { border-color: #9ca3af; }
.cal-shift-row.wish--preferred         { background: #dcfce7; border-color: #86efac; }
.cal-shift-row.wish--unavailable       { background: #fee2e2; border-color: #fca5a5; }
.cal-shift-label { font-weight: 600; font-size: 9px; text-transform: uppercase; }

.wish-row {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-top: 2px;
}
.wish-badge { font-size: 11px; font-weight: 700; }

.cell-info {
  margin-top: 3px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.cell-note {
  font-size: 8px;
  color: #6b7280;
  line-height: 1.3;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.cell-shift {
  font-size: 8px;
  font-weight: 700;
  line-height: 1.3;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.note-dot {
  font-size: 7px;
  color: #6366f1;
  line-height: 1;
  flex-shrink: 0;
}

.note-btn {
  display: none;
  background: none;
  border: none;
  padding: 0 1px;
  font-size: 10px;
  cursor: pointer;
  color: #9ca3af;
  line-height: 1;
  flex-shrink: 0;
}
.note-btn:hover { color: #6366f1; }

/* Desktop: show note-btn on hover */
@media (hover: hover) {
  .cal-day:hover .note-btn { display: inline; }
}
/* Mobile/touch: always show */
@media (hover: none) {
  .note-btn { display: inline; }
}
</style>
