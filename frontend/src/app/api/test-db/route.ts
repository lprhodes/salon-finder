import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

export async function GET() {
  try {
    const db = await getDatabase();
    
    // Test the connection by counting salons
    const collection = db.collection('salons');
    const count = await collection.countDocuments();
    
    // Get a sample salon to verify schema
    const sampleSalon = await collection.findOne({});
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      salonCount: count,
      databaseName: db.databaseName,
      sampleSalonFields: sampleSalon ? Object.keys(sampleSalon) : null
    });
  } catch (error) {
    console.error('Database connection error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect to database' 
      },
      { status: 500 }
    );
  }
}