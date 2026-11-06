-- MNSU-CampusEco — Phase 3 relational schema
-- Task 3.4: relational storage engine, normalised, with server-enforced business rules.
--
-- The statuses, destinations, identifier formats and numeric bounds below mirror
-- js/models.js exactly, so the Phase 2 browser rules and the Phase 3 server rules
-- cannot drift apart.
--
-- Run:  mysql -u root -p < db/schema.sql

DROP DATABASE IF EXISTS campuseco;
CREATE DATABASE campuseco CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE campuseco;

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  user_id       INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,          -- bcrypt via password_hash()
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(120) NOT NULL UNIQUE,
  role          ENUM('operator','courier','enduser') NOT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Reference data (normalised out of packages)
-- ---------------------------------------------------------------------------

CREATE TABLE destinations (
  destination_id INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(80) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE vehicles (
  cart_id  VARCHAR(20) PRIMARY KEY,             -- 'cart-01'
  route    VARCHAR(60)      NOT NULL,
  battery  TINYINT UNSIGNED NOT NULL,
  CONSTRAINT chk_battery CHECK (battery BETWEEN 0 AND 100)
) ENGINE=InnoDB;

CREATE TABLE couriers (
  courier_id VARCHAR(20) PRIMARY KEY,           -- 'ECO-0417'
  user_id    INT         NULL,
  cart_id    VARCHAR(20) NULL,
  CONSTRAINT chk_courier_id CHECK (courier_id REGEXP '^ECO-[0-9]{4}$'),
  FOREIGN KEY (user_id) REFERENCES users(user_id)   ON DELETE SET NULL,
  FOREIGN KEY (cart_id) REFERENCES vehicles(cart_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Packages and their history
-- ---------------------------------------------------------------------------

CREATE TABLE packages (
  package_id     INT AUTO_INCREMENT PRIMARY KEY,
  tracking       VARCHAR(34)  NOT NULL UNIQUE,  -- duplicate prevention lives here now
  weight         DECIMAL(6,2) NOT NULL,
  length_cm      DECIMAL(5,2) NOT NULL,
  width_cm       DECIMAL(5,2) NOT NULL,
  height_cm      DECIMAL(5,2) NOT NULL,
  destination_id INT          NOT NULL,
  urgent         TINYINT(1)   NOT NULL DEFAULT 0,
  status         ENUM('At hub','Loaded','En Route','Delivered') NOT NULL DEFAULT 'At hub',
  courier_id     VARCHAR(20)  NULL,
  cart_id        VARCHAR(20)  NULL,
  distance_km    DECIMAL(5,2) NOT NULL DEFAULT 2.00,
  recipient_id   INT          NULL,
  checked_in_by  INT          NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_tracking CHECK (tracking REGEXP '^([A-Z0-9]{8,34}|CE-[0-9]{8})$'),
  CONSTRAINT chk_weight   CHECK (weight     BETWEEN 0.1 AND 150),
  CONSTRAINT chk_length   CHECK (length_cm  BETWEEN 0.1 AND 60),
  CONSTRAINT chk_width    CHECK (width_cm   BETWEEN 0.1 AND 60),
  CONSTRAINT chk_height   CHECK (height_cm  BETWEEN 0.1 AND 60),
  CONSTRAINT chk_distance CHECK (distance_km BETWEEN 0.1 AND 20),

  FOREIGN KEY (destination_id) REFERENCES destinations(destination_id),
  FOREIGN KEY (courier_id)     REFERENCES couriers(courier_id) ON DELETE SET NULL,
  FOREIGN KEY (cart_id)        REFERENCES vehicles(cart_id)    ON DELETE SET NULL,
  FOREIGN KEY (recipient_id)   REFERENCES users(user_id)       ON DELETE SET NULL,
  FOREIGN KEY (checked_in_by)  REFERENCES users(user_id)       ON DELETE SET NULL,
  INDEX idx_status (status),
  INDEX idx_urgent_created (urgent DESC, created_at)
) ENGINE=InnoDB;

CREATE TABLE transit_events (
  event_id    INT AUTO_INCREMENT PRIMARY KEY,
  package_id  INT NOT NULL,
  status      ENUM('At hub','Loaded','En Route','Delivered') NOT NULL,
  note        VARCHAR(160) NOT NULL DEFAULT '',
  occurred_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (package_id) REFERENCES packages(package_id) ON DELETE CASCADE,
  INDEX idx_package_time (package_id, occurred_at)
) ENGINE=InnoDB;

-- UNIQUE is what enforces "one receipt per delivered package" at the database level.
CREATE TABLE receipts (
  receipt_id  INT AUTO_INCREMENT PRIMARY KEY,
  package_id  INT          NOT NULL UNIQUE,
  signed_name VARCHAR(100) NOT NULL,
  signed_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (package_id) REFERENCES packages(package_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- End-user delivery preferences
-- ---------------------------------------------------------------------------

CREATE TABLE preferences (
  user_id           INT PRIMARY KEY,
  destination_id    INT          NULL,
  location          VARCHAR(120) NOT NULL DEFAULT '',
  method            ENUM('desk','office','hub') NOT NULL DEFAULT 'desk',
  notify_hub        TINYINT(1)   NOT NULL DEFAULT 1,
  notify_transit    TINYINT(1)   NOT NULL DEFAULT 1,
  notify_delivered  TINYINT(1)   NOT NULL DEFAULT 1,
  FOREIGN KEY (user_id)        REFERENCES users(user_id)             ON DELETE CASCADE,
  FOREIGN KEY (destination_id) REFERENCES destinations(destination_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Application account. The API never connects as root.
-- ---------------------------------------------------------------------------

CREATE USER IF NOT EXISTS 'campuseco_app'@'localhost' IDENTIFIED BY 'CampusEco#Phase3';
GRANT SELECT, INSERT, UPDATE, DELETE ON campuseco.* TO 'campuseco_app'@'localhost';
FLUSH PRIVILEGES;
