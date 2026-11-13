import 'dotenv/config';
import mysql from 'mysql2/promise';

const db = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'mediturno'
});

await db.execute("ALTER TABLE appointments MODIFY COLUMN status ENUM('scheduled','confirmed','cancelled') NOT NULL DEFAULT 'scheduled'");
await db.execute(`CREATE TABLE IF NOT EXISTS doctor_availability (
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
)`);
await db.execute("INSERT IGNORE INTO doctor_availability (doctor_id, weekday, start_time, end_time, timezone, active) SELECT d.id, weekdays.weekday, '08:00:00', '17:00:00', 'America/Lima', TRUE FROM doctors d JOIN (SELECT 0 AS weekday UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4) weekdays");

const [columns] = await db.execute("SELECT COUNT(*) AS total FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='appointments' AND column_name='slot_key'");
if (!Number(columns[0].total)) await db.execute('ALTER TABLE appointments ADD COLUMN slot_key VARCHAR(19) NULL AFTER starts_at');
await db.execute("UPDATE appointments SET slot_key = DATE_FORMAT(starts_at, '%Y-%m-%d %H:%i:%s') WHERE status IN ('scheduled', 'confirmed') AND slot_key IS NULL");
const [indexes] = await db.execute("SELECT COUNT(*) AS total FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='appointments' AND index_name='uq_appointments_doctor_slot'");
if (!Number(indexes[0].total)) await db.execute('ALTER TABLE appointments ADD UNIQUE KEY uq_appointments_doctor_slot (doctor_id, slot_key)');

console.log('Migraciones aplicadas.');
await db.end();
