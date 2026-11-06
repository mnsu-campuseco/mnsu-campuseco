<?php
/**
 * MNSU-CampusEco — campus destinations.
 *
 *   GET api/destinations.php
 *
 * The check-in form's dropdown is built from this rather than hard-coded in the
 * HTML, so adding a building is a database row and not a code change. This is
 * what normalising the destination out of the packages table buys.
 */
declare(strict_types=1);
require __DIR__ . '/db.php';

allow('GET');

$rows = db()->query('SELECT destination_id, name FROM destinations ORDER BY name')->fetchAll();

ok([
    'destinations' => array_map(
        static fn (array $d): array => ['id' => (int) $d['destination_id'], 'name' => $d['name']],
        $rows
    ),
]);
