<?php
/**
 * MNSU-CampusEco — advancing a delivery through its milestones.
 *
 *   POST api/milestones.php   {package_id, courier_id, status, note?}
 *
 * Two Phase 2 rules move to the server here:
 *   1. only the assigned courier may advance a package;
 *   2. statuses run At hub → Loaded → En Route → Delivered, with no skipping.
 */
declare(strict_types=1);
require __DIR__ . '/db.php';

allow('POST');
$user = require_user('courier');
$in   = input();

$packageId = (int) ($in['package_id'] ?? 0);
$courierId = strtoupper(trim((string) ($in['courier_id'] ?? '')));
$status    = (string) ($in['status'] ?? '');
$note      = mb_substr(trim((string) ($in['note'] ?? '')), 0, 160);

if (!in_array($status, STATUSES, true)) {
    fail('Unknown transit status.');
}

$pdo = db();
try {
    $pdo->beginTransaction();

    $stmt = $pdo->prepare(
        'SELECT p.status, p.courier_id, c.user_id
           FROM packages p
           LEFT JOIN couriers c ON c.courier_id = p.courier_id
          WHERE p.package_id = ? FOR UPDATE'
    );
    $stmt->execute([$packageId]);
    $package = $stmt->fetch();

    if ($package === false) {
        $pdo->rollBack();
        fail('Unknown package.', 404);
    }

    // Ownership: the package must be assigned, to this driver code, and that
    // driver code must belong to the signed-in account.
    if ($package['courier_id'] === null
        || $package['courier_id'] !== $courierId
        || (int) ($package['user_id'] ?? 0) !== $user['user_id']) {
        $pdo->rollBack();
        fail('Only the assigned courier can update this package.', 403);
    }

    $expected = next_status($package['status']);
    if ($expected === null) {
        $pdo->rollBack();
        fail('This delivery is already complete.', 409);
    }
    if ($status !== $expected) {
        $pdo->rollBack();
        fail('Follow the sequence: Loaded → En Route → Delivered.', 409);
    }

    $pdo->prepare('UPDATE packages SET status = ? WHERE package_id = ?')
        ->execute([$status, $packageId]);

    $pdo->prepare('INSERT INTO transit_events (package_id, status, note) VALUES (?, ?, ?)')
        ->execute([$packageId, $status, $note]);

    $pdo->commit();
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $e;
}

$stmt = db()->prepare(PACKAGE_SELECT . ' WHERE p.package_id = ?');
$stmt->execute([$packageId]);

ok(['package' => package_row($stmt->fetch())]);
