<?php
/**
 * MNSU-CampusEco — the packages addressed to the signed-in recipient.
 *
 *   GET api/my-packages.php
 *
 * api/track.php stays public on purpose: a recipient can look up one tracking
 * number without an account, which is how most parcel tracking works and what
 * the Phase 3 report describes. This endpoint is the other half of that. It
 * answers "what is coming to me?" rather than "where is this number?", and
 * that question only has an answer for someone signed in.
 *
 * The scoping is done in the WHERE clause with the user_id taken from the
 * session, never from anything the request supplies. There is no parameter a
 * caller could change to read somebody else's packages, because the identity
 * is not part of the request at all.
 */
declare(strict_types=1);
require __DIR__ . '/db.php';

allow('GET');

$user = require_user('enduser');

$stmt = db()->prepare(
    PACKAGE_SELECT . ' WHERE p.recipient_id = ? ORDER BY p.urgent DESC, p.created_at DESC'
);
$stmt->execute([(int) $user['user_id']]);

$packages = array_map('package_row', $stmt->fetchAll());

/* The same per-status counts the operator sees, but only over this
   recipient's own packages. */
$totals = [
    'total'      => 0,
    'at_hub'     => 0,
    'in_transit' => 0,
    'delivered'  => 0,
];

foreach ($packages as $package) {
    $totals['total']++;

    if ($package['status'] === 'Delivered') {
        $totals['delivered']++;
    } elseif ($package['status'] === 'At hub') {
        $totals['at_hub']++;
    } else {
        $totals['in_transit']++;
    }
}

ok([
    'recipient' => [
        'username'  => $user['username'],
        'full_name' => $user['full_name'],
    ],
    'packages' => $packages,
    'totals'   => $totals,
]);
