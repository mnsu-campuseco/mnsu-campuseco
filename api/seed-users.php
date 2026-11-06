<?php
/**
 * MNSU-CampusEco — create the three demo accounts.
 *
 * Run once from the command line after loading schema.sql and seed.sql:
 *
 *     php api/seed-users.php
 *
 * The passwords live here rather than in seed.sql because they must go through
 * password_hash(); a bcrypt hash cannot sensibly be written into a .sql file by
 * hand, and storing the plain text in the database would defeat the point.
 *
 * These are demonstration accounts for a local marking environment, not secrets.
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Run this from the command line.\n");
}

require __DIR__ . '/db.php';

$demo = [
    ['operator1', 'CampusEco2026', 'Hub Operator Demo',  'operator@mnsu.edu', 'operator'],
    ['courier1',  'CampusEco2026', 'Eco-Transit Demo',   'courier@mnsu.edu',  'courier'],
    ['student1',  'CampusEco2026', 'Campus Student Demo', 'student@mnsu.edu', 'enduser'],
];

$insert = db()->prepare(
    'INSERT INTO users (username, password_hash, full_name, email, role)
          VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash),
                             full_name     = VALUES(full_name),
                             role          = VALUES(role)'
);

foreach ($demo as [$username, $password, $fullName, $email, $role]) {
    $insert->execute([$username, password_hash($password, PASSWORD_BCRYPT), $fullName, $email, $role]);
    printf("  %-10s  %-9s  %s\n", $username, $role, $email);
}

// Link the seeded driver code to the demo courier account.
db()->prepare(
    'UPDATE couriers SET user_id = (SELECT user_id FROM users WHERE username = ?)
      WHERE courier_id = ?'
)->execute(['courier1', 'ECO-0417']);

echo "\nDone. All three sign in with the password: CampusEco2026\n";
