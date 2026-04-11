// Main component
export { default as ShiftWisher } from './components/ShiftWisher.vue'

// Supporting composables for host apps
export { useWishStore }                           from './composables/useWishStore'
export { calcWishScore, DEFAULT_POINTS_RULES }    from './composables/useWishPoints'
export { getGermanFederalHolidays, getAustrianHolidays } from './composables/useHolidays'

// Types
export type { WishRow, WishType, SimpleShift, WishRequest } from './types/wish.types'
export type { WishScore, PointsRules, PointsEntry, ScoreRating } from './composables/useWishPoints'
