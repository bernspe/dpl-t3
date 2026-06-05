<?php
declare(strict_types=1);

require_once __DIR__ . '/ConfigHandler.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
    exit;
}

$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($contentType, 'application/json') === false) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_content_type']);
    exit;
}

$body = file_get_contents('php://input');
if ($body === false || $body === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'empty_body']);
    exit;
}

$data = json_decode($body, true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_json']);
    exit;
}

$handler = new ConfigHandler(dirname(__DIR__) . '/plandata');
$result  = $handler->save($data);

http_response_code($result['status']);
if ($result['ok']) {
    echo json_encode(['ok' => true, 'savedAt' => $result['savedAt']]);
} else {
    echo json_encode(['ok' => false, 'error' => $result['error']]);
}
