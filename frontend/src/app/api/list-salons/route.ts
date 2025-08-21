import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = parseInt(searchParams.get('skip') || '0');
    const suburb = searchParams.get('suburb');
    
    const db = await getDatabase();
    const collection = db.collection('salons');
    
    // Build query
    const query: any = {};
    if (suburb) {
      query['address.suburb'] = new RegExp(suburb, 'i');
    }
    
    // Get total count
    const totalCount = await collection.countDocuments(query);
    
    // Get salons with pagination
    const salons = await collection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    
    return NextResponse.json({
      success: true,
      salons,
      totalCount,
      limit,
      skip,
      hasMore: skip + limit < totalCount
    });
  } catch (error) {
    console.error('Error listing salons:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list salons' 
      },
      { status: 500 }
    );
  }
}