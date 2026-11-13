export function createLoginRateLimiter({ windowMs = 15 * 60 * 1000, maxFailures = 5, blockMs = 15 * 60 * 1000 } = {}) {
  const attempts = new Map();

  function cleanup(now) {
    for (const [key, entry] of attempts) {
      if (entry.blockedUntil <= now && now - entry.firstFailure >= windowMs) attempts.delete(key);
    }
  }

  return {
    check(key, now = Date.now()) {
      cleanup(now);
      const entry = attempts.get(key);
      if (!entry || entry.blockedUntil <= now) return { allowed: true, retryAfterSeconds: 0 };
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.blockedUntil - now) / 1000)) };
    },
    registerFailure(key, now = Date.now()) {
      cleanup(now);
      const current = attempts.get(key);
      const entry = !current || now - current.firstFailure >= windowMs
        ? { firstFailure: now, failures: 0, blockedUntil: 0 }
        : current;
      entry.failures += 1;
      if (entry.failures >= maxFailures) entry.blockedUntil = now + blockMs;
      attempts.set(key, entry);
      return this.check(key, now);
    },
    reset(key) { attempts.delete(key); }
  };
}
