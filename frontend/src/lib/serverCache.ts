import { promises as fs } from 'fs';
import path from 'path';
import { Salon } from '@/types';

interface CachedSalonData {
  suburb: string;
  salons: Salon[];
  timestamp: number;
  model?: string;
}

interface CachedSalonDetails {
  salon: Salon;
  timestamp: number;
  model: string;
  placeId?: string;
}

interface CacheMetadata {
  suburb: string;
  count: number;
  timestamp: number;
  model?: string;
}

const CACHE_DIR = path.join(process.cwd(), '.cache');
const SALON_LIST_CACHE_DIR = path.join(CACHE_DIR, 'salon-lists');
const SALON_DETAILS_CACHE_DIR = path.join(CACHE_DIR, 'salon-details');
const CACHE_INDEX_FILE = path.join(CACHE_DIR, 'cache-index.json');
const CACHE_EXPIRY_HOURS = 24 * 7; // 1 week

export class ServerCache {
  /**
   * Initialize cache directories
   */
  static async init(): Promise<void> {
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
      await fs.mkdir(SALON_LIST_CACHE_DIR, { recursive: true });
      await fs.mkdir(SALON_DETAILS_CACHE_DIR, { recursive: true });
    } catch {
      console.error('Failed to initialize cache directories');
    }
  }

  /**
   * Generate cache key for salon details based on place ID and model
   */
  static getSalonDetailsCacheKey(placeId: string | undefined, salonName: string, model: string): string {
    const id = placeId || this.sanitizeForFilename(salonName);
    const modelKey = model.replace(/[^a-z0-9]/gi, '_');
    return `${id}_${modelKey}`;
  }

  /**
   * Save salon list to cache
   */
  static async saveSalonList(suburb: string, salons: Salon[], model?: string): Promise<void> {
    await this.init();
    
    const filename = this.sanitizeForFilename(suburb) + '.json';
    const filepath = path.join(SALON_LIST_CACHE_DIR, filename);
    
    const cacheData: CachedSalonData = {
      suburb,
      salons,
      timestamp: Date.now(),
      model
    };
    
    try {
      await fs.writeFile(filepath, JSON.stringify(cacheData, null, 2));
      await this.updateIndex(suburb, salons.length, model);
      console.log(`📁 Cached ${salons.length} salons for ${suburb}`);
    } catch {
      console.error('Failed to save salon list cache');
    }
  }

  /**
   * Get cached salon list
   */
  static async getSalonList(suburb: string): Promise<CachedSalonData | null> {
    const filename = this.sanitizeForFilename(suburb) + '.json';
    const filepath = path.join(SALON_LIST_CACHE_DIR, filename);
    
    try {
      const data = await fs.readFile(filepath, 'utf-8');
      const cached: CachedSalonData = JSON.parse(data);
      
      // Check if cache is expired
      if (this.isExpired(cached.timestamp)) {
        await this.deleteSalonList(suburb);
        return null;
      }
      
      return cached;
    } catch {
      // File doesn't exist or can't be read
      return null;
    }
  }

  /**
   * Save individual salon details to cache
   */
  static async saveSalonDetails(salon: Salon, model: string, placeId?: string): Promise<void> {
    await this.init();
    
    const cacheKey = this.getSalonDetailsCacheKey(placeId, salon.name, model);
    const filename = `${cacheKey}.json`;
    const filepath = path.join(SALON_DETAILS_CACHE_DIR, filename);
    
    const cacheData: CachedSalonDetails = {
      salon,
      timestamp: Date.now(),
      model,
      placeId
    };
    
    try {
      // Check if file already exists (updating vs creating)
      const exists = await fs.access(filepath).then(() => true).catch(() => false);
      
      await fs.writeFile(filepath, JSON.stringify(cacheData, null, 2));
      
      if (exists) {
        console.log(`📁 Updated cached details for ${salon.name} (${model})`);
      } else {
        console.log(`📁 Created cache for ${salon.name} (${model})`);
      }
    } catch {
      console.error('Failed to save salon details cache');
    }
  }

  /**
   * Get cached salon details
   */
  static async getSalonDetails(placeId: string | undefined, salonName: string, model: string): Promise<Salon | null> {
    const cacheKey = this.getSalonDetailsCacheKey(placeId, salonName, model);
    const filename = `${cacheKey}.json`;
    const filepath = path.join(SALON_DETAILS_CACHE_DIR, filename);
    
    try {
      const data = await fs.readFile(filepath, 'utf-8');
      const cached: CachedSalonDetails = JSON.parse(data);
      
      // Check if cache is expired
      if (this.isExpired(cached.timestamp)) {
        await fs.unlink(filepath).catch(() => {}); // Delete expired cache
        return null;
      }
      
      console.log(`📁 Using cached details for ${salonName} (${model})`);
      return cached.salon;
    } catch {
      // File doesn't exist or can't be read
      return null;
    }
  }

  /**
   * Delete salon list cache
   */
  static async deleteSalonList(suburb: string): Promise<void> {
    const filename = this.sanitizeForFilename(suburb) + '.json';
    const filepath = path.join(SALON_LIST_CACHE_DIR, filename);
    
    try {
      await fs.unlink(filepath);
      await this.removeFromIndex(suburb);
    } catch {
      // File might not exist
    }
  }

  /**
   * Get all cached suburbs with metadata
   */
  static async getAllCached(): Promise<CacheMetadata[]> {
    try {
      const data = await fs.readFile(CACHE_INDEX_FILE, 'utf-8');
      const index: CacheMetadata[] = JSON.parse(data);
      
      // Filter out expired entries
      const validEntries = index.filter(entry => !this.isExpired(entry.timestamp));
      
      // Update index if we removed expired entries
      if (validEntries.length < index.length) {
        await fs.writeFile(CACHE_INDEX_FILE, JSON.stringify(validEntries, null, 2));
      }
      
      return validEntries;
    } catch {
      return [];
    }
  }

  /**
   * Clear all caches
   */
  static async clearAll(): Promise<void> {
    try {
      // Clear salon lists
      const listFiles = await fs.readdir(SALON_LIST_CACHE_DIR);
      await Promise.all(
        listFiles.map(file => fs.unlink(path.join(SALON_LIST_CACHE_DIR, file)))
      );
      
      // Clear salon details
      const detailFiles = await fs.readdir(SALON_DETAILS_CACHE_DIR);
      await Promise.all(
        detailFiles.map(file => fs.unlink(path.join(SALON_DETAILS_CACHE_DIR, file)))
      );
      
      // Clear index
      await fs.unlink(CACHE_INDEX_FILE).catch(() => {});
      
      console.log('🗑️ Cleared all caches');
    } catch {
      console.error('Failed to clear caches');
    }
  }

  /**
   * Get cache statistics
   */
  static async getStats(): Promise<{
    salonLists: number;
    salonDetails: number;
    totalSize: number;
  }> {
    try {
      const listFiles = await fs.readdir(SALON_LIST_CACHE_DIR);
      const detailFiles = await fs.readdir(SALON_DETAILS_CACHE_DIR);
      
      let totalSize = 0;
      
      // Calculate total size
      for (const file of listFiles) {
        const stats = await fs.stat(path.join(SALON_LIST_CACHE_DIR, file));
        totalSize += stats.size;
      }
      
      for (const file of detailFiles) {
        const stats = await fs.stat(path.join(SALON_DETAILS_CACHE_DIR, file));
        totalSize += stats.size;
      }
      
      return {
        salonLists: listFiles.length,
        salonDetails: detailFiles.length,
        totalSize: Math.round(totalSize / 1024) // KB
      };
    } catch {
      return { salonLists: 0, salonDetails: 0, totalSize: 0 };
    }
  }

  /**
   * Get age of cache in human-readable format
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

  // Private helper methods
  
  private static sanitizeForFilename(str: string): string {
    return str.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
  }

  private static isExpired(timestamp: number): boolean {
    const age = Date.now() - timestamp;
    return age > CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
  }

  private static async updateIndex(suburb: string, count: number, model?: string): Promise<void> {
    try {
      let index: CacheMetadata[] = [];
      
      try {
        const data = await fs.readFile(CACHE_INDEX_FILE, 'utf-8');
        index = JSON.parse(data);
      } catch {
        // File doesn't exist yet
      }
      
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
      
      await fs.writeFile(CACHE_INDEX_FILE, JSON.stringify(index, null, 2));
    } catch {
      console.error('Failed to update cache index');
    }
  }

  private static async removeFromIndex(suburb: string): Promise<void> {
    try {
      const data = await fs.readFile(CACHE_INDEX_FILE, 'utf-8');
      const index: CacheMetadata[] = JSON.parse(data);
      const filtered = index.filter(entry => entry.suburb !== suburb);
      await fs.writeFile(CACHE_INDEX_FILE, JSON.stringify(filtered, null, 2));
    } catch {
      // Index might not exist
    }
  }
}