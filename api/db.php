<?php
/**
 * MNSU-CampusEco — Phase 3 data access and shared helpers.
 *
 * Task 3.4: every query in this project goes through a real prepared statement.
 * ATTR_EMULATE_PREPARES is switched off so the values are sent to MySQL
 * separately from the SQL text; with emulation left on, PDO interpolates them
 * itself and the injection protection is only apparent.
 */
declare(strict_types=1);

const DB_HOST = 'localhost';
const DB_NAME = 'campuseco';
const DB_USER = 'campuseco_app';

/** The password is read from the environment first so it is not hard-coded in a repo. */
function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $password = getenv('CAMPUSECO_DB_PASS');
    if ($password === false || $password === '') {
        $password = 'CampusEco#Phase3';   // matches db/schema.sql for local setup
    }

    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER,
        $password,
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]
    );
    return $pdo;
}

/* ------------------------------------------------------------------ *
 * JSON request and response helpers
 * ------------------------------------------------------------------ */

/** Decode a JSON request body into an array. */
function input(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/** Send a JSON response and stop. */
function respond(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function ok(array $payload = []): never
{
    respond(['ok' => true] + $payload);
}

function fail(string $message, int $status = 400): never
{
    respond(['ok' => false, 'error' => $message], $status);
}

/** Reject any method other than those listed. */
function allow(string ...$methods): string
{
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($method, $methods, true)) {
        header('Allow: ' . implode(', ', $methods));
        fail('Method not allowed.', 405);
    }
    return $method;
}

/* ------------------------------------------------------------------ *
 * Sessions and authorisation
 * ------------------------------------------------------------------ */

function session_start_once(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax']);
        session_start();
    }
}

/** The signed-in user, or null. */
function current_user(): ?array
{
    session_start_once();
    if (!isset($_SESSION['user_id'])) {
        return null;
    }
    return [
        'user_id'   => (int) $_SESSION['user_id'],
        'username'  => $_SESSION['username'] ?? '',
        'full_name' => $_SESSION['full_name'] ?? '',
        'role'      => $_SESSION['role'] ?? '',
    ];
}

/**
 * Require a signed-in user, optionally in one of the given roles.
 * 401 means "we do not know who you are"; 403 means "we do, and you may not".
 */
function require_user(string ...$roles): array
{
    $user = current_user();
    if ($user === null) {
        fail('Sign in to continue.', 401);
    }
    if ($roles !== [] && !in_array($user['role'], $roles, true)) {
        fail('Your role cannot perform this action.', 403);
    }
    return $user;
}

/* ------------------------------------------------------------------ *
 * Domain constants — kept identical to js/models.js
 * ------------------------------------------------------------------ */

const STATUSES        = ['At hub', 'Loaded', 'En Route', 'Delivered'];
const CLAIM_BATTERY   = 20;      // minimum % to claim new work
const CO2_KG_PER_KM   = 0.20;    // avoided emissions per km

/** The status that may follow $current, or null if the journey is finished. */
function next_status(string $current): ?string
{
    $i = array_search($current, STATUSES, true);
    return ($i === false || $i + 1 >= count(STATUSES)) ? null : STATUSES[$i + 1];
}

/** Shape one package row the way the front end expects it. */
function package_row(array $r): array
{
    return [
        'id'          => (int) $r['package_id'],
        'tracking'    => $r['tracking'],
        'weight'      => (float) $r['weight'],
        'dimensions'  => [(float) $r['length_cm'], (float) $r['width_cm'], (float) $r['height_cm']],
        'destination' => $r['destination'],
        'urgent'      => (bool) $r['urgent'],
        'status'      => $r['status'],
        'courier'     => $r['courier_id'],
        'cart'        => $r['cart_id'],
        'distance'    => (float) $r['distance_km'],
        'created'     => $r['created_at'],
        'receipt'     => isset($r['signed_name']) && $r['signed_name'] !== null
            ? ['name' => $r['signed_name'], 'at' => $r['signed_at']]
            : null,
    ];
}

/** The SELECT every package read shares, so the shape never drifts between endpoints. */
const PACKAGE_SELECT = '
    SELECT p.package_id, p.tracking, p.weight, p.length_cm, p.width_cm, p.height_cm,
           d.name AS destination, p.urgent, p.status, p.courier_id, p.cart_id,
           p.distance_km, p.created_at, r.signed_name, r.signed_at
      FROM packages p
      JOIN destinations d ON d.destination_id = p.destination_id
      LEFT JOIN receipts r ON r.package_id = p.package_id';
