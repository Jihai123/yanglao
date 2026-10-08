<?php
declare(strict_types=1);

// Destructive fixtures permitted ONLY in the isolated disposable GitHub CI database.
// This script deliberately refuses to operate on any other database.
$database = (string)(getenv('ACQ_TEST_DB') ?: '');
if (!preg_match('/^[a-z0-9_]*_ci$/', $database)) {
    fwrite(STDERR, "Refusing to run: test database must end in _ci.\n");
    exit(2);
}
$pdo = new PDO(
    'mysql:host=' . (getenv('ACQ_TEST_HOST') ?: '127.0.0.1')
        . ';port=' . (getenv('ACQ_TEST_PORT') ?: '3306')
        . ';dbname=' . $database . ';charset=utf8mb4',
    getenv('ACQ_TEST_USER') ?: 'root',
    getenv('ACQ_TEST_PASS') ?: '',
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false],
);
$pdo->exec("SET time_zone = '+08:00'");
$pdo->exec('DROP TABLE IF EXISTS usage_event');
$schema = file_get_contents(__DIR__ . '/../api/schema.sql');
if (!$schema || !preg_match('/CREATE TABLE IF NOT EXISTS usage_event \([\s\S]*?\) ENGINE=InnoDB[^;]*;/i', $schema, $matches)) {
    throw new RuntimeException('usage_event DDL missing');
}
$pdo->exec($matches[0]);

const DIAGNOSTICS_APP_VERSION = 'v2-prod-20260929-v264';
require_once __DIR__ . '/../api/acquisition-query.php';
$insert = $pdo->prepare(
    "INSERT INTO usage_event (visitor_id, session_id, flow_id, event_name, feature, step, source, device, page, app_version, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())"
);
function event_insert(PDOStatement $stmt, string $session, string $flow, string $event, string $page, string $step = '', string $version = DIAGNOSTICS_APP_VERSION): void
{
    $stmt->execute(['test-visitor', $session, $flow, $event, 'early', $step, 'bing', 'desktop', $page, $version]);
}
$flex = '/guides/flexible-employment-pension.html';
$min = '/guides/minimum-pension-years.html';
event_insert($insert, 'session-a', '', 'page_view', $flex);
event_insert($insert, 'session-a', '', 'page_view', $flex); // repeated refresh must not inflate unique sessions
event_insert($insert, 'session-a', '', 'landing_cta_click', $flex, 'flexible-employment-pension');
event_insert($insert, 'session-a', '', 'landing_cta_click', $flex, 'flexible-employment-pension');
event_insert($insert, 'session-b', '', 'page_view', $flex);
event_insert($insert, 'session-a', 'flow-a', 'landing_flow_start', '/', 'flexible-employment-pension');
event_insert($insert, 'session-a', 'flow-a', 'result_view', '/', 'result');
event_insert($insert, 'session-a', 'flow-a', 'result_view', '/', 'result'); // duplicate result event
event_insert($insert, 'session-c', '', 'page_view', $min);
event_insert($insert, 'session-c', '', 'landing_cta_click', $min, 'minimum-pension-years');
event_insert($insert, 'session-c', 'flow-c', 'landing_flow_start', '/', 'minimum-pension-years');
event_insert($insert, 'session-d', '', 'page_view', $flex, '', 'older-version'); // must not count

$data = landing_acquisition_data($pdo);
$pages = [];
foreach ($data['pages'] as $row) $pages[$row['slug']] = $row;
function eq($actual, $expected, $field): void
{
    if ($actual !== $expected) throw new RuntimeException("$field: expected " . json_encode($expected) . ', got ' . json_encode($actual));
}
eq(count($pages), 3, 'page count');
eq($pages['flexible-employment-pension']['visits'], 2, 'flex visits');
eq($pages['flexible-employment-pension']['cta_sessions'], 1, 'flex CTA sessions');
eq($pages['flexible-employment-pension']['cta_clicks'], 2, 'flex CTA clicks');
eq($pages['flexible-employment-pension']['started_flows'], 1, 'flex starts');
eq($pages['flexible-employment-pension']['result_flows'], 1, 'flex results');
eq($pages['flexible-employment-pension']['cta_rate'], 50.0, 'flex CTA rate');
eq($pages['minimum-pension-years']['started_flows'], 1, 'minimum starts');
eq($pages['minimum-pension-years']['result_flows'], 0, 'minimum results');
eq($pages['retirement-age']['visits'], 0, 'empty page visits');

echo "MYSQL_ACQUISITION_QUERY_PASS: real MySQL, native prepares, production DDL, strict fixture counts\n";
