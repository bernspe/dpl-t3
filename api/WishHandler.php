<?php
declare(strict_types=1);

require_once __DIR__ . '/EnvLoader.php';

/**
 * Testable business logic extracted from the HTTP entry points.
 *
 * Token authentication is now centralised in a per-person auth file:
 *   plandata/{planId}/{personId}.auth  →  { "tokenHash": "sha256hex" }
 *
 * Wish files (wishdata/{YYYY-MM}/{planId}/{personId}.json) no longer carry
 * a tokenHash field. This means:
 *  – Token rotation only requires updating one file (the .auth file)
 *  – Multi-month submissions under one invite token never produce conflicts
 *  – Each person across all months is authenticated exactly once
 */
final class WishHandler
{
    private readonly string $planDataRoot;

    /**
     * @param string                 $wishDataRoot  Absolute path to the wishdata directory
     * @param TurnstileVerifier|null $turnstile     Injected verifier; null = use real Cloudflare API
     * @param string|null            $planDataRoot  Absolute path to the plandata directory;
     *                                              defaults to ../plandata relative to wishDataRoot
     */
    public function __construct(
        private readonly string $wishDataRoot,
        private readonly ?TurnstileVerifier $turnstile = null,
        ?string $planDataRoot = null,
    ) {
        $this->planDataRoot = $planDataRoot ?? dirname($wishDataRoot) . '/plandata';
    }

    // ── Validation ────────────────────────────────────────────────────────────

    public static function isUUID(string $s): bool
    {
        return (bool) preg_match(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i',
            $s
        );
    }

    /**
     * Accepts any ID that is safe for use in file-system paths:
     * alphanumeric characters, hyphens and underscores, 1–64 chars.
     * Intentionally broader than UUID v4 to support short IDs like "p1" or "anna".
     * Path-traversal characters (., /, \, spaces, …) are still rejected.
     */
    public static function isSafeId(string $s): bool
    {
        return (bool) preg_match('/^[a-zA-Z0-9_-]{1,64}$/', $s);
    }

    public static function isYearMonth(string $s): bool
    {
        return (bool) preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $s);
    }

    public static function isDayInMonth(string $date, string $month): bool
    {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) return false;
        return str_starts_with($date, $month);
    }

    public static function isValidPreference(string $pref): bool
    {
        return in_array($pref, ['preferred', 'unavailable', 'limited'], true);
    }

    // ── Auth (.auth file) ─────────────────────────────────────────────────────

    private function authFilePath(string $planId, string $personId): string
    {
        return $this->planDataRoot . '/' . $planId . '/' . $personId . '.auth';
    }

    /**
     * Reads the stored SHA-256 token hash for this person.
     * Returns null if no auth file exists yet (first write).
     */
    private function readTokenHash(string $planId, string $personId): ?string
    {
        $file = $this->authFilePath($planId, $personId);
        if (!file_exists($file)) return null;
        $data = json_decode((string)file_get_contents($file), true);
        return is_array($data) ? (($data['tokenHash'] ?? null) ?: null) : null;
    }

    /**
     * Persists the SHA-256 token hash. Creates the directory if needed.
     * Auth file is always written BEFORE the wish files to maintain consistency.
     */
    private function writeTokenHash(string $planId, string $personId, string $tokenHash): bool
    {
        $file = $this->authFilePath($planId, $personId);
        $dir  = dirname($file);
        if (!is_dir($dir) && !mkdir($dir, 0750, true)) return false;
        return file_put_contents($file, json_encode(['tokenHash' => $tokenHash]), LOCK_EX) !== false;
    }

    // ── Save (single, legacy) ─────────────────────────────────────────────────

    /**
     * Single-month save — kept for backwards compatibility.
     * Internally delegates to saveBatch with one payload.
     *
     * @param array<string,mixed> $data  Decoded request body
     * @return array{ok:bool, status:int, error?:string, savedAt?:string}
     */
    public function save(array $data): array
    {
        $payload = $data['payload'] ?? null;
        if (!is_array($payload)) return $this->err(400, 'missing_payload');

        $batch             = $data;
        $batch['payloads'] = [$payload];
        unset($batch['payload']);

        $result = $this->saveBatch($batch);
        if (!$result['ok']) return $result;

        return ['ok' => true, 'status' => 200, 'savedAt' => $result['savedAt']];
    }

    // ── Save (batch) ──────────────────────────────────────────────────────────

    /**
     * Multi-month batch save. All payloads must share the same planId and personId.
     * Auth is verified once against the central .auth file; wish files carry no tokenHash.
     *
     * Write order (atomic guarantee):
     *  1. Validate all payloads
     *  2. Verify / create .auth file  ← before any wish file write
     *  3. Write wish files
     *
     * @param array<string,mixed> $data  { cfToken, token, payloads: WishPayload[] }
     * @return array{ok:bool, status:int, error?:string, savedAt?:string, savedMonths?:string[]}
     */
    public function saveBatch(array $data): array
    {
        // ── Turnstile (once for the whole batch) ──────────────────────────────
        $cfToken = (string)($data['cfToken'] ?? '');
        if ($cfToken === '') return $this->err(400, 'missing_cf_token');

        $verifier = $this->turnstile ?? new TurnstileVerifier();
        if (!$verifier->verify($cfToken)) {
            return $this->err(403, 'turnstile_failed');
        }

        $token    = $data['token']    ?? '';
        $payloads = $data['payloads'] ?? null;

        if (!is_string($token) || $token === '') return $this->err(400, 'missing_token');
        if (!is_array($payloads) || count($payloads) === 0) return $this->err(400, 'missing_payloads');

        // ── Extract & validate consistent planId / personId ───────────────────
        $firstPayload = $payloads[0];
        if (!is_array($firstPayload)) return $this->err(400, 'invalid_payload');

        $planId   = (string)($firstPayload['planId']   ?? '');
        $personId = (string)($firstPayload['personId'] ?? '');

        if (!self::isSafeId($planId))   return $this->err(400, 'invalid_plan_id');
        if (!self::isSafeId($personId)) return $this->err(400, 'invalid_person_id');

        // ── Validate all payloads ─────────────────────────────────────────────
        foreach ($payloads as $payload) {
            if (!is_array($payload)) return $this->err(400, 'invalid_payload');

            // All payloads must share the same person
            if ((string)($payload['planId']   ?? '') !== $planId)   return $this->err(400, 'inconsistent_plan_id');
            if ((string)($payload['personId'] ?? '') !== $personId) return $this->err(400, 'inconsistent_person_id');

            $month  = (string)($payload['month']  ?? '');
            $wishes = $payload['wishes']           ?? null;

            if (!self::isYearMonth($month)) return $this->err(400, 'invalid_month');
            if (!is_array($wishes))         return $this->err(400, 'invalid_wishes');

            foreach ($wishes as $wish) {
                if (!is_array($wish)) return $this->err(400, 'invalid_wish_item');
                if (!self::isDayInMonth((string)($wish['date'] ?? ''), $month)) {
                    return $this->err(400, 'wish_date_out_of_range');
                }
                if (!self::isValidPreference((string)($wish['preference'] ?? ''))) {
                    return $this->err(400, 'invalid_preference');
                }
                if (isset($wish['note']) && strlen((string)$wish['note']) > 100) {
                    return $this->err(400, 'note_too_long');
                }
            }
        }

        // ── Auth: verify or establish token via .auth file ────────────────────
        $tokenHash   = hash('sha256', $token);
        $storedHash  = $this->readTokenHash($planId, $personId);

        if ($storedHash !== null && $storedHash !== $tokenHash) {
            return $this->err(403, 'token_mismatch');
        }

        // ── Write .auth file FIRST (before any wish file) ─────────────────────
        if ($storedHash === null) {
            if (!$this->writeTokenHash($planId, $personId, $tokenHash)) {
                return $this->err(500, 'write_failed');
            }
        }

        // ── Write wish files (without tokenHash) ──────────────────────────────
        $savedAt     = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format(DateTime::ATOM);
        $savedMonths = [];

        foreach ($payloads as $payload) {
            $month = (string)($payload['month'] ?? '');
            $dir   = $this->wishDataRoot . '/' . $month . '/' . $planId;
            $file  = $dir . '/' . $personId . '.json';

            if (!is_dir($dir) && !mkdir($dir, 0750, true)) {
                return $this->err(500, 'write_failed');
            }

            $record = [
                'v'           => 2,
                'type'        => 'wishes',
                'planId'      => $planId,
                'personId'    => $personId,
                'month'       => $month,
                'name'        => isset($payload['name']) ? substr((string)$payload['name'], 0, 50) : null,
                'submittedAt' => $savedAt,
                'wishes'      => $payload['wishes'],
                // tokenHash intentionally absent — stored in .auth file
            ];

            $json = json_encode($record, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            if (file_put_contents($file, $json, LOCK_EX) === false) {
                return $this->err(500, 'write_failed');
            }

            $savedMonths[] = $month;
        }

        return ['ok' => true, 'status' => 200, 'savedAt' => $savedAt, 'savedMonths' => $savedMonths];
    }

    // ── Load (single month) ───────────────────────────────────────────────────

    /**
     * @return array{ok:bool, status:int, error?:string, data?:array<string,mixed>}
     */
    public function load(string $planId, string $personId, string $token): array
    {
        if (!self::isSafeId($planId))   return $this->err(400, 'invalid_plan_id');
        if (!self::isSafeId($personId)) return $this->err(400, 'invalid_person_id');
        if ($token === '')               return $this->err(400, 'missing_token');

        $authErr = $this->checkToken($planId, $personId, $token);
        if ($authErr !== null) return $authErr;

        $relativePath = $this->findFirstFile($planId, $personId);
        if ($relativePath === '') return $this->err(404, 'not_found');

        $record = $this->readWishFile($relativePath);
        if (isset($record['error'])) return $record;

        return ['ok' => true, 'status' => 200, 'data' => $record];
    }

    // ── Load all months ───────────────────────────────────────────────────────

    /**
     * Returns all saved months for this person.
     *
     * @return array{ok:bool, status:int, error?:string, months?:array<array<string,mixed>>}
     */
    public function loadAll(string $planId, string $personId, string $token): array
    {
        if (!self::isSafeId($planId))   return $this->err(400, 'invalid_plan_id');
        if (!self::isSafeId($personId)) return $this->err(400, 'invalid_person_id');
        if ($token === '')               return $this->err(400, 'missing_token');

        $authErr = $this->checkToken($planId, $personId, $token);
        if ($authErr !== null) return $authErr;

        $paths = $this->findAllFiles($planId, $personId);
        if ($paths === []) return ['ok' => true, 'status' => 200, 'months' => []];

        $months = [];
        foreach ($paths as $relativePath) {
            $record = $this->readWishFile($relativePath);
            if (isset($record['error'])) return $record;
            $months[] = $record;
        }

        return ['ok' => true, 'status' => 200, 'months' => $months];
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /**
     * Verifies the token against the central .auth file.
     * Returns an error array on failure, null on success.
     *
     * @return array{ok:false, status:int, error:string}|null
     */
    private function checkToken(string $planId, string $personId, string $token): ?array
    {
        $storedHash = $this->readTokenHash($planId, $personId);
        if ($storedHash === null)                         return $this->err(404, 'not_found');
        if (hash('sha256', $token) !== $storedHash) return $this->err(403, 'token_mismatch');
        return null;
    }

    /** Returns relative path of the first matching wish file, or '' if none. */
    private function findFirstFile(string $planId, string $personId): string
    {
        $files = $this->findAllFiles($planId, $personId);
        return $files[0] ?? '';
    }

    /** Returns relative paths of all matching wish files, sorted by month ascending. */
    private function findAllFiles(string $planId, string $personId): array
    {
        $pattern = $this->wishDataRoot . '/????-??/' . $planId . '/' . $personId . '.json';
        $matches = glob($pattern) ?: [];
        sort($matches);
        return array_map(
            fn($f) => substr($f, strlen($this->wishDataRoot) + 1),
            $matches
        );
    }

    /**
     * Reads a wish file. Token verification is done separately via checkToken().
     *
     * @return array<string,mixed>
     */
    private function readWishFile(string $relativePath): array
    {
        $file = $this->wishDataRoot . '/' . $relativePath;
        if (!file_exists($file)) return $this->err(404, 'not_found');

        $record = json_decode((string)file_get_contents($file), true);
        if (!is_array($record)) return $this->err(500, 'corrupt_data');

        return $record;
    }

    /** @return array{ok:false, status:int, error:string} */
    private function err(int $status, string $error): array
    {
        return ['ok' => false, 'status' => $status, 'error' => $error];
    }
}
