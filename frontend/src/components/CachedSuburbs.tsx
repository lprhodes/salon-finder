'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Clock, Database, Server } from 'lucide-react';

interface CacheMetadata {
  suburb: string;
  count: number;
  timestamp: number;
  model?: string;
}

interface Props {
  onSelectCache?: (suburb: string) => void;
  selectedSuburb?: string;
}

export default function CachedSuburbs({ onSelectCache, selectedSuburb }: Props) {
  const [cachedSuburbs, setCachedSuburbs] = useState<CacheMetadata[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cleaningCache, setCleaningCache] = useState(false);

  useEffect(() => {
    fetchCachedSuburbs();
  }, [refreshKey]);

  const fetchCachedSuburbs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/cache');
      if (response.ok) {
        const data = await response.json();
        setCachedSuburbs(data);
      } else {
        setError('Failed to fetch cached suburbs');
      }
    } catch (err) {
      setError('Error loading cache');
      console.error('Error fetching cached suburbs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (suburb: string) => {
    if (confirm(`Delete cached data for ${suburb}?`)) {
      try {
        const response = await fetch(`/api/cache?suburb=${encodeURIComponent(suburb)}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          setRefreshKey(prev => prev + 1);
        } else {
          setError('Failed to delete cache');
        }
      } catch (err) {
        setError('Error deleting cache');
        console.error('Error deleting cache:', err);
      }
    }
  };

  const handleClearAll = async () => {
    if (confirm('Delete all cached salon data?')) {
      try {
        const response = await fetch('/api/cache?action=clear-all', {
          method: 'DELETE'
        });
        if (response.ok) {
          setRefreshKey(prev => prev + 1);
        } else {
          setError('Failed to clear all caches');
        }
      } catch (err) {
        setError('Error clearing caches');
        console.error('Error clearing all caches:', err);
      }
    }
  };

  const handleCleanCache = async () => {
    setCleaningCache(true);
    setError(null);
    
    try {
      // First, get analysis of what needs cleaning
      const analysisResponse = await fetch('/api/cache/clean');
      if (analysisResponse.ok) {
        const analysis = await analysisResponse.json();
        
        const message = `Cache Analysis:\n\n` +
          `Total cached suburbs: ${analysis.total}\n` +
          `Clean: ${analysis.clean}\n` +
          `Needs cleaning: ${analysis.needsCleaning}\n` +
          `Invalid (will be deleted): ${analysis.invalid}\n\n` +
          `Proceed with cleaning?`;
        
        if (confirm(message)) {
          // Perform the cleaning
          const cleanResponse = await fetch('/api/cache/clean', {
            method: 'POST'
          });
          
          if (cleanResponse.ok) {
            const result = await cleanResponse.json();
            alert(`Cache cleaning complete!\n\n` +
              `Cleaned: ${result.cleaned} suburbs\n` +
              `Deleted: ${result.deleted} suburbs\n` +
              `Total processed: ${result.totalProcessed} suburbs`);
            
            // Refresh the cache list
            setRefreshKey(prev => prev + 1);
          } else {
            setError('Failed to clean cache');
          }
        }
      } else {
        setError('Failed to analyze cache');
      }
    } catch (err) {
      setError('Error cleaning cache');
      console.error('Error cleaning cache:', err);
    } finally {
      setCleaningCache(false);
    }
  };

  const handleSelect = (suburb: string) => {
    if (onSelectCache) {
      onSelectCache(suburb);
    }
  };

  const getAge = (timestamp: number): string => {
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
  };

  if (loading && cachedSuburbs.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">Loading cache...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-destructive">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (cachedSuburbs.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Server Cache
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCleanCache}
            disabled={cleaningCache}
            className="text-primary hover:text-primary"
          >
            {cleaningCache ? 'Cleaning...' : 'Clean Cache'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="text-destructive hover:text-destructive"
          >
            Clear All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {cachedSuburbs.map((cache) => (
            <div
              key={cache.suburb}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                selectedSuburb === cache.suburb ? 'border-primary bg-primary/5' : 'border-border'
              } hover:bg-accent/50 transition-colors`}
            >
              <div className="flex-1">
                <div className="font-medium">{cache.suburb}</div>
                <div className="text-sm text-muted-foreground flex items-center gap-4">
                  <span>{cache.count} salons</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {getAge(cache.timestamp)}
                  </span>
                  {cache.model && (
                    <span className="text-xs bg-muted px-2 py-0.5 rounded">
                      {cache.model}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSelect(cache.suburb)}
                  disabled={selectedSuburb === cache.suburb}
                >
                  {selectedSuburb === cache.suburb ? 'Selected' : 'Use Cache'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(cache.suburb)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          Cached data stored on server, expires after 7 days
        </div>
      </CardContent>
    </Card>
  );
}