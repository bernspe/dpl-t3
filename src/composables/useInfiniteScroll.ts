import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { getMonthStart, isoDate, formatMonthLabel } from './useDateHelpers'
import { i18n } from '../i18n'

const CHUNK = 1

export function useInfiniteScroll() {
  const containerRef    = ref<HTMLElement | null>(null)
  const topSentinel     = ref<HTMLElement | null>(null)
  const bottomSentinel  = ref<HTMLElement | null>(null)

  const today = new Date()
  const todayIso = isoDate(today)

  const startOffset = ref(-1)  // 1 month before current
  const endOffset   = ref(1)   // 1 month after current

  const visibleMonths = computed<Date[]>(() => {
    const months: Date[] = []
    for (let i = startOffset.value; i <= endOffset.value; i++) {
      months.push(getMonthStart(today, i))
    }
    return months
  })

  function monthLabel(d: Date, _locale?: string): string {
    return formatMonthLabel(d, _locale ?? i18n.global.locale.value)
  }

  let topObs:    IntersectionObserver | null = null
  let bottomObs: IntersectionObserver | null = null

  function setup(): void {
    topObs?.disconnect()
    bottomObs?.disconnect()

    topObs = new IntersectionObserver(async (entries) => {
      if (!entries[0]?.isIntersecting) return
      const el         = containerRef.value
      const prevHeight = el?.scrollHeight ?? 0
      startOffset.value -= CHUNK
      await nextTick()
      if (el) el.scrollTop += el.scrollHeight - prevHeight
    }, { root: containerRef.value, rootMargin: '400px 0px 0px 0px', threshold: 0 })

    bottomObs = new IntersectionObserver(async (entries) => {
      if (!entries[0]?.isIntersecting) return
      endOffset.value += CHUNK
      await nextTick()
    }, { root: containerRef.value, rootMargin: '0px 0px 400px 0px', threshold: 0 })

    if (topSentinel.value)    topObs.observe(topSentinel.value)
    if (bottomSentinel.value) bottomObs.observe(bottomSentinel.value)
  }

  async function goToToday(): Promise<void> {
    startOffset.value = -1
    endOffset.value   = 1
    await nextTick()
    const todayEl = containerRef.value?.querySelector<HTMLElement>('[data-today="true"]')
    if (todayEl && containerRef.value) {
      containerRef.value.scrollTop = todayEl.offsetTop - 80
    }
  }

  async function scrollToDate(iso: string): Promise<void> {
    const target = new Date(iso + 'T00:00:00')
    const offset = (target.getFullYear() - today.getFullYear()) * 12
                 + (target.getMonth()    - today.getMonth())
    startOffset.value = offset - 1
    endOffset.value   = offset + 1
    await nextTick()
    const container = containerRef.value
    if (!container) return
    // Scroll to the month block, not the individual day cell
    const monthIso = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-01`
    const monthEl  = container.querySelector<HTMLElement>(`[data-month="${monthIso}"]`)
    if (monthEl) {
      container.scrollTop += monthEl.getBoundingClientRect().top
                           - container.getBoundingClientRect().top
                           - 16
    }
  }

  onMounted(() => {
    setup()
  })

  onUnmounted(() => {
    topObs?.disconnect()
    bottomObs?.disconnect()
  })

  return {
    containerRef,
    topSentinel,
    bottomSentinel,
    visibleMonths,
    todayIso,
    monthLabel,
    goToToday,
    scrollToDate,
  }
}
