<?php
// Query-only acquisition module; no connection, auth, writes or output.
function landing_acquisition_data(PDO $pdo): array
{
    $version = DIAGNOSTICS_APP_VERSION;
    $slugs = [
        'flexible-employment-pension' => '/guides/flexible-employment-pension.html',
        'minimum-pension-years' => '/guides/minimum-pension-years.html',
        'retirement-age' => '/tools/retirement-age.html',
    ];
    $pages = [];
    $pageStmt = $pdo->prepare(
        "SELECT
            COUNT(DISTINCT CASE WHEN event_name = 'page_view' AND session_id <> '' THEN session_id END) AS visits,
            COUNT(DISTINCT CASE WHEN event_name = 'landing_cta_click' AND session_id <> '' THEN session_id END) AS cta_sessions,
            SUM(event_name = 'landing_cta_click') AS cta_clicks
         FROM usage_event
         WHERE app_version = ?
           AND page = ?
           AND created_at >= CURDATE() - INTERVAL 29 DAY
           AND event_name IN ('page_view','landing_cta_click')"
    );
    $flowStmt = $pdo->prepare(
        "SELECT
            COUNT(DISTINCT entry.flow_id) AS started_flows,
            COUNT(DISTINCT CASE WHEN result_event.id IS NOT NULL THEN entry.flow_id END) AS result_flows
         FROM usage_event entry
         LEFT JOIN usage_event result_event ON result_event.flow_id = entry.flow_id
            AND result_event.app_version = ?
            AND result_event.event_name = 'result_view'
            AND result_event.created_at >= entry.created_at
         WHERE entry.app_version = ?
           AND entry.step = ?
           AND entry.event_name = 'landing_flow_start'
           AND entry.created_at >= CURDATE() - INTERVAL 29 DAY
           AND entry.flow_id <> ''"
    );
    foreach ($slugs as $slug => $page) {
        $pageStmt->execute([$version, $page]);
        $counts = $pageStmt->fetch() ?: [];
        $flowStmt->execute([$version, $version, $slug]);
        $flows = $flowStmt->fetch() ?: [];
        $visits = (int)($counts['visits'] ?? 0);
        $ctas = (int)($counts['cta_sessions'] ?? 0);
        $starts = (int)($flows['started_flows'] ?? 0);
        $results = (int)($flows['result_flows'] ?? 0);
        $pages[] = [
            'slug' => $slug,
            'page' => $page,
            'visits' => $visits,
            'cta_sessions' => $ctas,
            'cta_clicks' => (int)($counts['cta_clicks'] ?? 0),
            'started_flows' => $starts,
            'result_flows' => $results,
            'cta_rate' => $visits > 0 ? round($ctas * 100 / $visits, 1) : 0.0,
            'flow_result_rate' => $starts > 0 ? round($results * 100 / $starts, 1) : 0.0,
        ];
    }
    return ['app_version' => $version, 'period_days' => 30, 'pages' => $pages];
}

function safe_landing_acquisition_data(PDO $pdo): array
{
    try {
        return landing_acquisition_data($pdo);
    } catch (Throwable $error) {
        // Acquisition statistics must never take down admin login or legacy dashboards.
        return [
            'app_version' => DIAGNOSTICS_APP_VERSION,
            'period_days' => 30,
            'pages' => [],
            'unavailable' => true,
        ];
    }
}

