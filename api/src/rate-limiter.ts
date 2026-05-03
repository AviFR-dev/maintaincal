/**
 * Simple in-memory rate limiter for protection against brute-force attacks.
 * In production, consider using Redis for distributed deployments.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

export function checkRateLimit(key: string, maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // Create new entry or reset old one
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true; // Allow
  }

  if (entry.count >= maxAttempts) {
    return false; // Deny
  }

  entry.count++;
  return true; // Allow
}

export function resetRateLimit(key: string): void {
  store.delete(key);
}

// Clean up old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, 10 * 60 * 1000);
