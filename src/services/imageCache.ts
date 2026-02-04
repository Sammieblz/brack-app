import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";

interface CachedImage {
  url: string;
  localPath: string;
  cachedAt: number;
  size: number;
}

const CACHE_DIR = 'image-cache';
const MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const CACHE_METADATA_KEY = 'image_cache_metadata';

class ImageCacheService {
  private metadata: Map<string, CachedImage> = new Map();
  private totalCacheSize = 0;

  constructor() {
    this.loadMetadata();
  }

  private async loadMetadata() {
    try {
      if (Capacitor.isNativePlatform()) {
        // Load from Filesystem
        try {
          const { data } = await Filesystem.readFile({
            path: `${CACHE_DIR}/metadata.json`,
            directory: Directory.Cache,
            encoding: Encoding.UTF8,
          });
          const parsed = JSON.parse(data);
          this.metadata = new Map(Object.entries(parsed));
          this.calculateTotalSize();
        } catch (error) {
          // Metadata file doesn't exist yet, start fresh
          this.metadata = new Map();
        }
      } else {
        // Load from localStorage
        const stored = localStorage.getItem(CACHE_METADATA_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          this.metadata = new Map(Object.entries(parsed));
          this.calculateTotalSize();
        }
      }
    } catch (error) {
      console.error('Error loading cache metadata:', error);
      this.metadata = new Map();
    }
  }

  private async saveMetadata() {
    try {
      const metadataObj = Object.fromEntries(this.metadata);
      
      if (Capacitor.isNativePlatform()) {
        // Ensure cache directory exists
        try {
          await Filesystem.mkdir({
            path: CACHE_DIR,
            directory: Directory.Cache,
            recursive: true,
          });
        } catch (error) {
          // Directory might already exist
        }

        await Filesystem.writeFile({
          path: `${CACHE_DIR}/metadata.json`,
          data: JSON.stringify(metadataObj),
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
      } else {
        localStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadataObj));
      }
    } catch (error) {
      console.error('Error saving cache metadata:', error);
    }
  }

  private calculateTotalSize() {
    this.totalCacheSize = Array.from(this.metadata.values()).reduce(
      (sum, img) => sum + img.size,
      0
    );
  }

  private getCacheKey(url: string): string {
    // Create a safe filename from URL
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.replace(/[^a-zA-Z0-9]/g, '_');
      const hash = this.simpleHash(url);
      return `${hash}_${pathname.slice(-50)}`;
    } catch {
      return this.simpleHash(url);
    }
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  async getCachedImage(url: string): Promise<string | null> {
    const cacheKey = this.getCacheKey(url);
    const cached = this.metadata.get(cacheKey);

    if (!cached) {
      return null;
    }

    // Check if cache is expired
    const age = Date.now() - cached.cachedAt;
    if (age > MAX_CACHE_AGE) {
      await this.removeCachedImage(url);
      return null;
    }

    try {
      if (Capacitor.isNativePlatform()) {
        const { data } = await Filesystem.readFile({
          path: cached.localPath,
          directory: Directory.Cache,
        });
        return `data:image/jpeg;base64,${data}`;
      } else {
        // Web: use IndexedDB or return URL (browser handles caching)
        // For now, return the original URL as browsers cache automatically
        return url;
      }
    } catch (error) {
      console.error('Error reading cached image:', error);
      await this.removeCachedImage(url);
      return null;
    }
  }

  async cacheImage(url: string, blob: Blob): Promise<string> {
    const cacheKey = this.getCacheKey(url);
    const size = blob.size;

    // Check if we need to free up space
    await this.ensureCacheSpace(size);

    try {
      let localPath: string;

      if (Capacitor.isNativePlatform()) {
        // Ensure cache directory exists
        try {
          await Filesystem.mkdir({
            path: CACHE_DIR,
            directory: Directory.Cache,
            recursive: true,
          });
        } catch (error) {
          // Directory might already exist
        }

        // Convert blob to base64
        const base64 = await this.blobToBase64(blob);
        localPath = `${CACHE_DIR}/${cacheKey}.jpg`;

        await Filesystem.writeFile({
          path: localPath,
          data: base64,
          directory: Directory.Cache,
        });

        // Return data URL for immediate use
        const dataUrl = `data:image/jpeg;base64,${base64}`;
        
        this.metadata.set(cacheKey, {
          url,
          localPath,
          cachedAt: Date.now(),
          size,
        });
        this.totalCacheSize += size;
        await this.saveMetadata();

        return dataUrl;
      } else {
        // Web: Store in IndexedDB or use browser cache
        // For now, browsers handle image caching automatically
        // We'll just track metadata
        localPath = url; // Use URL as path for web

        this.metadata.set(cacheKey, {
          url,
          localPath,
          cachedAt: Date.now(),
          size,
        });
        this.totalCacheSize += size;
        await this.saveMetadata();

        return url;
      }
    } catch (error) {
      console.error('Error caching image:', error);
      return url; // Return original URL on error
    }
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // Remove data URL prefix if present
        const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private async ensureCacheSpace(requiredSize: number) {
    // Calculate target size (leave 20% headroom)
    const targetSize = MAX_CACHE_SIZE * 0.8;

    if (this.totalCacheSize + requiredSize <= targetSize) {
      return;
    }

    // Sort by age (oldest first)
    const sorted = Array.from(this.metadata.entries())
      .sort((a, b) => a[1].cachedAt - b[1].cachedAt);

    // Remove oldest images until we have enough space
    for (const [key, image] of sorted) {
      if (this.totalCacheSize + requiredSize <= targetSize) {
        break;
      }

      await this.removeCachedImageByKey(key);
    }
  }

  async removeCachedImage(url: string) {
    const cacheKey = this.getCacheKey(url);
    await this.removeCachedImageByKey(cacheKey);
  }

  private async removeCachedImageByKey(cacheKey: string) {
    const cached = this.metadata.get(cacheKey);
    if (!cached) return;

    try {
      if (Capacitor.isNativePlatform()) {
        await Filesystem.deleteFile({
          path: cached.localPath,
          directory: Directory.Cache,
        });
      }
      // Web: Browser handles cleanup automatically

      this.totalCacheSize -= cached.size;
      this.metadata.delete(cacheKey);
      await this.saveMetadata();
    } catch (error) {
      console.error('Error removing cached image:', error);
    }
  }

  async clearCache() {
    try {
      if (Capacitor.isNativePlatform()) {
        // Delete entire cache directory
        try {
          await Filesystem.rmdir({
            path: CACHE_DIR,
            directory: Directory.Cache,
            recursive: true,
          });
        } catch (error) {
          // Directory might not exist
        }
      }

      this.metadata.clear();
      this.totalCacheSize = 0;
      await this.saveMetadata();
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  getCacheStats() {
    return {
      totalImages: this.metadata.size,
      totalSize: this.totalCacheSize,
      maxSize: MAX_CACHE_SIZE,
      usagePercent: (this.totalCacheSize / MAX_CACHE_SIZE) * 100,
    };
  }

  async invalidateCache(url?: string) {
    if (url) {
      await this.removeCachedImage(url);
    } else {
      await this.clearCache();
    }
  }
}

export const imageCache = new ImageCacheService();
