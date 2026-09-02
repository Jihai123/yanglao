<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

const ADMIN_COOKIE = 'yanglao_admin';
const ADMIN_TOKEN_MESSAGE = 'yanglao-admin-v1';

$adminPassword = (string)($config['admin_password'] ?? '');
if ($adminPassword === '') {
    respond(['ok' => false, 'error' => 'admin_not_configured'], 503);
}

function admin_token(string $password): string
{
    return hash_hmac('sha256', ADMIN_TOKEN_MESSAGE, $password);
}

function admin_cookie_options(int $expires): array
{
    return [
        'expires' => $expires,
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Strict',
    ];
}

function admin_authorized(string $password): bool
{
    $cookie = (string)($_COOKIE[ADMIN_COOKIE] ?? '');
    return $cookie !== '' && hash_equals(admin_token($password), $cookie);
}

function int_fields(array $row, array $keys): array
{
    foreach ($keys as $key) $row[$key] = (int)($row[$key] ?? 0);
    return $row;
}

function add_conversion(array $row): array
{
    $starts = (int)($row['starts'] ?? 0);
    $results = (int)($row['results'] ?? 0);
    $row['conversion'] = $starts > 0 ? round(($results / $starts) * 100, 1) : 0.0;
    return $row;
}

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

function diagnostics_data(PDO $pdo): array
{
    $pdo->exec("SET time_zone = '+08:00'");
    return [
        'ok' => true,
        'today' => diagnostics_for_window($pdo, 'created_at >= CURDATE()'),
        'seven_days' => diagnostics_for_window($pdo, 'created_at >= CURDATE() - INTERVAL 6 DAY'),
        'generated_at' => date('Y-m-d H:i:s'),
    ];
}

function dashboard_data(PDO $pdo): array
{
    $pdo->exec("SET time_zone = '+08:00'");

    $todaySql = "
        SELECT
            COUNT(DISTINCT CASE WHEN event_name = 'page_view' THEN visitor_id END) AS visitors,
            COUNT(DISTINCT CASE WHEN event_name = 'result_view' THEN visitor_id END) AS result_visitors,
            COUNT(DISTINCT CASE WHEN event_name = 'flow_start' AND flow_id <> '' THEN flow_id END) AS started_flows,
            COUNT(DISTINCT CASE WHEN event_name = 'result_view' AND flow_id <> '' THEN flow_id END) AS result_flows,
            SUM(event_name = 'page_view') AS page_views,
            SUM(event_name = 'intent_click') AS intent_clicks,
            SUM(event_name = 'result_view') AS result_views,
            SUM(event_name = 'feedback_submit') AS feedback_submits,
            SUM(event_name = 'client_error') AS client_errors
        FROM usage_event
        WHERE created_at >= CURDATE()
    ";
    $today = int_fields($pdo->query($todaySql)->fetch() ?: [], [
        'visitors', 'result_visitors', 'started_flows', 'result_flows', 'page_views',
        'intent_clicks', 'result_views', 'feedback_submits', 'client_errors',
    ]);
    $today['result_conversion'] = $today['visitors'] > 0
        ? round(($today['result_visitors'] / $today['visitors']) * 100, 1)
        : 0.0;
    $today['flow_conversion'] = $today['started_flows'] > 0
        ? round(($today['result_flows'] / $today['started_flows']) * 100, 1)
        : 0.0;

    $visitorTypeSql = "
        SELECT
            SUM(first_seen = CURDATE()) AS new_visitors,
            SUM(first_seen < CURDATE()) AS returning_visitors
        FROM (
            SELECT visitor_id, DATE(MIN(created_at)) AS first_seen
            FROM usage_event
            WHERE visitor_id <> ''
            GROUP BY visitor_id
        ) v
        WHERE EXISTS (
            SELECT 1 FROM usage_event t
            WHERE t.visitor_id = v.visitor_id AND t.created_at >= CURDATE()
        )
    ";
    $visitorTypes = int_fields($pdo->query($visitorTypeSql)->fetch() ?: [], ['new_visitors', 'returning_visitors']);
    $today = array_merge($today, $visitorTypes);

    $totalSql = "
        SELECT
            COUNT(DISTINCT CASE WHEN event_name = 'page_view' THEN visitor_id END) AS visitors,
            SUM(event_name = 'page_view') AS page_views
        FROM usage_event
    ";
    $total = int_fields($pdo->query($totalSql)->fetch() ?: [], ['visitors', 'page_views']);

    $trendSql = "
        SELECT DATE(created_at) AS day,
            COUNT(DISTINCT CASE WHEN event_name = 'page_view' THEN visitor_id END) AS visitors,
            COUNT(DISTINCT CASE WHEN event_name = 'flow_start' AND flow_id <> '' THEN flow_id END) AS started_flows,
            COUNT(DISTINCT CASE WHEN event_name = 'result_view' AND flow_id <> '' THEN flow_id END) AS result_flows
        FROM usage_event
        WHERE created_at >= CURDATE() - INTERVAL 6 DAY
        GROUP BY DATE(created_at)
        ORDER BY day ASC
    ";
    $trend = array_map(static fn(array $row): array => int_fields($row, ['visitors', 'started_flows', 'result_flows']), $pdo->query($trendSql)->fetchAll());

    $sourceSql = "
        SELECT source,
            COUNT(DISTINCT CASE WHEN event_name = 'page_view' THEN visitor_id END) AS visitors,
            COUNT(DISTINCT CASE WHEN event_name = 'flow_start' AND flow_id <> '' THEN flow_id END) AS starts,
            COUNT(DISTINCT CASE WHEN event_name = 'result_view' AND flow_id <> '' THEN flow_id END) AS results
        FROM usage_event
        WHERE created_at >= CURDATE() - INTERVAL 29 DAY
        GROUP BY source
        HAVING visitors > 0 OR starts > 0
        ORDER BY visitors DESC, starts DESC
    ";
    $sources = array_map(static fn(array $row): array => add_conversion(int_fields($row, ['visitors', 'starts', 'results'])), $pdo->query($sourceSql)->fetchAll());

    $deviceSql = "
        SELECT device,
            COUNT(DISTINCT CASE WHEN event_name = 'page_view' THEN visitor_id END) AS visitors,
            COUNT(DISTINCT CASE WHEN event_name = 'flow_start' AND flow_id <> '' THEN flow_id END) AS starts,
            COUNT(DISTINCT CASE WHEN event_name = 'result_view' AND flow_id <> '' THEN flow_id END) AS results
        FROM usage_event
        WHERE created_at >= CURDATE() - INTERVAL 29 DAY
        GROUP BY device
        HAVING visitors > 0 OR starts > 0
        ORDER BY visitors DESC, starts DESC
    ";
    $devices = array_map(static fn(array $row): array => add_conversion(int_fields($row, ['visitors', 'starts', 'results'])), $pdo->query($deviceSql)->fetchAll());

    $stepSql = "
        SELECT step,
            COUNT(DISTINCT CASE WHEN event_name = 'step_view' AND flow_id <> '' THEN flow_id END) AS viewed_flows,
            COUNT(DISTINCT CASE WHEN event_name = 'wizard_next' AND flow_id <> '' THEN flow_id END) AS next_flows,
            SUM(event_name = 'wizard_next') AS next_attempts
        FROM usage_event
        WHERE created_at >= CURDATE() - INTERVAL 29 DAY
          AND step <> ''
        GROUP BY step
        HAVING viewed_flows > 0 OR next_flows > 0
    ";
    $stepFriction = array_map(static fn(array $row): array => int_fields($row, ['viewed_flows', 'next_flows', 'next_attempts']), $pdo->query($stepSql)->fetchAll());

    $funnelSql = "
        SELECT feature,
            COUNT(DISTINCT CASE WHEN event_name = 'flow_start' AND flow_id <> '' THEN flow_id END) AS starts,
            COUNT(DISTINCT CASE WHEN event_name = 'step_view' AND step = 'identity' AND flow_id <> '' THEN flow_id END) AS identity,
            COUNT(DISTINCT CASE WHEN event_name = 'step_view' AND step = 'status' AND flow_id <> '' THEN flow_id END) AS status,
            COUNT(DISTINCT CASE WHEN event_name = 'step_view' AND step = 'plan' AND flow_id <> '' THEN flow_id END) AS plan,
            COUNT(DISTINCT CASE WHEN event_name = 'step_view' AND step = 'amount' AND flow_id <> '' THEN flow_id END) AS amount,
            COUNT(DISTINCT CASE WHEN event_name = 'step_view' AND step = 'local' AND flow_id <> '' THEN flow_id END) AS local,
            COUNT(DISTINCT CASE WHEN event_name = 'result_view' AND flow_id <> '' THEN flow_id END) AS results,
            COUNT(DISTINCT CASE WHEN event_name = 'client_error' AND flow_id <> '' THEN flow_id END) AS error_flows
        FROM usage_event
        WHERE created_at >= CURDATE() - INTERVAL 29 DAY
          AND feature <> ''
        GROUP BY feature
        HAVING starts > 0
        ORDER BY starts DESC
    ";
    $funnels = array_map(static fn(array $row): array => add_conversion(int_fields($row, [
        'starts', 'identity', 'status', 'plan', 'amount', 'local', 'results', 'error_flows',
    ])), $pdo->query($funnelSql)->fetchAll());

    $feedbackSql = "
        SELECT content, created_at
        FROM feedback
        ORDER BY id DESC
        LIMIT 20
    ";
    $feedback = $pdo->query($feedbackSql)->fetchAll();

    return [
        'analytics_version' => 'a2',
        'today' => $today,
        'total' => $total,
        'trend' => $trend,
        'sources' => $sources,
        'devices' => $devices,
        'step_friction' => $stepFriction,
        'funnels' => $funnels,
        'feedback' => $feedback,
        'generated_at' => date('Y-m-d H:i:s'),
    ];
}

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if ($method === 'POST') {
    $input = json_decode((string)file_get_contents('php://input'), true);
    $action = (string)($input['action'] ?? '');

    if ($action === 'login') {
        $password = (string)($input['password'] ?? '');
        if (!hash_equals($adminPassword, $password)) {
            respond(['ok' => false, 'error' => 'unauthorized'], 401);
        }
        setcookie(ADMIN_COOKIE, admin_token($adminPassword), admin_cookie_options(time() + 86400 * 14));
        respond(['ok' => true, 'dashboard' => dashboard_data($pdo)]);
    }

    if ($action === 'logout') {
        setcookie(ADMIN_COOKIE, '', admin_cookie_options(time() - 3600));
        respond(['ok' => true]);
    }

    respond(['ok' => false, 'error' => 'invalid_action'], 400);
}

if ($method !== 'GET') {
    respond(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

if (!admin_authorized($adminPassword)) {
    respond(['ok' => false, 'error' => 'unauthorized'], 401);
}

if ((string)($_GET['action'] ?? '') === 'diagnostics') {
    try {
        respond(diagnostics_data($pdo));
    } catch (Throwable $error) {
        respond(['ok' => false, 'error' => 'diagnostics_query_failed'], 500);
    }
}

respond(['ok' => true, 'dashboard' => dashboard_data($pdo)]);
