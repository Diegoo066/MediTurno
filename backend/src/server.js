import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import crypto from 'node:crypto';

const app = express();
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://127.0.0.1:5173';
const sessionMaxAgeMs = 8 * 60 * 60 * 1000;
const sessionCookie = 'mediturno_admin';
const APP_TIME_ZONE = 'America/Lima';
const SLOT_MINUTES = 30;

app.use(cors({ origin: frontendOrigin, credentials: true }));
app.use(express.json({ limit: '20kb' }));

const db = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'mediturno',
  waitForConnections: true,
  connectionLimit: 5,
  timezone: 'Z'
});

function getZonedParts(date, timeZone = APP_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
}

function localDateTimeToUtc(dateText, timeText) {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);
  const time = /^(\d{2}):(\d{2})$/.exec(timeText);
  if (!date || !time) return null;
  const desired = Date.UTC(Number(date[1]), Number(date[2]) - 1, Number(date[3]), Number(time[1]), Number(time[2]), 0);
  if (!Number.isFinite(desired)) return null;
  const actual = getZonedParts(new Date(desired));
  const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
  return new Date(desired + desired - actualAsUtc);
}

function getLocalDateTime(date) {
  const parts = getZonedParts(date);
  const pad = value => String(value).padStart(2, '0');
  const utcDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  return { ...parts, date: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`, time: `${pad(parts.hour)}:${pad(parts.minute)}`, weekday: utcDay === 0 ? 6 : utcDay - 1 };
}

function isSlotTime(time) {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  return Boolean(match) && Number(match[1]) >= 0 && Number(match[1]) < 24 && [0, 30].includes(Number(match[2]));
}

function formatSlotKey(date) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:00`;
}

function base64Url(value) { return Buffer.from(value).toString('base64url'); }
function getCookie(req, name) {
  const header = req.headers.cookie || '';
  const part = header.split(';').map(item => item.trim()).find(item => item.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : null;
}
function signSession(payload) {
  const body = base64Url(JSON.stringify(payload));
  return `${body}.${crypto.createHmac('sha256', process.env.AUTH_SECRET).update(body).digest('base64url')}`;
}
function readSession(token) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || !token) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try { const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); return payload.exp > Date.now() ? payload : null; } catch { return null; }
}
function parsePasswordHash(encoded) {
  const [algorithm, salt, derivedKey] = String(encoded || '').split('$');
  if (algorithm !== 'scrypt' || !salt || !derivedKey) return null;
  return { salt: Buffer.from(salt, 'base64url'), derivedKey: Buffer.from(derivedKey, 'base64url') };
}
async function verifyPassword(password, encoded) {
  const parsed = parsePasswordHash(encoded);
  if (!parsed || parsed.derivedKey.length === 0) return false;
  const candidate = await new Promise((resolve, reject) => crypto.scrypt(password, parsed.salt, parsed.derivedKey.length, { N: 16384, r: 8, p: 1 }, (error, key) => error ? reject(error) : resolve(key)));
  return crypto.timingSafeEqual(parsed.derivedKey, candidate);
}
function requireAdmin(req, res, next) {
  const session = readSession(getCookie(req, sessionCookie));
  if (!session || session.role !== 'admin') return res.status(401).json({ error: 'Autenticación administrativa requerida.' });
  req.admin = session; next();
}
function setSessionCookie(res, token) {
  const secure = process.env.COOKIE_SECURE === 'true' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${sessionCookie}=${encodeURIComponent(token)}; Max-Age=${sessionMaxAgeMs / 1000}; Path=/; HttpOnly; SameSite=Lax${secure}`);
}
function clearSessionCookie(res) { res.setHeader('Set-Cookie', `${sessionCookie}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`); }

app.get('/api/health', async (_req, res) => {
  try { await db.query('SELECT 1'); res.json({ status: 'ok', database: 'connected' }); }
  catch (error) { console.error('[MYSQL HEALTH]', error.code || error.message); res.status(503).json({ status: 'degraded', database: 'disconnected', code: error.code || 'DB_ERROR' }); }
});

app.get('/api/doctors', async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim().slice(0, 80);
    const match = `%${search}%`;
    const [rows] = await db.execute('SELECT id, full_name, specialty, city FROM doctors WHERE full_name LIKE ? OR specialty LIKE ? ORDER BY full_name', [match, match]);
    res.json(rows);
  } catch (error) { next(error); }
});

app.get('/api/doctors/:doctorId/availability', async (req, res, next) => {
  try {
    const doctorId = Number(req.params.doctorId);
    const dateText = String(req.query.date || '');
    if (!Number.isSafeInteger(doctorId) || doctorId < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return res.status(400).json({ error: 'Selecciona un médico y una fecha válida.' });
    const date = localDateTimeToUtc(dateText, '00:00');
    if (!date || getLocalDateTime(date).date !== dateText) return res.status(400).json({ error: 'La fecha no es válida en America/Lima.' });
    const weekday = getLocalDateTime(date).weekday;
    const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
    const [doctors] = await db.execute('SELECT id FROM doctors WHERE id=?', [doctorId]);
    if (!doctors.length) return res.status(404).json({ error: 'Médico no encontrado.' });
    const [windows] = await db.execute('SELECT start_time, end_time FROM doctor_availability WHERE doctor_id=? AND weekday=? AND active=1 ORDER BY start_time', [doctorId, weekday]);
    const [booked] = await db.execute("SELECT slot_key FROM appointments WHERE doctor_id=? AND starts_at>=? AND starts_at<? AND status IN ('scheduled', 'confirmed')", [doctorId, formatSlotKey(date), formatSlotKey(nextDate)]);
    const bookedSlots = new Set(booked.map(row => String(row.slot_key || '')));
    const slots = [];
    for (const window of windows) {
      const start = String(window.start_time).slice(0, 5);
      const end = String(window.end_time).slice(0, 5);
      let cursor = localDateTimeToUtc(dateText, start);
      const endUtc = localDateTimeToUtc(dateText, end);
      while (cursor && endUtc && cursor.getTime() + SLOT_MINUTES * 60 * 1000 <= endUtc.getTime()) {
        const slotKey = formatSlotKey(cursor);
        if (cursor.getTime() > Date.now() && !bookedSlots.has(slotKey)) slots.push({ startsAt: cursor.toISOString(), localTime: getLocalDateTime(cursor).time });
        cursor = new Date(cursor.getTime() + SLOT_MINUTES * 60 * 1000);
      }
    }
    res.json({ doctorId, date: dateText, timezone: APP_TIME_ZONE, slots });
  } catch (error) { next(error); }
});

app.post('/api/appointments', async (req, res, next) => {
  let connection;
  try {
    const { doctorId, patientName, patientEmail, startsAt } = req.body || {};
    const name = String(patientName || '').trim();
    const email = String(patientEmail || '').trim();
    const date = new Date(startsAt);
    const local = Number.isFinite(date.getTime()) ? getLocalDateTime(date) : null;
    const validLocalDate = local && localDateTimeToUtc(local.date, local.time)?.getTime() === date.getTime();
    if (!Number.isSafeInteger(doctorId) || doctorId < 1 || name.length < 3 || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 190 || !Number.isFinite(date.getTime()) || date.getTime() <= Date.now() || !validLocalDate || !isSlotTime(local.time)) return res.status(400).json({ error: 'Revisa los datos y selecciona una franja de 30 minutos futura.' });
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [doctors] = await connection.execute('SELECT id FROM doctors WHERE id=? FOR UPDATE', [doctorId]);
    if (!doctors.length) { await connection.rollback(); return res.status(404).json({ error: 'Médico no encontrado.' }); }
    const [availability] = await connection.execute("SELECT start_time, end_time FROM doctor_availability WHERE doctor_id=? AND weekday=? AND active=1 AND start_time <= ? AND end_time >= ADDTIME(?, '00:30:00') LIMIT 1", [doctorId, local.weekday, `${local.time}:00`, `${local.time}:00`]);
    if (!availability.length) { await connection.rollback(); return res.status(409).json({ error: 'Ese horario no está disponible para este médico.' }); }
    const utc = formatSlotKey(date);
    const [result] = await connection.execute('INSERT INTO appointments (doctor_id, patient_name, patient_email, starts_at, slot_key, status) VALUES (?,?,?,?,?,?)', [doctorId, name, email, utc, utc, 'scheduled']);
    await connection.commit();
    res.status(201).json({ id: result.insertId, message: 'Solicitud registrada.' });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ese horario ya fue reservado.' });
    next(error);
  } finally { connection?.release(); }
});

app.post('/api/admin/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const configuredEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (!configuredEmail || !process.env.ADMIN_PASSWORD_HASH || !process.env.AUTH_SECRET) return res.status(503).json({ error: 'El administrador no está configurado en backend/.env.' });
    const valid = email === configuredEmail && password.length > 0 && await verifyPassword(password, process.env.ADMIN_PASSWORD_HASH);
    if (!valid) return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    setSessionCookie(res, signSession({ sub: email, role: 'admin', exp: Date.now() + sessionMaxAgeMs }));
    res.json({ email, role: 'admin' });
  } catch (error) { next(error); }
});
app.post('/api/admin/logout', (_req, res) => { clearSessionCookie(res); res.status(204).end(); });
app.get('/api/admin/session', requireAdmin, (req, res) => res.json({ email: req.admin.sub, role: req.admin.role }));

app.get('/api/admin/doctors', requireAdmin, async (_req, res, next) => {
  try { const [rows] = await db.execute('SELECT id, full_name, specialty FROM doctors ORDER BY full_name'); res.json(rows); }
  catch (error) { next(error); }
});

app.get('/api/admin/doctors/:doctorId/availability', requireAdmin, async (req, res, next) => {
  try {
    const doctorId = Number(req.params.doctorId);
    if (!Number.isSafeInteger(doctorId) || doctorId < 1) return res.status(400).json({ error: 'Médico no válido.' });
    const [rows] = await db.execute('SELECT id, weekday, start_time, end_time, timezone, active FROM doctor_availability WHERE doctor_id=? ORDER BY weekday, start_time', [doctorId]);
    res.json(rows);
  } catch (error) { next(error); }
});

app.put('/api/admin/doctors/:doctorId/availability', requireAdmin, async (req, res, next) => {
  let connection;
  try {
    const doctorId = Number(req.params.doctorId);
    const slots = Array.isArray(req.body?.slots) ? req.body.slots : null;
    if (!Number.isSafeInteger(doctorId) || doctorId < 1 || !slots || slots.length > 50) return res.status(400).json({ error: 'Configuración de horarios no válida.' });
    for (const slot of slots) {
      const start = String(slot.startTime || ''); const end = String(slot.endTime || '');
      if (!Number.isInteger(slot.weekday) || slot.weekday < 0 || slot.weekday > 6 || !isSlotTime(start) || !isSlotTime(end) || start >= end) return res.status(400).json({ error: 'Cada franja debe usar bloques de 30 minutos válidos.' });
    }
    connection = await db.getConnection(); await connection.beginTransaction();
    const [doctors] = await connection.execute('SELECT id FROM doctors WHERE id=? FOR UPDATE', [doctorId]);
    if (!doctors.length) { await connection.rollback(); return res.status(404).json({ error: 'Médico no encontrado.' }); }
    await connection.execute('DELETE FROM doctor_availability WHERE doctor_id=?', [doctorId]);
    for (const slot of slots) await connection.execute('INSERT INTO doctor_availability (doctor_id, weekday, start_time, end_time, timezone, active) VALUES (?,?,?,?,?,1)', [doctorId, slot.weekday, `${slot.startTime}:00`, `${slot.endTime}:00`, APP_TIME_ZONE]);
    await connection.commit(); res.json({ doctorId, slots });
  } catch (error) { if (connection) await connection.rollback().catch(() => {}); next(error); }
  finally { connection?.release(); }
});

app.get('/api/admin/dashboard', requireAdmin, async (_req, res, next) => {
  try {
    const [rows] = await db.execute('SELECT status, COUNT(*) AS total FROM appointments GROUP BY status');
    const counts = { total: 0, scheduled: 0, confirmed: 0, cancelled: 0 };
    for (const row of rows) { const total = Number(row.total); counts[row.status] = total; counts.total += total; }
    res.json(counts);
  } catch (error) { next(error); }
});

app.get('/api/admin/appointments', requireAdmin, async (req, res, next) => {
  try {
    const clauses = []; const values = [];
    const search = String(req.query.search || '').trim().slice(0, 80); const doctorId = String(req.query.doctorId || '').trim(); const date = String(req.query.date || '').trim(); const status = String(req.query.status || '').trim();
    if (search) { clauses.push('(a.patient_name LIKE ? OR a.patient_email LIKE ?)'); values.push(`%${search}%`, `%${search}%`); }
    if (/^\d+$/.test(doctorId)) { clauses.push('a.doctor_id = ?'); values.push(Number(doctorId)); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) { clauses.push('DATE(a.starts_at) = ?'); values.push(date); }
    if (['scheduled', 'confirmed', 'cancelled'].includes(status)) { clauses.push('a.status = ?'); values.push(status); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const [rows] = await db.execute(`SELECT a.id, a.patient_name, a.patient_email, a.starts_at, a.status, d.id AS doctor_id, d.full_name AS doctor_name, d.specialty FROM appointments a INNER JOIN doctors d ON d.id = a.doctor_id ${where} ORDER BY a.starts_at DESC, a.id DESC`, values);
    res.json(rows);
  } catch (error) { next(error); }
});

app.patch('/api/admin/appointments/:id/status', requireAdmin, async (req, res, next) => {
  let connection;
  try {
    const id = Number(req.params.id); const status = String(req.body?.status || '');
    if (!Number.isSafeInteger(id) || id < 1 || !['scheduled', 'confirmed', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Estado o reserva no válidos.' });
    connection = await db.getConnection(); await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT doctor_id, starts_at FROM appointments WHERE id=? FOR UPDATE', [id]);
    if (!rows.length) { await connection.rollback(); return res.status(404).json({ error: 'Reserva no encontrada.' }); }
    const appointmentDate = rows[0].starts_at instanceof Date ? rows[0].starts_at : new Date(`${String(rows[0].starts_at).replace(' ', 'T')}Z`);
    const slotKey = status === 'cancelled' ? null : formatSlotKey(appointmentDate);
    await connection.execute('UPDATE appointments SET status=?, slot_key=? WHERE id=?', [status, slotKey, id]);
    await connection.commit(); res.json({ id, status });
  } catch (error) { if (connection) await connection.rollback().catch(() => {}); if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ese horario ya está ocupado.' }); next(error); }
  finally { connection?.release(); }
});

app.use((err, _req, res, _next) => {
  console.error('[API ERROR]', err.code || 'ERROR', err.message);
  const databaseCodes = new Set(['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'ER_NO_SUCH_TABLE', 'PROTOCOL_CONNECTION_LOST']);
  if (databaseCodes.has(err.code)) return res.status(503).json({ error: 'No se puede conectar con MySQL. Comprueba XAMPP y backend/.env.', code: err.code });
  res.status(500).json({ error: 'No se pudo procesar la solicitud. Consulta la terminal del backend.' });
});

app.listen(Number(process.env.PORT || 3001), () => console.log('MediTurno API disponible'));
