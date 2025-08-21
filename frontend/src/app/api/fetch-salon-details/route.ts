import { NextResponse } from 'next/server';
import axios from 'axios';
import { PerplexityClient, type PerplexityModel, RetryableError } from '@/lib/perplexityClient';
import { enrichWithGooglePlaces } from '@/lib/googlePlacesClient';
import { perplexityRateLimiter } from '@/lib/rateLimiter';
import { ServerCache } from '@/lib/serverCache';
import { validateSalonDetails } from '@/lib/salonDataValidator';

interface ErrorResponse {
  error: string;
  isRetrying?: boolean;
  attempt?: number;
  maxAttempts?: number;
  nextRetryIn?: number;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { salon, suburb, model, skipCache = false, forceProcessThumbnails = false } = body;
    
    if (!salon?.name || !suburb) {
      return NextResponse.json(
        { error: 'Salon name and suburb are required' },
        { status: 400 }
      );
    }

    if (!process.env.PERPLEXITY_API_KEY) {
      return NextResponse.json(
        { error: 'Perplexity API key is not configured' },
        { status: 500 }
      );
    }

    console.log(`\n=== SALON DETAILS REQUEST ===`);
    console.log(`Salon: ${salon.name}`);
    console.log(`Suburb: ${suburb}`);
    console.log(`Model: ${model || 'default'}`);
    console.log(`Skip cache: ${skipCache}`);
    console.log(`Force process thumbnails: ${forceProcessThumbnails}`);
    
    let salonDetails;
    let fromCache = false;
    const placeId = salon.placeId || salon.place_id; // Support both formats
    
    // Check cache first (unless skipCache is true)
    if (!skipCache) {
      const cachedDetails = await ServerCache.getSalonDetails(placeId, salon.name, model || 'sonar');
      if (cachedDetails) {
        console.log(`📁 Using cached details for ${salon.name}`);
        salonDetails = cachedDetails;
        fromCache = true;
      }
    }
    
    // If not in cache or cache is skipped, fetch from Perplexity
    if (!salonDetails) {
      console.log(`Rate limit status: ${perplexityRateLimiter.getRemainingRequests()} requests remaining`);
      const client = new PerplexityClient(model as PerplexityModel);
      
      try {
        salonDetails = await client.getSalonDetails(salon.name, suburb);
        
        console.log('\n=== SALON DETAILS RESPONSE ===');
        console.log('Has address:', !!salonDetails.address);
        console.log('Has coordinates:', !!salonDetails.coordinates);
        console.log('Has rating:', !!salonDetails.rating);
        console.log('Has contact:', !!salonDetails.contactNumber);
        console.log('Has website:', !!salonDetails.website);
        console.log('Service categories:', salonDetails.serviceCategories?.length || 0);
        console.log('Services:', salonDetails.services?.length || 0);
        console.log('Thumbnails:', salonDetails.thumbnails?.length || 0);
        
        if (salonDetails.thumbnails && salonDetails.thumbnails.length > 0) {
          console.log('Thumbnail URLs:');
          salonDetails.thumbnails.forEach((url: string, i: number) => {
            console.log(`  ${i + 1}. ${url}`);
          });
        }
        
        // Save to cache for future use
        await ServerCache.saveSalonDetails(salonDetails, model || 'sonar', placeId);
      } catch (error) {
        if (error instanceof RetryableError) {
          const response: ErrorResponse = {
            error: error.message,
            isRetrying: true,
            attempt: error.attempt,
            maxAttempts: error.maxAttempts,
            nextRetryIn: Math.round(error.nextRetryMs / 1000)
          };
          return NextResponse.json(response, { status: 503 });
        }
        throw error; // Let the outer catch block handle non-retryable errors
      }
    }
    
    // Enrich salon data with Google Places if there are any missing details
    // Also enrich cached data if critical fields like coordinates are missing
    let enrichedSalonDetails = salonDetails;
    
    // Check if coordinates are missing (critical for map display)
    const missingCoordinates = !salonDetails.coordinates?.latitude || !salonDetails.coordinates?.longitude;
    
    if (!fromCache || forceProcessThumbnails || missingCoordinates) {
      const missingFields = [];
      if (!salonDetails.rating?.stars) missingFields.push('rating');
      if (!salonDetails.contactNumber) missingFields.push('contactNumber');
      if (!salonDetails.website) missingFields.push('website');
      if (!salonDetails.businessHours) missingFields.push('businessHours');
      if (!salonDetails.thumbnails || salonDetails.thumbnails.length === 0) missingFields.push('thumbnails');
      if (!salonDetails.coordinates?.latitude || !salonDetails.coordinates?.longitude) missingFields.push('coordinates');
      
      // Check if existing thumbnails are from non-Google sources that might fail
      const hasNonGoogleThumbnails = salonDetails.thumbnails?.some((url: string) => 
        url.includes('fresha.com') || 
        url.includes('instagram') || 
        url.includes('scontent') ||
        !url.includes('googleapis.com')
      );
      
      if (hasNonGoogleThumbnails) {
        console.log(`⚠️ Found non-Google thumbnails (likely from Fresha/Instagram). Will replace with Google Places photos.`);
        missingFields.push('thumbnails-replacement');
      }
      
      if (missingFields.length > 0) {
        console.log(`Missing/replaceable fields: ${missingFields.join(', ')}. Attempting to fill with Google Places data.`);
      } else {
        console.log('All essential salon details present with Google sources.');
      }
      
      enrichedSalonDetails = await enrichWithGooglePlaces(salonDetails, suburb);
      
      // Update cache with enriched data
      // Use the place ID from Google if available, otherwise use the original place ID
      const cacheKey = enrichedSalonDetails.placeId || placeId;
      await ServerCache.saveSalonDetails(enrichedSalonDetails, model || 'sonar', cacheKey);
      
      console.log('Enriched salon details with Google Places and updated cache');
    } else {
      console.log('Using cached data with complete information, skipping Google Places enrichment');
    }
    
    // Process thumbnails if available (with timeout to prevent stalling)
    // Check if thumbnails need processing:
    // 1. If any thumbnail is an external URL (needs downloading)
    // 2. If we have local thumbnails but no blob URLs (needs uploading to Blob)
    const finalSalonDetails = { ...enrichedSalonDetails };
    const hasUnprocessedThumbnails = enrichedSalonDetails.thumbnails?.some((thumb: string) => 
      thumb && (thumb.startsWith('http://') || thumb.startsWith('https://'))
    );
    const hasLocalThumbnailsWithoutBlobs = enrichedSalonDetails.localThumbnails?.length > 0 && 
      (!enrichedSalonDetails.blobUrls || enrichedSalonDetails.blobUrls.length === 0);
    
    const shouldProcessThumbnails = !fromCache || forceProcessThumbnails || hasUnprocessedThumbnails || hasLocalThumbnailsWithoutBlobs;
    
    if (shouldProcessThumbnails && enrichedSalonDetails.thumbnails && enrichedSalonDetails.thumbnails.length > 0) {
      try {
        console.log(`\n=== THUMBNAIL PROCESSING ===`);
        console.log(`Processing ${enrichedSalonDetails.thumbnails.length} thumbnails with 10s timeout...`);
        console.log(`Reason: ${!fromCache ? 'New data' : 
          forceProcessThumbnails ? 'Forced' : 
          hasUnprocessedThumbnails ? 'Unprocessed URLs found' : 
          hasLocalThumbnailsWithoutBlobs ? 'Local thumbnails need Blob upload' : 
          'Unknown'}`);
        
        const baseUrl = process.env.VERCEL_URL 
          ? `https://${process.env.VERCEL_URL}` 
          : process.env.NEXT_PUBLIC_API_URL
          ? process.env.NEXT_PUBLIC_API_URL
          : 'http://localhost:3000';
        
        const response = await axios.post(
          `${baseUrl}/api/process-thumbnails`, 
          { salon: enrichedSalonDetails },
          { 
            timeout: 10000, // 10 second timeout for entire thumbnail processing
            validateStatus: (status) => status === 200
          }
        );
        
        if (response.data && response.data.localThumbnails) {
          // Use Blob URLs if available, otherwise use local paths
          const thumbnailUrls = response.data.blobUrls || response.data.localThumbnails;
          
          // Replace the thumbnails URIs with Blob URLs or local paths
          finalSalonDetails.thumbnails = thumbnailUrls;
          finalSalonDetails.localThumbnails = response.data.localThumbnails;
          finalSalonDetails.blobUrls = response.data.blobUrls;
          
          console.log(`✅ Successfully processed ${response.data.localThumbnails.length} thumbnails`);
          if (response.data.blobUrls) {
            console.log('Blob URLs:', response.data.blobUrls);
          } else {
            console.log('Local paths:', response.data.localThumbnails);
          }
          
          // Update cache with processed thumbnails
          const cacheKey = finalSalonDetails.placeId || placeId;
          await ServerCache.saveSalonDetails(finalSalonDetails, model || 'sonar', cacheKey);
          console.log('Updated cache with processed thumbnails');
        } else if (response.data && response.data.warning) {
          console.warn(`⚠️ Thumbnail warning: ${response.data.warning}`);
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
          console.error('Thumbnail processing timed out after 10 seconds, continuing without local thumbnails');
        } else {
          console.error('Error processing thumbnails:', error instanceof Error ? error.message : 'Unknown error');
        }
        // Continue without local thumbnails if processing fails
      }
    } else if (!shouldProcessThumbnails) {
      console.log('Skipping thumbnail processing (all thumbnails are already local paths)');
    } else {
      console.log('No thumbnails to process');
    }
    
    // Validate the final salon details before returning
    const validation = validateSalonDetails(finalSalonDetails);
    
    if (!validation.isValid) {
      console.error('❌ Salon details validation failed:', validation.issues);
    }
    
    if (validation.issues.length > 0) {
      console.warn('⚠️ Salon details validation warnings:', validation.issues);
    }
    
    // Include cache status in response
    return NextResponse.json({
      ...validation.cleaned,
      localThumbnails: finalSalonDetails.localThumbnails || [],
      blobUrls: finalSalonDetails.blobUrls || [],
      _meta: {
        fromCache,
        model: model || 'sonar',
        placeId: enrichedSalonDetails.placeId || placeId,
        validationIssues: validation.issues
      }
    });
    
  } catch (error) {
    console.error('Error in fetch-salon-details route:', error);
    
    // Check if it's a RetryableError that somehow made it to the outer catch
    if (error instanceof RetryableError) {
      const response: ErrorResponse = {
        error: error.message,
        isRetrying: true,
        attempt: error.attempt,
        maxAttempts: error.maxAttempts,
        nextRetryIn: Math.round(error.nextRetryMs / 1000)
      };
      return NextResponse.json(response, { status: 503 });
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch salon details' },
      { status: 500 }
    );
  }
}