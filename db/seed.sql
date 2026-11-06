-- MNSU-CampusEco — Phase 3 demo data
-- Mirrors the seed() function in js/models.js so the server starts in the same
-- state the Phase 2 demo did.
--
-- Run after schema.sql:  mysql -u root -p campuseco < db/seed.sql
-- Demo user accounts are created separately by api/seed-users.php, because their
-- passwords must be hashed by PHP's password_hash() rather than written in by hand.

USE campuseco;

-- The destination names contain em-dashes. Without this line the mysql client
-- on Windows hands the file's bytes to the server tagged as the console code
-- page, and every em-dash is stored double-encoded as "ÔÇö". Declaring the
-- connection charset here fixes it whatever client loads the file.
SET NAMES utf8mb4;

-- DELETE rather than TRUNCATE so the campuseco_app account can reload this file;
-- TRUNCATE needs the DROP privilege, which the application user does not have.
SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM receipts;
DELETE FROM transit_events;
DELETE FROM packages;
DELETE FROM couriers;
DELETE FROM vehicles;
DELETE FROM destinations;
SET FOREIGN_KEY_CHECKS = 1;

-- Campus destinations — the six from js/models.js
INSERT INTO destinations (name) VALUES
  ('Julia Sears Hall — Array A'),
  ('Preska Residence Community — Array A'),
  ('McElroy Residence Community — Array B'),
  ('Centennial Student Union — Array A'),
  ('Memorial Library — Array A'),
  ('Trafton Science Center — Array B');

-- Electric cart fleet. cart-03 sits below the 20% claim threshold on purpose,
-- so the battery rule can be demonstrated live.
INSERT INTO vehicles (cart_id, route, battery) VALUES
  ('cart-01', 'North loop',      88),
  ('cart-02', 'South loop',      64),
  ('cart-03', 'Residence halls', 19);

INSERT INTO couriers (courier_id, cart_id) VALUES
  ('ECO-0417', 'cart-02');

-- Three demo packages at three different stages of the journey.
INSERT INTO packages
  (tracking, weight, length_cm, width_cm, height_cm, destination_id, urgent,
   status, courier_id, cart_id, distance_km, created_at)
VALUES
  ('CE-20261001', 4.2, 12, 8, 6,
   (SELECT destination_id FROM destinations WHERE name = 'Julia Sears Hall — Array A'),
   1, 'En Route',  'ECO-0417', 'cart-02', 2.00, NOW() - INTERVAL 3 HOUR),

  ('CE-20261002', 4.2, 12, 8, 6,
   (SELECT destination_id FROM destinations WHERE name = 'Memorial Library — Array A'),
   0, 'Delivered', 'ECO-0417', 'cart-02', 2.00, NOW() - INTERVAL 5 HOUR),

  ('CE-20261003', 4.2, 12, 8, 6,
   (SELECT destination_id FROM destinations WHERE name = 'Centennial Student Union — Array A'),
   0, 'At hub',    NULL,       NULL,      2.00, NOW() - INTERVAL 1 HOUR);

-- Transit history. Every status change a package has been through is a row here,
-- which is what the end-user tracking timeline reads.
INSERT INTO transit_events (package_id, status, note, occurred_at)
SELECT p.package_id, 'At hub', 'Received at central hub', p.created_at
FROM packages p;

INSERT INTO transit_events (package_id, status, note, occurred_at)
SELECT p.package_id, 'At hub', 'Claimed by ECO-0417 · cart-02', p.created_at + INTERVAL 20 MINUTE
FROM packages p WHERE p.courier_id IS NOT NULL;

INSERT INTO transit_events (package_id, status, note, occurred_at)
SELECT p.package_id, 'Loaded', 'Loaded onto cart-02', p.created_at + INTERVAL 35 MINUTE
FROM packages p WHERE p.status IN ('Loaded','En Route','Delivered');

INSERT INTO transit_events (package_id, status, note, occurred_at)
SELECT p.package_id, 'En Route', 'Departed the hub', p.created_at + INTERVAL 50 MINUTE
FROM packages p WHERE p.status IN ('En Route','Delivered');

INSERT INTO transit_events (package_id, status, note, occurred_at)
SELECT p.package_id, 'Delivered', 'Delivered to the destination array', p.created_at + INTERVAL 75 MINUTE
FROM packages p WHERE p.status = 'Delivered';

SELECT
  (SELECT COUNT(*) FROM destinations)    AS destinations,
  (SELECT COUNT(*) FROM vehicles)        AS vehicles,
  (SELECT COUNT(*) FROM couriers)        AS couriers,
  (SELECT COUNT(*) FROM packages)        AS packages,
  (SELECT COUNT(*) FROM transit_events)  AS transit_events;
