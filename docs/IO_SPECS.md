# ShiftCraft Wishmaker — IO-Spezifikation

## Kontext & Ziel

Mitarbeiter geben ihre Schichtwünsche über einen Einladungslink ein. Die Wünsche werden per HTTPS direkt als JSON-Datei auf dem Server des Planers gespeichert — kein E-Mail-Versand, kein Zwischensystem. Der Planer kann außerdem Plan-Konfigurationsdaten (Schichttypen, Feiertage) vorab auf den Server pushen, damit WishCraft diese beim Laden des Einladungslinks abruft.

## Architekturübersicht

```
Planer-Tool (ShiftCraft)             Mitarbeiter-Browser (WishCraft)
  │                                        │
  │  1. Generiert Einladungslink           │
  │     (planId, personId, month,          │
  │      accessToken, …)                   │
  │                                        │
  │  2. Beim Kopieren/Teilen:              │
  │     POST /api/save-plan-config.php     │
  │     → plandata/{planId}/{personId}.auth│
  │     → plandata/{planId}/config.json    │
  │                                        │
  │──── Link per E-Mail / Chat ───────────>│
  │                                        │
  │                          3. Öffnet Link│
  │                 GET /api/load-plan-    │
  │                 config.php?planId=…    │
  │                 (Schichttypen,         │
  │                 Feiertage laden)       │
  │                                        │
  │                          4. Füllt      │
  │                             Wünsche aus│
  │                             klickt     │
  │                             "Speichern"│
  │                                        │
  │<──── POST /api/save-wishes.php ────────│
  │      (WishPayload + accessToken)       │
  │                                        │
  │  5. Dateien liegen unter               │
  │     plandata/{planId}/{personId}.auth  │
  │     wishdata/{YYYY-MM}/               │
  │             {planId}/{personId}.json   │
```

---

## Einladungslink (Planer → Mitarbeiter)

Der Einladungslink ist ein normaler HTTPS-Link mit Query-Parametern.  
**Kein URL-Hash**, da die Parameter vom PHP-Backend nicht benötigt werden und im Browser-Verlauf akzeptabel sind.

```
https://wishcraft.renecol.org/wishes?planId=...&personId=...&month=YYYY-MM&token=BASE64URL&name=Vorname&...
```

### Query-Parameter

| Parameter    | Pflicht | Format              | Beschreibung |
|-------------|---------|---------------------|-------------|
| `planId`    | ja      | `isSafeId` (≤ 64 Zeichen, a-z A-Z 0-9 `-_`) | Eindeutige Plan-ID |
| `personId`  | ja      | `isSafeId`          | Eindeutige Mitarbeiter-ID |
| `month`     | ja      | `YYYY-MM`           | Zielmonat für Wünsche |
| `token`     | ja      | Base64url, 32 Byte  | Zugriffstoken (siehe unten) |
| `name`      | nein    | String ≤ 50         | Vorname / Kürzel, nur für Anzeige |
| `deadline`  | nein    | ISO-Datum           | Bis wann Wünsche einzutragen sind |
| `shifts`    | nein    | Base64url-JSON      | Schichttypen als Fallback (wird durch Plan-Config überschrieben) |

> **Hinweis zu IDs**: `planId` und `personId` müssen dem Regex `/^[a-zA-Z0-9_-]{1,64}$/` entsprechen (`isSafeId`). UUID v4 ist ein Sonderfall davon. Kurze IDs wie `p1` oder `anna` sind ebenfalls gültig. Punkte, Schrägstriche und Leerzeichen sind verboten (Path-Traversal-Schutz).

### Schichttypen (shifts-Parameter — Fallback)

Der `shifts`-Parameter enthält eine minimale Schichtlisten-Darstellung als Fallback, falls kein Plan-Config-Upload stattgefunden hat. WishCraft bevorzugt die reicheren Daten aus `load-plan-config.php`.

```typescript
interface SimpleShift {
  id: string      // z.B. "F", "S", "N" oder UUID
  name: string    // z.B. "Früh", "Spät", "Nacht"
  color?: string  // Hex-Farbe für UI, z.B. "#22c55e"
}
```

Kodierung: `Base64url(JSON.stringify(ShiftType[]))` — kein pako, da die Daten klein sind.

---

## Zugriffs-Token

### Konzept

Jeder Einladungslink enthält ein **permanentes, personengebundenes** `token` (32 zufällige Bytes, Base64url-kodiert). Es wird vom Planer-Tool einmalig pro Person generiert und gilt für **alle Monate** dieser Person in diesem Plan.

Das PHP-Backend speichert beim ersten Schreiben den **SHA-256-Hash** des Tokens in einer zentralen Auth-Datei:

```
plandata/{planId}/{personId}.auth   →   { "tokenHash": "sha256hex" }
```

Wunschdaten-Dateien (`wishdata/…`) enthalten **keinen** `tokenHash` mehr. Der Token-Scope ist per-Person+Plan, nicht per Monat — das verhindert Konflikte, wenn ein Mitarbeiter während eines Einladungszeitraums Wünsche für mehrere Monate einträgt.

- Das Token bleibt dauerhaft gültig → Mitarbeiter kann seinen Link bookmarken und zurückkehren
- Das Token wird **niemals im Klartext** serverseitig gespeichert
- Wer den Link kennt, kann schreiben — das ist das bewusst akzeptierte Bedrohungsmodell (analog zu Magic Links)
- Die Auth-Datei liegt in `plandata/`, das per `.htaccess` vor HTTP-Zugriff geschützt ist

### Token generieren (Planer-Tool, clientseitig)

```typescript
// composables/useWishInvite.ts (ShiftCraft)
function generateAccessToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
```

---

## Datenformat

### WishPayload (Mitarbeiter → Server)

```typescript
interface WishPayload {
  v: 2
  type: 'wishes'
  planId: string          // isSafeId
  personId: string        // isSafeId
  month: string           // "YYYY-MM"
  name?: string           // Vorname / Kürzel
  submittedAt: string     // ISO-Timestamp
  wishes: DayWish[]
}

interface DayWish {
  date: string            // ISO: "2026-07-04"
  preference: 'preferred' | 'unavailable' | 'limited'
  shiftTypeId?: string    // Bezug auf bestimmten Schichttyp
  note?: string           // Freitext max. 100 Zeichen
}
```

### Gespeicherte Wunsch-Datei — `wishdata/[YYYY-MM]/[planId]/[personId].json`

Identisch mit `WishPayload`, ergänzt um serverseitige Felder. **Kein `tokenHash`** — dieser liegt ausschließlich in der Auth-Datei.

```json
{
  "v": 2,
  "type": "wishes",
  "planId": "...",
  "personId": "...",
  "month": "2026-07",
  "name": "Maria",
  "submittedAt": "2026-06-15T10:23:00Z",
  "wishes": [...]
}
```

### Auth-Datei — `plandata/[planId]/[personId].auth`

Enthält ausschließlich den Token-Hash. Gilt für alle Monate dieser Person in diesem Plan.

```json
{ "tokenHash": "a3f9..." }
```

### Plan-Konfigurations-Datei — `plandata/[planId]/config.json`

Wird von ShiftCraft gepusht (beim ersten Versenden eines Einladungslinks oder bei Konfigurationsänderung). Enthält reichere Schichttyp-Daten und Feiertage.

```json
{
  "v": 1,
  "planId": "...",
  "updatedAt": "2026-06-01T10:00:00Z",
  "tokenHash": "...",
  "shiftTypes": [
    { "id": "F", "name": "Frühschicht", "code": "F",
      "color": "#fbbf24", "timeStart": "06:00", "timeEnd": "14:00" }
  ],
  "holidays": ["2026-07-01", "2026-12-25"]
}
```

---

## Verzeichnisstruktur

```
plandata/
  .htaccess                        ← Require all denied
  {planId}/
    config.json                    ← Plan-Konfiguration (Schichttypen, Feiertage)
    {personId}.auth                ← Token-Hash (per Person+Plan, monatsübergreifend)

wishdata/
  .htaccess                        ← Require all denied
  {YYYY-MM}/
    {planId}/
      {personId}.json              ← Wunschdaten (kein tokenHash)
```

---

## PHP-Backend

### Endpunkt: `POST /api/save-wishes.php`

Unterstützt zwei Modi: **Single** (Legacy) und **Batch** (empfohlen).

#### Request — Batch-Modus (empfohlen)

```
Content-Type: application/json

{
  "cfToken":  "<Cloudflare Turnstile one-time token>",
  "token":    "<32-Byte Base64url Zugriffstoken>",
  "payloads": [ ...WishPayload[] ]
}
```

Alle Payloads eines Batch **müssen** dieselbe `planId` und `personId` teilen. Der Client gruppiert Wünsche nach Monat. Jeder Monat wird als separate Datei gespeichert:

```
wishdata/2026-05/planId/personId.json
wishdata/2026-06/planId/personId.json
```

#### Request — Single-Modus (Legacy, rückwärtskompatibel)

```
Content-Type: application/json

{
  "cfToken":  "<Cloudflare Turnstile one-time token>",
  "token":    "<32-Byte Base64url Zugriffstoken>",
  "payload":  { ...WishPayload }
}
```

> **Hinweis:** `cfToken` wird vom Cloudflare-Turnstile-Widget im Browser erzeugt und ist einmalig gültig. Das Backend verifiziert es gegen die Cloudflare-API, bevor weitere Validierungsschritte stattfinden. Nach jedem erfolgreichen Save muss das Widget zurückgesetzt werden.

#### Validierungsschritte (in dieser Reihenfolge)

1. `Content-Type` ist `application/json`
2. Body ist gültiges JSON
3. `cfToken` ist vorhanden → Cloudflare Turnstile API verifizieren → bei Fehler: 403 `turnstile_failed`
4. `token` ist vorhanden und nicht leer
5. Erstes Payload: `planId`, `personId` matchen `isSafeId`; `month` matcht `YYYY-MM`
6. Alle Payloads: `planId` und `personId` identisch mit dem ersten Payload → sonst 400 `inconsistent_plan_id` / `inconsistent_person_id`
7. Auth-Check (einmalig für den Batch): `plandata/{planId}/{personId}.auth` existiert → `tokenHash` vergleichen → bei Mismatch: 403 `token_mismatch`
8. Wish-Inhalte validieren: `DayWish.date` im angegebenen Monat, gültige `preference`, `note` ≤ 100 Zeichen
9. Alle Payloads valide → Auth-Datei anlegen (falls neu), dann Wunschdateien schreiben (alle oder keine)

#### Write-Reihenfolge (Konsistenzgarantie)

```
1. plandata/{planId}/{personId}.auth  ← zuerst schreiben
2. wishdata/{YYYY-MM}/{planId}/{personId}.json  ← dann Wunschdateien
```

Schlägt Schritt 1 fehl → kein Wish-File geschrieben, Fehler 500 zurückgegeben.  
Schlägt Schritt 2 fehl → Auth-File existiert, aber Wish-File fehlt. Sicher: nächster Write korrigiert das.

#### Response

```json
// 200 OK — Batch
{ "ok": true, "savedAt": "2026-06-15T10:23:05Z", "savedMonths": ["2026-05", "2026-06"] }

// 200 OK — Single (Legacy)
{ "ok": true, "savedAt": "2026-06-15T10:23:05Z" }

// 400 Bad Request
{ "ok": false, "error": "invalid_payload" }
{ "ok": false, "error": "inconsistent_person_id" }

// 403 Forbidden — Token-Mismatch
{ "ok": false, "error": "token_mismatch" }

// 403 Forbidden — Turnstile-Fehler
{ "ok": false, "error": "turnstile_failed" }

// 500 Internal Server Error
{ "ok": false, "error": "write_failed" }
```

---

### Endpunkt: `GET /api/load-wishes.php`

Ermöglicht dem Mitarbeiter, beim Zurückkehren seine gespeicherten Wünsche zu laden.

#### Request

```
GET /api/load-wishes.php?planId=...&personId=...&token=BASE64URL
```

#### Validierung

1. `isSafeId` für `planId` und `personId`
2. Auth-Check: `plandata/{planId}/{personId}.auth` existiert → `tokenHash` prüfen → bei Mismatch: 403; fehlt: 404
3. Wunschdatei(en) lesen und zurückgeben

#### Response

```json
// 200 OK — ohne `month`-Param: alle Monate
{ "ok": true, "months": [ { "v": 2, "type": "wishes", ... }, ... ] }

// 200 OK — mit `month`-Param: erster gefundener Eintrag
{ "v": 2, "type": "wishes", ... }

// 403 / 404 wie oben
```

---

### Endpunkt: `POST /api/save-plan-config.php`

Wird von ShiftCraft beim Senden eines Einladungslinks aufgerufen (fire-and-forget, kein Turnstile). Schreibt die Plan-Konfiguration für WishCraft.

#### Request

```
Content-Type: application/json

{
  "token": "<Plan-Config-Token (separates Plan-Level-Token, nie im Einladungslink)>",
  "config": {
    "v": 1,
    "planId": "...",
    "shiftTypes": [
      { "id": "F", "name": "Frühschicht", "code": "F",
        "color": "#fbbf24", "timeStart": "06:00", "timeEnd": "14:00" }
    ],
    "holidays": ["2026-07-01"]
  }
}
```

**Kein Turnstile** — Planer-Aktion, Token-Auth ist ausreichend.  
**Token-Scope**: Pro Plan, nicht pro Person. ShiftCraft speichert dieses Token separat in `sc_plan_tokens_v1`.

#### Validierungsschritte

1. `Content-Type` ist `application/json`
2. `token` vorhanden
3. `config.planId` matcht `isSafeId`, `config.v === 1`
4. `config.shiftTypes` ist Array, `config.holidays` ist Array mit ISO-Datum-Strings
5. Erste Write: Token-Hash in `plandata/{planId}/config.json` speichern; Folge-Write: Token-Hash vergleichen → 403 bei Mismatch

#### Response

```json
// 200 OK
{ "ok": true, "savedAt": "2026-06-01T10:00:00Z" }
// 400 / 403 / 500 analog zu save-wishes.php
```

---

### Endpunkt: `GET /api/load-plan-config.php`

Wird von WishCraft beim Öffnen des Einladungslinks aufgerufen. **Kein Auth** — Schichttypen und Feiertage sind keine sensiblen Daten.

#### Request

```
GET /api/load-plan-config.php?planId=...
```

#### Response

```json
// 200 OK — PlanConfig ohne tokenHash
{
  "v": 1,
  "planId": "...",
  "updatedAt": "...",
  "shiftTypes": [...],
  "holidays": ["2026-07-01", "2026-12-25"]
}

// 400 Bad Request (ungültige planId)
{ "ok": false, "error": "invalid_plan_id" }

// 404 Not Found (noch kein Config-Upload)
{ "ok": false, "error": "not_found" }
```

---

### Webserver-Absicherung

Beide Dateiverzeichnisse müssen vor direktem HTTP-Zugriff geschützt werden:

```apache
# wishdata/.htaccess
Require all denied

# plandata/.htaccess
Require all denied
```

Oder die Verzeichnisse außerhalb des Document-Root platzieren.

### Rate-Limiting (empfohlen)

Im PHP-Skript einfaches File-basiertes Rate-Limiting:

```php
// max. 10 Requests pro IP und Stunde
$rateFile = sys_get_temp_dir() . '/sc_rate_' . md5($_SERVER['REMOTE_ADDR']);
```

Alternativ über `.htaccess` / nginx `limit_req`.

---

## Frontend-Integration (WishCraft)

### Query-Params lesen (`utils/urlParams.ts`)

```typescript
interface ContextParams {
  planId:   string
  personId: string
  month:    string    // YYYY-MM
  token:    string
  name?:    string
  deadline?: string
  shifts?:  SimpleShift[]   // Fallback; wird durch Plan-Config überschrieben
}

export function parseContextParams(): ContextParams | null {
  const p = new URLSearchParams(window.location.search)
  const planId   = p.get('planId')   ?? ''
  const personId = p.get('personId') ?? ''
  const month    = p.get('month')    ?? ''
  const token    = p.get('token')    ?? ''

  // isSafeId statt isUUID — akzeptiert auch Kurz-IDs wie "p1" oder "anna"
  if (!isSafeId(planId) || !isSafeId(personId) || !isYearMonth(month) || !token) return null

  const shiftsRaw = p.get('shifts')
  let shifts: SimpleShift[] | undefined
  try {
    if (shiftsRaw) {
      const bytes = Uint8Array.from(atob(shiftsRaw.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0))
      shifts = JSON.parse(new TextDecoder().decode(bytes))
    }
  } catch { /* shifts bleibt undefined */ }

  return { planId, personId, month, token, name: p.get('name') ?? undefined,
           deadline: p.get('deadline') ?? undefined, shifts }
}

export function isSafeId(s: string): boolean {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(s)
}

export function isYearMonth(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s)
}
```

### Plan-Config laden (`composables/useWishConfig.ts`)

Nach `applyContext()` wird die Plan-Config fire-and-forget geladen und überschreibt bei Erfolg die `shifts`-URL-Parameter:

```typescript
export async function fetchPlanConfig(planId: string, apiBase?: string): Promise<PlanConfig | null>
// GET {apiBase}/api/load-plan-config.php?planId=...
// Gibt PlanConfig oder null zurück (404/Fehler → Fallback auf URL-shifts)
```

`App.vue` verwendet dann:
- `serverConfig.shiftTypes` statt URL-`shifts` (wenn vorhanden)
- `serverConfig.holidays` statt berechneter Bundesfeiertage (wenn vorhanden)

### Token im localStorage cachen

Nach dem ersten Laden wird das Token in `localStorage` gespeichert, damit es bei einem erneuten Besuch ohne vollständigen Link verfügbar bleibt:

```typescript
const STORAGE_KEY = (personId: string) => `sc_token_${personId}`

export function cacheToken(personId: string, token: string): void {
  localStorage.setItem(STORAGE_KEY(personId), token)
}

export function getCachedToken(personId: string): string | null {
  return localStorage.getItem(STORAGE_KEY(personId))
}
```

### Wünsche speichern (Batch)

```typescript
// Wünsche nach Monat gruppieren
const byMonth = new Map<string, DayWish[]>()
for (const w of wishes) {
  const month = w.date.slice(0, 7)
  if (!byMonth.has(month)) byMonth.set(month, [])
  byMonth.get(month)!.push(w)
}

// Mindestens den Einladungsmonat senden, auch wenn leer
if (!byMonth.has(inviteMonth)) byMonth.set(inviteMonth, [])

const payloads = [...byMonth.entries()].map(([month, wishes]) => ({
  v: 2, type: 'wishes', planId, personId, month, name, submittedAt: new Date().toISOString(), wishes,
}))
// Alle payloads haben dieselbe planId + personId

const res = await fetch('/api/save-wishes.php', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ cfToken, token, payloads }),
})
const data = await res.json()
if (!data.ok) throw new Error(data.error)
// data.savedMonths enthält die gespeicherten Monate: ["2026-05", "2026-06"]
// cfToken ist einmalig — Widget nach erfolgreichem Save zurücksetzen!
```

---

## Fallback-Modus (kein vollständiger Link)

Fehlen `planId`, `personId` oder `token` im Querystring, zeigt die App ein Eingabeformular:

| Feld | Eingabetyp | Validierung |
|------|-----------|-------------|
| Plan-ID | Text (Paste) | `isSafeId` (Buchstaben, Ziffern, `-_`, max. 64 Zeichen) |
| Personen-ID | Text (Paste) | `isSafeId` |
| Zugangscode | Text (Paste) | nicht leer |
| Monat | `<input type="month">` | Pflicht, default: aktueller Monat |

Im Fallback-Modus kann kein neues Token generiert werden — der Mitarbeiter muss den originalen Einladungslink verwenden oder den Zugangscode aus dem Link kopieren.
