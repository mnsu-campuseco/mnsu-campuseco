<?php
/**
 * MNSU-CampusEco — recipient package tracking.
 *
 *   GET api/track.php?tracking=CE-20261001
 *
 * Returns the package plus its timestamped history, read from transit_events
 * rather than from a field on the package, so the timeline is a real audit trail.
 * Tracking is public by design: a recipient can look up a number without an account.
 */
declare(strict_types=1);
require __DIR__ . '/db.php';

allow('GET');

$tracking = strtoupper(trim((string) ($_GET['tracking'] ?? '')));
if ($tracking === '') {
    fail('Enter a tracking number.');
}

$stmt = db()->prepare(PACKAGE_SELECT . ' WHERE p.tracking = ?');
$stmt->execute([$tracking]);
$row = $stmt->fetch();

if ($row === false) {
    fail('No package found for that tracking number.', 404);
}

$events = db()->prepare(
    'SELECT status, note, occurred_at
       FROM transit_events
      WHERE package_id = ?
      ORDER BY occurred_at ASC, event_id ASC'
);
$events->execute([(int) $row['package_id']]);

ok([
    'package' => package_row($row),
    'history' => array_map(
        static fn (array $e): array => [
            'status' => $e['status'],
            'note'   => $e['note'],
            'at'     => $e['occurred_at'],
        ],
        $events->fetchAll()
    ),
]);
