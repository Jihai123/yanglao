<?php
declare(strict_types=1);

// Safe to run BEFORE deployment against the existing production database.
// READ-ONLY: SELECT / information_schema only. No migrations or fixture writes.
// No secrets, flow IDs, visitor IDs or pension inputs are printed.
if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "CLI only\n");
    exit(2);
}
$root = (string)(getenv('YANGLAO_APP_ROOT') ?: dirname(__DIR__));
$queryModule = (string)(getenv('YANGLAO_ACQ_QUERY_FILE') ?: $root . '/api/acquisition-query.php');
if (!is_file($root . '/.yanglao-db.php') || !is_file($queryModule)) {
    fwrite(STDERR, "Missing app configuration or audited query module\n");
    exit(2);
}
putenv('YANGLAO_DB_CONFIG=' . $root . '/.yanglao-db.php');
require $root . '/api/bootstrap.php';
const DIAGNOSTICS_APP_VERSION = 'v2-prod-20260929-v264';
require $queryModule;

$required = ['id','session_id','flow_id','event_name','page','step','app_version','created_at'];
$stmt = $pdo->query(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usage_event'"
);
$columns = array_column($stmt->fetchAll(), 'COLUMN_NAME');
$missing = array_diff($required, $columns);
if ($missing) {
    throw new RuntimeException('Missing production columns: ' . implode(',', $missing));
}
$pdo->exec("SET time_zone = '+08:00'");
$test = landing_acquisition_data($pdo);
if (count($test['pages']) !== 3) {
    throw new RuntimeException('Expected exactly three landing page rows');
}
foreach ($test['pages'] as $row) {
    foreach (['visits','cta_sessions','cta_clicks','started_flows','result_flows'] as $metric) {
        if (!is_int($row[$metric]) || $row[$metric] < 0) {
            throw new RuntimeException('Invalid metric ' . $metric);
        }
    }
    echo $row['slug'] . ': visits=' . $row['visits']
       . ', cta_sessions=' . $row['cta_sessions']
       . ', started_flows=' . $row['started_flows']
       . ', result_flows=' . $row['result_flows'] . "\n";
}
echo "PRODUCTION_ACQUISITION_READONLY_PASS: existing schema and actual query compatible; no data changed\n";
