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

function dashboard_data(PDO $pdo): array
{
    // TIMESTAMP values are rendered in China Standard Time for this site dashboard.
    $pdo->exec("SET time_zone = '+08:00'");

    $todaySql = "
        SELECT
            COUNT(DISTINCT CASE WHEN event_name = 'page_view' THEN visitor_id END) AS visitors,
            COUNT(DISTINCT CASE WHEN event_name = 'result_view' THEN visitor_id END) AS result_visitors,
            SUM(event_name = 'page_view') AS page_views,
            SUM(event_name = 'intent_click') AS intent_clicks,
            SUM(event_name = 'result_view') AS result_views,
            SUM(event_name = 'feedback_submit') AS feedback_submits
        FROM usage_event
        WHERE created_at >= CURDATE()
    ";
    $today = $pdo->query($todaySql)->fetch() ?: [];
    foreach (['visitors', 'result_visitors', 'page_views', 'intent_clicks', 'result_views', 'feedback_submits'] as $key) {
        $today[$key] = (int)($today[$key] ?? 0);
    }
    $today['result_conversion'] = $today['visitors'] > 0
        ? round(($today['result_visitors'] / $today['visitors']) * 100, 1)
        : 0.0;

    $trendSql = "
        SELECT
            DATE(created_at) AS day,
            COUNT(DISTINCT CASE WHEN event_name = 'page_view' THEN visitor_id END) AS visitors,
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
            'result_visitors' => 0,
            'page_views' => 0,
        ];
    }

    $featureSql = "
        SELECT feature, COUNT(*) AS clicks
        FROM usage_event
        WHERE event_name = 'intent_click'
          AND created_at >= CURDATE() - INTERVAL 29 DAY
        GROUP BY feature
        ORDER BY clicks DESC, feature ASC
        LIMIT 20
    ";
    $features = array_map(static function (array $row): array {
        return [
            'feature' => (string)$row['feature'],
            'clicks' => (int)$row['clicks'],
        ];
    }, $pdo->query($featureSql)->fetchAll());

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
    $total = $pdo->query($totalSql)->fetch() ?: [];
    $total = [
        'visitors' => (int)($total['visitors'] ?? 0),
        'page_views' => (int)($total['page_views'] ?? 0),
        'result_visitors' => (int)($total['result_visitors'] ?? 0),
    ];

    return [
        'today' => $today,
        'trend' => $trend,
        'features' => $features,
        'feedback' => $feedback,
        'total' => $total,
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
