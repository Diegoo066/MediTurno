USE mediturno;

-- Migración no destructiva: conserva todas las citas y amplía el catálogo de estados.
ALTER TABLE appointments
  MODIFY COLUMN status ENUM('scheduled', 'confirmed', 'cancelled') NOT NULL DEFAULT 'scheduled';
