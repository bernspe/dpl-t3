# ShiftCraft Wishmaker — IO-Spezifikation

## Kontext & Ziel

Mitarbeiter geben ihre Schichtwünsche über einen Einladungslink ein. Die Wünsche werden per HTTPS direkt als JSON-Datei auf dem Server des Planers gespeichert — kein E-Mail-Versand, kein Zwischensystem.

## Architekturübersicht

```
Planer-Tool                        Mitarbeiter-Browser
  │                                        │
  │  1. Generiert Einladungslink           │
  │     (planId, personId, month,          │
  │      accessToken, shiftTypes, …)       │
  │                                        │
  │──── Link per E-Mail / Chat ───────────>│
  │                                        │
  │                          2. Öffnet Link│
  │                             App liest  │
  │                             Query-Params│
  │                             scrollt zu │
  │                             Zielmonat  │
  │                                        │
  │                          3. Füllt      │
  │                             Wünsche aus│
  │                             klickt     │
  │                             "Speichern"│
  │                                        │
  │<──── POST /api/save-wishes.php ────────│
  │      (WishPayload + accessToken)       │
  │                                        │
  │  4. Datei liegt unter                  │
  │     wishdata/[YYYY-MM]/                │
  │             [planId]/[personId].json   │
```

---

## Einladungslink (Planer → Mitarbeiter)

Der Einladungslink ist ein normaler HTTPS-Link mit Query-Parametern.  
**Kein URL-Hash**, da die Parameter vom PHP-Backend nicht benötigt werden und im Browser-Verlauf akzeptabel sind.

```
https://wishcraft.renecol.org/wishes?planId=UUID&personId=UUID&month=YYYY-MM&token=BASE64URL&name=Vorname&...
```

### Query-Parameter

| Parameter    | Pflicht | Format         | Beschreibung |
|-------------|---------|---------------|-------------|
| `planId`    | ja      | UUID v4        | Eindeutige Plan-ID |
| `personId`  | ja      | UUID v4        | Eindeutige Mitarbeiter-ID |
| `month`     | ja      | `YYYY-MM`      | Zielmonat für Wünsche |
| `token`     | ja      | Base64url, 32 Byte | Zugriffstoken (siehe unten) |
| `name`      | nein    | String ≤ 50    | Vorname / Kürzel, nur für Anzeige |
| `deadline`  | nein    | ISO-Datum      | Bis wann Wünsche einzutragen sind |
| `shifts`    | nein    | Base64url-JSON | Schichttypen (siehe ShiftType[]) |

### Schichttypen (shifts-Parameter)

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

Jeder Einladungslink enthält ein **permanentes, personengebundenes** `token` (32 zufällige Bytes, Base64url-kodiert). Es wird vom Planer-Tool einmalig generiert und dient als einziger Authentifizierungsnachweis beim Schreiben.

Das PHP-Backend speichert beim ersten Schreiben den **SHA-256-Hash** des Tokens in der JSON-Datei. Bei jedem Folge-Request wird der Hash verglichen.

- Das Token bleibt dauerhaft gültig → Mitarbeiter kann seinen Link bookmarken und zurückkehren
- Das Token wird **niemals im Klartext** serverseitig gespeichert
- Wer den Link kennt, kann schreiben — das ist das bewusst akzeptierte Bedrohungsmodell (analog zu Magic Links)

### Token generieren (Planer-Tool, clientseitig)

```typescript
// utils/token.ts
export function generateAccessToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
```

---

## Datenformat

### WishPayload (Mitarbeiter → Server)

```typescript
interface WishPayload {
  v: 2
  type: 'wishes'
  planId: string          // UUID v4
  personId: string        // UUID v4
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

### Gespeicherte Datei — `wishdata/[YYYY-MM]/[planId]/[personId].json`

Identisch mit `WishPayload`, ergänzt um serverseitige Felder:

```json
{
  "v": 2,
  "type": "wishes",
  "planId": "...",
  "personId": "...",
  "month": "2026-07",
  "name": "Maria",
  "submittedAt": "2026-06-15T10:23:00Z",
  "tokenHash": "a3f9...",
  "wishes": [...]
}
```

---

## PHP-Backend

### Endpunkt: `POST /api/save-wishes.php`

#### Request

```
Content-Type: application/json

{
  "cfToken": "<Cloudflare Turnstile one-time token>",
  "token":   "<32-Byte Base64url Zugriffstoken>",
  "payload": { ...WishPayload }
}
```

> **Hinweis:** `cfToken` wird vom Cloudflare-Turnstile-Widget im Browser erzeugt und ist einmalig gültig. Das Backend verifiziert es gegen die Cloudflare-API, bevor weitere Validierungsschritte stattfinden. Nach jedem erfolgreichen Save muss das Widget zurückgesetzt werden.

#### Validierungsschritte (in dieser Reihenfolge)

1. `Content-Type` ist `application/json`
2. Body ist gültiges JSON
3. `cfToken` ist vorhanden → Cloudflare Turnstile API verifizieren → bei Fehler: 403 `turnstile_failed`
4. `payload.planId` und `payload.personId` matchen UUID-v4-Format
5. `payload.month` matcht `YYYY-MM`
6. `token` ist vorhanden und nicht leer
7. Datei existiert bereits → `tokenHash` aus Datei mit `hash('sha256', $token)` vergleichen → bei Mismatch: 403
8. Datei existiert noch nicht → erste Speicherung, `tokenHash` wird aus `$token` berechnet und gesetzt
9. `payload.wishes` ist ein Array (darf leer sein)
10. Jedes `DayWish.date` matcht `YYYY-MM-DD` und liegt im angegebenen Monat

#### Verzeichnisstruktur aufbauen

```php
$month   = $payload['month'];                          // "2026-07"
$planId  = $payload['planId'];                         // UUID v4
$personId = $payload['personId'];                      // UUID v4

$dir  = __DIR__ . "/../wishdata/{$month}/{$planId}";
$file = "{$dir}/{$personId}.json";
```

Pfade werden **ausschließlich** aus validierten UUID/YYYY-MM Strings gebaut — keine Nutzereingabe landet ungefiltert im Pfad.

#### Response

```json
// 200 OK
{ "ok": true, "savedAt": "2026-06-15T10:23:05Z" }

// 400 Bad Request
{ "ok": false, "error": "invalid_payload" }

// 403 Forbidden — Token-Mismatch
{ "ok": false, "error": "token_mismatch" }

// 403 Forbidden — Turnstile-Fehler
{ "ok": false, "error": "turnstile_failed" }

// 500 Internal Server Error
{ "ok": false, "error": "write_failed" }
```

### Endpunkt: `GET /api/load-wishes.php`

Ermöglicht dem Mitarbeiter, beim Zurückkehren seine gespeicherten Wünsche zu laden.

#### Request

```
GET /api/load-wishes.php?planId=UUID&personId=UUID&token=BASE64URL
```

#### Validierung

1. UUID-Format für `planId` und `personId`
2. Datei existiert → `tokenHash` prüfen → bei Mismatch: 403
3. Datei existiert nicht → 404

#### Response

```json
// 200 OK — WishPayload ohne tokenHash
{ "v": 2, "type": "wishes", ... }

// 403 / 404 wie oben
```

### Webserver-Absicherung

`wishdata/` muss vor direktem HTTP-Zugriff geschützt werden:

```apache
# wishdata/.htaccess
Require all denied
```

Oder `wishdata/` außerhalb des Document-Root platzieren.

### Rate-Limiting (empfohlen)

Im PHP-Skript einfaches File-basiertes Rate-Limiting:

```php
// max. 10 Requests pro IP und Stunde
$rateFile = sys_get_temp_dir() . '/sc_rate_' . md5($_SERVER['REMOTE_ADDR']);
```

Alternativ über `.htaccess` / nginx `limit_req`.

---

## Frontend-Integration

### Query-Params lesen (`utils/urlParams.ts`)

```typescript
interface ContextParams {
  planId:   string
  personId: string
  month:    string    // YYYY-MM
  token:    string
  name?:    string
  deadline?: string
  shifts?:  ShiftType[]
}

export function parseContextParams(): ContextParams | null {
  const p = new URLSearchParams(window.location.search)
  const planId   = p.get('planId')   ?? ''
  const personId = p.get('personId') ?? ''
  const month    = p.get('month')    ?? ''
  const token    = p.get('token')    ?? ''

  if (!isUUID(planId) || !isUUID(personId) || !isYearMonth(month) || !token) return null

  const shiftsRaw = p.get('shifts')
  let shifts: ShiftType[] | undefined
  try { if (shiftsRaw) shifts = JSON.parse(atob(shiftsRaw.replace(/-/g,'+').replace(/_/g,'/'))) }
  catch { /* shifts bleibt undefined */ }

  return { planId, personId, month, token, name: p.get('name') ?? undefined,
           deadline: p.get('deadline') ?? undefined, shifts }
}

function isUUID(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
}

function isYearMonth(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s)
}
```

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

### Wünsche speichern

```typescript
async function saveWishes(payload: WishPayload, token: string, cfToken: string): Promise<void> {
  const res = await fetch('/api/save-wishes.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cfToken, token, payload }),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.error)
  // cfToken ist einmalig — Widget nach erfolgreichem Save zurücksetzen!
}
```

---

## Fallback-Modus (kein vollständiger Link)

Fehlen `planId`, `personId` oder `token` im Querystring, zeigt die App ein Eingabeformular:

| Feld | Eingabetyp | Validierung |
|------|-----------|-------------|
| Plan-ID | Text (Paste) | UUID v4 |
| Personen-ID | Text (Paste) | UUID v4 |
| Zugangscode | Text (Paste) | nicht leer |
| Monat | `<input type="month">` | Pflicht, default: aktueller Monat |

Im Fallback-Modus kann kein neues Token generiert werden — der Mitarbeiter muss den originalen Einladungslink verwenden oder den Zugangscode aus dem Link kopieren.
