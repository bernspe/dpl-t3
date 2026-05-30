import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '../App.vue'

// ── Mock vue-turnstile ────────────────────────────────────────────────────────
// The real widget loads Cloudflare's external script; stub it for unit tests.
vi.mock('vue-turnstile', () => ({
  default: {
    name: 'VueTurnstile',
    props: ['siteKey', 'size', 'modelValue', 'appearance'],
    emits: ['update:modelValue', 'expired', 'error'],
    template: '<div class="turnstile-stub" />',
    expose: ['reset'],
    setup() {
      return { reset: vi.fn() }
    },
  },
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

const PLAN_ID   = '12345678-1234-4234-a234-123456789abc'
const PERSON_ID = 'abcdef12-abcd-4bcd-abcd-abcdef123456'

function setSearch(params: Record<string, string>): void {
  const sp = new URLSearchParams(params)
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search: '?' + sp.toString() },
    writable: true,
  })
}

function clearSearch(): void {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search: '' },
    writable: true,
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

// Stub fetch so loadWishes() resolves immediately with 404 (no saved data)
const fetchMock = vi.fn(() =>
  Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response)
)

describe('App', () => {
  beforeEach(() => {
    clearSearch()
    localStorage.clear()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('shows the fallback form when no context params are present', () => {
    const wrapper = mount(App)
    expect(wrapper.find('.sc-setup').exists()).toBe(true)
    expect(wrapper.find('.shift-wisher').exists()).toBe(false)
  })

  it('renders ShiftWisher when valid query params are present', async () => {
    setSearch({ planId: PLAN_ID, personId: PERSON_ID, month: '2026-07', token: 'any-token' })
    const wrapper = mount(App)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.shift-wisher').exists()).toBe(true)
    expect(wrapper.find('.sc-setup').exists()).toBe(false)
  })

  it('shows Turnstile widget and save button in the toolbar when context is ready', async () => {
    setSearch({ planId: PLAN_ID, personId: PERSON_ID, month: '2026-07', token: 'any-token' })
    const wrapper = mount(App)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.sc-toolbar-end').exists()).toBe(true)
    expect(wrapper.find('.turnstile-stub').exists()).toBe(true)
    expect(wrapper.find('.sc-save-btn').exists()).toBe(true)
  })

  it('save button is disabled before Turnstile is verified', async () => {
    setSearch({ planId: PLAN_ID, personId: PERSON_ID, month: '2026-07', token: 'any-token' })
    const wrapper = mount(App)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.sc-save-btn').element.hasAttribute('disabled')).toBe(true)
  })

  it('save button becomes enabled after Turnstile emits update:modelValue', async () => {
    setSearch({ planId: PLAN_ID, personId: PERSON_ID, month: '2026-07', token: 'any-token' })
    const wrapper = mount(App)
    await wrapper.vm.$nextTick()

    // Simulate v-model update from Turnstile widget
    await wrapper.findComponent({ name: 'VueTurnstile' }).vm.$emit('update:modelValue', 'cf-test-token')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.sc-save-btn').element.hasAttribute('disabled')).toBe(false)
  })

  it('save button becomes disabled again after Turnstile expires', async () => {
    setSearch({ planId: PLAN_ID, personId: PERSON_ID, month: '2026-07', token: 'any-token' })
    const wrapper = mount(App)
    await wrapper.vm.$nextTick()

    await wrapper.findComponent({ name: 'VueTurnstile' }).vm.$emit('update:modelValue', 'cf-test-token')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.sc-save-btn').element.hasAttribute('disabled')).toBe(false)

    ;(wrapper.vm as any).onTurnstileExpired()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.sc-save-btn').element.hasAttribute('disabled')).toBe(true)
  })

  it('shows validation errors in the fallback form on bad input', async () => {
    const wrapper = mount(App)
    await wrapper.find('.sc-setup__btn').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.sc-field__error').length).toBeGreaterThan(0)
  })
})
