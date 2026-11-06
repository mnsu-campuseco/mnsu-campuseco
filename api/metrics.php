<?php
/**
 * MNSU-CampusEco — carbon reduction metrics.
 *
 *   GET api/metrics.php[?tracking=CE-20261001]
 *
 * Avoided emissions are the delivered distance multiplied by 0.20 kg of CO2 per
 * km — the same illustrative figure Phase 2 used. It is computed from the
 * packages table rather than kept as a running total, so it cannot drift.
 */
declare(strict_types=1);
require __DIR__ . '/db.php';

allow('GET');

$row = db()->query(
    "SELECT COUNT(*) AS deliveries, COALESCE(SUM(distance_km), 0) AS km
       FROM packages WHERE status = 'Delivered'"
)->fetch();

$deliveries = (int) $row['deliveries'];
$km         = (float) $row['km'];

$payload = [
    'deliveries' => $deliveries,
    'km'         => round($km, 2),
    'co2_kg'     => round($km * CO2_KG_PER_KM, 2),
    'rate'       => CO2_KG_PER_KM,
];

/* Optional per-package figure for the recipient's own delivery. */
$tracking = strtoupper(trim((string) ($_GET['tracking'] ?? '')));
if ($tracking !== '') {
    $stmt = db()->prepare(
        "SELECT distance_km FROM packages WHERE tracking = ? AND status = 'Delivered'"
    );
    $stmt->execute([$tracking]);
    $distance = $stmt->fetchColumn();

    $payload['package'] = $distance === false
        ? null
        : ['km' => (float) $distance, 'co2_kg' => round((float) $distance * CO2_KG_PER_KM, 2)];
}

ok($payload);
