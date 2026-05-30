<?php
declare(strict_types=1);

require_once __DIR__ . '/EnvLoader.php';

/**
 * Verifies a Cloudflare Turnstile token against the siteverify API.
 *
 * Inject a mock subclass in tests to avoid real HTTP calls.
 */
class TurnstileVerifier
{
    private const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

    public function __construct(private readonly string $secretKey = '')
    {
    }

    public function verify(string $token, string $remoteIp = ''): bool
    {
        $secret = $this->secretKey !== ''
            ? $this->secretKey
            : EnvLoader::get('TURNSTILE_SECRET_KEY');

        if ($secret === '') return false;

        $postFields = http_build_query(array_filter([
            'secret'   => $secret,
            'response' => $token,
            'remoteip' => $remoteIp ?: ($_SERVER['REMOTE_ADDR'] ?? ''),
        ]));

        $ctx = stream_context_create([
            'http' => [
                'method'  => 'POST',
                'header'  => "Content-Type: application/x-www-form-urlencoded\r\n",
                'content' => $postFields,
                'timeout' => 5,
            ],
        ]);

        $response = @file_get_contents(self::VERIFY_URL, false, $ctx);
        if ($response === false) return false;

        $data = json_decode($response, true);
        return is_array($data) && ($data['success'] ?? false) === true;
    }
}
