<?php
declare(strict_types=1);

require_once __DIR__ . '/ConfigHandler.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
    exit;
}

$planId = (string)($_GET['planId'] ?? '');

$handler = new ConfigHandler(dirname(__DIR__) . '/plandata');
$result  = $handler->load($planId);

http_response_code($result['status']);
if ($result['ok']) {
    echo json_encode($result['data'], JSON_UNESCAPED_UNICODE);
} else {
    echo json_encode(['ok' => false, 'error' => $result['error']]);
}
