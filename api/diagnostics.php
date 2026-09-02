<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

const DIAGNOSTICS_ADMIN_COOKIE = 'yanglao_admin';
const DIAGNOSTICS_TOKEN_MESSAGE = 'yanglao-admin-v1';

$adminPassword = (string)($config['admin_password'] ?? '');
if ($adminPassword === '') respond(['ok' => false, 'error' => 'admin_not_configured'], 503);

$cookie = (string)($_COOKIE[DIAGNOSTICS_ADMIN_COOKIE] ?? '');
$expected = hash_hmac('sha256', DIAGNOSTICS_TOKEN_MESSAGE, $adminPassword);
if ($cookie === '' || !hash_equals($expected, $cookie)) {
    respond(['ok' => false, 'error' => 'unauthorized'], 401);
}

if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'GET') {
    respond(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

$pdo->exec("SET time_zone = '+08:00'");

function diagnostics_for_window(PDO $pdo, string $where): array
{
    $reasonSql = "
        SELECT reason_code, COUNT(*) AS attempts, COUNT(DISTINCT flow_id) AS flows
        FROM usage_event
        WHERE {$where}
          AND event_name = 'validation_error'
          AND reason_code <> ''
        GROUP BY reason_code
        ORDER BY attempts DESC, reason_code ASC
        LIMIT 20
    ";
    $reasons = array_map(static fn(array $row): array => [
        'reason' => (string)$row['reason_code'],
        'attempts' => (int)$row['attempts'],
        'flows' => (int)$row['flows'],
    ], $pdo->query($reasonSql)->fetchAll());

    $stepSql = "
        SELECT step, COUNT(*) AS attempts, COUNT(DISTINCT flow_id) AS flows
        FROM usage_event
        WHERE {$where}
          AND event_name = 'validation_error'
          AND step <> ''
        GROUP BY step
        ORDER BY attempts DESC, step ASC
    ";
    $steps = array_map(static fn(array $row): array => [
        'step' => (string)$row['step'],
        'attempts' => (int)$row['attempts'],
        'flows' => (int)$row['flows'],
    ], $pdo->query($stepSql)->fetchAll());

    $featureSql = "
        SELECT feature, COUNT(*) AS attempts, COUNT(DISTINCT flow_id) AS flows
        FROM usage_event
        WHERE {$where}
          AND event_name = 'validation_error'
          AND feature <> ''
        GROUP BY feature
        ORDER BY attempts DESC, feature ASC
    ";
    $features = array_map(static fn(array $row): array => [
        'feature' => (string)$row['feature'],
        'attempts' => (int)$row['attempts'],
        'flows' => (int)$row['flows'],
    ], $pdo->query($featureSql)->fetchAll());

    $clientSql = "
        SELECT error_type, script_name, line_no, column_no, step, feature,
               COUNT(*) AS attempts, COUNT(DISTINCT flow_id) AS flows
        FROM usage_event
        WHERE {$where}
          AND event_name = 'client_error'
        GROUP BY error_type, script_name, line_no, column_no, step, feature
        ORDER BY attempts DESC, error_type ASC, script_name ASC, line_no ASC
        LIMIT 30
    ";
    $clientErrors = array_map(static fn(array $row): array => [
        'error_type' => (string)$row['error_type'],
        'script_name' => (string)$row['script_name'],
        'line_no' => (int)$row['line_no'],
        'column_no' => (int)$row['column_no'],
        'step' => (string)$row['step'],
        'feature' => (string)$row['feature'],
        'attempts' => (int)$row['attempts'],
        'flows' => (int)$row['flows'],
    ], $pdo->query($clientSql)->fetchAll());

    $amountSql = "
        SELECT
          SUM(event_name = 'wizard_next' AND step = 'amount') AS next_attempts,
          COUNT(DISTINCT CASE WHEN event_name = 'wizard_next' AND step = 'amount' AND flow_id <> '' THEN flow_id END) AS next_flows,
          SUM(event_name = 'validation_error' AND step = 'amount') AS validation_attempts,
          COUNT(DISTINCT CASE WHEN event_name = 'validation_error' AND step = 'amount' AND flow_id <> '' THEN flow_id END) AS validation_flows
        FROM usage_event
        WHERE {$where}
          AND event_name IN ('wizard_next', 'validation_error')
    ";
    $amount = $pdo->query($amountSql)->fetch() ?: [];

    return [
        'reasons' => $reasons,
        'steps' => $steps,
        'features' => $features,
        'client_errors' => $clientErrors,
        'amount' => [
            'next_attempts' => (int)($amount['next_attempts'] ?? 0),
            'next_flows' => (int)($amount['next_flows'] ?? 0),
            'validation_attempts' => (int)($amount['validation_attempts'] ?? 0),
            'validation_flows' => (int)($amount['validation_flows'] ?? 0),
        ],
    ];
}

try {
    respond([
        'ok' => true,
        'today' => diagnostics_for_window($pdo, 'created_at >= CURDATE()'),
        'seven_days' => diagnostics_for_window($pdo, 'created_at >= CURDATE() - INTERVAL 6 DAY'),
        'generated_at' => date('Y-m-d H:i:s'),
    ]);
} catch (Throwable $error) {
    respond(['ok' => false, 'error' => 'diagnostics_query_failed'], 500);
}
