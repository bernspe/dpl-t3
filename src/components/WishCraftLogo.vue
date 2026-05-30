<script setup lang="ts">
withDefaults(defineProps<{
  iconSize?: number
  variant?: 'solid' | 'light' | 'soft'
  dark?: boolean
  showWordmark?: boolean
}>(), {
  iconSize: 40,
  variant: 'solid',
  dark: false,
  showWordmark: true,
})
</script>

<template>
  <div class="wc-logo">
    <!-- Icon -->
    <svg
      :width="iconSize"
      :height="iconSize"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <!-- background -->
      <rect
        width="64" height="64" rx="14"
        :fill="variant === 'solid' ? '#13A8C4' : variant === 'soft' ? '#E4F6FA' : '#ffffff'"
        :stroke="variant === 'light' ? '#e5e7eb' : 'none'"
        stroke-width="1.5"
      />
      <!-- top bar -->
      <rect
        x="11" y="12" width="42" height="8" rx="4"
        :fill="variant === 'solid' ? 'rgba(255,255,255,0.22)' : variant === 'soft' ? '#c4e7ee' : '#dbeef3'"
      />
      <!-- bottom bar -->
      <rect
        x="11" y="44" width="42" height="8" rx="4"
        :fill="variant === 'solid' ? 'rgba(255,255,255,0.22)' : variant === 'soft' ? '#c4e7ee' : '#dbeef3'"
      />
      <!-- ring -->
      <circle
        cx="32" cy="32" r="13"
        :fill="variant === 'solid' ? 'rgba(255,255,255,0.14)' : variant === 'soft' ? '#ffffff' : '#E4F6FA'"
      />
      <!-- star (5-pointed, r1=11, r2=4.6) -->
      <path
        d="M32.00 21.00 L34.71 28.28 L42.46 28.60 L36.37 33.42 L38.47 40.90 L32.00 36.60 L25.53 40.90 L27.63 33.42 L21.54 28.60 L29.29 28.28 Z"
        :fill="variant === 'solid' ? '#ffffff' : '#13A8C4'"
      />
    </svg>

    <!-- Wordmark -->
    <div v-if="showWordmark" class="wc-wordmark">
      <div class="wc-name">
        <span class="wc-wish" :class="{ 'wc-wish--dark': dark }">Wish</span><span class="wc-craft" :class="{ 'wc-craft--dark': dark }">Craft</span>
      </div>
      <div class="wc-tagline" :class="{ 'wc-tagline--dark': dark }">Your shifts, your way.</div>
    </div>
  </div>
</template>

<style scoped>
.wc-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  user-select: none;
}

.wc-wordmark {
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.5px;
  line-height: 1;
}

.wc-wish {
  color: #13A8C4;
}
.wc-wish--dark {
  color: #67CBDD;
}

.wc-craft {
  font-weight: 400;
  color: #1c1917;
  opacity: 0.4;
}
.wc-craft--dark {
  color: #fff;
  opacity: 0.4;
}

.wc-tagline {
  font-size: 9.5px;
  font-weight: 400;
  letter-spacing: 1.8px;
  color: #6b7280;
  opacity: 0.5;
  margin-top: 2px;
}
.wc-tagline--dark {
  color: #fff;
}
</style>
