<?php
// Simple PHP front controller serving index.html while preventing access to .git directory.
// Also sets basic security headers.

$requested = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Block .git or other hidden paths
if (preg_match('~/(?:\\.|%2e)git~i', $requested)) {
    http_response_code(403);
    header('Content-Type: text/plain');
    echo 'Access denied.';
    exit;
}

// Serve index.html for root or any non-file SPA style route
$root = __DIR__;
$indexFile = $root . '/index.html';
$filePath = realpath($root . $requested);

// Portable starts-with check for older PHP versions (<8)
function starts_with_root($path, $root) {
    return $path !== false && substr($path, 0, strlen($root)) === $root;
}

if ($filePath && is_file($filePath) && starts_with_root($filePath, $root)) {
    // Serve existing file
    $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
    $mime = [
        'html' => 'text/html; charset=utf-8',
        'js'   => 'application/javascript; charset=utf-8',
        'css'  => 'text/css; charset=utf-8',
        'json' => 'application/json; charset=utf-8',
        'png'  => 'image/png',
        'jpg'  => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'svg'  => 'image/svg+xml',
        'ico'  => 'image/x-icon',
        'txt'  => 'text/plain; charset=utf-8',
    ][$ext] ?? 'application/octet-stream';
    header("Content-Type: $mime");
    readfile($filePath);
    exit;
}

// Default: serve index.html
if (is_file($indexFile)) {
    header('Content-Type: text/html; charset=utf-8');
    readfile($indexFile);
    exit;
}

http_response_code(404);
header('Content-Type: text/plain');
print 'Not found';
