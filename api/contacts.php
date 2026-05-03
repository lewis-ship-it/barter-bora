<?php
require_once '../config/supabase.php';
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

$headers   = apache_request_headers();
$authToken = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : '';

if (empty($authToken)) { http_response_code(401); echo json_encode(['error' => 'Authentication required']); exit(); }

$bid_id     = $_GET['bid_id']     ?? null;
$requester  = $_GET['requester_id'] ?? null;

if (!$bid_id || !$requester) { http_response_code(400); echo json_encode(['error' => 'bid_id and requester_id required']); exit(); }

try {
    $supabase = get_supabase();

    // Fetch bid
    $bidResult = $supabase->query('bids', 'GET', null, ['id' => 'eq.' . $bid_id]);
    if ($bidResult['status'] !== 200 || empty($bidResult['data'])) {
        http_response_code(404); echo json_encode(['error' => 'Bid not found']); exit();
    }
    $bid = $bidResult['data'][0];

    // Only accepted bids, and only parties involved
    if ($bid['status'] !== 'accepted') {
        http_response_code(403); echo json_encode(['error' => 'Contact info only available for accepted swaps']); exit();
    }
    if ($bid['proposer_id'] !== $requester && $bid['target_owner_id'] !== $requester) {
        http_response_code(403); echo json_encode(['error' => 'Not authorised to view this contact info']); exit();
    }

    // Return contact info of the OTHER party
    $other_id = ($requester === $bid['proposer_id']) ? $bid['target_owner_id'] : $bid['proposer_id'];

    $profileResult = $supabase->query('profiles', 'GET', null, ['id' => 'eq.' . $other_id]);
    if ($profileResult['status'] !== 200 || empty($profileResult['data'])) {
        http_response_code(404); echo json_encode(['error' => 'Profile not found']); exit();
    }
    $profile = $profileResult['data'][0];

    echo json_encode([
        'first_name'   => $profile['first_name'],
        'last_name'    => $profile['last_name'],
        'username'     => $profile['username'],
        'email'        => $profile['email'],
        'phone_number' => $profile['phone_number'] ?? null,
        'location'     => $profile['location'] ?? null
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>