<?php
/**
 * MNSU-CampusEco — electronic delivery sign-off.
 *
 *   POST api/receipts.php   {tracking, name}
 *
 * Two rules, both now server-side:
 *   1. a package can only be signed for once it is Delivered;
 *   2. it can only be signed for once — enforced by UNIQUE on receipts.package_id,
 *      so even two simultaneous requests cannot both succeed.
 */
declare(strict_types=1);
require __DIR__ . '/db.php';

allow('POST');
$in = input();

$tracking = strtoupper(trim((string) ($in['tracking'] ?? '')));
$name     = trim((string) ($in['name'] ?? ''));

if (mb_strlen($name) < 2) {
    fail('Enter your full name.');
}
$name = mb_substr($name, 0, 100);

$stmt = db()->prepare('SELECT package_id, status FROM packages WHERE tracking = ?');
$stmt->execute([$tracking]);
$package = $stmt->fetch();

if ($package === false) {
    fail('No package found for that tracking number.', 404);
}
if ($package['status'] !== 'Delivered') {
    fail('Wait until the package is delivered before signing.', 409);
}

try {
    db()->prepare('INSERT INTO receipts (package_id, signed_name) VALUES (?, ?)')
        ->execute([(int) $package['package_id'], $name]);
} catch (PDOException $e) {
    if ($e->getCode() === '23000') {
        fail('This delivery has already been signed for.', 409);
    }
    throw $e;
}

$stmt = db()->prepare(PACKAGE_SELECT . ' WHERE p.package_id = ?');
$stmt->execute([(int) $package['package_id']]);

ok(['package' => package_row($stmt->fetch())]);
