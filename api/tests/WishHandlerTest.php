<?php
declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once dirname(__DIR__) . '/TurnstileVerifier.php';
require_once dirname(__DIR__) . '/WishHandler.php';

// ── Test double ───────────────────────────────────────────────────────────────

final class AlwaysPassTurnstile extends TurnstileVerifier
{
    public function verify(string $token, string $remoteIp = ''): bool { return true; }
}

final class AlwaysFailTurnstile extends TurnstileVerifier
{
    public function verify(string $token, string $remoteIp = ''): bool { return false; }
}

// ── Test suite ────────────────────────────────────────────────────────────────

final class WishHandlerTest extends TestCase
{
    private string $tmpDir;
    private WishHandler $handler;

    // ── Fixtures ──────────────────────────────────────────────────────────────

    private const PLAN_ID   = '12345678-1234-4234-a234-123456789abc';
    private const PERSON_ID = 'abcdef12-abcd-4bcd-abcd-abcdef123456';
    private const MONTH     = '2026-07';
    private const TOKEN     = 'test-token-secret-32bytes-padded!!';

    private function validPayload(array $override = []): array
    {
        return array_merge([
            'cfToken' => 'dummy-cf-token',
            'token'   => self::TOKEN,
            'payload' => array_merge([
                'planId'   => self::PLAN_ID,
                'personId' => self::PERSON_ID,
                'month'    => self::MONTH,
                'wishes'   => [],
            ], $override['payload'] ?? []),
        ], array_diff_key($override, ['payload' => null]));
    }

    // ── Setup / Teardown ──────────────────────────────────────────────────────

    protected function setUp(): void
    {
        $this->tmpDir = sys_get_temp_dir() . '/wishhandler_test_' . uniqid();
        mkdir($this->tmpDir, 0750, true);
        // Use AlwaysPassTurnstile so tests don't hit Cloudflare's API
        $this->handler = new WishHandler($this->tmpDir, new AlwaysPassTurnstile());
    }

    protected function tearDown(): void
    {
        $this->removeDir($this->tmpDir);
    }

    private function removeDir(string $dir): void
    {
        foreach (glob($dir . '/*') ?: [] as $f) {
            is_dir($f) ? $this->removeDir($f) : unlink($f);
        }
        rmdir($dir);
    }

    // ── Validation helpers ────────────────────────────────────────────────────

    public function testIsUUIDAcceptsValidV4(): void
    {
        $this->assertTrue(WishHandler::isUUID(self::PLAN_ID));
        $this->assertTrue(WishHandler::isUUID('00000000-0000-4000-8000-000000000000'));
    }

    public function testIsUUIDRejectsInvalid(): void
    {
        $this->assertFalse(WishHandler::isUUID('not-a-uuid'));
        $this->assertFalse(WishHandler::isUUID('12345678-1234-3234-a234-123456789abc')); // v3, not v4
        $this->assertFalse(WishHandler::isUUID('../../etc/passwd'));
        $this->assertFalse(WishHandler::isUUID(''));
    }

    public function testIsYearMonthAcceptsValid(): void
    {
        $this->assertTrue(WishHandler::isYearMonth('2026-07'));
        $this->assertTrue(WishHandler::isYearMonth('2026-01'));
        $this->assertTrue(WishHandler::isYearMonth('2026-12'));
    }

    public function testIsYearMonthRejectsInvalid(): void
    {
        $this->assertFalse(WishHandler::isYearMonth('2026-13'));
        $this->assertFalse(WishHandler::isYearMonth('2026-00'));
        $this->assertFalse(WishHandler::isYearMonth('26-07'));
        $this->assertFalse(WishHandler::isYearMonth('../../'));
        $this->assertFalse(WishHandler::isYearMonth(''));
    }

    public function testIsDayInMonth(): void
    {
        $this->assertTrue(WishHandler::isDayInMonth('2026-07-01', '2026-07'));
        $this->assertTrue(WishHandler::isDayInMonth('2026-07-31', '2026-07'));
        $this->assertFalse(WishHandler::isDayInMonth('2026-08-01', '2026-07'));
        $this->assertFalse(WishHandler::isDayInMonth('not-a-date', '2026-07'));
    }

    // ── Save: validation errors ───────────────────────────────────────────────

    public function testSaveRejectsMissingToken(): void
    {
        $data = ['cfToken' => 'dummy-cf-token', 'payload' => $this->validPayload()['payload']];
        $result = $this->handler->save($data);
        $this->assertSame(400, $result['status']);
        $this->assertSame('missing_token', $result['error']);
    }

    public function testSaveRejectsMissingPayload(): void
    {
        $result = $this->handler->save(['cfToken' => 'dummy-cf-token', 'token' => self::TOKEN]);
        $this->assertSame(400, $result['status']);
        $this->assertSame('missing_payload', $result['error']);
    }

    public function testSaveRejectsInvalidPlanId(): void
    {
        $data = $this->validPayload(['payload' => ['planId' => '../../evil']]);
        $result = $this->handler->save($data);
        $this->assertSame(400, $result['status']);
        $this->assertSame('invalid_plan_id', $result['error']);
    }

    public function testSaveRejectsInvalidPersonId(): void
    {
        $data = $this->validPayload(['payload' => ['personId' => 'not-a-uuid']]);
        $result = $this->handler->save($data);
        $this->assertSame(400, $result['status']);
        $this->assertSame('invalid_person_id', $result['error']);
    }

    public function testSaveRejectsInvalidMonth(): void
    {
        $data = $this->validPayload(['payload' => ['month' => '2026-13']]);
        $result = $this->handler->save($data);
        $this->assertSame(400, $result['status']);
        $this->assertSame('invalid_month', $result['error']);
    }

    public function testSaveRejectsWishOutsideMonth(): void
    {
        $data = $this->validPayload(['payload' => [
            'wishes' => [['date' => '2026-08-01', 'preference' => 'preferred']],
        ]]);
        $result = $this->handler->save($data);
        $this->assertSame(400, $result['status']);
        $this->assertSame('wish_date_out_of_range', $result['error']);
    }

    public function testSaveRejectsInvalidPreference(): void
    {
        $data = $this->validPayload(['payload' => [
            'wishes' => [['date' => '2026-07-04', 'preference' => 'maybe']],
        ]]);
        $result = $this->handler->save($data);
        $this->assertSame(400, $result['status']);
        $this->assertSame('invalid_preference', $result['error']);
    }

    public function testSaveRejectsNoteTooLong(): void
    {
        $data = $this->validPayload(['payload' => [
            'wishes' => [['date' => '2026-07-04', 'preference' => 'preferred', 'note' => str_repeat('x', 101)]],
        ]]);
        $result = $this->handler->save($data);
        $this->assertSame(400, $result['status']);
        $this->assertSame('note_too_long', $result['error']);
    }

    // ── Save: happy path ──────────────────────────────────────────────────────

    public function testSaveWritesFileAndReturns200(): void
    {
        $result = $this->handler->save($this->validPayload());

        $this->assertTrue($result['ok']);
        $this->assertSame(200, $result['status']);
        $this->assertArrayHasKey('savedAt', $result);

        $file = $this->tmpDir . '/' . self::MONTH . '/' . self::PLAN_ID . '/' . self::PERSON_ID . '.json';
        $this->assertFileExists($file);

        $stored = json_decode(file_get_contents($file), true);
        $this->assertSame(hash('sha256', self::TOKEN), $stored['tokenHash']);
        $this->assertSame(self::PLAN_ID, $stored['planId']);
    }

    public function testSaveAllowsOverwriteWithSameToken(): void
    {
        $this->handler->save($this->validPayload());

        $data = $this->validPayload(['payload' => [
            'wishes' => [['date' => '2026-07-10', 'preference' => 'unavailable']],
        ]]);
        $result = $this->handler->save($data);

        $this->assertTrue($result['ok']);

        $file = $this->tmpDir . '/' . self::MONTH . '/' . self::PLAN_ID . '/' . self::PERSON_ID . '.json';
        $stored = json_decode(file_get_contents($file), true);
        $this->assertCount(1, $stored['wishes']);
    }

    public function testSaveRejectsOverwriteWithWrongToken(): void
    {
        $this->handler->save($this->validPayload());

        $data           = $this->validPayload();
        $data['token']  = 'wrong-token';
        $result = $this->handler->save($data);

        $this->assertFalse($result['ok']);
        $this->assertSame(403, $result['status']);
        $this->assertSame('token_mismatch', $result['error']);
    }

    public function testSaveTruncatesNameAt50Chars(): void
    {
        $data = $this->validPayload(['payload' => ['name' => str_repeat('A', 60)]]);
        $this->handler->save($data);

        $file = $this->tmpDir . '/' . self::MONTH . '/' . self::PLAN_ID . '/' . self::PERSON_ID . '.json';
        $stored = json_decode(file_get_contents($file), true);
        $this->assertSame(50, strlen($stored['name']));
    }

    // ── Load: validation errors ───────────────────────────────────────────────

    public function testLoadRejectsInvalidPlanId(): void
    {
        $result = $this->handler->load('bad-id', self::PERSON_ID, self::TOKEN);
        $this->assertSame(400, $result['status']);
        $this->assertSame('invalid_plan_id', $result['error']);
    }

    public function testLoadReturns404WhenFileAbsent(): void
    {
        $result = $this->handler->load(self::PLAN_ID, self::PERSON_ID, self::TOKEN);
        $this->assertSame(404, $result['status']);
        $this->assertSame('not_found', $result['error']);
    }

    // ── Load: happy path ──────────────────────────────────────────────────────

    public function testLoadReturnsStoredDataWithoutTokenHash(): void
    {
        $this->handler->save($this->validPayload());

        $result = $this->handler->load(self::PLAN_ID, self::PERSON_ID, self::TOKEN);

        $this->assertTrue($result['ok']);
        $this->assertSame(200, $result['status']);
        $this->assertArrayNotHasKey('tokenHash', $result['data']);
        $this->assertSame(self::PLAN_ID, $result['data']['planId']);
    }

    public function testLoadRejects403OnWrongToken(): void
    {
        $this->handler->save($this->validPayload());

        $result = $this->handler->load(self::PLAN_ID, self::PERSON_ID, 'wrong-token');

        $this->assertFalse($result['ok']);
        $this->assertSame(403, $result['status']);
        $this->assertSame('token_mismatch', $result['error']);
    }

    // ── Path traversal ────────────────────────────────────────────────────────

    public function testPathTraversalInPlanIdBlocked(): void
    {
        $result = $this->handler->save(
            $this->validPayload(['payload' => ['planId' => '../../etc/passwd']])
        );
        $this->assertSame(400, $result['status']);
    }

    public function testPathTraversalInPersonIdBlocked(): void
    {
        $result = $this->handler->save(
            $this->validPayload(['payload' => ['personId' => '../../../root']])
        );
        $this->assertSame(400, $result['status']);
    }

    public function testPathTraversalInMonthBlocked(): void
    {
        $result = $this->handler->save(
            $this->validPayload(['payload' => ['month' => '../../etc']])
        );
        $this->assertSame(400, $result['status']);
    }

    // ── Turnstile ─────────────────────────────────────────────────────────────

    public function testSaveRejectsMissingCfToken(): void
    {
        $data = $this->validPayload();
        unset($data['cfToken']);
        $result = $this->handler->save($data);
        $this->assertSame(400, $result['status']);
        $this->assertSame('missing_cf_token', $result['error']);
    }

    public function testSaveRejectsEmptyCfToken(): void
    {
        $data = $this->validPayload(['cfToken' => '']);
        $result = $this->handler->save($data);
        $this->assertSame(400, $result['status']);
        $this->assertSame('missing_cf_token', $result['error']);
    }

    public function testSaveRejects403WhenTurnstileFails(): void
    {
        $handler = new WishHandler($this->tmpDir, new AlwaysFailTurnstile());
        $result  = $handler->save($this->validPayload());
        $this->assertSame(403, $result['status']);
        $this->assertSame('turnstile_failed', $result['error']);
    }

    public function testSaveSucceedsWhenTurnstilePasses(): void
    {
        // handler in setUp() uses AlwaysPassTurnstile
        $result = $this->handler->save($this->validPayload());
        $this->assertTrue($result['ok']);
        $this->assertSame(200, $result['status']);
    }
}
