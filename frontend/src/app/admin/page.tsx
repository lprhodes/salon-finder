'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SavedSalon {
  _id: string;
  name: string;
  address?: {
    suburb?: string;
    fullAddress?: string;
  };
  contactNumber?: string;
  website?: string;
  rating?: {
    stars: number;
    numberOfReviewers: number;
  };
  createdAt: string;
  updatedAt: string;
}

export default function AdminPage() {
  const [salons, setSalons] = useState<SavedSalon[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const limit = 20;

  const fetchSalons = async (skipAmount: number = 0) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/list-salons?limit=${limit}&skip=${skipAmount}`);
      if (!response.ok) {
        throw new Error('Failed to fetch salons');
      }
      
      const data = await response.json();
      setSalons(data.salons);
      setTotalCount(data.totalCount);
      setHasMore(data.hasMore);
      setSkip(skipAmount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalons();
  }, []);

  const handleNext = () => {
    if (hasMore) {
      fetchSalons(skip + limit);
    }
  };

  const handlePrevious = () => {
    if (skip > 0) {
      fetchSalons(Math.max(0, skip - limit));
    }
  };

  const testDatabaseConnection = async () => {
    try {
      const response = await fetch('/api/test-db');
      const data = await response.json();
      alert(`Database Connection: ${data.success ? 'Success' : 'Failed'}\n\nTotal Salons: ${data.salonCount}\nDatabase: ${data.databaseName}`);
    } catch (err) {
      alert('Failed to test database connection');
    }
  };

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Salon Database Admin</h1>
        <div className="flex gap-3">
          <Button onClick={testDatabaseConnection} variant="outline">
            Test DB Connection
          </Button>
          <Button onClick={() => window.location.href = '/'} variant="outline">
            Back to Salon Finder
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-lg p-4 mb-6">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>
              Saved Salons ({totalCount} total)
            </CardTitle>
            <div className="text-sm text-muted-foreground">
              Showing {skip + 1}-{Math.min(skip + limit, totalCount)} of {totalCount}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : salons.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No salons found in the database
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3">
                {salons.map((salon) => (
                  <Card key={salon._id}>
                    <CardContent className="pt-6">
                      <div className="grid gap-2">
                        <div className="flex justify-between items-start">
                          <h3 className="font-semibold text-lg">{salon.name}</h3>
                          <span className="text-xs text-muted-foreground">
                            ID: {salon._id}
                          </span>
                        </div>
                        
                        {salon.address?.suburb && (
                          <div className="text-sm">
                            <span className="font-medium">Suburb:</span> {salon.address.suburb}
                          </div>
                        )}
                        
                        {salon.address?.fullAddress && (
                          <div className="text-sm">
                            <span className="font-medium">Address:</span> {salon.address.fullAddress}
                          </div>
                        )}
                        
                        {salon.contactNumber && (
                          <div className="text-sm">
                            <span className="font-medium">Phone:</span> {salon.contactNumber}
                          </div>
                        )}
                        
                        {salon.website && (
                          <div className="text-sm">
                            <span className="font-medium">Website:</span>{' '}
                            <a href={salon.website} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                              {salon.website}
                            </a>
                          </div>
                        )}
                        
                        {salon.rating && (
                          <div className="text-sm">
                            <span className="font-medium">Rating:</span> {salon.rating.stars} ★ ({salon.rating.numberOfReviewers} reviews)
                          </div>
                        )}
                        
                        <div className="text-xs text-muted-foreground mt-2">
                          Created: {new Date(salon.createdAt).toLocaleDateString()}
                          {salon.updatedAt !== salon.createdAt && (
                            <> | Updated: {new Date(salon.updatedAt).toLocaleDateString()}</>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <div className="flex justify-between items-center pt-4">
                <Button
                  onClick={handlePrevious}
                  disabled={skip === 0}
                  variant="outline"
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {Math.floor(skip / limit) + 1} of {Math.ceil(totalCount / limit)}
                </span>
                <Button
                  onClick={handleNext}
                  disabled={!hasMore}
                  variant="outline"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}