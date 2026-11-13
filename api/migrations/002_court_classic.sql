-- Precio base del modelo Court Classic (court-classic-01) en bases de datos ya sembradas.
-- En una instalación nueva lo inserta la semilla de bin/migrate.php; aquí solo si falta.
INSERT INTO price_rules (id, kind, target, label, amount, factor, active)
SELECT UUID(), 'base_model', 'court-classic-01', 'Court Classic — par base', 89.00, 1.000, 1
FROM DUAL
WHERE EXISTS (SELECT 1 FROM price_rules)
  AND NOT EXISTS (SELECT 1 FROM price_rules WHERE kind = 'base_model' AND target = 'court-classic-01');
