/**
 * In-Memory Sliding Window Rate Limiter & Lockout Guard
 * Prevents 4-digit PIN brute-force attacks across all staff portals
 */

interface AttemptRecord {
  count: number;
  lockedUntil: number | null;
  firstAttemptAt: number;
}

const attemptMap = new Map<string, AttemptRecord>();

// Parameters:
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes sliding window
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout
const ARTIFICIAL_DELAY_MS = 500; // 500ms jittered delay per attempt

export async function checkRateLimit(key: string): Promise<{
  allowed: boolean;
  remainingAttempts: number;
  lockedForSeconds?: number;
}> {
  // Artificial throttle to destroy script throughput
  await new Promise((resolve) =>
    setTimeout(resolve, ARTIFICIAL_DELAY_MS + Math.floor(Math.random() * 100))
  );

  const now = Date.now();
  const record = attemptMap.get(key);

  if (!record) {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
  }

  // Check if locked
  if (record.lockedUntil && record.lockedUntil > now) {
    const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      lockedForSeconds: remainingSeconds,
    };
  }

  // Check if window has expired
  if (now - record.firstAttemptAt > WINDOW_MS) {
    attemptMap.delete(key);
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
  }

  return {
    allowed: true,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - record.count),
  };
}

export function recordFailedAttempt(key: string): {
  isLocked: boolean;
  lockedForSeconds?: number;
  remainingAttempts: number;
} {
  const now = Date.now();
  const record = attemptMap.get(key) || {
    count: 0,
    lockedUntil: null,
    firstAttemptAt: now,
  };

  record.count += 1;

  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
    attemptMap.set(key, record);
    return {
      isLocked: true,
      lockedForSeconds: Math.ceil(LOCKOUT_MS / 1000),
      remainingAttempts: 0,
    };
  }

  attemptMap.set(key, record);
  return {
    isLocked: false,
    remainingAttempts: MAX_ATTEMPTS - record.count,
  };
}

export function resetAttempts(key: string): void {
  attemptMap.delete(key);
}
