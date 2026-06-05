<template>
  <div class="shift-wisher">
    <!-- Toolbar -->
    <div class="sw-toolbar">
      <WishCraftLogo :icon-size="32" :show-wordmark="false" />
      <div class="sw-actions">
        <div class="sw-lang-toggle">
          <button :class="['sw-lang-btn', { active: locale === 'de' }]" @click="setLocale('de')">DE</button>
          <button :class="['sw-lang-btn', { active: locale === 'en' }]" @click="setLocale('en')">EN</button>
        </div>
        <button
          data-testid="btn-undo"
          class="sw-btn sw-btn--icon"
          :disabled="!canUndo"
          :title="$t('toast.undone') + ' (Ctrl+Z)'"
          @click="doUndo"
        >↩</button>
        <button
          data-testid="btn-redo"
          class="sw-btn sw-btn--icon"
          :disabled="!canRedo"
          :title="$t('toast.redone') + ' (Ctrl+Shift+Z)'"
          @click="doRedo"
        >↪</button>
        <slot name="toolbar-end" />
      </div>
    </div>

    <!-- Context bar -->
    <div class="sw-context-bar">
      <div class="sw-context-left">
        <span v-if="props.name" class="sw-name">👤 {{ props.name }}</span>
        <button v-if="wishRequestLabel" class="sw-request-range" @click="scrollToDate(props.wishRequest!.from)">{{ wishRequestLabel }}</button>
      </div>
      <div class="sw-context-right">
        <span v-if="props.deadline" class="sw-deadline">⏰ {{ $t('toolbar.deadline', { date: formatDeadline(props.deadline) }) }}</span>
        <button class="sw-today-btn" @click="goToToday">{{ $t('toolbar.today') }}</button>
      </div>
    </div>

    <!-- Legend -->
    <div class="sw-legend">
      <span class="legend-item legend--preferred">{{ $t('legend.preferred') }}</span>
      <span class="legend-item legend--unavailable">{{ $t('legend.unavailable') }}</span>
      <span class="legend-item">{{ $t('legend.available') }}</span>
      <span v-if="holidays && holidays.length > 0" class="legend-item legend--holiday">{{ $t('legend.holiday') }}</span>
    </div>

    <WishScoreDisplay v-if="score" :score="score" />

    <!-- Scrollable calendar container -->
    <div ref="containerRef" class="sw-scroll">
      <div ref="topSentinel" class="sentinel" />

      <div
        v-for="month in visibleMonths"
        :key="isoDate(month)"
        :data-month="isoDate(month)"
        class="sw-month-block"
      >
        <div class="sw-month-header">{{ monthLabel(month, locale) }}</div>
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
        <!-- "Load wishes from other months" hint — shown once, below the target month -->
        <div
          v-if="showLoadOtherMonths && targetMonth && isoDate(month) === targetMonth"
          class="sw-load-other-months"
        >
          <button class="sw-load-other-btn" @click="emit('load-other-months')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 .49-4.85"/>
            </svg>
            {{ $t('calendar.loadOtherMonths') }}
          </button>
        </div>
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
import { useI18n } from 'vue-i18n'
import { setLocale, i18n } from '../i18n'
import CalendarView        from './CalendarView.vue'
import ToastNotification   from './ToastNotification.vue'
import WishModal           from './WishModal.vue'
import NotePopover         from './NotePopover.vue'
import WishScoreDisplay    from './WishScoreDisplay.vue'
import WishCraftLogo       from './WishCraftLogo.vue'
import { useWishStore }    from '../composables/useWishStore'
import { useInfiniteScroll } from '../composables/useInfiniteScroll'
import { useToast }        from '../composables/useToast'
import { isoDate, formatDayRange, formatDay } from '../composables/useDateHelpers'
import { calcWishScore }           from '../composables/useWishPoints'
import type { PointsRules, WishScore } from '../composables/useWishPoints'
import type { SimpleShift, WishRow, WishType, WishRequest } from '../types/wish.types'

const props = defineProps<{
  planId?:      string
  personId?:    string
  name?:        string
  deadline?:    string
  title?:       string
  shifts?:      SimpleShift[]
  holidays?:    string[]
  wishRequest?:          WishRequest
  showLoadOtherMonths?:  boolean   // show "load wishes from other months" hint below target month
  pointsBase?:           number    // 0-100; activates scoring when set together with wishRequest
  pointsRules?:          PointsRules  // optional custom point values
}>()

const emit = defineEmits<{
  'update:wishes':      [WishRow[]]
  'update:score':       [WishScore | null]
  'month-visible':      [month: string]
  'load-other-months':  []
}>()

const { t } = useI18n()
const locale = i18n.global.locale
const store = useWishStore()
const { canUndo, canRedo, undo, redo, cycleWish, bulkSetWish, replaceShiftConstraint, clearShiftConstraints, setNote, getNote, getWishType, wishes } = store

const title            = computed(() => props.title ?? '')

function formatDeadline(iso: string): string {
  try {
    return new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso + 'T00:00:00'))
  } catch {
    return iso
  }
}
/** YYYY-MM of the target/invite month, or null */
const targetMonth = computed(() =>
  props.wishRequest ? props.wishRequest.from.slice(0, 7) : null
)

const wishRequestLabel = computed(() => {
  void locale.value  // reactive dependency
  return props.wishRequest
    ? formatDayRange([props.wishRequest.from, props.wishRequest.to], locale.value)
    : null
})

const score = computed(() => {
  if (props.pointsBase == null || !props.wishRequest) return null
  return calcWishScore(
    wishes.value as WishRow[],
    props.wishRequest.from,
    props.wishRequest.to,
    new Set(props.holidays ?? []),
    props.pointsBase,
    props.pointsRules,
  )
})

watch(score, (val) => emit('update:score', val), { immediate: true })

// ── Modal state ───────────────────────────────────────────────────────────────
const showModal  = ref(false)
const modalDays  = ref<string[]>([])

// ── Note popover state ────────────────────────────────────────────────────────
const notePopover = ref<{ dayIso: string; shiftId?: string; note: string; anchorRect?: DOMRect } | null>(null)
const { containerRef, topSentinel, bottomSentinel, visibleMonths, todayIso, monthLabel, goToToday, scrollToDate } =
  useInfiniteScroll()
const toast = useToast()

// Emit month-visible whenever a previously-unseen month scrolls into view
const _seenMonths = new Set<string>()
watch(visibleMonths, (months) => {
  for (const d of months) {
    const m = d.toISOString().slice(0, 7)
    if (!_seenMonths.has(m)) {
      _seenMonths.add(m)
      emit('month-visible', m)
    }
  }
}, { immediate: true })

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
  toast.show(t('toast.undone'), 'undo')
}

function doRedo(): void {
  redo()
  toast.show(t('toast.redone'), 'redo')
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
  if (props.wishRequest) {
    scrollToDate(props.wishRequest.from)
    const label = monthLabel(new Date(props.wishRequest.from + 'T00:00:00'))
    toast.show(t('toast.enterWishes', { month: label }), 'info', 5000)
  }
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
  padding: 8px 12px;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
  flex-shrink: 0;
  min-height: 48px;
}

.sw-context-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 12px;
  background: #f8fafc;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.sw-context-left,
.sw-context-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sw-name {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
}

.sw-deadline {
  font-size: 11px;
  font-weight: 600;
  color: #92400e;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 999px;
  padding: 1px 8px;
  white-space: nowrap;
}

.sw-request-range {
  font-size: 12px;
  font-weight: 600;
  color: #13A8C4;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-decoration: underline dotted;
  text-underline-offset: 3px;
  font-family: inherit;
}
.sw-request-range:hover { color: #0B8AA3; }

.sw-today-btn {
  font-size: 12px;
  font-weight: 600;
  color: #13A8C4;
  background: none;
  border: 1px solid #13A8C4;
  border-radius: 6px;
  padding: 2px 10px;
  cursor: pointer;
  transition: background .1s, color .1s;
}
.sw-today-btn:hover { background: #E4F6FA; }

.sw-actions { display: flex; gap: 6px; align-items: center; }

.sw-lang-toggle { display: flex; gap: 3px; }
.sw-lang-btn {
  padding: 3px 7px;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid #d1d5db;
  border-radius: 5px;
  background: #f9fafb;
  color: #6b7280;
  cursor: pointer;
  transition: all .1s;
  line-height: 1.4;
}
.sw-lang-btn.active { background: #13A8C4; border-color: #13A8C4; color: #fff; }
.sw-lang-btn:hover:not(.active) { background: #E4F6FA; border-color: #13A8C4; color: #13A8C4; }

.sw-btn {
  padding: 6px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f9fafb;
  font-size: 13px;
  cursor: pointer;
  transition: background .1s;
  line-height: 1;
}
.sw-btn--icon {
  width: 36px;
  height: 36px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
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

.sw-load-other-months {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}
.sw-load-other-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: transparent;
  color: #13A8C4;
  border: 1.5px solid #13A8C4;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background .15s, color .15s;
}
.sw-load-other-btn:hover {
  background: #13A8C4;
  color: #fff;
}
</style>
