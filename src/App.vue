<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { setLocale, i18n } from './i18n'
import VueTurnstile from 'vue-turnstile'
import ShiftWisher from './components/ShiftWisher.vue'
import WishCraftLogo from './components/WishCraftLogo.vue'
import type { SimpleShift, WishRow, WishRequest, WishType } from './types/wish.types'
import { useWishStore } from './composables/useWishStore'
import { getGermanFederalHolidays } from './composables/useHolidays'
import { useToast } from './composables/useToast'
import { parseContextParams, isUUID, isYearMonth, lastDayOfMonth } from './utils/urlParams'
import { cacheToken, getCachedToken } from './utils/token'
import type { ContextParams } from './utils/urlParams'

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string

const { t } = useI18n()
const locale = i18n.global.locale
const toast = useToast()
const { loadWishes: loadWishesIntoStore } = useWishStore()

const holidays = [
  ...getGermanFederalHolidays(2027),
  ...getGermanFederalHolidays(2026),
]

// ── Context state ─────────────────────────────────────────────────────────────

const ctx = ref<ContextParams | null>(null)
const contextReady = computed(() => ctx.value !== null)

// ── Fallback form ─────────────────────────────────────────────────────────────

const formPlanId   = ref('')
const formPersonId = ref('')
const formToken    = ref('')
const formMonth    = ref(new Date().toISOString().slice(0, 7))

const formErrors = ref<{ planId?: string; personId?: string; token?: string; month?: string }>({})

function validateForm(): boolean {
  const errors: typeof formErrors.value = {}
  if (!isUUID(formPlanId.value))     errors.planId   = t('setup.errUuid')
  if (!isUUID(formPersonId.value))   errors.personId = t('setup.errUuidShort')
  if (formToken.value.trim() === '') errors.token    = t('setup.errToken')
  if (!isYearMonth(formMonth.value)) errors.month    = t('setup.errMonth')
  formErrors.value = errors
  return Object.keys(errors).length === 0
}

function confirmForm(): void {
  if (!validateForm()) return
  applyContext({
    planId:   formPlanId.value.trim(),
    personId: formPersonId.value.trim(),
    month:    formMonth.value,
    token:    formToken.value.trim(),
  })
}

// ── Context application ───────────────────────────────────────────────────────

function applyContext(params: ContextParams): void {
  cacheToken(params.personId, params.token)
  ctx.value = params
  toast.show(t('toast.loading'), 'info')
  loadWishes(params)
}

// ── wishRequest computed from month ───────────────────────────────────────────

const wishRequest = computed<WishRequest | undefined>(() => {
  if (!ctx.value) return undefined
  return {
    from: `${ctx.value.month}-01`,
    to:   lastDayOfMonth(ctx.value.month),
  }
})

const shifts = computed<SimpleShift[]>(() => ctx.value?.shifts ?? [])

// ── Wishes state ──────────────────────────────────────────────────────────────

const currentWishes = ref<WishRow[]>([])
const isSaving  = ref(false)
const isLoading = ref(false)

function onWishesUpdate(wishes: WishRow[]): void {
  currentWishes.value = wishes
}

// ── Turnstile state ───────────────────────────────────────────────────────────

/**
 * vue-turnstile uses v-model (update:modelValue) to expose the token.
 * cfToken is '' until Cloudflare verifies the user, then set to the one-time token.
 * After each successful save it is reset so the next submit needs a fresh challenge.
 */
const cfToken     = ref('')
const turnstileRef = ref<InstanceType<typeof VueTurnstile> | null>(null)

function onTurnstileExpired(): void {
  cfToken.value = ''
  toast.show(t('toast.turnstileExpired'), 'warning')
}

function resetTurnstile(): void {
  cfToken.value = ''
  turnstileRef.value?.reset()
}

// ── API calls ─────────────────────────────────────────────────────────────────

async function loadWishes(params: ContextParams): Promise<void> {
  isLoading.value = true
  try {
    const url = new URL('/api/load-wishes.php', window.location.origin)
    url.searchParams.set('planId',   params.planId)
    url.searchParams.set('personId', params.personId)
    url.searchParams.set('token',    params.token)

    const res = await fetch(url.toString())
    if (res.status === 404) return // Noch keine Wünsche gespeichert — OK
    if (res.status === 403) {
      toast.show(t('toast.tokenInvalid'), 'warning')
      return
    }
    if (!res.ok) return

    const data = await res.json()
    const rawWishes: Array<{ date: string; preference: string; shiftTypeId?: string; note?: string }> =
      data.wishes ?? []

    let id = 0
    const rows: WishRow[] = rawWishes
      .filter(w => w.preference === 'preferred' || w.preference === 'unavailable')
      .map(w => ({
        id:      String(++id),
        dayIso:  w.date,
        shiftId: w.shiftTypeId,
        type:    w.preference as WishType,
        note:    w.note,
      }))

    loadWishesIntoStore(rows)
    toast.show(t('toast.loaded', rows.length), 'success')
  } catch {
    // Netzwerkfehler — stillschweigend ignorieren (offline-Modus möglich)
  } finally {
    isLoading.value = false
  }
}

async function saveWishes(): Promise<void> {
  if (!ctx.value) return

  if (!cfToken.value) {
    toast.show(t('toast.turnstileNeeded'), 'warning')
    return
  }

  isSaving.value = true
  try {
    const payload = {
      v:           2,
      type:        'wishes',
      planId:      ctx.value.planId,
      personId:    ctx.value.personId,
      month:       ctx.value.month,
      name:        ctx.value.name,
      submittedAt: new Date().toISOString(),
      wishes:      currentWishes.value.map(w => ({
        date:        w.dayIso,
        preference:  w.type === 'preferred' ? 'preferred' : 'unavailable',
        shiftTypeId: w.shiftId,
        note:        w.note,
      })),
    }

    const res = await fetch('/api/save-wishes.php', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ cfToken: cfToken.value, token: ctx.value.token, payload }),
    })

    const data = await res.json()
    if (data.ok) {
      toast.show(t('toast.saved'), 'success')
      resetTurnstile()
    } else if (data.error === 'turnstile_failed') {
      toast.show(t('toast.turnstileFailed'), 'warning')
      resetTurnstile()
    } else {
      toast.show(t('toast.saveError', { error: data.error }), 'warning')
    }
  } catch {
    toast.show(t('toast.networkError'), 'warning')
  } finally {
    isSaving.value = false
  }
}

// ── Dev mock ─────────────────────────────────────────────────────────────────

const DEV_MODE = import.meta.env.DEV

function fillMockData(): void {
  formPlanId.value   = '12345678-1234-4234-a234-123456789abc'
  formPersonId.value = 'abcdef12-abcd-4bcd-abcd-abcdef123456'
  formToken.value    = 'dev-mock-token'
  formMonth.value    = new Date().toISOString().slice(0, 7)
}

// ── Exposed for testing ───────────────────────────────────────────────────────
defineExpose({ onTurnstileExpired, cfToken })

// ── Init ──────────────────────────────────────────────────────────────────────

onMounted(() => {
  const params = parseContextParams()
  if (params) {
    const token = params.token || getCachedToken(params.personId) || ''
    applyContext({ ...params, token })
  }
})
</script>

<template>
  <div style="height: 100dvh; display: flex; flex-direction: column;">

    <!-- Fallback-Formular -->
    <div v-if="!contextReady" class="sc-setup">
      <div class="sc-setup__card">
        <div class="sc-setup__header">
          <WishCraftLogo :icon-size="48" class="sc-setup__logo" />
          <div class="sc-lang-toggle">
            <button :class="['sc-lang-btn', { active: locale === 'de' }]" @click="setLocale('de')">DE</button>
            <button :class="['sc-lang-btn', { active: locale === 'en' }]" @click="setLocale('en')">EN</button>
          </div>
        </div>
        <p class="sc-setup__hint">{{ $t('setup.hint') }}</p>

        <div class="sc-field">
          <label for="field-plan-id">{{ $t('setup.planId') }}</label>
          <input
            id="field-plan-id"
            v-model="formPlanId"
            type="text"
            placeholder="xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx"
            autocomplete="off"
            spellcheck="false"
          />
          <span v-if="formErrors.planId" class="sc-field__error">{{ formErrors.planId }}</span>
        </div>

        <div class="sc-field">
          <label for="field-person-id">{{ $t('setup.personId') }}</label>
          <input
            id="field-person-id"
            v-model="formPersonId"
            type="text"
            placeholder="xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx"
            autocomplete="off"
            spellcheck="false"
          />
          <span v-if="formErrors.personId" class="sc-field__error">{{ formErrors.personId }}</span>
        </div>

        <div class="sc-field">
          <label for="field-token">{{ $t('setup.token') }}</label>
          <input
            id="field-token"
            v-model="formToken"
            type="text"
            :placeholder="$t('setup.tokenPlaceholder')"
            autocomplete="off"
            spellcheck="false"
          />
          <span v-if="formErrors.token" class="sc-field__error">{{ formErrors.token }}</span>
        </div>

        <div class="sc-field">
          <label for="field-month">{{ $t('setup.month') }}</label>
          <input
            id="field-month"
            v-model="formMonth"
            type="month"
          />
          <span v-if="formErrors.month" class="sc-field__error">{{ formErrors.month }}</span>
        </div>

        <button class="sc-setup__btn" @click="confirmForm">{{ $t('setup.confirm') }}</button>

        <!-- DEV ONLY: verschwindet automatisch im Production-Build -->
        <button v-if="DEV_MODE" class="sc-setup__btn sc-setup__btn--mock" @click="fillMockData">
          {{ $t('setup.mockData') }}
        </button>
      </div>
    </div>

    <!-- Kalender -->
    <template v-else>
      <ShiftWisher
        :plan-id="ctx!.planId"
        :person-id="ctx!.personId"
        :name="ctx!.name"
        :deadline="ctx!.deadline"
        :shifts="shifts"
        :holidays="holidays"
        :wish-request="wishRequest"
        @update:wishes="onWishesUpdate"
        @update:score="() => {}"
      >
        <template #toolbar-end>
          <button
            class="sc-save-btn"
            :disabled="isSaving || isLoading || !cfToken"
            :title="!cfToken ? $t('toolbar.savePending') : $t('toolbar.saveTip')"
            @click="saveWishes"
          >
            <svg v-if="isSaving" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation:spin .8s linear infinite"><circle cx="12" cy="12" r="9" stroke-opacity=".3"/><path d="M12 3a9 9 0 0 1 9 9"/></svg>
            <svg v-else-if="!cfToken" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </template>
      </ShiftWisher>

      <!-- Turnstile widget: fixed unten-rechts, beeinflusst kein Layout -->
      <div class="sc-turnstile-anchor">
        <VueTurnstile
          ref="turnstileRef"
          v-model="cfToken"
          :site-key="TURNSTILE_SITE_KEY"
          size="compact"
          appearance="interaction-only"
          @expired="onTurnstileExpired"
          @error="resetTurnstile"
        />
      </div>
    </template>

  </div>
</template>

<style>
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; background: #f9fafb; font-family: system-ui, sans-serif; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>

<style scoped>
.sc-setup {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  padding: 24px;
}

.sc-setup__card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 32px;
  width: 100%;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: 0 4px 16px rgba(0,0,0,.06);
}

.sc-setup__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.sc-setup__logo {
  margin-bottom: 4px;
}

.sc-lang-toggle {
  display: flex;
  gap: 4px;
}

.sc-lang-btn {
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #f9fafb;
  color: #6b7280;
  cursor: pointer;
  transition: all .1s;
}
.sc-lang-btn.active {
  background: #13A8C4;
  border-color: #13A8C4;
  color: #fff;
}
.sc-lang-btn:hover:not(.active) { background: #E4F6FA; border-color: #13A8C4; color: #13A8C4; }

.sc-setup__hint {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
}

.sc-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sc-field label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.sc-field input {
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  font-family: monospace;
  outline: none;
  transition: border-color .15s;
}

.sc-field input:focus { border-color: #3b82f6; }

.sc-field__error {
  font-size: 12px;
  color: #dc2626;
}

.sc-setup__btn {
  padding: 10px 0;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 4px;
  transition: background .15s;
}

.sc-setup__btn:hover { background: #1d4ed8; }

.sc-setup__btn--mock {
  background: #6b7280;
  font-size: 12px;
  margin-top: -8px;
}
.sc-setup__btn--mock:hover { background: #4b5563; }

/* Turnstile widget schwebt unten-rechts, außerhalb des normalen Layouts */
.sc-turnstile-anchor {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 50;
}

.sc-save-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  background: #13A8C4;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
  transition: background .15s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sc-save-btn:hover:not(:disabled) { background: #0B8AA3; }
.sc-save-btn:disabled { opacity: .45; cursor: default; }
</style>
