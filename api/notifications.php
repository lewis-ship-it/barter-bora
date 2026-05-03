<?php
require_once '../config/supabase.php';
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

$headers   = apache_request_headers();
$authToken = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : '';

if (empty($authToken)) { http_response_code(401); echo json_encode(['error' => 'Authentication required']); exit(); }

try {
    $supabase = get_supabase();
    $method   = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $user_id = $_GET['user_id'] ?? null;
        if (!$user_id) { http_response_code(400); echo json_encode(['error' => 'user_id required']); exit(); }

        $result = $supabase->query('notifications', 'GET', null, [
            'user_id' => 'eq.' . $user_id,
            'order'   => 'created_at.desc'
        ]);

        echo json_encode($result['status'] === 200 ? $result['data'] : []);

    } elseif ($method === 'PATCH') {
        // Mark as read — body: { id: '...' } or { user_id: '...', mark_all: true }
        $input = json_decode(file_get_contents('php://input'), true);

        if (!empty($input['mark_all']) && !empty($input['user_id'])) {
            $supabase->query('notifications', 'PATCH',
                ['read' => true],
                ['user_id' => 'eq.' . $input['user_id'], 'read' => 'eq.false']
            );
        } elseif (!empty($input['id'])) {
            $supabase->query('notifications', 'PATCH',
                ['read' => true],
                ['id' => 'eq.' . $input['id']]
            );
        }
        echo json_encode(['success' => true]);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>