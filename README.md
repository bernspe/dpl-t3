# ShiftWisher

Eine Vue 3-Komponente zur Erfassung von Schicht- und Dienstwünschen. Zeigt einen monatsbasierten Kalender mit Infinite-Scroll, in dem Mitarbeiter Verfügbarkeiten und Präferenzen eintragen können.

## Features

- Klick auf einen Tag zyklisch zwischen **Bevorzugt → Nicht verfügbar → Verfügbar** wechseln
- **Drag-Selektion** mehrerer Tage (Maus und Touch) mit Modal zur Bulk-Zuweisung
- **Diensteinschränkung**: Wunsch auf einen spezifischen Dienst eingrenzen (im Modal und im Notiz-Popover)
- **Notizen** pro Tag/Dienst über das ✎-Icon
- **Undo/Redo** (Ctrl+Z / Ctrl+Shift+Z) mit 50-Schritt-Historie
- **Feiertage** optional per Prop einspeisbar, mit eigenem Darstellungsstil
- Wochenenden visuell hervorgehoben
- Vollständig **touch-optimiert** (mobile-first)
- Infinite-Scroll über mehrere Monate

---

## Installation

```bash
npm install
npm run dev
```

---

## Verwendung

```vue
<template>
  <ShiftWisher
    title="Dienstwünsche Mai"
    :shifts="shifts"
    :holidays="holidays"
    @update:wishes="onWishesChanged"
  />
</template>

<script setup lang="ts">
import ShiftWisher from './components/ShiftWisher.vue'
import { getGermanFederalHolidays } from './composables/useHolidays'
import type { SimpleShift, WishRow } from './types/wish.types'

const shifts: SimpleShift[] = [
  { id: 'f', name: 'Frühschicht',  color: '#f59e0b' },
  { id: 's', name: 'Spätschicht',  color: '#6366f1' },
  { id: 'n', name: 'Nachtschicht', color: '#1d4ed8' },
]

const holidays = [
  ...getGermanFederalHolidays(2025),
  ...getGermanFederalHolidays(2026),
]

function onWishesChanged(wishes: WishRow[]) {
  // z.B. in Backend persistieren
}
</script>
```

---

## Props

| Prop | Typ | Default | Beschreibung |
|---|---|---|---|
| `title` | `string` | `'Schichtwünsche'` | Titel in der Toolbar |
| `personId` | `string` | — | Optionale ID der Person (für externe Zuordnung) |
| `shifts` | `SimpleShift[]` | — | Verfügbare Diensttypen für die Diensteinschränkung im Modal |
| `holidays` | `string[]` | — | ISO-Datumsstrings (`'YYYY-MM-DD'`) der Feiertage |

---

## Events

| Event | Payload | Beschreibung |
|---|---|---|
| `update:wishes` | `WishRow[]` | Wird bei jeder Änderung emittiert |

---

## Bestehende Wünsche laden

Da `useWishStore` ein Modul-Level-Singleton ist, werden Wünsche direkt über die Store-Funktion geladen — ohne zusätzliches Prop:

```ts
import { useWishStore } from './composables/useWishStore'
import type { WishRow } from './types/wish.types'

const { loadWishes } = useWishStore()

// Beim Initialisieren (z.B. nach API-Call):
const wishes: WishRow[] = await fetchWishesFromBackend()
loadWishes(wishes)
```

---

## Typen

```ts
type WishType = 'preferred' | 'unavailable'

interface WishRow {
  id:       string
  dayIso:   string    // 'YYYY-MM-DD'
  shiftId?: string    // undefined = Ganztageswunsch
  type:     WishType
  note?:    string
}

interface SimpleShift {
  id:    string
  name:  string
  color: string       // CSS-Farbwert
}
```

---

## Feiertage

```ts
import { getGermanFederalHolidays, getAustrianHolidays } from './composables/useHolidays'

// Deutsche Bundesfeiertage + Bayern-spezifische Zusatztage
const holidays = getGermanFederalHolidays(2025, [
  '2025-01-06',  // Heilige Drei Könige (BY, BW, ST)
  '2025-11-01',  // Allerheiligen (BY, BW, NW, RP, SL)
])
```

Beide Funktionen akzeptieren ein optionales zweites Array für länderspezifische Feiertage.

---

## Entwicklung

```bash
npm run dev          # Vite Dev-Server
npm run test:unit    # Vitest (Watch-Modus)
npm run test:unit -- --run   # Einmaliger Testlauf
npm run type-check   # vue-tsc
npm run build        # Type-check + Build
```

---

## Projektstruktur

```
src/
├── components/
│   ├── ShiftWisher.vue      # Haupt-Komponente (Props, Events, Layout)
│   ├── CalendarView.vue     # Monatsraster, Drag-Selektion
│   ├── WishModal.vue        # Modal für Multi-Tag-Selektion inkl. Dienstauswahl
│   ├── NotePopover.vue      # Notiz-/Dienst-Popover für Einzeltag
│   └── ToastNotification.vue
├── composables/
│   ├── useWishStore.ts      # Singleton-Store, Undo/Redo
│   ├── useDragSelect.ts     # Drag-Selektion (Maus + Touch)
│   ├── useInfiniteScroll.ts # Monatsgenerierung per IntersectionObserver
│   ├── useDateHelpers.ts    # Datumsformatierung, Kalenderaufbau
│   ├── useHolidays.ts       # Deutsche/österreichische Feiertage
│   └── useToast.ts
└── types/
    └── wish.types.ts
```
