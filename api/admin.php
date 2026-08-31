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
            SUM(first_seen >= CURDATE()) AS new_visitors,
            SUM(first_seen < CURDATE()) AS returning_visitors
        FROM (
            SELECT active.visitor_id, MIN(history.created_at) AS first_seen
            FROM (
                SELECT DISTINCT visitor_id
                FROM usage_event
                WHERE event_name = 'page_view'
                  AND created_at >= CURDATE()
                  AND visitor_id <> ''
            ) active
            JOIN usage_event history
              ON history.visitor_id = active.visitor_id
             AND history.event_name = 'page_view'
            GROUP BY active.visitor_id
        ) visitor_first_seen
    ";
    $visitorTypes = int_fields($pdo->query($visitorTypeSql)->fetch() ?: [], ['new_visitors', 'returning_visitors']);
    $today = array_merge($today, $visitorTypes);

    $trendSql = "
        SELECT
            DATE(created_at) AS day,
            COUNT(DISTINCT CASE WHEN event_name = 'page_view' THEN visitor_id END) AS visitors,
            COUNT(DISTINCT CASE WHEN event_name = 'flow_start' AND flow_id <> '' THEN flow_id END) AS started_flows,
            COUNT(DISTINCT CASE WHEN event_name = 'result_view' AND flow_id <> '' THEN flow_id END) AS result_flows,
            COUNT(DISTINCT CASE WHEN event_name = 'result_view' THEN visitor_id END) AS result_visitors,
            SUM(event_name = 'page_view') AS page_views
        FROM usage_event
        WHERE created_at >= CURDATE() - INTERVAL 6 DAY
        GROUP BY DATE(created_at)
        ORDER BY day ASC
    ";
    $trendRows = $pdo->query($trendSql)->fetchAll();
    $trendMap = [];
    foreach ($trendRows as $row) {
        $trendMap[(string)$row['day']] = [
            'day' => (string)$row['day'],
            'visitors' => (int)$row['visitors'],
            'started_flows' => (int)$row['started_flows'],
            'result_flows' => (int)$row['result_flows'],
            'result_visitors' => (int)$row['result_visitors'],
            'page_views' => (int)$row['page_views'],
        ];
    }
    $trend = [];
    for ($offset = 6; $offset >= 0; $offset -= 1) {
        $day = date('Y-m-d', strtotime("-{$offset} day"));
        $trend[] = $trendMap[$day] ?? [
            'day' => $day,
            'visitors' => 0,
            'started_flows' => 0,
            'result_flows' => 0,
            'result_visitors' => 0,
            'page_views' => 0,
        ];
    }

    $sourceSql = "
        SELECT
            CASE WHEN source = '' THEN 'unknown' ELSE source END AS source,
            COUNT(DISTINCT CASE WHEN event_name = 'page_view' THEN visitor_id END) AS visitors,
            COUNT(DISTINCT CASE WHEN event_name = 'flow_start' AND flow_id <> '' THEN flow_id END) AS starts,
            COUNT(DISTINCT CASE WHEN event_name = 'result_view' AND flow_id <> '' THEN flow_id END) AS results
        FROM usage_event
        WHERE created_at >= CURDATE() - INTERVAL 29 DAY
        GROUP BY CASE WHEN source = '' THEN 'unknown' ELSE source END
        HAVING visitors > 0 OR starts > 0
        ORDER BY visitors DESC, source ASC
    ";
    $sources = array_map(static function (array $row): array {
        return add_conversion([
            'source' => (string)$row['source'],
            'visitors' => (int)$row['visitors'],
            'starts' => (int)$row['starts'],
            'results' => (int)$row['results'],
        ]);
    }, $pdo->query($sourceSql)->fetchAll());

    $deviceSql = "
        SELECT
            CASE WHEN device = '' THEN 'unknown' ELSE device END AS device,
            COUNT(DISTINCT CASE WHEN event_name = 'page_view' THEN visitor_id END) AS visitors,
            COUNT(DISTINCT CASE WHEN event_name = 'flow_start' AND flow_id <> '' THEN flow_id END) AS starts,
            COUNT(DISTINCT CASE WHEN event_name = 'result_view' AND flow_id <> '' THEN flow_id END) AS results
        FROM usage_event
        WHERE created_at >= CURDATE() - INTERVAL 29 DAY
        GROUP BY CASE WHEN device = '' THEN 'unknown' ELSE device END
        HAVING visitors > 0 OR starts > 0
        ORDER BY visitors DESC, device ASC
    ";
    $devices = array_map(static function (array $row): array {
        return add_conversion([
            'device' => (string)$row['device'],
            'visitors' => (int)$row['visitors'],
            'starts' => (int)$row['starts'],
            'results' => (int)$row['results'],
        ]);
    }, $pdo->query($deviceSql)->fetchAll());

    $funnelSql = "
        SELECT
            flow_start_event.feature,
            COUNT(DISTINCT flow_start_event.flow_id) AS starts,
            COUNT(DISTINCT CASE WHEN flow_event.event_name = 'step_view' AND flow_event.step = 'identity' THEN flow_event.flow_id END) AS identity,
            COUNT(DISTINCT CASE WHEN flow_event.event_name = 'step_view' AND flow_event.step = 'status' THEN flow_event.flow_id END) AS status_step,
            COUNT(DISTINCT CASE WHEN flow_event.event_name = 'step_view' AND flow_event.step = 'plan' THEN flow_event.flow_id END) AS plan_step,
            COUNT(DISTINCT CASE WHEN flow_event.event_name = 'step_view' AND flow_event.step = 'amount' THEN flow_event.flow_id END) AS amount_step,
            COUNT(DISTINCT CASE WHEN flow_event.event_name = 'step_view' AND flow_event.step = 'local' THEN flow_event.flow_id END) AS local_step,
            COUNT(DISTINCT CASE WHEN flow_event.event_name = 'result_view' THEN flow_event.flow_id END) AS results,
            COUNT(DISTINCT CASE WHEN flow_event.event_name = 'client_error' THEN flow_event.flow_id END) AS error_flows
        FROM usage_event flow_start_event
        LEFT JOIN usage_event flow_event
          ON flow_event.flow_id = flow_start_event.flow_id
         AND flow_event.created_at >= CURDATE() - INTERVAL 29 DAY
        WHERE flow_start_event.event_name = 'flow_start'
          AND flow_start_event.flow_id <> ''
          AND flow_start_event.created_at >= CURDATE() - INTERVAL 29 DAY
        GROUP BY flow_start_event.feature
        ORDER BY starts DESC, flow_start_event.feature ASC
    ";
    $funnels = array_map(static function (array $row): array {
        $item = [
            'feature' => (string)$row['feature'],
            'starts' => (int)$row['starts'],
            'identity' => (int)$row['identity'],
            'status' => (int)$row['status_step'],
            'plan' => (int)$row['plan_step'],
            'amount' => (int)$row['amount_step'],
            'local' => (int)$row['local_step'],
            'results' => (int)$row['results'],
            'error_flows' => (int)$row['error_flows'],
        ];
        return add_conversion($item);
    }, $pdo->query($funnelSql)->fetchAll());

    $stepSql = "
        SELECT
            step,
            COUNT(DISTINCT CASE WHEN event_name = 'step_view' THEN flow_id END) AS viewed_flows,
            COUNT(DISTINCT CASE WHEN event_name = 'wizard_next' THEN flow_id END) AS next_flows,
            SUM(event_name = 'wizard_next') AS next_attempts
        FROM usage_event
        WHERE created_at >= CURDATE() - INTERVAL 29 DAY
          AND flow_id <> ''
          AND step <> ''
          AND event_name IN ('step_view', 'wizard_next')
        GROUP BY step
    ";
    $stepFriction = array_map(static function (array $row): array {
        return [
            'step' => (string)$row['step'],
            'viewed_flows' => (int)$row['viewed_flows'],
            'next_flows' => (int)$row['next_flows'],
            'next_attempts' => (int)$row['next_attempts'],
        ];
    }, $pdo->query($stepSql)->fetchAll());

    $feedbackSql = "
        SELECT id, content, created_at
        FROM feedback
        WHERE status = 'visible'
        ORDER BY id DESC
        LIMIT 20
    ";
    $feedback = array_map(static function (array $row): array {
        return [
            'id' => (int)$row['id'],
            'content' => (string)$row['content'],
            'created_at' => (string)$row['created_at'],
        ];
    }, $pdo->query($feedbackSql)->fetchAll());

    $totalSql = "
        SELECT
            COUNT(DISTINCT CASE WHEN event_name = 'page_view' THEN visitor_id END) AS visitors,
            SUM(event_name = 'page_view') AS page_views,
            COUNT(DISTINCT CASE WHEN event_name = 'result_view' THEN visitor_id END) AS result_visitors
        FROM usage_event
    ";
    $total = int_fields($pdo->query($totalSql)->fetch() ?: [], ['visitors', 'page_views', 'result_visitors']);

    return [
        'today' => $today,
        'trend' => $trend,
        'sources' => $sources,
        'devices' => $devices,
        'funnels' => $funnels,
        'step_friction' => $stepFriction,
        'feedback' => $feedback,
        'total' => $total,
        'analytics_version' => 'a2',
        'generated_at' => date('Y-m-d H:i:s'),
    ];
}

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if ($method === 'POST') {
    $body = request_json();
    $action = clean_string($body['action'] ?? 'login', 24);

    if ($action === 'logout') {
        setcookie(ADMIN_COOKIE, '', admin_cookie_options(time() - 3600));
        respond(['ok' => true]);
    }

    $password = (string)($body['password'] ?? '');
    if ($password === '' || !hash_equals($adminPassword, $password)) {
        usleep(350000);
        respond(['ok' => false, 'error' => 'unauthorized'], 401);
    }

    setcookie(ADMIN_COOKIE, admin_token($adminPassword), admin_cookie_options(time() + 60 * 60 * 24 * 14));
    try {
        respond(['ok' => true, 'dashboard' => dashboard_data($pdo)]);
    } catch (Throwable $error) {
        respond(['ok' => false, 'error' => 'dashboard_query_failed'], 500);
    }
}

if ($method !== 'GET') {
    respond(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

if (!admin_authorized($adminPassword)) {
    respond(['ok' => false, 'error' => 'unauthorized'], 401);
}

try {
    respond(['ok' => true, 'dashboard' => dashboard_data($pdo)]);
} catch (Throwable $error) {
    respond(['ok' => false, 'error' => 'dashboard_query_failed'], 500);
}
