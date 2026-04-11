<template>
  <div class="wsd-bar" :class="`wsd--${score.rating}`">
    <div class="wsd-header">
      <span class="wsd-label">{{ score.label }}</span>
      <span class="wsd-points">{{ score.earned }} / {{ score.target }} Punkte</span>
      <span class="wsd-pct">{{ score.percentage }}%</span>
    </div>
    <div class="wsd-track">
      <div class="wsd-fill" :style="{ width: fillWidth }" />
      <div class="wsd-target-marker" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WishScore } from '../composables/useWishPoints'

const props = defineProps<{ score: WishScore }>()

// Cap visual progress at 150 % so "very good" doesn't overflow
const fillWidth = computed(() => `${Math.min(props.score.percentage, 150) / 150 * 100}%`)
</script>

<style scoped>
.wsd-bar {
  padding: 8px 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
  flex-shrink: 0;
}

.wsd-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
  font-size: 12px;
}

.wsd-label {
  font-weight: 700;
  flex-shrink: 0;
}

.wsd-points {
  color: #6b7280;
}

.wsd-pct {
  margin-left: auto;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* Progress track */
.wsd-track {
  position: relative;
  height: 6px;
  background: #e5e7eb;
  border-radius: 999px;
  overflow: hidden;
}

.wsd-fill {
  position: absolute;
  inset: 0;
  width: 0;
  border-radius: 999px;
  transition: width .3s ease;
}

/* Target marker at 66.7% of track = 100% score */
.wsd-target-marker {
  position: absolute;
  left: 66.7%;
  top: 0;
  bottom: 0;
  width: 2px;
  background: rgba(0,0,0,.15);
  border-radius: 1px;
}

/* Rating colours */
.wsd--sehr-gut   .wsd-label { color: #15803d; }
.wsd--sehr-gut   .wsd-pct   { color: #15803d; }
.wsd--sehr-gut   .wsd-fill  { background: #22c55e; }

.wsd--gut        .wsd-label { color: #1d4ed8; }
.wsd--gut        .wsd-pct   { color: #1d4ed8; }
.wsd--gut        .wsd-fill  { background: #3b82f6; }

.wsd--ausreichend .wsd-label { color: #b45309; }
.wsd--ausreichend .wsd-pct   { color: #b45309; }
.wsd--ausreichend .wsd-fill  { background: #f59e0b; }

.wsd--unzureichend .wsd-label { color: #b91c1c; }
.wsd--unzureichend .wsd-pct   { color: #b91c1c; }
.wsd--unzureichend .wsd-fill  { background: #ef4444; }
</style>
