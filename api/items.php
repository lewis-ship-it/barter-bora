<?php
require_once '../config/supabase.php';
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

$headers   = apache_request_headers();
$authToken = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : '';

if (empty($authToken)) { http_response_code(401); echo json_encode(['error' => 'Authentication required']); exit(); }

try {
    $supabase = get_supabase();
    if (!$supabase) throw new Exception('Database connection failed', 500);

    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $filters = ['order' => 'created_at.desc'];
        if (!empty($_GET['owner'])) $filters['ownerid'] = 'eq.' . $_GET['owner'];
        if (!empty($_GET['status'])) $filters['status'] = 'eq.' . $_GET['status'];

        $result = $supabase->query('items', 'GET', null, $filters);
        if ($result['status'] === 200) {
            echo json_encode($result['data']);
        } else {
            http_response_code(500); echo json_encode(['error' => 'Failed to fetch items']);
        }

    } elseif ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) { http_response_code(400); echo json_encode(['error' => 'Invalid JSON']); exit(); }

        $required = ['title', 'description', 'condition', 'ownerid'];
        foreach ($required as $f) {
            if (empty($input[$f])) { http_response_code(400); echo json_encode(['error' => "Missing: $f"]); exit(); }
        }

        $item_data = [
            'title'       => htmlspecialchars($input['title'], ENT_QUOTES),
            'description' => htmlspecialchars($input['description'], ENT_QUOTES),
            'condition'   => $input['condition'],
            'ownerid'     => $input['ownerid'],
            'imageurl'    => $input['imageurl'] ?? null,
            'status'      => $input['status'] ?? 'available',
            'created_at'  => date('c')
        ];

        $result = $supabase->query('items', 'POST', $item_data);
        if ($result['status'] >= 200 && $result['status'] < 300) {
            echo json_encode(['success' => true, 'item' => $result['data'][0] ?? $result['data']]);
        } else {
            http_response_code(500); echo json_encode(['error' => 'Failed to create item']);
        }

    } elseif ($method === 'PATCH') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || empty($input['id'])) { http_response_code(400); echo json_encode(['error' => 'Missing item id']); exit(); }

        $item_id = $input['id'];
        unset($input['id']);
        $input['updated_at'] = date('c');

        $result = $supabase->query('items', 'PATCH', $input, ['id' => 'eq.' . $item_id]);
        if ($result['status'] >= 200 && $result['status'] < 300) {
            echo json_encode(['success' => true]);
        } else {
            http_response_code(500); echo json_encode(['error' => 'Failed to update item']);
        }

    } elseif ($method === 'DELETE') {
        $item_id = $_GET['id'] ?? null;
        if (!$item_id) { http_response_code(400); echo json_encode(['error' => 'Missing item id']); exit(); }

        $result = $supabase->query('items', 'DELETE', null, ['id' => 'eq.' . $item_id]);
        if ($result['status'] >= 200 && $result['status'] < 300) {
            echo json_encode(['success' => true]);
        } else {
            http_response_code(500); echo json_encode(['error' => 'Failed to delete item']);
        }
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>