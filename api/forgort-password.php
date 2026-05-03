<?php
require_once '../config/supabase.php';
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization");
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || empty($input['email'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Email is required']);
    exit;
}

$email = $input['email'];

// Validate email format
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Please enter a valid email address']);
    exit;
}

$supabase = get_supabase();

// Check if email exists in database
$result = $supabase->query('profiles', 'GET', null, ['email' => 'eq.' . $email]);

if ($result['status'] !== 200) {
    // Don't reveal whether email exists or not for security
    echo json_encode(['message' => 'If this email is registered, you will receive a password reset link shortly.']);
    exit;
}

if (empty($result['data'])) {
    // Email doesn't exist, but return generic message for security
    echo json_encode(['message' => 'If this email is registered, you will receive a password reset link shortly.']);
    exit;
}

$user = $result['data'][0];

// Generate reset token (in a real app, you'd use a proper token generation method)
$reset_token = bin2hex(random_bytes(32));
$expires_at = date('Y-m-d H:i:s', strtotime('+1 hour'));

// Store reset token in database (you might want a separate table for this)
try {
    $update_data = [
        'reset_token' => $reset_token,
        'reset_token_expires' => $expires_at
    ];
    
    $update_result = $supabase->query('profiles', 'PATCH', $update_data, ['id' => 'eq.' . $user['id']]);
    
    if ($update_result['status'] >= 200 && $update_result['status'] < 300) {
        // In a real application, you would:
        // 1. Send an email with the reset link
        // 2. Use a proper email service
        // 3. Include a secure reset link
        
        // For now, we'll just return success message
        error_log("Password reset token for {$email}: {$reset_token}"); // Log for development
        
        echo json_encode(['message' => 'If this email is registered, you will receive a password reset link shortly.']);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to process reset request']);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error processing request']);
}

?>
