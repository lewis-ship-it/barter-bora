<?php
require_once '../config/supabase.php';
header('Content-Type: application/json');

$result = test_supabase_connection();
echo json_encode($result, JSON_PRETTY_PRINT);
?>
