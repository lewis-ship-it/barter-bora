<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
header('Content-Type: application/json');

// Your actual credentials from config
$supabase_url = 'https://ywbaqtegpjiwsarbkszr.supabase.co';
$supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3YmFxdGVncGppd3NhcmJrc3pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjE0MjE1MTksImV4cCI6MjAzNjk5NzUxOX0.2BP9dUJ1g2sGp0N7QzLmQkLm2X2X2X2X2X2X2X2X2X';

// Test CURL connection
$test_url = $supabase_url . '/rest/v1/profiles?limit=1';
$headers = [
    'apikey: ' . $supabase_key,
    'Authorization: Bearer ' . $supabase_key,
];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $test_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_FAILONERROR, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Disable SSL verify for testing
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
curl_setopt($ch, CURLOPT_VERBOSE, true); // Get detailed info

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
$info = curl_getinfo($ch);
curl_close($ch);

echo json_encode([
    'test_url' => $test_url,
    'http_code' => $http_code,
    'error' => $error,
    'response' => $response,
    'curl_info' => $info
], JSON_PRETTY_PRINT);
?>
