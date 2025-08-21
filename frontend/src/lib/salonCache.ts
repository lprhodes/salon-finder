import { Salon } from '@/types';

interface CachedSalonData {
  suburb: string;
  salons: Salon[];
  timestamp: number;
  model?: string;
}

interface CacheMetadata {
  suburb: string;
  count: number;
  timestamp: number;
  model?: string;
}

const CACHE_KEY_PREFIX = 'salon_cache_';
const CACHE_INDEX_KEY = 'salon_cache_index';
const CACHE_EXPIRY_HOURS = 24 * 7; // 1 week

export class SalonCache {
  /**
   * Save salon data to cache for a specific suburb
   */
  static save(suburb: string, salons: Salon[], model?: string): void {
    console.log('SalonCache.save called:');
    console.log('  Suburb:', suburb);
    console.log('  Salons array length:', salons.length);
    console.log('  First salon:', salons[0]);
    console.log('  Model:', model);
    
    const cacheKey = this.getCacheKey(suburb);
    const cacheData: CachedSalonData = {
      suburb,
      salons,
      timestamp: Date.now(),
      model
    };
    
    try {
      const dataStr = JSON.stringify(cacheData);
      console.log('  Stringified data length:', dataStr.length);
      localStorage.setItem(cacheKey, dataStr);
      
      this.updateIndex(suburb, salons.length, model);
      console.log('  ✅ Cache saved successfully');
    } catch (e) {
      console.error('Failed to save salon cache:', e);
      // If storage is full, try to clear old caches
      this.clearOldCaches();
      try {
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        this.updateIndex(suburb, salons.length, model);
      } catch (e2) {
        console.error('Failed to save salon cache even after cleanup:', e2);
      }
    }
  }

  /**
   * Get cached salon data for a specific suburb
   */
  static get(suburb: string): CachedSalonData | null {
    const cacheKey = this.getCacheKey(suburb);
    
    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;
      
      const data: CachedSalonData = JSON.parse(cached);
      
      // Check if cache is expired
      if (this.isExpired(data.timestamp)) {
        this.delete(suburb);
        return null;
      }
      
      return data;
    } catch (e) {
      console.error('Failed to get salon cache:', e);
      return null;
    }
  }

  /**
   * Check if cached data exists for a suburb
   */
  static has(suburb: string): boolean {
    const data = this.get(suburb);
    return data !== null;
  }

  /**
   * Delete cache for a specific suburb
   */
  static delete(suburb: string): void {
    const cacheKey = this.getCacheKey(suburb);
    localStorage.removeItem(cacheKey);
    this.removeFromIndex(suburb);
  }

  /**
   * Get all cached suburbs with metadata
   */
  static getAllCached(): CacheMetadata[] {
    try {
      const indexStr = localStorage.getItem(CACHE_INDEX_KEY);
      if (!indexStr) return [];
      
      const index: CacheMetadata[] = JSON.parse(indexStr);
      
      // Filter out expired entries
      const validEntries = index.filter(entry => !this.isExpired(entry.timestamp));
      
      // Update index if we removed expired entries
      if (validEntries.length < index.length) {
        localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(validEntries));
      }
      
      return validEntries;
    } catch (e) {
      console.error('Failed to get cache index:', e);
      return [];
    }
  }

  /**
   * Clear all salon caches
   */
  static clearAll(): void {
    const allCached = this.getAllCached();
    
    allCached.forEach(entry => {
      const cacheKey = this.getCacheKey(entry.suburb);
      localStorage.removeItem(cacheKey);
    });
    
    localStorage.removeItem(CACHE_INDEX_KEY);
  }

  /**
   * Clear caches older than the expiry time
   */
  static clearOldCaches(): void {
    const allCached = this.getAllCached();
    
    allCached.forEach(entry => {
      if (this.isExpired(entry.timestamp)) {
        this.delete(entry.suburb);
      }
    });
  }

  /**
   * Get the age of cached data in human-readable format
   */
  static getAge(timestamp: number): string {
    const age = Date.now() - timestamp;
    const hours = Math.floor(age / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days} day${days === 1 ? '' : 's'} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    } else {
      const minutes = Math.floor(age / (1000 * 60));
      return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    }
  }

  /**
   * Format a suburb name for consistent caching
   */
  static formatSuburb(suburb: string): string {
    return suburb.toLowerCase().trim().replace(/\s+/g, '_');
  }

  // Private helper methods
  
  private static getCacheKey(suburb: string): string {
    return `${CACHE_KEY_PREFIX}${this.formatSuburb(suburb)}`;
  }

  private static isExpired(timestamp: number): boolean {
    const age = Date.now() - timestamp;
    return age > CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
  }

  private static updateIndex(suburb: string, count: number, model?: string): void {
    try {
      const index = this.getAllCached();
      const existingIndex = index.findIndex(entry => entry.suburb === suburb);
      
      const metadata: CacheMetadata = {
        suburb,
        count,
        timestamp: Date.now(),
        model
      };
      
      if (existingIndex >= 0) {
        index[existingIndex] = metadata;
      } else {
        index.push(metadata);
      }
      
      // Sort by timestamp (most recent first)
      index.sort((a, b) => b.timestamp - a.timestamp);
      
      localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
    } catch (e) {
      console.error('Failed to update cache index:', e);
    }
  }

  private static removeFromIndex(suburb: string): void {
    try {
      const index = this.getAllCached();
      const filtered = index.filter(entry => entry.suburb !== suburb);
      localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.error('Failed to remove from cache index:', e);
    }
  }
}