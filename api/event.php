<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    respond(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

$data = request_json();
$eventName = clean_string($data['event'] ?? '', 48);
$feature = clean_string($data['feature'] ?? '', 48);
$visitorId = clean_string($data['visitor_id'] ?? '', 64);
$sessionId = clean_string($data['session_id'] ?? '', 64);
$page = clean_string($data['page'] ?? '', 255);
$appVersion = clean_string($data['app_version'] ?? '', 32);

$allowed = [
    'page_view',
    'intent_click',
    'wizard_next',
    'result_view',
    'resident_start',
    'resume_plan',
    'home_click',
    'feedback_submit',
];

if (!in_array($eventName, $allowed, true)) {
    respond(['ok' => false, 'error' => 'invalid_event'], 422);
}

$stmt = $pdo->prepare('INSERT INTO usage_event (visitor_id, session_id, event_name, feature, page, app_version) VALUES (?, ?, ?, ?, ?, ?)');
$stmt->execute([$visitorId, $sessionId, $eventName, $feature, $page, $appVersion]);
respond(['ok' => true], 201);
