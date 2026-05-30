<?php
declare(strict_types=1);

/**
 * Minimal .env file loader — no dependencies required.
 *
 * Search order (first found wins):
 *   1. /home/.env.server-wishcraft   (production)
 *   2. <project-root>/.env.server    (local development)
 */
final class EnvLoader
{
    private static bool $loaded = false;

    public static function load(): void
    {
        if (self::$loaded) return;
        self::$loaded = true;

        $candidates = [
            '/home/.env.server-wishcraft',
            dirname(__DIR__) . '/.env.server',
        ];

        foreach ($candidates as $path) {
            if (is_readable($path)) {
                self::parse($path);
                return;
            }
        }
    }

    private static function parse(string $path): void
    {
        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) return;

        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) continue;

            [$key, $value] = array_pad(explode('=', $line, 2), 2, '');
            $key   = trim($key);
            $value = trim($value);

            // Strip optional surrounding quotes
            if (strlen($value) >= 2) {
                $first = $value[0];
                $last  = $value[-1];
                if (($first === '"' && $last === '"') || ($first === "'" && $last === "'")) {
                    $value = substr($value, 1, -1);
                }
            }

            if ($key !== '' && !isset($_ENV[$key])) {
                $_ENV[$key] = $value;
                putenv("{$key}={$value}");
            }
        }
    }

    public static function get(string $key, string $default = ''): string
    {
        self::load();
        return $_ENV[$key] ?? getenv($key) ?: $default;
    }
}
