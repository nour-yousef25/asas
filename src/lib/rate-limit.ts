const store = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export function rateLimit(
  key: string,
  config: RateLimitConfig
): { success: boolean; remaining: number; resetAt: number } {
  const { windowMs, maxRequests } = config;
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (entry.count >= maxRequests) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { success: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

export const RATE_LIMITS = {
  api: { windowMs: 60_000, maxRequests: 60 },
  auth: { windowMs: 900_000, maxRequests: 10 },
  sms: { windowMs: 60_000, maxRequests: 5 },
  donation: { windowMs: 60_000, maxRequests: 20 },
} as const;
