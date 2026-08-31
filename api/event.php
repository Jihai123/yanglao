<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    respond(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

$data = request_json();
$eventName = clean_string($data['event'] ?? '', 48);
$feature = clean_string($data['feature'] ?? '', 48);
$step = clean_string($data['step'] ?? '', 48);
$visitorId = clean_string($data['visitor_id'] ?? '', 64);
$sessionId = clean_string($data['session_id'] ?? '', 64);
$flowId = clean_string($data['flow_id'] ?? '', 64);
$source = clean_string($data['source'] ?? '', 32);
$device = clean_string($data['device'] ?? '', 16);
$page = clean_string($data['page'] ?? '', 255);
$appVersion = clean_string($data['app_version'] ?? '', 32);

$allowed = [
    'page_view',
    'intent_click',
    'flow_start',
    'step_view',
    'wizard_next',
    'result_view',
    'client_error',
    'resident_start',
    'resume_plan',
    'home_click',
    'feedback_submit',
];

if (!in_array($eventName, $allowed, true)) {
    respond(['ok' => false, 'error' => 'invalid_event'], 422);
}

$allowedSources = ['direct', 'internal', 'baidu', 'google', 'bing', 'sogou', '360', 'zhihu', 'wechat', 'other'];
if (!in_array($source, $allowedSources, true)) $source = 'other';

$allowedDevices = ['desktop', 'mobile', 'tablet'];
if (!in_array($device, $allowedDevices, true)) $device = '';

$stmt = $pdo->prepare(
    'INSERT INTO usage_event '
    . '(visitor_id, session_id, flow_id, event_name, feature, step, source, device, page, app_version) '
    . 'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);
$stmt->execute([
    $visitorId,
    $sessionId,
    $flowId,
    $eventName,
    $feature,
    $step,
    $source,
    $device,
    $page,
    $appVersion,
]);
respond(['ok' => true], 201);
