/**
 * Simple in-memory sliding-window rate limiter.
 * Works for single-instance deployments (Vercel serverless resets on cold start,
 * which is acceptable — rate limits are best-effort per warm instance).
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Periodic cleanup every 60s to prevent memory leaks
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    store.forEach((entry, key) => {
      entry.timestamps = entry.timestamps.filter((t: number) => now - t < 3600_000);
      if (entry.timestamps.length === 0) store.delete(key);
    });
  }, 60_000);
  // Don't prevent process exit
  if (typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref();
  }
}

interface RateLimitOptions {
  /** Unique key for the rate limit bucket (e.g., `login:${ip}`) */
  key: string;
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Time window in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit({ key, limit, windowMs }: RateLimitOptions): RateLimitResult {
  ensureCleanup();

  const now = Date.now();
  const entry = store.get(key) || { timestamps: [] };

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= limit) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = oldestInWindow + windowMs - now;
    return { success: false, remaining: 0, retryAfterMs: Math.max(retryAfterMs, 1000) };
  }

  entry.timestamps.push(now);
  store.set(key, entry);

  return {
    success: true,
    remaining: limit - entry.timestamps.length,
    retryAfterMs: 0,
  };
}

// Account lockout tracking (separate from rate limit)
const lockouts = new Map<string, { failedAttempts: number; lockedUntil: number }>();

const LOCKOUT_THRESHOLD = 10;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export function recordFailedLogin(accountKey: string): void {
  const entry = lockouts.get(accountKey) || { failedAttempts: 0, lockedUntil: 0 };
  entry.failedAttempts++;
  if (entry.failedAttempts >= LOCKOUT_THRESHOLD) {
    entry.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
  }
  lockouts.set(accountKey, entry);
}

export function clearFailedLogins(accountKey: string): void {
  lockouts.delete(accountKey);
}

export function isAccountLocked(accountKey: string): boolean {
  const entry = lockouts.get(accountKey);
  if (!entry) return false;
  if (entry.lockedUntil > Date.now()) return true;
  // Lockout expired — reset
  lockouts.delete(accountKey);
  return false;
}

/** Extract client IP from request headers (Vercel / reverse proxy aware). */
export function getClientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}
