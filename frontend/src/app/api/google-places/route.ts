import { NextResponse } from 'next/server';
import axios from 'axios';
import { config } from '@/config/config';

/**
 * API route for proxying Google Places findPlaceFromText requests
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query } = body;
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    if (!config.USE_GOOGLE_PLACES || !config.GOOGLE_PLACES_API_KEY) {
      return NextResponse.json(
        { error: 'Google Places API is not configured' },
        { status: 500 }
      );
    }

    console.log(`🔍 Searching Google Places for: ${query}`);

    console.log('config.GOOGLE_PLACES_API_KEY', config.GOOGLE_PLACES_API_KEY)
    
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
        return NextResponse.json(detailsResponse.data.result);
      } else {
        console.log(`⚠️ No details found for place ID: ${placeId} (status: ${detailsResponse.data.status})`);
        return NextResponse.json(
          { error: `Failed to get place details: ${detailsResponse.data.status}` },
          { status: 404 }
        );
      }
    } else {
      console.log(`⚠️ No Google Places results found for: ${query} (status: ${response.data.status})`);
      return NextResponse.json(
        { error: `No results found: ${response.data.status}` },
        { status: 404 }
      );
    }
  } catch (error: any) {
    console.error('Error in Google Places API:', error);
    
    // Handle specific error responses
    if (error?.response?.status === 403) {
      return NextResponse.json(
        { 
          error: 'Google Places API returned a 403 Forbidden error. Check API key configuration.' 
        },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search Google Places' },
      { status: 500 }
    );
  }
}