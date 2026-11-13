CREATE DATABASE IF NOT EXISTS mediturno CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mediturno;

CREATE TABLE IF NOT EXISTS doctors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  specialty VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  doctor_id INT NOT NULL,
  patient_name VARCHAR(120) NOT NULL,
  patient_email VARCHAR(190) NOT NULL,
  starts_at DATETIME NOT NULL,
  status ENUM('scheduled','confirmed','cancelled') NOT NULL DEFAULT 'scheduled',
  slot_key VARCHAR(19) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_appointments_doctor_time (doctor_id, starts_at),
  UNIQUE KEY uq_appointments_doctor_slot (doctor_id, slot_key),
  CONSTRAINT fk_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(id)
);

CREATE TABLE IF NOT EXISTS doctor_availability (
  id INT AUTO_INCREMENT PRIMARY KEY,
  doctor_id INT NOT NULL,
  weekday TINYINT UNSIGNED NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'America/Lima',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY uq_doctor_availability_window (doctor_id, weekday, start_time, end_time),
  CONSTRAINT fk_availability_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(id)
);

INSERT INTO doctors (full_name, specialty, city)
SELECT 'Dra. Valeria Torres', 'Medicina general', 'Lima'
WHERE NOT EXISTS (SELECT 1 FROM doctors WHERE full_name='Dra. Valeria Torres');
INSERT INTO doctors (full_name, specialty, city)
SELECT 'Dr. Martín Rojas', 'Dermatología', 'Lima'
WHERE NOT EXISTS (SELECT 1 FROM doctors WHERE full_name='Dr. Martín Rojas');
INSERT INTO doctors (full_name, specialty, city)
SELECT 'Dra. Lucía Salazar', 'Pediatría', 'Lima'
WHERE NOT EXISTS (SELECT 1 FROM doctors WHERE full_name='Dra. Lucía Salazar');
