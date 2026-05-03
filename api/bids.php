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
        // GET /api/bids.php?user_id=xxx  — returns bids involving this user
        $user_id = $_GET['user_id'] ?? null;
        if (!$user_id) { http_response_code(400); echo json_encode(['error' => 'user_id required']); exit(); }

        // Bids where user is the proposer OR the target owner
        $result = $supabase->query('bids', 'GET', null, [
            'select' => '*',
            'order'  => 'created_at.desc'
        ]);

        if ($result['status'] === 200) {
            // Filter client-side since Supabase REST OR filter needs PostgREST syntax
            $bids = array_filter($result['data'], function($b) use ($user_id) {
                return $b['proposer_id'] === $user_id || $b['target_owner_id'] === $user_id;
            });
            echo json_encode(array_values($bids));
        } else {
            http_response_code(500); echo json_encode(['error' => 'Failed to fetch bids']);
        }

    } elseif ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) { http_response_code(400); echo json_encode(['error' => 'Invalid JSON']); exit(); }

        $required = ['proposer_id', 'proposer_item_id', 'target_item_id', 'target_owner_id'];
        foreach ($required as $f) {
            if (empty($input[$f])) { http_response_code(400); echo json_encode(['error' => "Missing: $f"]); exit(); }
        }

        // Prevent bidding on own items
        if ($input['proposer_id'] === $input['target_owner_id']) {
            http_response_code(400); echo json_encode(['error' => 'Cannot bid on your own item']); exit();
        }

        $bid_data = [
            'proposer_id'      => $input['proposer_id'],
            'proposer_item_id' => $input['proposer_item_id'],
            'target_item_id'   => $input['target_item_id'],
            'target_owner_id'  => $input['target_owner_id'],
            'status'           => 'pending',
            'created_at'       => date('c')
        ];

        $result = $supabase->query('bids', 'POST', $bid_data);
        if ($result['status'] >= 200 && $result['status'] < 300) {
            $bid = $result['data'][0] ?? $result['data'];

            // Fetch proposer details for the notification message
            $proposerResult = $supabase->query('profiles', 'GET', null, ['id' => 'eq.' . $input['proposer_id']]);
            $proposer        = ($proposerResult['status'] === 200 && !empty($proposerResult['data'])) ? $proposerResult['data'][0] : null;

            // Fetch item names
            $offeredResult = $supabase->query('items', 'GET', null, ['id' => 'eq.' . $input['proposer_item_id']]);
            $offeredItem   = ($offeredResult['status'] === 200 && !empty($offeredResult['data'])) ? $offeredResult['data'][0] : null;

            $targetResult  = $supabase->query('items', 'GET', null, ['id' => 'eq.' . $input['target_item_id']]);
            $targetItem    = ($targetResult['status'] === 200 && !empty($targetResult['data'])) ? $targetResult['data'][0] : null;

            $proposerName  = $proposer ? ($proposer['username'] ?? $proposer['first_name']) : 'Someone';
            $offeredName   = $offeredItem['title'] ?? 'an item';
            $targetName    = $targetItem['title']  ?? 'your item';

            // Create notification for target owner
            $notif = [
                'user_id'    => $input['target_owner_id'],
                'type'       => 'bid_received',
                'title'      => "{$proposerName} wants to swap their \"{$offeredName}\" for your \"{$targetName}\"",
                'bid_id'     => $bid['id'],
                'read'       => false,
                'created_at' => date('c')
            ];
            $supabase->query('notifications', 'POST', $notif);

            echo json_encode(['success' => true, 'bid' => $bid]);
        } else {
            http_response_code(500); echo json_encode(['error' => 'Failed to create bid']);
        }

    } elseif ($method === 'PATCH') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || empty($input['id']) || empty($input['status'])) {
            http_response_code(400); echo json_encode(['error' => 'Missing id or status']); exit();
        }

        $bid_id    = $input['id'];
        $new_status = $input['status'];
        $updater_id = $input['updater_id'] ?? null;

        if (!in_array($new_status, ['accepted', 'rejected', 'cancelled'])) {
            http_response_code(400); echo json_encode(['error' => 'Invalid status']); exit();
        }

        // Fetch the bid first to verify ownership and get item IDs
        $bidResult = $supabase->query('bids', 'GET', null, ['id' => 'eq.' . $bid_id]);
        if ($bidResult['status'] !== 200 || empty($bidResult['data'])) {
            http_response_code(404); echo json_encode(['error' => 'Bid not found']); exit();
        }
        $bid = $bidResult['data'][0];

        // Security: only target_owner can accept/reject; only proposer can cancel
        if ($new_status === 'cancelled' && $bid['proposer_id'] !== $updater_id) {
            http_response_code(403); echo json_encode(['error' => 'Only the proposer can cancel']); exit();
        }
        if (in_array($new_status, ['accepted', 'rejected']) && $bid['target_owner_id'] !== $updater_id) {
            http_response_code(403); echo json_encode(['error' => 'Only the item owner can accept/reject']); exit();
        }

        // Update bid status
        $updateResult = $supabase->query('bids', 'PATCH',
            ['status' => $new_status, 'updated_at' => date('c')],
            ['id' => 'eq.' . $bid_id]
        );
        if ($updateResult['status'] < 200 || $updateResult['status'] >= 300) {
            http_response_code(500); echo json_encode(['error' => 'Failed to update bid']); exit();
        }

        if ($new_status === 'accepted') {
            // Mark both items as unavailable
            $supabase->query('items', 'PATCH', ['status' => 'unavailable', 'updated_at' => date('c')], ['id' => 'eq.' . $bid['proposer_item_id']]);
            $supabase->query('items', 'PATCH', ['status' => 'unavailable', 'updated_at' => date('c')], ['id' => 'eq.' . $bid['target_item_id']]);

            // Create transaction record
            $transaction = [
                'bid_id'        => $bid_id,
                'user1_id'      => $bid['proposer_id'],
                'user1_item_id' => $bid['proposer_item_id'],
                'user2_id'      => $bid['target_owner_id'],
                'user2_item_id' => $bid['target_item_id'],
                'created_at'    => date('c')
            ];
            $supabase->query('transactions', 'POST', $transaction);

            // Notify proposer their bid was accepted
            $notif = [
                'user_id'    => $bid['proposer_id'],
                'type'       => 'bid_accepted',
                'title'      => 'Your swap proposal was accepted! Contact details are now available.',
                'bid_id'     => $bid_id,
                'read'       => false,
                'created_at' => date('c')
            ];
            $supabase->query('notifications', 'POST', $notif);

        } elseif ($new_status === 'rejected') {
            // Notify proposer their bid was rejected
            $notif = [
                'user_id'    => $bid['proposer_id'],
                'type'       => 'bid_rejected',
                'title'      => 'Your swap proposal was declined.',
                'bid_id'     => $bid_id,
                'read'       => false,
                'created_at' => date('c')
            ];
            $supabase->query('notifications', 'POST', $notif);
        }

        echo json_encode(['success' => true, 'status' => $new_status]);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>