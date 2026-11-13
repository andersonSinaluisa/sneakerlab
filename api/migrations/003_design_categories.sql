-- Estilos (categorías) de las plantillas, administrables. bin/migrate.php siembra los integrados
-- (api/contracts/catalog.json) sin pisar los cambios hechos desde administración.
CREATE TABLE design_categories (
  id VARCHAR(60) NOT NULL PRIMARY KEY,
  label VARCHAR(60) NOT NULL,
  group_id VARCHAR(30) NOT NULL,
  sort INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  builtin TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY design_categories_sort_idx (active, group_id, sort)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
