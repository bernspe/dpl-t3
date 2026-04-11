<template>
  <Teleport to="body">
    <div class="modal-overlay" data-testid="wish-modal" @click.self="$emit('cancel')">
      <div class="modal-card" role="dialog" aria-modal="true">
        <p class="modal-title">{{ days.length }} Tag{{ days.length !== 1 ? 'e' : '' }} markiert</p>
        <p class="modal-daterange">{{ dateLabel }}</p>
        <p class="modal-subtitle">Wunsch für diesen Zeitraum setzen:</p>

        <div class="modal-actions">
          <button
            data-testid="modal-btn-preferred"
            class="modal-btn modal-btn--preferred"
            @click="emit('apply', 'preferred', note.trim() || undefined, selectedShift || undefined)"
          >★ Bevorzugt</button>

          <button
            data-testid="modal-btn-unavailable"
            class="modal-btn modal-btn--unavailable"
            @click="emit('apply', 'unavailable', note.trim() || undefined, selectedShift || undefined)"
          >✗ Nicht verfügbar</button>

          <button
            data-testid="modal-btn-available"
            class="modal-btn modal-btn--available"
            @click="emit('apply', 'available', note.trim() || undefined, selectedShift || undefined)"
          >□ Löschen</button>
        </div>

        <!-- Shift selector -->
        <div v-if="shifts && shifts.length > 0" class="modal-shift-section">
          <label class="modal-note-label">Dienst</label>
          <div class="modal-shift-options">
            <label class="modal-shift-option">
              <input type="radio" value="" v-model="selectedShift" />
              <span>Alle Dienste</span>
            </label>
            <label v-for="shift in shifts" :key="shift.id" class="modal-shift-option">
              <input type="radio" :value="shift.id" v-model="selectedShift" />
              <span :style="{ color: shift.color }">{{ shift.name }}</span>
            </label>
          </div>
        </div>

        <div class="modal-note-section">
          <label class="modal-note-label" for="modal-note-input">Notiz <span class="optional">(optional)</span></label>
          <textarea
            id="modal-note-input"
            v-model="note"
            data-testid="modal-note"
            class="modal-note-area"
            rows="2"
            placeholder="Gilt für alle markierten Tage…"
          />
        </div>

        <button
          data-testid="modal-btn-cancel"
          class="modal-cancel"
          @click="$emit('cancel')"
        >Abbrechen</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { WishType, SimpleShift } from '../types/wish.types'
import { formatDayRange } from '../composables/useDateHelpers'

const props = defineProps<{ days: string[]; shifts?: SimpleShift[] }>()
const dateLabel = computed(() => formatDayRange(props.days))
const emit = defineEmits<{
  apply:  [type: WishType | 'available', note?: string, shiftId?: string]
  cancel: []
}>()

const note          = ref('')
const selectedShift = ref('')  // '' = alle Dienste
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 8000;
  padding: 16px;
}

.modal-card {
  background: #fff;
  border-radius: 14px;
  padding: 24px;
  min-width: 280px;
  max-width: 360px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0,0,0,.25);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modal-title {
  font-size: 17px;
  font-weight: 700;
  color: #111827;
  margin: 0;
}
.modal-daterange {
  font-size: 13px;
  font-weight: 600;
  color: #6366f1;
  margin: -8px 0 0;
}
.modal-subtitle {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
}

.modal-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.modal-btn {
  padding: 11px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: 2px solid transparent;
  text-align: left;
  transition: filter .12s;
}
.modal-btn:hover { filter: brightness(.95); }

.modal-btn--preferred   { background: #dcfce7; border-color: #22c55e; color: #15803d; }
.modal-btn--unavailable { background: #fee2e2; border-color: #ef4444; color: #b91c1c; }
.modal-btn--available   { background: #f3f4f6; border-color: #d1d5db; color: #374151; }

.modal-shift-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px solid #f3f4f6;
  padding-top: 12px;
  margin-top: 4px;
}
.modal-shift-options {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.modal-shift-option {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
}
.modal-shift-option input { cursor: pointer; }

.modal-note-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px solid #f3f4f6;
  padding-top: 12px;
  margin-top: 4px;
}
.modal-note-label {
  font-size: 12px;
  font-weight: 700;
  color: #374151;
  text-transform: uppercase;
  letter-spacing: .04em;
}
.optional { font-weight: 400; text-transform: none; color: #9ca3af; }
.modal-note-area {
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 8px;
  font-size: 13px;
  font-family: inherit;
  resize: none;
  outline: none;
}
.modal-note-area:focus { border-color: #6366f1; }

.modal-cancel {
  background: none;
  border: none;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
  padding: 4px;
  text-align: center;
}
.modal-cancel:hover { color: #111827; }
</style>
