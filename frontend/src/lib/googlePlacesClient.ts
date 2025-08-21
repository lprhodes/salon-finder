import axios from 'axios';
import { config } from '@/config/config';
import { Salon } from '@/types';

/**
 * Search for a place using Google Places API via our server-side endpoint
 * 
 * @param query - The search query to find a place
 * @returns Promise containing place data or null if not found/API disabled
 */
export async function searchPlace(query: string) {
  if (!config.USE_GOOGLE_PLACES) {
    console.log('⚠️ Skipping Google Places search: API key not configured');
    return null;
  }

  try {
    console.log(`🔍 Directly searching Google Places for: ${query}`);
    
    // First call: Find place from text
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/findplacefromtext/json',
      {
        params: {
          input: query,
          inputtype: 'textquery',
          fields: [
            'place_id',
            'name',
            'formatted_address',
            'geometry',
            'photos',
            'rating',
            'user_ratings_total',
            'opening_hours',
            'website',
            'formatted_phone_number'
          ],
          key: config.GOOGLE_PLACES_API_KEY
        }
      }
    );

    if (response.data.status === 'OK' && response.data.candidates && response.data.candidates.length > 0) {
      console.log(`✓ Found place match: ${response.data.candidates[0].name || 'Unknown place'}`);
      const placeId = response.data.candidates[0].place_id || '';
      
      // Get place details using placeId
      const detailsResponse = await axios.get(
        'https://maps.googleapis.com/maps/api/place/details/json',
        {
          params: {
            place_id: placeId,
            fields: [
              'name',
              'formatted_address',
              'geometry',
              'photos',
              'rating',
              'user_ratings_total',
              'opening_hours',
              'website',
              'formatted_phone_number',
              'url'
            ],
            key: config.GOOGLE_PLACES_API_KEY
          }
        }
      );

      if (detailsResponse.data.status === 'OK' && detailsResponse.data.result) {
        console.log(`✓ Successfully fetched details for place ID: ${placeId}`);
        return detailsResponse.data.result;
      } else {
        console.log(`⚠️ No details found for place ID: ${placeId} (status: ${detailsResponse.data.status})`);
        return null;
      }
    } else {
      console.log(`⚠️ No Google Places results found: ${config.GOOGLE_PLACES_API_KEY}`, response.data);
      console.log(`⚠️ No Google Places results found for: ${query} (status: ${response.data.status})`);
      return null;
    }
  } catch (error) {
    console.error(`Error searching Google Places for "${query}":`, error);
    return null;
  }
}

/**
 * Format Google business hours to match our Salon interface format
 * 
 * @param openingHours - Opening hours data from Google Places API
 * @returns Formatted business hours object
 */
export function formatBusinessHours(openingHours?: { periods?: Array<{ open?: { day?: number; time?: string }; close?: { day?: number; time?: string } }> }): Record<string, { open: string; close: string }> {
  const defaultHours = {
    monday: { open: "closed", close: "closed" },
    tuesday: { open: "closed", close: "closed" },
    wednesday: { open: "closed", close: "closed" },
    thursday: { open: "closed", close: "closed" },
    friday: { open: "closed", close: "closed" },
    saturday: { open: "closed", close: "closed" },
    sunday: { open: "closed", close: "closed" }
  };
  
  if (!openingHours || !openingHours.periods) {
    return defaultHours;
  }

  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const formattedHours: Record<string, { open: string; close: string }> = {...defaultHours};

  openingHours.periods.forEach((period) => {
    if (period.open && typeof period.open.day === 'number') {
      const day = daysOfWeek[period.open.day];
      // Handle potentially undefined time values
      const openTime = period.open.time ? period.open.time.replace(/(\d{2})(\d{2})/, '$1:$2') : "closed";
      const closeTime = period.close?.time ? 
        period.close.time.replace(/(\d{2})(\d{2})/, '$1:$2') : "closed";
      
      formattedHours[day] = { open: openTime, close: closeTime };
    }
  });

  return formattedHours;
}

/** 
 * Enrich salon data with Google Places information
 * Only fills in missing data, preserving existing Perplexity data when available
 * 
 * @param salon - The salon data to enrich
 * @param suburb - The suburb where the salon is located
 * @returns Promise containing enriched salon data
 */
export async function enrichWithGooglePlaces(salon: Salon, suburb: string): Promise<Salon> {
  if (!config.USE_GOOGLE_PLACES) {
    console.log(`⚠️ Skipping Google Places enrichment for ${salon.name}: API key not configured`);
    return salon;
  }

  console.log(`🔍 Checking for missing data in ${salon.name}`);
  
  console.log(`🔍 Attempting to enrich ${salon.name} with Google Places data`);
  

  // Log what data is missing
  if (!salon.rating?.stars) console.log(`  - Missing: rating`);
  if (!salon.contactNumber) console.log(`  - Missing: contact number`);
  if (!salon.thumbnails || salon.thumbnails.length === 0) console.log(`  - Missing: thumbnails`);
  if (!salon.website) console.log(`  - Missing: website`);
  if (!salon.businessHours) console.log(`  - Missing: business hours`);
  if (!salon.coordinates?.latitude || !salon.coordinates?.longitude) console.log(`  - Missing: coordinates`);
  
  // First try with the full name and suburb
  console.log(`🔍 Searching Google Places for: ${salon.name} in ${suburb}`);
  const searchQuery = `${salon.name} salon ${suburb}`;
  let placeData = await searchPlace(searchQuery);
  
  // If the first search fails, try with the name and address
  if (!placeData && salon.address) {
    console.log(`↪ Trying again with address: ${salon.name} ${salon.address}`);
    placeData = await searchPlace(`${salon.name} ${salon.address}`);
  }

  if (!placeData) {
    console.log(`⚠️ No Google data found for ${salon.name}, using Perplexity data only`);
    return salon;
  }

  console.log(`✅ Found Google Places data for ${salon.name}`);
  console.log(`  📸 Google has ${placeData.photos?.length || 0} photos available`);
  
  // Log coordinates if found
  if (placeData.geometry?.location?.lat && placeData.geometry?.location?.lng) {
    console.log(`  📍 Found coordinates: ${placeData.geometry.location.lat}, ${placeData.geometry.location.lng}`);
  }
  
  // Log existing thumbnails for comparison
  if (salon.thumbnails && salon.thumbnails.length > 0) {
    console.log(`  🔄 Replacing ${salon.thumbnails.length} existing thumbnails:`);
    salon.thumbnails.forEach((url: string, i: number) => {
      const source = url.includes('fresha') ? 'Fresha' :
                     url.includes('instagram') ? 'Instagram' :
                     url.includes('googleapis') ? 'Google' : 'Other';
      console.log(`     ${i + 1}. [${source}] ${url.substring(0, 50)}...`);
    });
  }
  
  // Only use Google data to fill in missing values
  const enrichedSalon: Salon = {
    ...salon,
    // Always use Google data when available
    name: placeData.name || salon.name,
    
    address: placeData.formatted_address || salon.address,
    
    // Add coordinates from Google Places if missing
    coordinates: (placeData.geometry?.location?.lat && placeData.geometry?.location?.lng)
      ? {
          latitude: placeData.geometry.location.lat,
          longitude: placeData.geometry.location.lng
        }
      : salon.coordinates,
    
    rating: placeData.rating 
      ? {
          stars: placeData.rating,
          numberOfReviewers: placeData.user_ratings_total || 0
        }
      : salon.rating,
      
    // Keep Perplexity-specific data that Google doesn't provide
    services: salon.services || [],
    priceRange: salon.priceRange || '',
    serviceCategories: salon.serviceCategories || [],
    
    // ALWAYS prioritize Google Places photos over other sources
    thumbnails: placeData.photos && placeData.photos.length > 0 && config.GOOGLE_PLACES_API_KEY
      ? placeData.photos.slice(0, 3).map((photo: any, index: number) => {
          // Validate photo reference exists
          if (!photo.photo_reference) {
            console.warn(`  ⚠️ Photo ${index + 1} missing photo_reference`);
            return null;
          }
          
          // Ensure we have both width and height parameters for proper image sizing
          const maxWidth = config.THUMBNAIL_WIDTH || 400;
          const maxHeight = config.THUMBNAIL_HEIGHT || 300;
          
          // Build the Google Places Photo API URL with all required parameters
          const params = new URLSearchParams({
            maxwidth: maxWidth.toString(),
            maxheight: maxHeight.toString(),
            photoreference: photo.photo_reference,
            key: config.GOOGLE_PLACES_API_KEY
          });
          
          const url = `https://maps.googleapis.com/maps/api/place/photo?${params.toString()}`;
          
          console.log(`  📷 Google photo ${index + 1}/${Math.min(placeData.photos.length, 3)}:`);
          console.log(`     Photo reference: ${photo.photo_reference.substring(0, 20)}...`);
          console.log(`     Dimensions: ${maxWidth}x${maxHeight}`);
          console.log(`     API key: ${config.GOOGLE_PLACES_API_KEY ? 'Present' : 'Missing!'}`);
          console.log(`     Full URL: ${url.substring(0, 150)}...`);
          
          return url;
        }).filter((url: string | null) => url !== null) // Remove any null entries
      : salon.thumbnails || [],

    contactNumber: placeData.formatted_phone_number 
      ? placeData.formatted_phone_number 
      : salon.contactNumber,
    
    website: placeData.website 
      ? placeData.website 
      : salon.website,
    
    businessHours: placeData.opening_hours ? (
      (() => {
        // Convert the complex hours format to the simple format expected by the frontend
        const formattedHours = formatBusinessHours(placeData.opening_hours);
        
        // Return the structured format { day: { open: "HH:MM", close: "HH:MM" } }
        return formattedHours as typeof salon.businessHours;
      })()
    ) : salon.businessHours
  };

  // List updated fields
  const updatedFields = [];
  if (salon.name !== enrichedSalon.name) updatedFields.push('name');
  if (salon.address !== enrichedSalon.address) updatedFields.push('address');
  if (salon.rating !== enrichedSalon.rating) updatedFields.push('rating');
  if (JSON.stringify(salon.thumbnails) !== JSON.stringify(enrichedSalon.thumbnails)) updatedFields.push('thumbnails');
  if (salon.contactNumber !== enrichedSalon.contactNumber) updatedFields.push('contactNumber');
  if (salon.website !== enrichedSalon.website) updatedFields.push('website');
  if (JSON.stringify(salon.businessHours) !== JSON.stringify(enrichedSalon.businessHours)) updatedFields.push('businessHours');
  
  if (updatedFields.length > 0) {
    console.log(`✅ Updated data for ${salon.name} with Google Places data: ${updatedFields.join(', ')}`);
  } else {
    console.log(`ℹ️ No data updated for ${salon.name}`);
  }
  
  // Log which fields are still using Perplexity data
  console.log(`ℹ️ Using Perplexity data for: services, priceRange, serviceCategories`);
  
  return enrichedSalon;
}