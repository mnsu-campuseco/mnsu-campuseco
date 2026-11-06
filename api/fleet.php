<?php
/**
 * MNSU-CampusEco — electric cart fleet.
 *
 *   GET  api/fleet.php                        list carts and their battery levels
 *   POST api/fleet.php   {cart_id, battery}   a courier reports a battery level
 *
 * Note which carts are claimable: the 20% threshold is reported here so the UI
 * can grey out a cart, but api/claims.php is what actually refuses the claim.
 */
declare(strict_types=1);
require __DIR__ . '/db.php';

$method = allow('GET', 'POST');

if ($method === 'GET') {
    $rows = db()->query(
        'SELECT v.cart_id, v.route, v.battery,
                (SELECT COUNT(*) FROM packages p
                  WHERE p.cart_id = v.cart_id AND p.status <> \'Delivered\') AS active
           FROM vehicles v
          ORDER BY v.cart_id'
    )->fetchAll();

    ok([
        'vehicles' => array_map(
            static fn (array $v): array => [
                'id'        => $v['cart_id'],
                'route'     => $v['route'],
                'battery'   => (int) $v['battery'],
                'active'    => (int) $v['active'],
                'claimable' => (int) $v['battery'] >= CLAIM_BATTERY,
            ],
            $rows
        ),
        'threshold' => CLAIM_BATTERY,
    ]);
}

/* POST — report a battery level */
require_user('courier');
$in = input();

$cartId  = trim((string) ($in['cart_id'] ?? ''));
$battery = $in['battery'] ?? null;

if (!is_numeric($battery) || (float) $battery != (int) $battery) {
    fail('Battery must be a whole percentage.');
}
$battery = (int) $battery;
if ($battery < 0 || $battery > 100) {
    fail('Battery must be between 0 and 100.');
}

$stmt = db()->prepare('UPDATE vehicles SET battery = ? WHERE cart_id = ?');
$stmt->execute([$battery, $cartId]);

if ($stmt->rowCount() === 0) {
    // Either the cart does not exist, or the value was already that number.
    $exists = db()->prepare('SELECT 1 FROM vehicles WHERE cart_id = ?');
    $exists->execute([$cartId]);
    if ($exists->fetchColumn() === false) {
        fail('Unknown cart.', 404);
    }
}

ok(['cart_id' => $cartId, 'battery' => $battery]);
