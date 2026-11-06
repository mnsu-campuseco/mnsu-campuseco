<?php
/**
 * MNSU-CampusEco — the shared tracking log.
 *
 *   GET  api/packages.php[?search=CE-2026&status=At+hub]   list packages
 *   POST api/packages.php                                  check a package in
 *
 * This is the worked example for the other endpoints: validate, use a prepared
 * statement, let the database enforce what the database can enforce, and return
 * JSON either way.
 */
declare(strict_types=1);
require __DIR__ . '/db.php';

$method = allow('GET', 'POST');

/* ------------------------------------------------------------------ *
 * GET — the tracking log, with optional search and status filter
 * ------------------------------------------------------------------ */
if ($method === 'GET') {
    $search = trim((string) ($_GET['search'] ?? ''));
    $status = (string) ($_GET['status'] ?? '');

    $sql    = PACKAGE_SELECT;
    $where  = [];
    $params = [];

    if ($search !== '') {
        // Still a bound parameter — the wildcards go in the value, not the SQL.
        $where[]  = '(p.tracking LIKE ? OR d.name LIKE ?)';
        $params[] = '%' . $search . '%';
        $params[] = '%' . $search . '%';
    }
    if ($status !== '' && in_array($status, STATUSES, true)) {
        $where[]  = 'p.status = ?';
        $params[] = $status;
    }
    if ($where !== []) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }
    $sql .= ' ORDER BY p.urgent DESC, p.created_at DESC';

    $stmt = db()->prepare($sql);
    $stmt->execute($params);

    $packages = array_map('package_row', $stmt->fetchAll());

    $totals = db()->query(
        "SELECT
            COUNT(*)                                          AS total,
            SUM(status = 'At hub')                            AS at_hub,
            SUM(status IN ('Loaded','En Route'))              AS in_transit,
            SUM(status = 'Delivered')                         AS delivered,
            SUM(urgent = 1 AND status <> 'Delivered')         AS urgent_open
         FROM packages"
    )->fetch();

    ok(['packages' => $packages, 'totals' => array_map('intval', $totals)]);
}

/* ------------------------------------------------------------------ *
 * POST — check a package in at the hub
 * ------------------------------------------------------------------ */
$user = require_user('operator');
$in   = input();

$tracking = strtoupper(trim((string) ($in['tracking'] ?? '')));
if (!preg_match('/^([A-Z0-9]{8,34}|CE-[0-9]{8})$/', $tracking)) {
    fail('Use 8–34 letters/digits or CE- followed by 8 digits.');
}

/** Numeric field inside inclusive bounds, same rule as bounded() in js/models.js. */
function bounded(mixed $value, float $min, float $max, string $label): float
{
    if ($value === null || $value === '' || !is_numeric($value)) {
        fail("$label must be between $min and $max.");
    }
    $n = (float) $value;
    if ($n < $min || $n > $max) {
        fail("$label must be between $min and $max.");
    }
    return $n;
}

$weight = bounded($in['weight'] ?? null, 0.1, 150, 'Weight');
$length = bounded($in['length'] ?? null, 0.1, 60, 'Length');
$width  = bounded($in['width']  ?? null, 0.1, 60, 'Width');
$height = bounded($in['height'] ?? null, 0.1, 60, 'Height');
$urgent = !empty($in['urgent']) ? 1 : 0;

$destination = (string) ($in['destination'] ?? '');
$stmt = db()->prepare('SELECT destination_id FROM destinations WHERE name = ?');
$stmt->execute([$destination]);
$destinationId = $stmt->fetchColumn();
if ($destinationId === false) {
    fail('Select a campus destination.');
}

$pdo = db();
try {
    $pdo->beginTransaction();

    $insert = $pdo->prepare(
        'INSERT INTO packages
            (tracking, weight, length_cm, width_cm, height_cm,
             destination_id, urgent, status, distance_km, checked_in_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $insert->execute([
        $tracking, $weight, $length, $width, $height,
        (int) $destinationId, $urgent, 'At hub', 2.00, $user['user_id'],
    ]);

    $packageId = (int) $pdo->lastInsertId();

    // Every status a package reaches becomes a row, including the first one.
    $pdo->prepare(
        'INSERT INTO transit_events (package_id, status, note) VALUES (?, ?, ?)'
    )->execute([$packageId, 'At hub', 'Received at central hub']);

    $pdo->commit();
} catch (PDOException $e) {
    $pdo->rollBack();
    // The UNIQUE index on tracking is what actually prevents duplicates now.
    if ($e->getCode() === '23000') {
        fail('That tracking number is already checked in.', 409);
    }
    throw $e;
}

$stmt = db()->prepare(PACKAGE_SELECT . ' WHERE p.package_id = ?');
$stmt->execute([$packageId]);

ok(['package' => package_row($stmt->fetch())]);
