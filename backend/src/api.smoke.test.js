import test from 'node:test';
import assert from 'node:assert/strict';

const base = process.env.TEST_API_BASE_URL;
const configured = base && process.env.TEST_ADMIN_EMAIL && process.env.TEST_ADMIN_PASSWORD;

test('API administrativa y conflicto de reserva', { skip: !configured }, async () => {
  const startsAt = process.env.TEST_APPOINTMENT_STARTS_AT || '2031-01-06T18:00:00.000Z';
  const invalid = await fetch(`${base}/api/appointments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doctorId: 1, patientName: 'x', patientEmail: 'invalid', startsAt: 'not-a-date' }) });
  assert.equal(invalid.status, 400);

  const unauthenticated = await fetch(`${base}/api/admin/appointments`);
  assert.equal(unauthenticated.status, 401);

  const login = await fetch(`${base}/api/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_ADMIN_PASSWORD }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie')?.split(';', 1)[0];
  assert.ok(cookie);

  let createdId;
  try {
    const payload = { doctorId: 1, patientName: 'MediTurno API Test', patientEmail: `api-test-${Date.now()}@example.test`, startsAt };
    const first = await fetch(`${base}/api/appointments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    assert.equal(first.status, 201);
    createdId = (await first.json()).id;
    const duplicate = await fetch(`${base}/api/appointments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, patientEmail: `api-duplicate-${Date.now()}@example.test` }) });
    assert.equal(duplicate.status, 409);
  } finally {
    if (createdId) {
      const cancelled = await fetch(`${base}/api/admin/appointments/${createdId}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ status: 'cancelled' }) });
      assert.equal(cancelled.status, 200);
    }
  }
});
