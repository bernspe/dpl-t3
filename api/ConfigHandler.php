<?php
declare(strict_types=1);

/**
 * ConfigHandler – testable business logic for plan-configuration storage.
 *
 * Plan configs are stored at  plandata/{planId}/config.json
 * The planner authenticates writes via a plan-level token (SHA-256 hash stored
 * server-side on first write; verified on subsequent writes).
 * Reads are unauthenticated – shift types and holidays are not sensitive.
 */
final class ConfigHandler
{
    public function __construct(
        private readonly string $planDataRoot,
    ) {}

    // ── Validation ────────────────────────────────────────────────────────────

    public static function isSafeId(string $s): bool
    {
        return (bool) preg_match('/^[a-zA-Z0-9_-]{1,64}$/', $s);
    }

    public static function isIsoDate(string $s): bool
    {
        return (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', $s);
    }

    // ── Save ──────────────────────────────────────────────────────────────────

    /**
     * @param array<string,mixed> $data  Decoded request body: { token, config }
     * @return array{ok:bool, status:int, error?:string, savedAt?:string}
     */
    public function save(array $data): array
    {
        $token  = (string)($data['token']  ?? '');
        $config = $data['config'] ?? null;

        if ($token === '')      return $this->err(400, 'missing_token');
        if (!is_array($config)) return $this->err(400, 'invalid_config');

        $planId     = (string)($config['planId']     ?? '');
        $v          = $config['v']                   ?? null;
        $shiftTypes = $config['shiftTypes']          ?? null;
        $holidays   = $config['holidays']            ?? null;

        if (!self::isSafeId($planId))  return $this->err(400, 'invalid_plan_id');
        if ($v !== 1)                  return $this->err(400, 'invalid_version');
        if (!is_array($shiftTypes))    return $this->err(400, 'invalid_shift_types');
        if (!is_array($holidays))      return $this->err(400, 'invalid_holidays');

        foreach ($holidays as $h) {
            if (!self::isIsoDate((string)$h)) {
                return $this->err(400, 'invalid_holiday_format');
            }
        }

        $tokenHash = hash('sha256', $token);
        $file      = $this->filePath($planId);

        // Token verification against existing file
        if (file_exists($file)) {
            $existing = json_decode((string)file_get_contents($file), true);
            if (!is_array($existing) || ($existing['tokenHash'] ?? '') !== $tokenHash) {
                return $this->err(403, 'token_mismatch');
            }
        }

        $dir = dirname($file);
        if (!is_dir($dir) && !mkdir($dir, 0750, true)) {
            return $this->err(500, 'write_failed');
        }

        $savedAt = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format(DateTime::ATOM);

        $record = array_merge($config, [
            'updatedAt' => $savedAt,
            'tokenHash' => $tokenHash,
        ]);

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
    public function load(string $planId): array
    {
        if (!self::isSafeId($planId)) return $this->err(400, 'invalid_plan_id');

        $file = $this->filePath($planId);
        if (!file_exists($file)) return $this->err(404, 'not_found');

        $record = json_decode((string)file_get_contents($file), true);
        if (!is_array($record)) return $this->err(500, 'corrupt_data');

        unset($record['tokenHash']);
        return ['ok' => true, 'status' => 200, 'data' => $record];
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private function filePath(string $planId): string
    {
        return $this->planDataRoot . '/' . $planId . '/config.json';
    }

    /** @return array{ok:false, status:int, error:string} */
    private function err(int $status, string $error): array
    {
        return ['ok' => false, 'status' => $status, 'error' => $error];
    }
}
