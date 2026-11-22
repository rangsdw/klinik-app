/**
 * Rate limiter dengan interface sederhana agar mudah diganti Redis/Upstash nanti.
 * Implementasi awal: in-memory fixed window (cukup untuk satu instance / lokal).
 */
export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export interface RateLimiter {
  /** Catat satu percobaan dan kembalikan apakah masih diizinkan. */
  hit(key: string): Promise<RateLimitResult>;
  /** Hapus hitungan (mis. setelah login berhasil). */
  reset(key: string): Promise<void>;
}

type Bucket = { count: number; resetAt: number };

export class MemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  async hit(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      this.sweep(now);
      return { ok: true };
    }
    if (bucket.count >= this.limit) {
      return { ok: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
    }
    bucket.count += 1;
    return { ok: true };
  }

  async reset(key: string): Promise<void> {
    this.buckets.delete(key);
  }

  private sweep(now: number) {
    if (this.buckets.size < 1000) return;
    for (const [k, b] of this.buckets) if (b.resetAt <= now) this.buckets.delete(k);
  }
}

const globalForLimiter = globalThis as unknown as {
  loginLimiter?: RateLimiter;
  checkInScanLimiter?: RateLimiter;
};

/** 5 percobaan per menit per kombinasi identifier + IP. */
export const loginLimiter: RateLimiter =
  globalForLimiter.loginLimiter ?? new MemoryRateLimiter(5, 60_000);
globalForLimiter.loginLimiter = loginLimiter;

/** 30 pemindaian / pencarian check-in per menit per staf pendaftaran. */
export const checkInScanLimiter: RateLimiter =
  globalForLimiter.checkInScanLimiter ?? new MemoryRateLimiter(30, 60_000);
globalForLimiter.checkInScanLimiter = checkInScanLimiter;
