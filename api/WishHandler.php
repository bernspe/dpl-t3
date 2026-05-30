<?php
declare(strict_types=1);

require_once __DIR__ . '/EnvLoader.php';

/**
 * Testable business logic extracted from the HTTP entry points.
 */
final class WishHandler
{
    /**
     * @param string               $wishDataRoot  Absolute path to the wishdata directory
     * @param TurnstileVerifier|null $turnstile   Injected verifier; null = use real Cloudflare API
     */
    public function __construct(
        private readonly string $wishDataRoot,
        private readonly ?TurnstileVerifier $turnstile = null,
    ) {}

    // ── Validation ────────────────────────────────────────────────────────────

    public static function isUUID(string $s): bool
    {
        return (bool) preg_match(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i',
            $s
        );
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

    // ── Save ──────────────────────────────────────────────────────────────────

    /**
     * @param array<string,mixed> $data  Decoded request body
     * @return array{ok:bool, status:int, error?:string, savedAt?:string}
     */
    public function save(array $data): array
    {
        // ── Turnstile verification (must come first) ───────────────────────────
        $cfToken = (string)($data['cfToken'] ?? '');
        if ($cfToken === '') return $this->err(400, 'missing_cf_token');

        $verifier = $this->turnstile ?? new TurnstileVerifier();
        if (!$verifier->verify($cfToken)) {
            return $this->err(403, 'turnstile_failed');
        }

        $token   = $data['token']   ?? '';
        $payload = $data['payload'] ?? null;

        if (!is_string($token) || $token === '') return $this->err(400, 'missing_token');
        if (!is_array($payload))                  return $this->err(400, 'missing_payload');

        $planId   = (string)($payload['planId']   ?? '');
        $personId = (string)($payload['personId'] ?? '');
        $month    = (string)($payload['month']    ?? '');
        $wishes   = $payload['wishes']            ?? null;

        if (!self::isUUID($planId))     return $this->err(400, 'invalid_plan_id');
        if (!self::isUUID($personId))   return $this->err(400, 'invalid_person_id');
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

        $dir  = $this->wishDataRoot . '/' . $month . '/' . $planId;
        $file = $dir . '/' . $personId . '.json';
        $tokenHash = hash('sha256', $token);

        if (file_exists($file)) {
            $existing = json_decode((string)file_get_contents($file), true);
            if (!is_array($existing) || ($existing['tokenHash'] ?? '') !== $tokenHash) {
                return $this->err(403, 'token_mismatch');
            }
        }

        if (!is_dir($dir) && !mkdir($dir, 0750, true)) {
            return $this->err(500, 'write_failed');
        }

        $savedAt = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format(DateTime::ATOM);

        $record = [
            'v'           => 2,
            'type'        => 'wishes',
            'planId'      => $planId,
            'personId'    => $personId,
            'month'       => $month,
            'name'        => isset($payload['name']) ? substr((string)$payload['name'], 0, 50) : null,
            'submittedAt' => $savedAt,
            'tokenHash'   => $tokenHash,
            'wishes'      => $wishes,
        ];

        $json = json_encode($record, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if (file_put_contents($file, $json, LOCK_EX) === false) {
            return $this->err(500, 'write_failed');
        }

        return ['ok' => true, 'status' => 200, 'savedAt' => $savedAt];
    }

    // ── Load ──────────────────────────────────────────────────────────────────

    /**
     * @return array{ok:bool, status:int, error?:string, data?:array<string,mixed>}
     */
    public function load(string $planId, string $personId, string $token): array
    {
        if (!self::isUUID($planId))   return $this->err(400, 'invalid_plan_id');
        if (!self::isUUID($personId)) return $this->err(400, 'invalid_person_id');
        if ($token === '')             return $this->err(400, 'missing_token');

        $relativePath = $this->findFile($planId, $personId);
        if ($relativePath === '') return $this->err(404, 'not_found');

        $file = $this->wishDataRoot . '/' . $relativePath;
        if (!file_exists($file)) return $this->err(404, 'not_found');

        $record = json_decode((string)file_get_contents($file), true);
        if (!is_array($record)) return $this->err(500, 'corrupt_data');

        if (hash('sha256', $token) !== ($record['tokenHash'] ?? '')) {
            return $this->err(403, 'token_mismatch');
        }

        unset($record['tokenHash']);
        return ['ok' => true, 'status' => 200, 'data' => $record];
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private function findFile(string $planId, string $personId): string
    {
        $pattern = $this->wishDataRoot . '/????-??/' . $planId . '/' . $personId . '.json';
        $matches = glob($pattern) ?: [];
        if ($matches === []) return '';
        return substr($matches[0], strlen($this->wishDataRoot) + 1);
    }

    /** @return array{ok:false, status:int, error:string} */
    private function err(int $status, string $error): array
    {
        return ['ok' => false, 'status' => $status, 'error' => $error];
    }

}
