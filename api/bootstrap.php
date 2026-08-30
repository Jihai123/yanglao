<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function clean_string(mixed $value, int $maxLength): string
{
    $text = trim((string)($value ?? ''));
    if (function_exists('mb_substr')) {
        return mb_substr($text, 0, $maxLength, 'UTF-8');
    }
    return substr($text, 0, $maxLength);
}

function request_json(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') return [];
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) respond(['ok' => false, 'error' => 'invalid_json'], 400);
    return $decoded;
}

$documentRoot = rtrim((string)($_SERVER['DOCUMENT_ROOT'] ?? ''), '/');
$defaultConfig = $documentRoot !== ''
    ? dirname($documentRoot) . '/.yanglao-db.php'
    : dirname(__DIR__, 2) . '/.yanglao-db.php';
$configFile = getenv('YANGLAO_DB_CONFIG') ?: $defaultConfig;

if (!is_file($configFile)) {
    respond(['ok' => false, 'error' => 'api_not_configured'], 503);
}

$config = require $configFile;
if (!is_array($config)) respond(['ok' => false, 'error' => 'invalid_config'], 500);

try {
    $host = (string)($config['db_host'] ?? '127.0.0.1');
    $port = (int)($config['db_port'] ?? 3306);
    $name = (string)($config['db_name'] ?? '');
    $user = (string)($config['db_user'] ?? '');
    $pass = (string)($config['db_pass'] ?? '');
    $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (Throwable $error) {
    respond(['ok' => false, 'error' => 'database_unavailable'], 503);
}
