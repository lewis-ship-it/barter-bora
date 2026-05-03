<?php
require_once '../config/supabase.php';
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || empty($input['email']) || empty($input['password'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Email and password are required']);
    exit;
}

$supabase = get_supabase();
if (!$supabase) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

$result = $supabase->query('profiles', 'GET', null, ['email' => 'eq.' . $input['email']]);

if ($result['status'] !== 200 || empty($result['data'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid email or password']);
    exit;
}

$user = $result['data'][0];

if (!verify_password($input['password'], $user['password_hash'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid email or password']);
    exit;
}

// Generate a session token and store it in the profile row
$token = bin2hex(random_bytes(32));
$supabase->query('profiles', 'PATCH', ['auth_token' => $token], ['id' => 'eq.' . $user['id']]);

echo json_encode([
    'access_token' => $token,
    'token_type'   => 'bearer',
    'user' => [
        'id'           => $user['id'],
        'email'        => $user['email'],
        'username'     => $user['username'],
        'first_name'   => $user['first_name'],
        'last_name'    => $user['last_name'],
        'phone_number' => $user['phone_number'] ?? null,
        'location'     => $user['location'] ?? null
    ]
]);
?>