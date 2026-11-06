<?php
/**
 * MNSU-CampusEco — authentication.
 *
 * Task 3.4: passwords are hashed with bcrypt via password_hash() and checked with
 * password_verify(). A plain password is never stored, never logged, and never
 * compared with ==.
 *
 *   POST ?action=register   {username, password, full_name, email, role}
 *   POST ?action=login      {username, password}
 *   POST ?action=logout
 *   GET  ?action=me
 */
declare(strict_types=1);
require __DIR__ . '/db.php';

$action = $_GET['action'] ?? 'me';

/* ---------------------------------------------------------------- */
if ($action === 'me') {
    allow('GET');
    $user = current_user();
    ok(['user' => $user]);
}

/* ---------------------------------------------------------------- */
if ($action === 'logout') {
    allow('POST');
    session_start_once();
    $_SESSION = [];
    session_destroy();
    ok();
}

/* ---------------------------------------------------------------- */
if ($action === 'register') {
    allow('POST');
    $in = input();

    $username = trim((string) ($in['username'] ?? ''));
    $password = (string) ($in['password'] ?? '');
    $fullName = trim((string) ($in['full_name'] ?? ''));
    $email    = trim((string) ($in['email'] ?? ''));
    $role     = (string) ($in['role'] ?? 'enduser');

    if (!preg_match('/^[A-Za-z0-9_.-]{3,50}$/', $username)) {
        fail('Username must be 3–50 letters, digits, dot, dash or underscore.');
    }
    if (strlen($password) < 8) {
        fail('Password must be at least 8 characters.');
    }
    if (strlen($fullName) < 2) {
        fail('Enter your full name.');
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        fail('Enter a valid email address.');
    }
    if (!in_array($role, ['operator', 'courier', 'enduser'], true)) {
        fail('Unknown role.');
    }

    $hash = password_hash($password, PASSWORD_BCRYPT);

    try {
        $stmt = db()->prepare(
            'INSERT INTO users (username, password_hash, full_name, email, role)
             VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([$username, $hash, $fullName, $email, $role]);
    } catch (PDOException $e) {
        // 23000 = integrity constraint violation = username or email already taken
        if ($e->getCode() === '23000') {
            fail('That username or email is already registered.', 409);
        }
        throw $e;
    }

    ok(['user_id' => (int) db()->lastInsertId()]);
}

/* ---------------------------------------------------------------- */
if ($action === 'login') {
    allow('POST');
    $in = input();

    $username = trim((string) ($in['username'] ?? ''));
    $password = (string) ($in['password'] ?? '');

    $stmt = db()->prepare(
        'SELECT user_id, username, password_hash, full_name, role
           FROM users WHERE username = ?'
    );
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    // password_verify() is a constant-time comparison. Returning the same message
    // for an unknown username and a wrong password avoids leaking which it was.
    if ($user === false || !password_verify($password, $user['password_hash'])) {
        fail('Invalid username or password.', 401);
    }

    session_start_once();
    session_regenerate_id(true);          // guards against session fixation
    $_SESSION['user_id']   = (int) $user['user_id'];
    $_SESSION['username']  = $user['username'];
    $_SESSION['full_name'] = $user['full_name'];
    $_SESSION['role']      = $user['role'];

    ok([
        'user' => [
            'user_id'   => (int) $user['user_id'],
            'username'  => $user['username'],
            'full_name' => $user['full_name'],
            'role'      => $user['role'],
        ],
    ]);
}

fail('Unknown action.', 404);
