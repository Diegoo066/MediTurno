USE mediturno;

-- No elimina médicos ni reservas. Los horarios iniciales son configurables y sirven
-- como punto de partida para los médicos existentes (lunes a viernes, 08:00-17:00).
CREATE TABLE IF NOT EXISTS doctor_availability (
  id INT AUTO_INCREMENT PRIMARY KEY,
  doctor_id INT NOT NULL,
  weekday TINYINT UNSIGNED NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'America/Lima',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY uq_doctor_availability_window (doctor_id, weekday, start_time, end_time),
  CONSTRAINT fk_availability_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(id),
  CONSTRAINT chk_availability_weekday CHECK (weekday BETWEEN 0 AND 6),
  CONSTRAINT chk_availability_order CHECK (start_time < end_time)
);

INSERT IGNORE INTO doctor_availability (doctor_id, weekday, start_time, end_time, timezone, active)
SELECT d.id, weekdays.weekday, '08:00:00', '17:00:00', 'America/Lima', TRUE
FROM doctors d
JOIN (
  SELECT 0 AS weekday UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL
  SELECT 3 UNION ALL SELECT 4
) weekdays;

-- slot_key permite bloquear una franja activa con una restricción única.
-- Las citas canceladas conservan su fila histórica y dejan slot_key en NULL.
ALTER TABLE appointments ADD COLUMN slot_key VARCHAR(19) NULL AFTER starts_at;
UPDATE appointments
SET slot_key = DATE_FORMAT(starts_at, '%Y-%m-%d %H:%i:%s')
WHERE status IN ('scheduled', 'confirmed');
ALTER TABLE appointments ADD UNIQUE KEY uq_appointments_doctor_slot (doctor_id, slot_key);
