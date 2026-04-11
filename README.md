# ShiftWisher

Eine Vue 3-Komponente zur Erfassung von Schicht- und Dienstwünschen. Zeigt einen monatsbasierten Kalender mit Infinite-Scroll, in dem Mitarbeiter Verfügbarkeiten und Präferenzen eintragen können.

## Features

- Klick auf einen Tag zyklisch zwischen **Bevorzugt → Nicht verfügbar → Verfügbar** wechseln
- **Drag-Selektion** mehrerer Tage (Maus und Touch) mit Modal zur Bulk-Zuweisung
- **Diensteinschränkung**: Wunsch auf einen spezifischen Dienst eingrenzen (im Modal und im Notiz-Popover)
- **Notizen** pro Tag/Dienst über das ✎-Icon
- **Undo/Redo** (Ctrl+Z / Ctrl+Shift+Z) mit 50-Schritt-Historie
- **Wunschzeitraum** (`wishRequest`) — hervorgehobener Bereich, Kalender scrollt beim Mounten dorthin
- **Punktebewertung** — optionales Scoring relativ zur Stellenkapazität mit konfigurierbaren Regeln
- **Feiertage** optional per Prop einspeisbar, mit eigenem Darstellungsstil
- Wochenenden visuell hervorgehoben
- Vollständig **touch-optimiert** (mobile-first)
- Infinite-Scroll über mehrere Monate

---

## Installation

```bash
npm install @dienzt/shift-wisher
```

`vue` muss als Peer-Dependency bereits im Projekt vorhanden sein:

```bash
npm install vue
```

---

## Verwendung

```vue
<template>
  <ShiftWisher
    title="Dienstwünsche Mai"
    :shifts="shifts"
    :holidays="holidays"
    :wish-request="{ from: '2025-05-01', to: '2025-05-31' }"
    :points-base="100"
    @update:wishes="onWishesChanged"
    @update:score="onScoreChanged"
  />
</template>

<script setup lang="ts">
import { ShiftWisher, getGermanFederalHolidays } from '@dienzt/shift-wisher'
import type { SimpleShift, WishRow, WishScore } from '@dienzt/shift-wisher'

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

function onScoreChanged(score: WishScore | null) {
  console.log(score?.percentage, score?.rating)
}
</script>
```

---

## Props

| Prop | Typ | Default | Beschreibung |
|---|---|---|---|
| `title` | `string` | `'Schichtwünsche'` | Titel in der Toolbar |
| `personId` | `string` | — | Optionale ID der Person (für externe Zuordnung) |
| `shifts` | `SimpleShift[]` | — | Verfügbare Diensttypen für die Diensteinschränkung im Modal/Popover |
| `holidays` | `string[]` | — | ISO-Datumsstrings (`'YYYY-MM-DD'`) der Feiertage |
| `wishRequest` | `WishRequest` | — | Zeitraum zur Wunschabgabe; wird hervorgehoben, Kalender scrollt beim Mounten dorthin |
| `pointsBase` | `number` | — | Stellenkapazität in % (z.B. `100` = Vollzeit). Aktiviert die Punkteanzeige (zusammen mit `wishRequest`) |
| `pointsRules` | `PointsRules` | Standardregeln | Optionale angepasste Punktwerte (siehe Punkte-System) |

---

## Events

| Event | Payload | Beschreibung |
|---|---|---|
| `update:wishes` | `WishRow[]` | Wird bei jeder Änderung emittiert |
| `update:score` | `WishScore \| null` | Wird bei jeder Änderung emittiert; `null` wenn `pointsBase` nicht gesetzt |

---

## Bestehende Wünsche laden

Da `useWishStore` ein Modul-Level-Singleton ist, werden Wünsche direkt über die Store-Funktion geladen — ohne zusätzliches Prop:

```ts
import { useWishStore } from '@dienzt/shift-wisher'
import type { WishRow } from '@dienzt/shift-wisher'

const { loadWishes } = useWishStore()

// Beim Initialisieren (z.B. nach API-Call):
const wishes: WishRow[] = await fetchWishesFromBackend()
loadWishes(wishes)
```

---

## Feiertage

```ts
import { getGermanFederalHolidays, getAustrianHolidays } from '@dienzt/shift-wisher'

// Deutsche Bundesfeiertage + optionale länderspezifische Zusatztage
const holidays = getGermanFederalHolidays(2025, [
  '2025-01-06',  // Heilige Drei Könige (BY, BW, ST)
  '2025-11-01',  // Allerheiligen (BY, BW, NW, RP, SL)
])
```

Beide Funktionen akzeptieren ein optionales zweites Array für länderspezifische Feiertage.

---

## Punkte-System

Wenn `pointsBase` und `wishRequest` gesetzt sind, wird eine Punktebewertung oberhalb des Kalenders angezeigt. Ungünstige Tage (Fr/Sa/So/Feiertag) vergeben mehr Punkte bei Verfügbarkeit.

**Standardpunktwerte:**

| Tag | Bevorzugt | Verfügbar | Nicht verfügbar |
|---|---|---|---|
| Mo–Do | 2 | 1 | 0 |
| Fr/Sa/So/Feiertag | 3 | 2 | 0 |

**Bewertungsschema:**

| Rating | Prozent |
|---|---|
| Sehr gut | ≥ 100 % |
| Gut | ≥ 80 % |
| Ausreichend | ≥ 60 % |
| Unzureichend | < 60 % |

**Eigene Punktregeln:**

```ts
import type { PointsRules } from '@dienzt/shift-wisher'

const rules: PointsRules = {
  regular:     { preferred: 2, available: 1, unavailable: -1 },
  unfavorable: { preferred: 4, available: 3, unavailable: -2 },
}
```

```vue
<ShiftWisher :points-base="80" :points-rules="rules" :wish-request="..." />
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

interface WishRequest {
  from: string        // 'YYYY-MM-DD'
  to:   string        // 'YYYY-MM-DD'
}

interface WishScore {
  earned:     number
  target:     number
  percentage: number
  rating:     'sehr-gut' | 'gut' | 'ausreichend' | 'unzureichend'
  label:      string
}

interface PointsRules {
  regular:     { preferred: number; available: number; unavailable: number }
  unfavorable: { preferred: number; available: number; unavailable: number }
}
```

---

## Entwicklung

```bash
npm run dev               # Vite Dev-Server
npm run test:unit         # Vitest (Watch-Modus)
npm run test:unit -- --run  # Einmaliger Testlauf
npm run type-check        # vue-tsc
npm run build             # App-Build (Type-check + Vite)
npm run build:lib         # Library-Build → dist/
```

`npm publish` führt automatisch Tests und Library-Build aus (`prepublishOnly`).

---

## Projektstruktur

```
src/
├── index.ts             # Öffentlicher Library-Einstiegspunkt
├── components/
│   ├── ShiftWisher.vue      # Haupt-Komponente (Props, Events, Layout)
│   ├── CalendarView.vue     # Monatsraster, Drag-Selektion
│   ├── WishModal.vue        # Modal für Multi-Tag-Selektion inkl. Dienstauswahl
│   ├── NotePopover.vue      # Notiz-/Dienst-Popover für Einzeltag
│   ├── WishScoreDisplay.vue # Punktebalken mit Rating
│   └── ToastNotification.vue
├── composables/
│   ├── useWishStore.ts      # Singleton-Store, Undo/Redo
│   ├── useDragSelect.ts     # Drag-Selektion (Maus + Touch)
│   ├── useInfiniteScroll.ts # Monatsgenerierung per IntersectionObserver
│   ├── useDateHelpers.ts    # Datumsformatierung, Kalenderaufbau
│   ├── useHolidays.ts       # Deutsche/österreichische Feiertage
│   ├── useWishPoints.ts     # Punkte-Berechnung und -Regeln
│   └── useToast.ts
└── types/
    └── wish.types.ts
```
