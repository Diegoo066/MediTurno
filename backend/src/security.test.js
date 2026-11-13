import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoginRateLimiter } from './security.js';

test('bloquea despues del maximo de intentos y permite resetear', () => {
  const limiter = createLoginRateLimiter({ windowMs: 1000, maxFailures: 2, blockMs: 5000 });
  const key = '127.0.0.1:admin@example.test';

  assert.equal(limiter.check(key, 0).allowed, true);
  limiter.registerFailure(key, 0);
  assert.equal(limiter.check(key, 1).allowed, true);
  const blocked = limiter.registerFailure(key, 2);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0);

  limiter.reset(key);
  assert.equal(limiter.check(key, 3).allowed, true);
});

test('reinicia el contador despues de la ventana de fallos', () => {
  const limiter = createLoginRateLimiter({ windowMs: 1000, maxFailures: 2, blockMs: 5000 });
  const key = '127.0.0.1:other@example.test';
  limiter.registerFailure(key, 0);
  limiter.registerFailure(key, 2001);
  assert.equal(limiter.check(key, 2002).allowed, true);
});
