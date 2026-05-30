<template>
  <Teleport to="body">
    <div
      class="np-overlay"
      data-testid="note-popover"
      @mousedown.self="$emit('close')"
    >
      <div
        class="np-card"
        :style="cardStyle"
        role="dialog"
        :aria-label="t('note.ariaLabel')"
      >
        <p class="np-day">{{ formatDay(dayIso, i18n.global.locale.value) }}</p>
        <p class="np-label">{{ $t('note.title') }}</p>

        <!-- Shift selector -->
        <div v-if="shifts && shifts.length > 0" class="np-shift-section">
          <p class="np-sublabel">{{ $t('note.shift') }}</p>
          <div class="np-shift-options">
            <label class="np-shift-option">
              <input type="radio" value="" v-model="localShiftId" />
              <span>{{ $t('note.allShifts') }}</span>
            </label>
            <label v-for="shift in shifts" :key="shift.id" class="np-shift-option">
              <input type="radio" :value="shift.id" v-model="localShiftId" />
              <span :style="{ color: shift.color }">{{ shift.name }}</span>
            </label>
          </div>
        </div>

        <textarea
          ref="textareaRef"
          v-model="draft"
          data-testid="note-textarea"
          class="np-textarea"
          rows="3"
          :placeholder="t('note.placeholder')"
          @keydown.escape.prevent="$emit('close')"
        />
        <div class="np-actions">
          <button
            data-testid="note-save"
            class="np-btn np-btn--save"
            @click="onSave"
          >{{ $t('note.save') }}</button>
          <button
            class="np-btn np-btn--cancel"
            @click="$emit('close')"
          >{{ $t('note.cancel') }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWishStore } from '../composables/useWishStore'
import { formatDay } from '../composables/useDateHelpers'
import { i18n } from '../i18n'
import type { SimpleShift } from '../types/wish.types'

const props = defineProps<{
  dayIso:      string
  note:        string
  anchorRect?: DOMRect
  shifts?:     SimpleShift[]
}>()

const emit = defineEmits<{
  save:  [note: string, shiftId?: string]
  close: []
}>()

const { t } = useI18n()
const { getNote, wishes } = useWishStore()

// Pre-select an existing shift constraint for this day (if any)
const existingShift    = wishes.value.find(r => r.dayIso === props.dayIso && r.shiftId !== undefined)
const draft            = ref(existingShift ? (getNote(props.dayIso, existingShift.shiftId) ?? '') : props.note)
const localShiftId     = ref(existingShift?.shiftId ?? '')
const textareaRef      = ref<HTMLTextAreaElement | null>(null)

watch(localShiftId, (newId) => {
  draft.value = getNote(props.dayIso, newId || undefined) ?? ''
})

const cardStyle = computed(() => {
  const MOBILE_BREAKPOINT = 520
  if (!props.anchorRect || window.innerWidth < MOBILE_BREAKPOINT) {
    return {}
  }
  const rect        = props.anchorRect
  const CARD_WIDTH  = 300
  const CARD_HEIGHT = 380   // conservative estimate (incl. shift selector)
  const GAP         = 8

  // Flip above anchor if not enough space below
  const spaceBelow = window.innerHeight - rect.bottom - GAP
  const top = spaceBelow >= CARD_HEIGHT
    ? rect.bottom + GAP
    : Math.max(GAP, rect.top - GAP - CARD_HEIGHT)

  const left = Math.max(GAP, Math.min(rect.left, window.innerWidth - CARD_WIDTH - GAP))

  return { position: 'fixed' as const, top: `${top}px`, left: `${left}px`, transform: 'none' }
})

function onSave(): void {
  emit('save', draft.value.trim(), localShiftId.value || undefined)
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
  textareaRef.value?.focus()
  textareaRef.value?.select()
})
onUnmounted(() => document.removeEventListener('keydown', onKeyDown))
</script>

<style scoped>
.np-overlay {
  position: fixed;
  inset: 0;
  z-index: 8500;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Transparent overlay — just catches outside clicks */
}

.np-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  width: 280px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0,0,0,.2);
  border: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.np-day {
  font-size: 13px;
  font-weight: 600;
  color: #6366f1;
  margin: 0;
}
.np-label {
  font-size: 12px;
  font-weight: 700;
  color: #374151;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: .04em;
}

.np-shift-section { margin-bottom: 2px; }
.np-sublabel {
  font-size: 11px;
  font-weight: 700;
  color: #374151;
  margin: 0 0 4px;
  text-transform: uppercase;
  letter-spacing: .04em;
}
.np-shift-options { display: flex; flex-direction: column; gap: 4px; }
.np-shift-option {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
}
.np-shift-option input { cursor: pointer; }

.np-textarea {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 8px;
  font-size: 13px;
  font-family: inherit;
  resize: none;
  outline: none;
  line-height: 1.5;
  box-sizing: border-box;
}
.np-textarea:focus { border-color: #6366f1; box-shadow: 0 0 0 2px #eef2ff; }

.np-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.np-btn {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
}
.np-btn--save   { background: #6366f1; color: #fff; border-color: #6366f1; }
.np-btn--save:hover { background: #4f46e5; }
.np-btn--cancel { background: #f3f4f6; color: #374151; border-color: #e5e7eb; }
.np-btn--cancel:hover { background: #e5e7eb; }
</style>
