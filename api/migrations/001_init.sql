-- SneakerLab 3D — esquema inicial para MySQL 8 / MariaDB 10.6+ (hosting compartido).
-- Equivalente al esquema PostgreSQL anterior: jsonb → JSON, enums → ENUM, numeric → DECIMAL,
-- timestamptz → DATETIME(3) en UTC (la conexión fija time_zone = '+00:00').

CREATE TABLE users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(200) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(120) NOT NULL,
  role ENUM('customer','admin') NOT NULL DEFAULT 'customer',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY users_email_idx (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE assets (
  id CHAR(36) NOT NULL PRIMARY KEY,
  owner_id CHAR(36) NULL,
  storage_key VARCHAR(255) NOT NULL,
  mime VARCHAR(60) NOT NULL,
  bytes INT NOT NULL,
  width INT NOT NULL,
  height INT NOT NULL,
  sha256 CHAR(64) NULL,
  kind VARCHAR(30) NOT NULL DEFAULT 'uploaded',
  confirmed TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY assets_storage_key_idx (storage_key),
  CONSTRAINT assets_owner_fk FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE designs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  model_id VARCHAR(60) NOT NULL,
  document JSON NOT NULL,
  thumbnail_url VARCHAR(2000) NULL,
  share_token VARCHAR(40) NULL,
  is_public TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY designs_owner_idx (owner_id),
  UNIQUE KEY designs_share_idx (share_token),
  CONSTRAINT designs_owner_fk FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE price_rules (
  id CHAR(36) NOT NULL PRIMARY KEY,
  kind ENUM('base_model','per_zone','per_image','per_text','per_pattern','material_factor','finish','service','complexity') NOT NULL,
  target VARCHAR(60) NULL,
  label VARCHAR(120) NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  factor DECIMAL(6,3) NOT NULL DEFAULT 1,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY price_rules_kind_idx (kind, target)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE quotes (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NULL,
  design_id CHAR(36) NULL,
  model_id VARCHAR(60) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  base_price DECIMAL(10,2) NOT NULL,
  customization DECIMAL(10,2) NOT NULL,
  extras DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  breakdown JSON NOT NULL,
  document_hash CHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT quotes_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT quotes_design_fk FOREIGN KEY (design_id) REFERENCES designs (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE orders (
  id CHAR(36) NOT NULL PRIMARY KEY,
  number INT NOT NULL,
  user_id CHAR(36) NOT NULL,
  design_id CHAR(36) NULL,
  quote_id CHAR(36) NULL,
  document_snapshot JSON NOT NULL,
  price_snapshot JSON NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  status ENUM('pending','in_review','approved','in_production','finished','delivered','cancelled') NOT NULL DEFAULT 'pending',
  size VARCHAR(20) NULL,
  notes TEXT NULL,
  shipping JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY orders_number_idx (number),
  KEY orders_user_idx (user_id),
  KEY orders_status_idx (status),
  CONSTRAINT orders_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT orders_design_fk FOREIGN KEY (design_id) REFERENCES designs (id) ON DELETE SET NULL,
  CONSTRAINT orders_quote_fk FOREIGN KEY (quote_id) REFERENCES quotes (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_status_history (
  seq BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  id CHAR(36) NOT NULL,
  order_id CHAR(36) NOT NULL,
  from_status ENUM('pending','in_review','approved','in_production','finished','delivered','cancelled') NULL,
  to_status ENUM('pending','in_review','approved','in_production','finished','delivered','cancelled') NOT NULL,
  by_user_id CHAR(36) NULL,
  note VARCHAR(1000) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY order_status_history_id_idx (id),
  KEY order_status_history_order_idx (order_id),
  CONSTRAINT osh_order_fk FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT osh_user_fk FOREIGN KEY (by_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE design_presets (
  id VARCHAR(120) NOT NULL PRIMARY KEY,
  author_id CHAR(36) NULL,
  name VARCHAR(60) NOT NULL,
  category VARCHAR(60) NOT NULL,
  status ENUM('published','draft','pending-assets') NOT NULL DEFAULT 'draft',
  badge VARCHAR(20) NULL,
  preset JSON NOT NULL,
  published_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY design_presets_status_idx (status, category),
  CONSTRAINT design_presets_author_fk FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_favorites (
  user_id CHAR(36) NOT NULL,
  preset_id VARCHAR(120) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, preset_id),
  CONSTRAINT user_favorites_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_provider_config (
  id CHAR(36) NOT NULL PRIMARY KEY,
  provider VARCHAR(60) NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  api_key_env VARCHAR(120) NULL,
  settings JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
