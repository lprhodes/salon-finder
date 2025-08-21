import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { uploadThumbnailsToBlob } from '@/lib/vercelBlobClient';
import { ServerCache } from '@/lib/serverCache';

export const maxDuration = 60; // Set max execution time to 60 seconds

/**
 * API route to upload all existing local thumbnails to Vercel Blob
 * Can be called to migrate existing thumbnails or re-upload specific salon thumbnails
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { salonName, placeId } = body;
    
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: 'Blob storage is not configured' },
        { status: 500 }
      );
    }
    
    const results: any[] = [];
    
    if (salonName && placeId) {
      // Upload thumbnails for a specific salon
      console.log(`Uploading thumbnails for ${salonName} to Vercel Blob`);
      
      // Get cached salon details
      const cachedDetails = await ServerCache.getSalonDetails(placeId, salonName, 'sonar');
      
      if (!cachedDetails || !cachedDetails.localThumbnails || cachedDetails.localThumbnails.length === 0) {
        return NextResponse.json(
          { error: 'No local thumbnails found for this salon' },
          { status: 404 }
        );
      }
      
      // Upload thumbnails to Blob
      const blobUrls = await uploadThumbnailsToBlob(cachedDetails.localThumbnails, salonName);
      
      if (blobUrls.length > 0) {
        // Update cache with Blob URLs
        const updatedDetails = {
          ...cachedDetails,
          blobUrls,
          thumbnails: blobUrls // Replace thumbnails with Blob URLs
        };
        await ServerCache.saveSalonDetails(updatedDetails as any, 'sonar', placeId);
        
        results.push({
          salonName,
          placeId,
          uploadedCount: blobUrls.length,
          blobUrls
        });
      }
    } else {
      // Upload all thumbnails from the thumbnails directory
      console.log('Uploading all local thumbnails to Vercel Blob');
      
      const thumbnailsDir = path.join(process.cwd(), 'public', 'thumbnails');
      
      try {
        // Read all salon directories
        const salonDirs = await fs.readdir(thumbnailsDir, { withFileTypes: true });
        
        for (const dir of salonDirs) {
          if (dir.isDirectory()) {
            const salonDirPath = path.join(thumbnailsDir, dir.name);
            
            try {
              // Read all image files in the salon directory
              const files = await fs.readdir(salonDirPath);
              const imageFiles = files.filter(file => file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png'));
              
              if (imageFiles.length > 0) {
                // Create local paths relative to thumbnails directory
                const localPaths = imageFiles.map(file => `${dir.name}/${file}`);
                
                // Convert directory name back to salon name (reverse the safe filename conversion)
                const salonName = dir.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                
                // Upload to Blob
                const blobUrls = await uploadThumbnailsToBlob(localPaths, salonName);
                
                if (blobUrls.length > 0) {
                  results.push({
                    salonName,
                    directory: dir.name,
                    uploadedCount: blobUrls.length,
                    blobUrls
                  });
                }
              }
            } catch (error) {
              console.error(`Failed to process salon directory ${dir.name}:`, error);
            }
          }
        }
      } catch (error) {
        console.error('Failed to read thumbnails directory:', error);
        return NextResponse.json(
          { error: 'Failed to read thumbnails directory' },
          { status: 500 }
        );
      }
    }
    
    return NextResponse.json({
      success: true,
      totalSalons: results.length,
      totalImages: results.reduce((sum, r) => sum + r.uploadedCount, 0),
      results
    });
    
  } catch (error) {
    console.error('Error in upload-to-blob route:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload to Blob' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check Blob upload status
 */
export async function GET() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({
      configured: false,
      message: 'Blob storage is not configured'
    });
  }
  
  return NextResponse.json({
    configured: true,
    message: 'Blob storage is configured and ready'
  });
}