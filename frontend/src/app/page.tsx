'use client';

import { useState, useRef, useEffect } from 'react';
import SuburbSelect from '@/components/SuburbSelect';
import ModelSelector from '@/components/ModelSelector';
import SalonResults from '@/components/SalonResults';
import CachedSuburbs from '@/components/CachedSuburbs';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PerplexityModel } from '@/lib/perplexityClient';
import { Salon } from '@/types';

type Step = {
  id: string;
  label: string;
  status: 'pending' | 'in-progress' | 'completed';
  detail?: string;
  approved?: boolean;
};

interface RetryError {
  error: string;
  isRetrying?: boolean;
  attempt?: number;
  maxAttempts?: number;
  nextRetryIn?: number;
}

interface SalonResults {
  salons: Salon[];
}

export default function Home() {
  const [selectedSuburb, setSelectedSuburb] = useState('');
  const [selectedListModel, setSelectedListModel] = useState<PerplexityModel | undefined>('sonar-deep-research');
  const [selectedDetailsModel, setSelectedDetailsModel] = useState<PerplexityModel | undefined>('sonar');
  const [steps, setSteps] = useState<Step[]>([
    {
      id: 'research',
      label: 'Researching suburb',
      status: 'pending'
    },
    {
      id: 'fetch-details',
      label: 'Fetching salon details',
      status: 'pending'
    },
    {
      id: 'complete',
      label: 'Done',
      status: 'pending'
    }
  ]);
  const [salonResults, setSalonResults] = useState<SalonResults | null>(null);
  const [detailedSalonResults, setDetailedSalonResults] = useState<SalonResults | null>(null);
  const [currentStep, setCurrentStep] = useState<string>('research');
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [isResearchExpanded, setIsResearchExpanded] = useState(false);
  const [selectedSalonIndices, setSelectedSalonIndices] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryInfo, setRetryInfo] = useState<RetryError | null>(null);
  const [isUsingCache, setIsUsingCache] = useState(false);
  const [cacheRefreshKey, setCacheRefreshKey] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const hasStarted = steps.some(step => step.status !== 'pending');
  const formDisabled = isProcessing || hasStarted;
  
  const handleReset = () => {
    // Reset steps
    setSteps([
      {
        id: 'research',
        label: 'Researching suburb',
        status: 'pending'
      },
      {
        id: 'fetch-details',
        label: 'Fetching salon details',
        status: 'pending'
      },
      {
        id: 'complete',
        label: 'Done',
        status: 'pending'
      }
    ]);
    setCurrentStep('research');
    setSalonResults(null);
    setSelectedSalonIndices(new Set());
    setDetailedSalonResults(null);
    setIsDetailsExpanded(false);
    setIsResearchExpanded(false);
    setError(null);
    setRetryInfo(null);
    setIsUsingCache(false);
    
    // Cancel any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // De-duplicate salons based on name and address
  const deduplicateSalons = (salons: Salon[]): Salon[] => {
    const seen = new Map<string, Salon>();
    
    salons.forEach(salon => {
      // Create a unique key based on name and address
      // Normalize the key by converting to lowercase and trimming
      const name = (salon.name || '').toLowerCase().trim();
      const address = (salon.address || '').toLowerCase().trim();
      const key = `${name}|${address}`;
      
      // Only keep the first occurrence of each unique salon
      if (!seen.has(key)) {
        seen.set(key, salon);
      } else {
        // Log duplicates for debugging
        console.log(`Duplicate found: ${salon.name} at ${salon.address}`);
      }
    });
    
    return Array.from(seen.values());
  };

  const handleSalonSelection = (index: number, selected: boolean) => {
    setSelectedSalonIndices(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(index);
      } else {
        newSet.delete(index);
      }
      return newSet;
    });
  };

  const handleSelectCache = async (suburb: string) => {
    console.log('DEBUG: handleSelectCache called for:', suburb);
    
    try {
      // Fetch cached data from server
      const response = await fetch(`/api/cache?suburb=${encodeURIComponent(suburb)}&type=list`);
      
      if (!response.ok) {
        setError('Cache not found or expired');
        return;
      }
      
      const cachedData = await response.json();
      
      console.log('DEBUG: Retrieved cached data from server:');
      console.log('  Found cache:', !!cachedData);
      console.log('  Salon count:', cachedData?.salons?.length);
      console.log('  First salon:', JSON.stringify(cachedData?.salons?.[0], null, 2));
      
      if (!cachedData || !cachedData.salons) {
        setError('Invalid cache data');
        return;
      }

      // Set the suburb selector to the cached suburb
      setSelectedSuburb(suburb);
      
      // Load the cached salons
      setSalonResults({ salons: cachedData.salons });
      setSelectedSalonIndices(new Set(cachedData.salons.map((_: any, i: number) => i))); // Select all by default
      setIsUsingCache(true);
      
      // Update steps to show we have data ready
      setSteps(steps => steps.map(step => {
        if (step.id === 'research') {
          return { 
            ...step, 
            status: 'completed' as const,
            detail: `Loaded ${cachedData.salons.length} salons from server cache`
          };
        }
        return step;
      }));
      
      setCurrentStep('research');
      setError(null);
      setRetryInfo(null);
    } catch (error) {
      console.error('Error loading cached data:', error);
      setError('Failed to load cached data');
    }
  };

  const handleSubmit = async () => {
    if (!selectedSuburb) return;
    
    // Cancel any previous requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    setIsProcessing(true);
    setError(null);
    setRetryInfo(null);
    setCurrentStep('research');
    setSelectedSalonIndices(new Set());
    // Update research step to in-progress
    setSteps(steps.map(step => 
      step.id === 'research' 
        ? { ...step, status: 'in-progress' as const }
        : step
    ));

    try {
      // Call API to get salon list
      const response = await fetch('/api/research-suburb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({ 
          suburb: `${selectedSuburb}, NSW, Australia`,
          model: selectedListModel,
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.isRetrying) {
          setRetryInfo(errorData);
          // Don't throw, let the UI show retry status
          return;
        }
        throw new Error(errorData.error || 'Failed to fetch salon list');
      }

      const data = await response.json();
      setSalonResults(data);
      setSelectedSalonIndices(new Set(data.salons.map((_: unknown, i: number) => i))); // Select all by default

      // Server cache is now handled by the API endpoint
      if (data.salons && data.salons.length > 0) {
        console.log(`✅ Received ${data.salons.length} salons from API (cached on server)`);
        setCacheRefreshKey(prev => prev + 1); // Trigger cache list refresh
      }

      // Update steps
      setSteps(steps => steps.map(step => {
        if (step.id === 'research') {
          return { ...step, status: 'completed' as const };
        }
        return step;
      }));
    } catch (error) {
      console.error('Error:', error);
      // Only set error state if it's not an abort error
      if (error instanceof Error && error.name !== 'AbortError') {
        setError(error instanceof Error ? error.message : 'An error occurred');
        setSteps(steps => steps.map(step => ({ ...step, status: 'pending' as const })));
      }
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
    } finally {
      if (abortControllerRef.current) {
        abortControllerRef.current = null;
      }
      setIsProcessing(false);
    }
  };

  const handleApprove = (stepId: string) => {
    setSteps(steps => steps.map(step => {
      if (step.id === stepId) {
        return { ...step, approved: true };
      }
      return step;
    }));

    // Move to next step
    if (stepId === 'research') {
      setCurrentStep('fetch-details');
      handleFetchDetails();
      setIsResearchExpanded(false);
    } else if (stepId === 'fetch-details') {
      setCurrentStep('complete');
      setSteps(steps => steps.map(step => 
        step.id === 'complete' ? { ...step, status: 'completed' as const } : step
      ));
    }
  };

  const handleFetchDetails = async () => {
    if (!salonResults?.salons) return;

    setSteps(steps => steps.map(step => {
      if (step.id === 'fetch-details') {
        return { ...step, status: 'in-progress' as const };
      }
      return step;
    }));

    // Cancel any previous requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const selectedSalons = Array.from(selectedSalonIndices).map(index => salonResults.salons[index]);
      
      // De-duplicate selected salons before processing
      const uniqueSelectedSalons = deduplicateSalons(selectedSalons);
      
      if (selectedSalons.length !== uniqueSelectedSalons.length) {
        const duplicatesRemoved = selectedSalons.length - uniqueSelectedSalons.length;
        console.log(`De-duplication before processing: Removed ${duplicatesRemoved} duplicate(s) from ${selectedSalons.length} selected salons`);
      }
      
      setDetailedSalonResults({ salons: [] }); // Initialize detailed results
      setError(null);
      setRetryInfo(null);

      // Process salons serially to avoid rate limit issues and have better control
      const allDetailedSalons: Salon[] = [];
      
      // Process each unique salon one by one
      for (let i = 0; i < uniqueSelectedSalons.length; i++) {
        const salon = uniqueSelectedSalons[i];
        
        // Update progress
        setSteps(steps => steps.map(step => {
          if (step.id === 'fetch-details') {
            return { 
              ...step, 
              detail: `Processing salon ${i + 1} of ${uniqueSelectedSalons.length}: ${salon.name}`
            };
          }
          return step;
        }));

        try {
          const detailsResponse = await fetch('/api/fetch-salon-details', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: abortControllerRef.current?.signal,
            body: JSON.stringify({ 
              salon, 
              suburb: `${selectedSuburb}, NSW, Australia`,
              model: selectedDetailsModel,
            })
          });

          if (!detailsResponse.ok) {
            const errorData = await detailsResponse.json();
            
            // Check if it's a retry error
            if (errorData.isRetrying) {
              setRetryInfo(errorData);
              // Wait a bit and continue to next salon
              await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
              console.error(`Failed to fetch details for ${salon.name}:`, errorData.error);
              // Add salon with error flag
              const errorSalon = { ...salon, fetchError: errorData.error || 'Failed to fetch details' };
              allDetailedSalons.push(errorSalon);
              
              // Update UI with this salon's result
              setDetailedSalonResults(prev => ({
                salons: [...(prev?.salons || []), errorSalon]
              }));
            }
          } else {
            const detailsData = await detailsResponse.json();
            console.log(`✅ Fetched details for ${salon.name}`);
            const detailedSalon = { ...salon, ...detailsData };
            allDetailedSalons.push(detailedSalon);
            
            // Update UI with this salon's result immediately
            setDetailedSalonResults(prev => ({
              salons: [...(prev?.salons || []), detailedSalon]
            }));
            
            // Clear retry info on success
            setRetryInfo(null);
          }
        } catch (error) {
          // Handle abort
          if (error instanceof Error && error.name === 'AbortError') {
            console.log('Fetch details aborted');
            break;
          }
          
          console.error(`Error fetching details for ${salon.name}:`, error);
          // Add salon with error flag
          const errorSalon = { ...salon, fetchError: error instanceof Error ? error.message : 'Unknown error' };
          allDetailedSalons.push(errorSalon);
          
          // Update UI with this salon's result
          setDetailedSalonResults(prev => ({
            salons: [...(prev?.salons || []), errorSalon]
          }));
        }
        
        // Small delay between requests to be respectful of the API
        // This also helps with rate limiting (1.2s minimum between requests for 50/min limit)
        if (i < uniqueSelectedSalons.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1200));
        }
      }

      // Log summary
      const successCount = allDetailedSalons.filter(s => !s.fetchError).length;
      const errorCount = allDetailedSalons.filter(s => s.fetchError).length;
      console.log(`Fetch details complete: ${successCount} successful, ${errorCount} failed out of ${uniqueSelectedSalons.length} total`);
      setSteps(steps => steps.map(step => {
        if (step.id === 'fetch-details') {
          return { ...step, status: 'completed' as const, detail: `Completed ${uniqueSelectedSalons.length} salons`, approved: true };
        }
        if (step.id === 'complete') {
          setCurrentStep('complete');
          return { ...step, status: 'completed' as const };
        }
        return step;
      }));
    } catch (error) {
      console.error('Error:', error);
      // Only set error state if it's not an abort error
      if (error instanceof Error && error.name !== 'AbortError') {
        setError(error instanceof Error ? error.message : 'An error occurred');
        setSteps(steps => steps.map(step => ({ ...step, status: 'pending' as const })));
      }
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
    } finally {
      abortControllerRef.current = null;
      setIsProcessing(false);
    }
  };

  const downloadResults = () => {
    // Create an array of salons that includes detailed information if available
    let salonsToDownload: Salon[] = [];
    
    if (detailedSalonResults?.salons && detailedSalonResults.salons.length > 0) {
      // Use the detailed salon results which have all the information
      salonsToDownload = detailedSalonResults.salons;
    } else if (salonResults?.salons) {
      // Fallback to basic salon data if detailed info is not available
      salonsToDownload = salonResults.salons;
    }
    
    // De-duplicate salons based on name and address
    const uniqueSalons = deduplicateSalons(salonsToDownload);
    
    // Log de-duplication results
    if (salonsToDownload.length !== uniqueSalons.length) {
      console.log(`De-duplication: Reduced from ${salonsToDownload.length} to ${uniqueSalons.length} salons`);
      const duplicatesRemoved = salonsToDownload.length - uniqueSalons.length;
      alert(`Removed ${duplicatesRemoved} duplicate salon(s). Downloading ${uniqueSalons.length} unique salons.`);
    }
    
    // Convert to JSON with proper formatting
    // Root is now an array of salon objects
    const blob = new Blob([JSON.stringify(uniqueSalons, null, 2)], { type: 'application/json' });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'salon-results.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const saveToDatabase = async () => {
    let salonsToSave: Salon[] = [];
    
    if (detailedSalonResults?.salons && detailedSalonResults.salons.length > 0) {
      // Use the detailed salon results which have all the information
      salonsToSave = detailedSalonResults.salons;
    } else if (salonResults?.salons) {
      // Fallback to basic salon data if detailed info is not available
      salonsToSave = salonResults.salons;
    }

    if (salonsToSave.length === 0) {
      setError('No salons to save');
      return;
    }

    // De-duplicate salons before saving to database
    const uniqueSalons = deduplicateSalons(salonsToSave);
    
    // Log de-duplication results
    if (salonsToSave.length !== uniqueSalons.length) {
      console.log(`De-duplication before DB save: Reduced from ${salonsToSave.length} to ${uniqueSalons.length} salons`);
      const duplicatesRemoved = salonsToSave.length - uniqueSalons.length;
      alert(`Removed ${duplicatesRemoved} duplicate salon(s). Saving ${uniqueSalons.length} unique salons to database.`);
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Add suburb and state information to each unique salon
      const salonsWithLocation = uniqueSalons.map(salon => ({
        ...salon,
        suburb: selectedSuburb,
        state: 'NSW'
      }));

      const response = await fetch('/api/save-salons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          salons: salonsWithLocation
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save salons to database');
      }

      const result = await response.json();
      
      // Build detailed message about skipped salons
      let message = `Database Save Results:\n\n`;
      message += `✅ Inserted: ${result.inserted || 0} new salons\n`;
      message += `⏭️ Skipped: ${result.skipped || 0} existing salons\n`;
      
      if (result.skippedSalons && result.skippedSalons.length > 0) {
        message += `\nSkipped salons (already in database):\n`;
        result.skippedSalons.forEach((salon: any) => {
          message += `  • ${salon.name} (${salon.suburb})\n`;
        });
      }
      
      alert(message);
      
    } catch (error) {
      console.error('Error saving to database:', error);
      setError(error instanceof Error ? error.message : 'Failed to save salons to database');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Salon Finder</h1>
        <a 
          href="/review" 
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Review Editor →
        </a>
      </div>
      
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <SuburbSelect
                value={selectedSuburb}
                onChange={setSelectedSuburb}
                disabled={formDisabled}
              />
              <ModelSelector
                value={selectedListModel}
                onChange={setSelectedListModel}
                disabled={formDisabled}
                label="List Model"
                description="Model used for generating salon list"
              />
              <ModelSelector
                value={selectedDetailsModel}
                onChange={setSelectedDetailsModel}
                disabled={formDisabled}
                label="Details Model"
                description="Model used for fetching salon details"
              />
              <div className="flex gap-3">
                <Button
                  onClick={handleSubmit}
                  disabled={!selectedSuburb || formDisabled}
                  className="flex-1"
                >
                  Search
                </Button>
                <Button
                  onClick={handleReset}
                  variant="outline"
                >
                  Reset
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cached Suburbs */}
        <CachedSuburbs 
          key={cacheRefreshKey}
          onSelectCache={handleSelectCache}
          selectedSuburb={isUsingCache ? selectedSuburb : undefined}
        />

        {/* Error and Retry Status Display */}
        {error && !retryInfo && (
          <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
            {error}
          </div>
        )}

        {retryInfo && (
          <div className={`border rounded-lg p-4 text-sm ${
            retryInfo.error.includes('Auth') 
              ? 'bg-red-50 border-red-200 text-red-800'
              : retryInfo.error.includes('Server error')
              ? 'bg-orange-50 border-orange-200 text-orange-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <div className="flex items-center">
              <svg className={`animate-spin -ml-1 mr-3 h-5 w-5 ${
                retryInfo.error.includes('Auth') 
                  ? 'text-red-600'
                  : retryInfo.error.includes('Server error')
                  ? 'text-orange-600'
                  : 'text-amber-600'
              }`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <div>
                <p className="font-medium">
                  {retryInfo.error.includes('Auth') 
                    ? '🔐 Authentication Issue - Retrying...'
                    : retryInfo.error.includes('Server error')
                    ? '💥 Server Error - Retrying...'
                    : retryInfo.error.includes('Rate limit')
                    ? '🚫 Rate Limit - Waiting...'
                    : 'Automatically retrying...'}
                </p>
                <p>{retryInfo.error}</p>
                <p className="mt-1">
                  Attempt {retryInfo.attempt} of {retryInfo.maxAttempts} 
                  {retryInfo.nextRetryIn && (
                    retryInfo.nextRetryIn > 60 
                      ? ` (Retrying in ${Math.floor(retryInfo.nextRetryIn / 60)} minutes ${retryInfo.nextRetryIn % 60} seconds)`
                      : ` (Retrying in ${retryInfo.nextRetryIn} seconds)`
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {(isProcessing || salonResults) && (
          <Card>
            <CardHeader>
              <CardTitle>Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {steps.map((step) => {
                const isResearchComplete = step.id === 'research' && 
                  step.status === 'completed' && 
                  salonResults?.salons;
                
                return (
                  <div key={step.id} className="space-y-2">
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 rounded-full transition-colors ${
                        step.status === 'completed' ? 'bg-primary' :
                        step.status === 'in-progress' ? 'bg-primary animate-pulse' :
                        'bg-muted'
                      }`} />
                      <span>{step.label}</span>
                      {step.detail && (
                        <span className="text-sm text-muted-foreground">- {step.detail}</span>
                      )}
                    </div>
                    {isResearchComplete && step.id === 'research' && salonResults && !step.approved && (
                      <SalonResults 
                        salons={salonResults.salons}
                        selectedSalons={selectedSalonIndices}
                        onSelectionChange={handleSalonSelection}
                        isExpanded={isResearchExpanded}
                        onExpandedChange={setIsResearchExpanded}
                        showApprove={step.status === 'completed' && !step.approved && step.id === currentStep && step.id === 'research'}
                        disabled={currentStep !== 'research'}
                        onApprove={() => handleApprove(step.id)}
                      />
                    )}
                    {step.id === 'fetch-details' && step.status === 'completed' && detailedSalonResults?.salons && (
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="ghost"
                                onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
                                className="space-x-2"
                              >
                                <span>{isDetailsExpanded ? 'Hide' : 'View'} detailed results</span>
                                <span className="text-xs">
                                  {isDetailsExpanded ? '▼' : '▶'}
                                </span>
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        
                        {isDetailsExpanded && (
                          <CardContent className="pt-0 grid gap-3">
                            {detailedSalonResults.salons.map((salon: Salon, index: number) => (
                              <Card key={index}>
                                <CardContent className="pt-6">
                                  <div className="flex-1 min-w-0">
                                    <CardTitle className="text-lg mb-2">{salon.name}</CardTitle>
                                    {salon.address && (
                                      <p className="text-muted-foreground text-sm mb-2">{salon.address}</p>
                                    )}
                                    <div className="grid gap-2">
                                      {Object.entries(salon).map(([key, value]) => {
                                        if (key !== 'name' && key !== 'address' && value) {
                                          return (
                                            <div key={key} className="flex items-baseline gap-2 text-sm">
                                              <span className="font-medium">
                                                {key.charAt(0).toUpperCase() + key.slice(1)}:
                                              </span>
                                              <span className="text-muted-foreground">{String(value)}</span>
                                            </div>
                                          );
                                        }
                                        return null;
                                      })}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </CardContent>
                        )}
                      </Card>
                    )}
                  </div>
                )}
              )}
            </CardContent>
          </Card>
        )}

        {salonResults && steps[2].status === 'completed' && (
          <Card>
            <CardHeader>
              <CardTitle>Save & Export</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-3">
              <Button
                onClick={downloadResults}
                variant="secondary"
              >
                Download JSON
              </Button>
              <Button
                onClick={saveToDatabase}
                disabled={isProcessing}
              >
                {isProcessing ? 'Saving...' : 'Save to Database'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
