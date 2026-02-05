interface CachedData<T> {
  data: T;
  cachedAt: number;
  expiresAt: number;
}

const CACHE_PREFIX = 'brack_data_cache_';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 hours max

class DataCacheService {
  private getCacheKey(key: string): string {
    return `${CACHE_PREFIX}${key}`;
  }

  set<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
    try {
      const expiresAt = Date.now() + Math.min(ttl, MAX_CACHE_AGE);
      const cached: CachedData<T> = {
        data,
        cachedAt: Date.now(),
        expiresAt,
      };

      const cacheKey = this.getCacheKey(key);
      localStorage.setItem(cacheKey, JSON.stringify(cached));
    } catch (error) {
      console.error('Error caching data:', error);
      // If storage is full, try to clear old cache
      this.cleanup();
    }
  }

  get<T>(key: string): T | null {
    try {
      const cacheKey = this.getCacheKey(key);
      const stored = localStorage.getItem(cacheKey);

      if (!stored) {
        return null;
      }

      const cached: CachedData<T> = JSON.parse(stored);

      // Check if expired
      if (Date.now() > cached.expiresAt) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      return cached.data;
    } catch (error) {
      console.error('Error retrieving cached data:', error);
      return null;
    }
  }

  has(key: string): boolean {
    const cacheKey = this.getCacheKey(key);
    const stored = localStorage.getItem(cacheKey);
    
    if (!stored) {
      return false;
    }

    try {
      const cached: CachedData<unknown> = JSON.parse(stored);
      return Date.now() <= cached.expiresAt;
    } catch {
      return false;
    }
  }

  remove(key: string): void {
    const cacheKey = this.getCacheKey(key);
    localStorage.removeItem(cacheKey);
  }

  clear(): void {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  }

  cleanup(): void {
    const keys = Object.keys(localStorage);
    let cleaned = 0;

    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const cached: CachedData<unknown> = JSON.parse(stored);
            if (Date.now() > cached.expiresAt) {
              localStorage.removeItem(key);
              cleaned++;
            }
          }
        } catch {
          // Invalid cache entry, remove it
          localStorage.removeItem(key);
          cleaned++;
        }
      }
    });

    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} expired cache entries`);
    }
  }

  getStats() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
    let totalSize = 0;
    let expiredCount = 0;

    keys.forEach(key => {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          totalSize += stored.length;
          const cached: CachedData<unknown> = JSON.parse(stored);
          if (Date.now() > cached.expiresAt) {
            expiredCount++;
          }
        }
      } catch {
        // Invalid entry
      }
    });

    return {
      totalEntries: keys.length,
      expiredEntries: expiredCount,
      estimatedSize: totalSize,
    };
  }

  invalidate(pattern?: string): void {
    if (pattern) {
      // Invalidate keys matching pattern
      const keys = Object.keys(localStorage).filter(k => 
        k.startsWith(CACHE_PREFIX) && k.includes(pattern)
      );
      keys.forEach(key => localStorage.removeItem(key));
    } else {
      this.clear();
    }
  }
}

export const dataCache = new DataCacheService();

// Initialize cleanup on load
if (typeof window !== 'undefined') {
  // Cleanup expired entries on startup
  dataCache.cleanup();

  // Cleanup every hour
  setInterval(() => {
    dataCache.cleanup();
  }, 60 * 60 * 1000);
}
