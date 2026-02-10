/**
 * Generic caching utility
 * In Apps Script we used CacheService, here we'll use a simple in-memory cache
 * For production, you'd use Redis or similar
 */

interface CacheEntry {
  value: any;
  expiresAt: number;
}

class InMemoryCache {
  private cache: Map<string, CacheEntry> = new Map();

  get(key: string): any | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key: string, value: any, ttlSeconds: number = 3600): void {
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expiresAt });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Cleanup expired entries (run periodically)
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// Singleton instance
export const cache = new InMemoryCache();

// Run cleanup every 5 minutes
// Run cleanup every 5 minutes (only in non-test environments)
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => cache.cleanup(), 5 * 60 * 1000);
}