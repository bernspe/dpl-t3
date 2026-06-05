<?php
declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once dirname(__DIR__) . '/ConfigHandler.php';

/**
 * Tests for ConfigHandler.
 *
 * A. isSafeId / isIsoDate  — validation helpers
 * B. save() validation     — missing/invalid fields
 * C. save() happy path     — first write + token hash stored
 * D. save() overwrite      — same token allows overwrite, wrong token → 403
 * E. load() validation     — invalid planId
 * F. load() happy path     — reads back config without tokenHash
 * G. Path traversal        — planId with dangerous chars rejected
 */
final class ConfigHandlerTest extends TestCase
{
    private string     $tmpDir;
    private ConfigHandler $handler;

    private const PLAN_ID = 'plan-abc-123';
    private const TOKEN   = 'super-secret-plan-token';

    private function validPayload(array $override = []): array
    {
        return array_merge([
            'token'  => self::TOKEN,
            'config' => array_merge([
                'v'          => 1,
                'planId'     => self::PLAN_ID,
                'updatedAt'  => '2026-07-01T00:00:00Z',
                'shiftTypes' => [
                    ['id' => 'F', 'name' => 'Frühschicht', 'code' => 'F',
                     'color' => '#fbbf24', 'timeStart' => '06:00', 'timeEnd' => '14:00'],
                ],
                'holidays'   => ['2026-07-01'],
            ], $override['config'] ?? []),
        ], array_diff_key($override, ['config' => null]));
    }

    protected function setUp(): void
    {
        $this->tmpDir  = sys_get_temp_dir() . '/confighandler_test_' . uniqid();
        mkdir($this->tmpDir, 0750, true);
        $this->handler = new ConfigHandler($this->tmpDir);
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

    // ── A. Validation helpers ─────────────────────────────────────────────────

    public function testIsSafeIdAcceptsUUID(): void
    {
        $this->assertTrue(ConfigHandler::isSafeId('12345678-1234-4234-a234-123456789abc'));
    }

    public function testIsSafeIdAcceptsShortIds(): void
    {
        $this->assertTrue(ConfigHandler::isSafeId('plan-abc-123'));
        $this->assertTrue(ConfigHandler::isSafeId('p1'));
    }

    public function testIsSafeIdRejectsDangerousValues(): void
    {
        $this->assertFalse(ConfigHandler::isSafeId('../../etc/passwd'));
        $this->assertFalse(ConfigHandler::isSafeId('has.dot'));
        $this->assertFalse(ConfigHandler::isSafeId(''));
    }

    public function testIsIsoDateAcceptsValidDate(): void
    {
        $this->assertTrue(ConfigHandler::isIsoDate('2026-07-01'));
        $this->assertTrue(ConfigHandler::isIsoDate('2026-12-25'));
    }

    public function testIsIsoDateRejectsInvalidFormats(): void
    {
        $this->assertFalse(ConfigHandler::isIsoDate('2026-7-1'));
        $this->assertFalse(ConfigHandler::isIsoDate('not-a-date'));
        $this->assertFalse(ConfigHandler::isIsoDate(''));
    }

    // ── B. save() validation ─────────────────────────────────────────────────

    public function testSaveRejectsMissingToken(): void
    {
        $data   = $this->validPayload(['token' => '']);
        $result = $this->handler->save($data);
        $this->assertSame(400, $result['status']);
        $this->assertSame('missing_token', $result['error']);
    }

    public function testSaveRejectsMissingConfig(): void
    {
        $result = $this->handler->save(['token' => self::TOKEN]);
        $this->assertSame(400, $result['status']);
        $this->assertSame('invalid_config', $result['error']);
    }

    public function testSaveRejectsInvalidPlanId(): void
    {
        $data   = $this->validPayload(['config' => ['planId' => '../../evil']]);
        $result = $this->handler->save($data);
        $this->assertSame(400, $result['status']);
        $this->assertSame('invalid_plan_id', $result['error']);
    }

    public function testSaveRejectsInvalidVersion(): void
    {
        $data   = $this->validPayload(['config' => ['v' => 2]]);
        $result = $this->handler->save($data);
        $this->assertSame(400, $result['status']);
        $this->assertSame('invalid_version', $result['error']);
    }

    public function testSaveRejectsInvalidShiftTypes(): void
    {
        $data   = $this->validPayload(['config' => ['shiftTypes' => 'not-an-array']]);
        $result = $this->handler->save($data);
        $this->assertSame(400, $result['status']);
        $this->assertSame('invalid_shift_types', $result['error']);
    }

    public function testSaveRejectsInvalidHolidayFormat(): void
    {
        $data   = $this->validPayload(['config' => ['holidays' => ['not-a-date']]]);
        $result = $this->handler->save($data);
        $this->assertSame(400, $result['status']);
        $this->assertSame('invalid_holiday_format', $result['error']);
    }

    // ── C. save() happy path ─────────────────────────────────────────────────

    public function testSaveWritesFileAndReturns200(): void
    {
        $result = $this->handler->save($this->validPayload());

        $this->assertTrue($result['ok']);
        $this->assertSame(200, $result['status']);
        $this->assertArrayHasKey('savedAt', $result);

        $file = $this->tmpDir . '/' . self::PLAN_ID . '/config.json';
        $this->assertFileExists($file);

        $stored = json_decode(file_get_contents($file), true);
        $this->assertSame(hash('sha256', self::TOKEN), $stored['tokenHash']);
        $this->assertSame(self::PLAN_ID, $stored['planId']);
        $this->assertIsArray($stored['shiftTypes']);
        $this->assertIsArray($stored['holidays']);
    }

    public function testSaveStoresUpdatedAtTimestamp(): void
    {
        $this->handler->save($this->validPayload());
        $file   = $this->tmpDir . '/' . self::PLAN_ID . '/config.json';
        $stored = json_decode(file_get_contents($file), true);
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}T/', $stored['updatedAt']);
    }

    // ── D. save() overwrite ──────────────────────────────────────────────────

    public function testSaveAllowsOverwriteWithSameToken(): void
    {
        $this->handler->save($this->validPayload());

        $updated = $this->validPayload(['config' => ['shiftTypes' => [], 'holidays' => ['2026-12-25']]]);
        $result  = $this->handler->save($updated);

        $this->assertTrue($result['ok']);

        $file   = $this->tmpDir . '/' . self::PLAN_ID . '/config.json';
        $stored = json_decode(file_get_contents($file), true);
        $this->assertSame(['2026-12-25'], $stored['holidays']);
    }

    public function testSaveRejects403WithWrongToken(): void
    {
        $this->handler->save($this->validPayload());

        $data            = $this->validPayload();
        $data['token']   = 'wrong-token';
        $result          = $this->handler->save($data);

        $this->assertFalse($result['ok']);
        $this->assertSame(403, $result['status']);
        $this->assertSame('token_mismatch', $result['error']);
    }

    // ── E. load() validation ─────────────────────────────────────────────────

    public function testLoadRejectsInvalidPlanId(): void
    {
        $result = $this->handler->load('has.dots');
        $this->assertSame(400, $result['status']);
        $this->assertSame('invalid_plan_id', $result['error']);
    }

    public function testLoadReturns404WhenNoConfigExists(): void
    {
        $result = $this->handler->load('nonexistent-plan');
        $this->assertSame(404, $result['status']);
        $this->assertSame('not_found', $result['error']);
    }

    // ── F. load() happy path ─────────────────────────────────────────────────

    public function testLoadReturnsConfigWithoutTokenHash(): void
    {
        $this->handler->save($this->validPayload());
        $result = $this->handler->load(self::PLAN_ID);

        $this->assertTrue($result['ok']);
        $this->assertSame(200, $result['status']);
        $this->assertArrayHasKey('data', $result);
        $this->assertArrayNotHasKey('tokenHash', $result['data']);
        $this->assertSame(self::PLAN_ID, $result['data']['planId']);
        $this->assertIsArray($result['data']['shiftTypes']);
        $this->assertIsArray($result['data']['holidays']);
    }

    // ── G. Path traversal ────────────────────────────────────────────────────

    public function testPathTraversalInPlanIdBlockedOnSave(): void
    {
        $data   = $this->validPayload(['config' => ['planId' => '../../etc/passwd']]);
        $result = $this->handler->save($data);
        $this->assertSame(400, $result['status']);
    }

    public function testPathTraversalInPlanIdBlockedOnLoad(): void
    {
        $result = $this->handler->load('../../../root');
        $this->assertSame(400, $result['status']);
    }
}
