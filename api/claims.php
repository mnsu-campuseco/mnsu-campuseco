<?php
/**
 * MNSU-CampusEco — claiming a delivery.
 *
 *   POST api/claims.php   {package_id, courier_id, cart_id}
 *
 * Phase 2 enforced "cart needs at least 20% battery" and "a package can only be
 * claimed once" in the browser. Both now happen here, where the user cannot
 * reach them. The browser keeps its copy of the rule for instant feedback; this
 * is the one that decides.
 */
declare(strict_types=1);
require __DIR__ . '/db.php';

allow('POST');
$user = require_user('courier');
$in   = input();

$packageId = (int)    ($in['package_id'] ?? 0);
$courierId = strtoupper(trim((string) ($in['courier_id'] ?? '')));
$cartId    = trim((string) ($in['cart_id'] ?? ''));

if (!preg_match('/^ECO-[0-9]{4}$/', $courierId)) {
    fail('Driver ID must use ECO- followed by 4 digits.');
}

$pdo = db();
try {
    $pdo->beginTransaction();

    /* The courier must either already belong to this account, or be unclaimed —
       in which case signing in binds the driver code to the user. */
    $stmt = $pdo->prepare('SELECT user_id FROM couriers WHERE courier_id = ? FOR UPDATE');
    $stmt->execute([$courierId]);
    $courier = $stmt->fetch();

    if ($courier === false) {
        $pdo->prepare('INSERT INTO couriers (courier_id, user_id) VALUES (?, ?)')
            ->execute([$courierId, $user['user_id']]);
    } elseif ($courier['user_id'] === null) {
        $pdo->prepare('UPDATE couriers SET user_id = ? WHERE courier_id = ?')
            ->execute([$user['user_id'], $courierId]);
    } elseif ((int) $courier['user_id'] !== $user['user_id']) {
        $pdo->rollBack();
        fail('That driver ID belongs to another account.', 403);
    }

    /* Battery threshold, read under lock so two couriers cannot both pass it. */
    $stmt = $pdo->prepare('SELECT battery FROM vehicles WHERE cart_id = ? FOR UPDATE');
    $stmt->execute([$cartId]);
    $battery = $stmt->fetchColumn();

    if ($battery === false) {
        $pdo->rollBack();
        fail('Unknown cart.');
    }
    if ((int) $battery < CLAIM_BATTERY) {
        $pdo->rollBack();
        fail('Choose a cart with at least ' . CLAIM_BATTERY . '% battery.', 409);
    }

    /* The package must still be unclaimed and still at the hub. Locking the row
       is what makes two simultaneous claims resolve to one winner. */
    $stmt = $pdo->prepare(
        'SELECT status, courier_id FROM packages WHERE package_id = ? FOR UPDATE'
    );
    $stmt->execute([$packageId]);
    $package = $stmt->fetch();

    if ($package === false) {
        $pdo->rollBack();
        fail('Unknown package.', 404);
    }
    if ($package['courier_id'] !== null || $package['status'] !== 'At hub') {
        $pdo->rollBack();
        fail('This package is already assigned.', 409);
    }

    $pdo->prepare('UPDATE packages SET courier_id = ?, cart_id = ? WHERE package_id = ?')
        ->execute([$courierId, $cartId, $packageId]);

    $pdo->prepare('UPDATE couriers SET cart_id = ? WHERE courier_id = ?')
        ->execute([$cartId, $courierId]);

    $pdo->prepare('INSERT INTO transit_events (package_id, status, note) VALUES (?, ?, ?)')
        ->execute([$packageId, 'At hub', "Claimed by $courierId · $cartId"]);

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
