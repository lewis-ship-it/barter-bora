<?php
function load_env($path) {
    if (!file_exists($path)) {
        error_log("Env file not found: " . $path);
        return;
    }
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        $parts = explode('=', $line, 2);
        if (count($parts) < 2) continue;
        list($name, $value) = $parts;
        $name = trim($name);
        $value = trim($value);
        if (preg_match('/^([\'"])(.*)\\1$/', $value, $matches)) {
            $value = $matches[2];
        }
        putenv($name . "=" . $value);
        $_ENV[$name] = $value;
        $_SERVER[$name] = $value;
    }
}

load_env(__DIR__ . '/../.env');

class SupabaseClient {
    private $supabase_url;
    private $supabase_key;

    public function __construct() {
        $this->supabase_url = getenv('SUPABASE_URL');
        $this->supabase_key = getenv('SUPABASE_ANON_KEY');
        if (!$this->supabase_url || !$this->supabase_key) {
            throw new Exception("Missing Supabase credentials. Please check your .env file.");
        }
        $this->supabase_url = rtrim($this->supabase_url, '/');
    }

    /**
     * @param string $table
     * @param string $method   GET|POST|PATCH|DELETE
     * @param array|null $data  body data for POST/PATCH
     * @param array $filters    key => "operator.value"  e.g. ['id' => 'eq.123']
     *                          or for GET, also accepts ['select' => '...', 'order' => '...']
     */
    public function query($table, $method = 'GET', $data = null, $filters = []) {
        $url = $this->supabase_url . '/rest/v1/' . $table;

        if (!empty($filters)) {
            $queryParams = [];
            foreach ($filters as $key => $value) {
                // special supabase filter keys (select, order, limit, offset) go as plain params
                if (in_array($key, ['select', 'order', 'limit', 'offset'])) {
                    $queryParams[] = $key . '=' . urlencode($value);
                } else {
                    // e.g. 'id' => 'eq.abc' becomes ?id=eq.abc
                    $queryParams[] = $key . '=' . urlencode($value);
                }
            }
            $url .= '?' . implode('&', $queryParams);
        }

        $headers = [
            'apikey: ' . $this->supabase_key,
            'Authorization: Bearer ' . $this->supabase_key,
            'Content-Type: application/json',
            'Prefer: return=representation'
        ];

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_FAILONERROR, false);

        if (getenv('APP_ENV') === 'production') {
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
        } else {
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
        }

        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            if ($data) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        } elseif (in_array($method, ['PATCH', 'DELETE', 'PUT'])) {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
            if ($data) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }

        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            return ['data' => ['error' => $error], 'status' => 0];
        }

        $response_data = json_decode($response, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return ['data' => ['error' => 'Invalid JSON response'], 'status' => $http_code];
        }

        return ['data' => $response_data, 'status' => $http_code];
    }
}

function get_supabase() {
    static $supabase = null;
    if ($supabase === null) {
        try {
            $supabase = new SupabaseClient();
        } catch (Exception $e) {
            error_log("Failed to create Supabase client: " . $e->getMessage());
            return null;
        }
    }
    return $supabase;
}

function hash_password($password) {
    $password = substr($password, 0, 72);
    $hash = password_hash($password, PASSWORD_DEFAULT);
    if ($hash === false) throw new Exception("Password hashing failed");
    return $hash;
}

function verify_password($plain_password, $hashed_password) {
    $plain_password = substr($plain_password, 0, 72);
    return password_verify($plain_password, $hashed_password);
}

function get_authenticated_user($supabase, $token) {
    if (empty($token)) return null;
    $result = $supabase->query('profiles', 'GET', null, [
        'auth_token' => 'eq.' . $token
    ]);
    if ($result['status'] === 200 && !empty($result['data'])) {
        return $result['data'][0];
    }
    return null;
}

function test_supabase_connection() {
    $supabase = get_supabase();
    if (!$supabase) return ['status' => 'error', 'message' => 'Failed to initialize client'];
    $result = $supabase->query('profiles', 'GET', null, ['limit' => '1']);
    return [
        'status' => $result['status'] === 200 ? 'success' : 'error',
        'http_code' => $result['status'],
        'message' => $result['status'] === 200 ? 'Connection successful' : 'Connection failed'
    ];
}
?>