<?php
declare(strict_types=1);

$root = dirname(__DIR__);
putenv('YANGLAO_DB_CONFIG=' . $root . '/.yanglao-db.php');
require $root . '/api/bootstrap.php';

function column_exists(PDO $pdo, string $table, string $column): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.COLUMNS '
        . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
    );
    $stmt->execute([$table, $column]);
    return (int)$stmt->fetchColumn() > 0;
}

function index_exists(PDO $pdo, string $table, string $index): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.STATISTICS '
        . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?'
    );
    $stmt->execute([$table, $index]);
    return (int)$stmt->fetchColumn() > 0;
}

$columns = [
    'flow_id' => "VARCHAR(64) NOT NULL DEFAULT '' AFTER session_id",
    'step' => "VARCHAR(48) NOT NULL DEFAULT '' AFTER feature",
    'source' => "VARCHAR(32) NOT NULL DEFAULT '' AFTER step",
    'device' => "VARCHAR(16) NOT NULL DEFAULT '' AFTER source",
];

foreach ($columns as $name => $definition) {
    if (column_exists($pdo, 'usage_event', $name)) {
        echo "column exists: {$name}\n";
        continue;
    }
    $pdo->exec("ALTER TABLE usage_event ADD COLUMN {$name} {$definition}");
    echo "added column: {$name}\n";
}

$indexes = [
    'idx_usage_flow_created' => '(flow_id, created_at)',
    'idx_usage_source_created' => '(source, created_at)',
    'idx_usage_device_created' => '(device, created_at)',
    'idx_usage_step_created' => '(step, created_at)',
];

foreach ($indexes as $name => $definition) {
    if (index_exists($pdo, 'usage_event', $name)) {
        echo "index exists: {$name}\n";
        continue;
    }
    $pdo->exec("ALTER TABLE usage_event ADD KEY {$name} {$definition}");
    echo "added index: {$name}\n";
}

echo "analytics v2 migration complete\n";
