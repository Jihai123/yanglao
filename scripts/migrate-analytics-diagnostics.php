<?php
declare(strict_types=1);

$root = dirname(__DIR__);
putenv('YANGLAO_DB_CONFIG=' . $root . '/.yanglao-db.php');
require $root . '/api/bootstrap.php';

function diagnostics_column_exists(PDO $pdo, string $table, string $column): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.COLUMNS '
        . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
    );
    $stmt->execute([$table, $column]);
    return (int)$stmt->fetchColumn() > 0;
}

$columns = [
    'reason_code' => "VARCHAR(48) NOT NULL DEFAULT '' AFTER app_version",
    'error_type' => "VARCHAR(32) NOT NULL DEFAULT '' AFTER reason_code",
    'script_name' => "VARCHAR(96) NOT NULL DEFAULT '' AFTER error_type",
    'line_no' => "INT UNSIGNED NOT NULL DEFAULT 0 AFTER script_name",
    'column_no' => "INT UNSIGNED NOT NULL DEFAULT 0 AFTER line_no",
];

foreach ($columns as $name => $definition) {
    if (diagnostics_column_exists($pdo, 'usage_event', $name)) {
        echo "column exists: {$name}\n";
        continue;
    }
    $pdo->exec("ALTER TABLE usage_event ADD COLUMN {$name} {$definition}");
    echo "added column: {$name}\n";
}

echo "analytics diagnostics migration complete\n";
