<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new Exception('Method not allowed', 405);

    require_once '../config/supabase.php';

    $input = json_decode(file_get_contents('php://input'), true);
    if (json_last_error() !== JSON_ERROR_NONE || !$input) throw new Exception('Invalid JSON data', 400);

    $required = ['email', 'password', 'username', 'first_name', 'last_name'];
    $missing = array_filter($required, fn($f) => empty($input[$f]));
    if (!empty($missing)) throw new Exception('Missing required fields: ' . implode(', ', $missing), 400);

    if (!filter_var($input['email'], FILTER_VALIDATE_EMAIL)) throw new Exception('Invalid email format', 400);
    if (strlen($input['password']) < 8) throw new Exception('Password must be at least 8 characters', 400);

    $supabase = get_supabase();
    if (!$supabase) throw new Exception('Database connection failed', 500);

    // Check duplicates
    $checkEmail = $supabase->query('profiles', 'GET', null, ['email' => 'eq.' . $input['email']]);
    if ($checkEmail['status'] === 200 && !empty($checkEmail['data'])) throw new Exception('This email is already registered.', 400);

    $checkUser = $supabase->query('profiles', 'GET', null, ['username' => 'eq.' . $input['username']]);
    if ($checkUser['status'] === 200 && !empty($checkUser['data'])) throw new Exception('That username is already taken.', 400);

    $user_data = [
        'email'         => $input['email'],
        'username'      => $input['username'],
        'first_name'    => $input['first_name'],
        'last_name'     => $input['last_name'],
        'password_hash' => hash_password($input['password'])
    ];
    if (!empty($input['phone_number'])) $user_data['phone_number'] = $input['phone_number'];
    if (!empty($input['location']))     $user_data['location']     = $input['location'];

    $result = $supabase->query('profiles', 'POST', $user_data);
    if ($result['status'] >= 200 && $result['status'] < 300) {
        http_response_code(201);
        echo json_encode(['status' => 'success', 'message' => 'Account created successfully! You can now login.']);
    } else {
        $msg = $result['data']['message'] ?? $result['data']['error'] ?? 'Failed to create account.';
        throw new Exception($msg, 500);
    }

} catch (Exception $e) {
    $code = ($e->getCode() >= 400) ? $e->getCode() : 500;
    http_response_code($code);
    echo json_encode(['error' => $e->getMessage(), 'code' => $code]);
}
?>