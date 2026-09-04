<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

if ($method === 'GET') {
    $stmt = $pdo->query("SELECT id, content, created_at FROM feedback WHERE status = 'visible' ORDER BY id DESC LIMIT 20");
    $items = $stmt->fetchAll();
    respond(['ok' => true, 'items' => $items]);
}

if ($method !== 'POST') {
    respond(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

$data = request_json();
$content = clean_string($data['content'] ?? '', 1200);
$visitorId = clean_string($data['visitor_id'] ?? '', 64);
$page = clean_string($data['page'] ?? '', 255);
$appVersion = clean_string($data['app_version'] ?? '', 32);

if ($content === '') {
    respond(['ok' => false, 'error' => 'empty_content'], 422);
}

if ($visitorId !== '') {
    $rate = $pdo->prepare('SELECT created_at FROM feedback WHERE visitor_id = ? ORDER BY id DESC LIMIT 1');
    $rate->execute([$visitorId]);
    $last = $rate->fetchColumn();
    if ($last !== false && strtotime((string)$last) > time() - 10) {
        respond(['ok' => false, 'error' => 'too_frequent'], 429);
    }
}

$stmt = $pdo->prepare('INSERT INTO feedback (visitor_id, content, page, app_version) VALUES (?, ?, ?, ?)');
$stmt->execute([$visitorId, $content, $page, $appVersion]);

respond([
    'ok' => true,
    'item' => [
        'id' => (int)$pdo->lastInsertId(),
        'content' => $content,
        'created_at' => date('Y-m-d H:i:s'),
    ],
], 201);
