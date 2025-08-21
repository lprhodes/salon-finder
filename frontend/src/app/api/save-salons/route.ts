import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { validateSalonBatch } from '@/lib/salonDataValidator';

interface SalonInput {
  name: string;
  address?: string;
  suburb?: string;
  state?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  description?: string;
  primaryService?: string;
  contactNumber?: string;
  website?: string;
  bookingLink?: string;
  rating?: {
    stars: number;
    numberOfReviewers: number;
  };
  services?: {
    item: string;
    price: number;
  }[];
  priceRange?: string;
  thumbnails?: string[];
  businessHours?: {
    [key: string]: { open: string; close: string } | string;
  };
  serviceCategories?: string[];
  googlePlaceId?: string;
  instagramHandle?: string;
  email?: string;
  salonType?: string;
  category?: string;
}

function transformBusinessHours(hours: any) {
  if (!hours) return undefined;

  const transformedHours: any = {};
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  for (const day of days) {
    const dayHours = hours[day];
    if (dayHours) {
      if (typeof dayHours === 'string') {
        // Handle string format like "9:00 AM - 6:00 PM"
        const match = dayHours.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
        if (match) {
          transformedHours[day] = {
            open: convertTo24Hour(match[1]),
            close: convertTo24Hour(match[2]),
            isClosed: false
          };
        } else if (dayHours.toLowerCase().includes('closed')) {
          transformedHours[day] = { isClosed: true };
        }
      } else if (typeof dayHours === 'object' && dayHours.open && dayHours.close) {
        // Already in object format
        transformedHours[day] = {
          open: convertTo24Hour(dayHours.open),
          close: convertTo24Hour(dayHours.close),
          isClosed: false
        };
      }
    }
  }

  return Object.keys(transformedHours).length > 0 ? { hours: transformedHours } : undefined;
}

function convertTo24Hour(time12h: string): string {
  // If already in 24h format, return as is
  if (/^\d{2}:\d{2}$/.test(time12h)) {
    return time12h;
  }

  const [time, modifier] = time12h.split(/\s+(AM|PM)/i);
  const [hours, minutes] = time.split(':');
  let hour = parseInt(hours);

  if (modifier?.toUpperCase() === 'PM' && hour !== 12) {
    hour += 12;
  } else if (modifier?.toUpperCase() === 'AM' && hour === 12) {
    hour = 0;
  }

  return `${hour.toString().padStart(2, '0')}:${minutes}`;
}

function parseAddress(addressString?: string, suburb?: string, state?: string) {
  if (!addressString) return undefined;

  return {
    fullAddress: addressString,
    suburb: suburb || extractSuburbFromAddress(addressString),
    state: state || extractStateFromAddress(addressString),
    postcode: extractPostcodeFromAddress(addressString)
  };
}

function extractSuburbFromAddress(address: string): string | undefined {
  // Simple extraction - in a real app, you'd use a more sophisticated parser
  const parts = address.split(',');
  if (parts.length >= 2) {
    return parts[parts.length - 2]?.trim();
  }
  return undefined;
}

function extractStateFromAddress(address: string): string | undefined {
  // Look for Australian state abbreviations
  const stateMatch = address.match(/\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\b/i);
  return stateMatch ? stateMatch[1].toUpperCase() : undefined;
}

function extractPostcodeFromAddress(address: string): string | undefined {
  const postcodeMatch = address.match(/\b(\d{4})\b/);
  return postcodeMatch ? postcodeMatch[1] : undefined;
}

export async function POST(request: Request) {
  try {
    const { salons } = await request.json();
    
    if (!salons || !Array.isArray(salons)) {
      return NextResponse.json(
        { error: 'Salons array is required' },
        { status: 400 }
      );
    }

    // Validate all salons before saving
    const batchValidation = validateSalonBatch(salons);
    
    if (batchValidation.valid.length === 0) {
      console.error('❌ No valid salons to save:', batchValidation.totalIssues);
      return NextResponse.json(
        { 
          error: 'No valid salons in the batch',
          issues: batchValidation.totalIssues 
        },
        { status: 400 }
      );
    }
    
    if (batchValidation.invalid.length > 0) {
      console.warn(`⚠️ ${batchValidation.invalid.length} invalid salons will be skipped`);
      console.warn('Issues:', batchValidation.totalIssues);
    }

    const db = await getDatabase();
    const collection = db.collection('salons');
    
    // Use only validated salons for processing
    const validSalons = batchValidation.valid;
    
    // First, check which salons already exist
    const salonChecks = await Promise.all(
      validSalons.map(async (salon: SalonInput) => {
        const existingCount = await collection.countDocuments({
          name: salon.name,
          'address.suburb': salon.suburb || extractSuburbFromAddress(salon.address)
        });
        return {
          salon,
          exists: existingCount > 0
        };
      })
    );

    const existingSalons = salonChecks.filter(check => check.exists).map(check => check.salon);
    const newSalons = salonChecks.filter(check => !check.exists).map(check => check.salon);

    if (newSalons.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All salons already exist in the database',
        skipped: existingSalons.length,
        skippedSalons: existingSalons.map(s => ({ name: s.name, suburb: s.suburb || 'Unknown' })),
        inserted: 0
      });
    }

    // Transform only the new salons for insertion
    const transformedSalons = newSalons.map((salon: SalonInput) => {
      const doc: any = {
        name: salon.name,
        address: parseAddress(salon.address, salon.suburb, salon.state),
        description: salon.description,
        primaryService: salon.primaryService,
        contactNumber: salon.contactNumber,
        email: salon.email,
        website: salon.website,
        bookingLink: salon.bookingLink,
        rating: salon.rating,
        services: salon.services?.map(service => ({
          item: service.item,
          price: service.price
        })),
        priceRange: salon.priceRange,
        thumbnails: salon.thumbnails,
        businessHours: transformBusinessHours(salon.businessHours),
        serviceCategories: salon.serviceCategories,
        googlePlaceId: salon.googlePlaceId,
        instagramHandle: salon.instagramHandle,
        salonTypeFilter: salon.salonType,
        category: salon.category,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Add location if coordinates are provided
      if (salon.coordinates) {
        doc.location = {
          type: 'Point',
          coordinates: [salon.coordinates.longitude, salon.coordinates.latitude]
        };
      }

      // Remove undefined values
      Object.keys(doc).forEach(key => {
        if (doc[key] === undefined) {
          delete doc[key];
        }
      });

      return doc;
    });

    // Insert only new salons
    const result = await collection.insertMany(transformedSalons);
    
    return NextResponse.json({
      success: true,
      message: existingSalons.length > 0 
        ? `Inserted ${result.insertedCount} new salons, skipped ${existingSalons.length} existing salons`
        : `Successfully inserted ${result.insertedCount} new salons`,
      inserted: result.insertedCount,
      skipped: existingSalons.length,
      skippedSalons: existingSalons.map(s => ({ name: s.name, suburb: s.suburb || 'Unknown' })),
      invalidSalons: batchValidation.invalid.length,
      validationIssues: batchValidation.totalIssues,
      totalProcessed: salons.length,
      insertedIds: result.insertedIds
    });
    
  } catch (error) {
    console.error('Error saving salons to database:', error);
    
    // Check for duplicate key error
    if ((error as any).code === 11000) {
      return NextResponse.json(
        { 
          error: 'Duplicate salon detected. Some salons may already exist in the database.',
          details: (error as any).keyValue 
        },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save salons' },
      { status: 500 }
    );
  }
}