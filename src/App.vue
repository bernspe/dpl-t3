<script setup lang="ts">
import ShiftWisher from './components/ShiftWisher.vue'
import type {SimpleShift, WishRow} from './types/wish.types'
import {ref} from "vue";

function onWishesUpdate(wishes: WishRow[]): void {
  console.log('Wishes updated:', wishes)
}
import { getGermanFederalHolidays } from './composables/useHolidays'

  const holidays = [
    ...getGermanFederalHolidays(2025),
    ...getGermanFederalHolidays(2026),
  ]

const exampleShifts = ref<SimpleShift[]>([
  {id: 'FS', color:'green',name:'Frühschicht'},
  {id:'SP', color: 'orange',name:'Spätschicht'},
  {id:'NS', color:'red',name:'Nachtschicht'}
])


</script>

<template>
  <div style="height: 100dvh; display: flex; flex-direction: column;">
    <ShiftWisher
        @update:wishes="onWishesUpdate"
        @update:score="console.log"
        :shifts="exampleShifts"
        :holidays="holidays"
        :points-base="25"
    :wish-request="{ from: '2025-05-01', to: '2025-06-30' }"
    />
  </div>
</template>

<style>
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; background: #f9fafb; }
</style>
