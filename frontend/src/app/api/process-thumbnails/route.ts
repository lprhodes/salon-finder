import { NextResponse } from 'next/server';
import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { config } from '@/config/config';
import { uploadThumbnailsToBlob } from '@/lib/vercelBlobClient';

export const maxDuration = 60; // Set max execution time to 60 seconds

/**
 * API route for downloading and processing thumbnails
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { salon } = body;
    
    if (!salon?.name || !salon.thumbnails || salon.thumbnails.length === 0) {
      return NextResponse.json(
        { error: 'Salon name and thumbnails are required' },
        { status: 400 }
      );
    }

    console.log(`🖼️ Processing ${Math.min(salon.thumbnails.length, 3)} thumbnails for ${salon.name}...`);
    
    // Check if we already have local thumbnails (but maybe not Blob URLs)
    const hasLocalThumbnails = salon.localThumbnails?.length > 0 && 
      salon.localThumbnails.every((path: string) => !path.startsWith('http'));
    
    if (hasLocalThumbnails && process.env.BLOB_READ_WRITE_TOKEN) {
      // We already have local files, just need to upload to Blob
      console.log('📤 Local thumbnails exist, uploading to Vercel Blob...');
      
      try {
        const blobUrls = await uploadThumbnailsToBlob(salon.localThumbnails, salon.name);
        
        if (blobUrls.length > 0) {
          console.log(`✅ Uploaded ${blobUrls.length} existing thumbnails to Vercel Blob`);
          return NextResponse.json({ 
            localThumbnails: salon.localThumbnails,
            blobUrls
          });
        }
      } catch (error) {
        console.error('Failed to upload existing thumbnails to Blob:', error);
      }
    }
    
    // Create a safe filename based on salon name
    const safeSalonName = createSafeFilename(salon.name);
    
    // Ensure the directory exists
    const thumbnailsDir = path.join(process.cwd(), 'public', 'thumbnails');
    const salonDir = path.join(thumbnailsDir, safeSalonName);
    
    try {
      await fs.mkdir(thumbnailsDir, { recursive: true });
      await fs.mkdir(salonDir, { recursive: true });
    } catch (err) {
      console.error('Error creating directories:', err);
    }
    
    // Validate and filter thumbnails
    const validThumbnails = salon.thumbnails
      .filter((url: string) => {
        // Skip invalid URLs
        if (!url || typeof url !== 'string') {
          console.warn('  ⚠️ Invalid thumbnail URL type:', typeof url);
          return false;
        }
        
        // Skip placeholder images
        if (url.includes('placeholder') || 
            url.includes('photo_0') || 
            url === 'photo_01.jpg' ||
            url === 'photo_03.jpg' ||
            !url.startsWith('http')) {
          console.log(`  ⏭️ Skipping placeholder/invalid URL: ${url}`);
          return false;
        }
        
        return true;
      })
      .slice(0, 3); // Process max 3 thumbnails
    
    if (validThumbnails.length === 0) {
      console.log('⚠️ No valid thumbnail URLs found for', salon.name);
      return NextResponse.json(
        { localThumbnails: [], warning: 'No valid thumbnail URLs provided' },
        { status: 200 }
      );
    }
    
    console.log(`🖼️ Processing ${validThumbnails.length} valid thumbnails for ${salon.name}...`);
    
    // Process all thumbnails in parallel with timeout
    const thumbnailPromises = validThumbnails.map(async (url: string, i: number) => {
      const index = i + 1;
      const filename = `photo_${index}.jpg`;
      const outputPath = path.join(salonDir, filename);
      // Return path without /thumbnails/ prefix
      const publicPath = `${safeSalonName}/${filename}`;
      
      // Create a timeout promise with longer timeout
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout downloading image ${index}`)), 5000); // 5 second timeout per image
      });
      
      // Create the download promise
      const downloadPromise = async () => {
        try {
          console.log(`  📥 Downloading image ${index}/${validThumbnails.length} from: ${url.substring(0, 50)}...`);
          
          // Check if this is a Google Places API URL
          const isGooglePlacesUrl = url.includes('maps.googleapis.com/maps/api/place/photo');
          
          // Use different headers for Google Places API vs other sources
          const headers = isGooglePlacesUrl ? {
            // Minimal headers for Google API - let axios handle defaults
            'Accept': 'image/*'
          } : {
            // Browser-like headers for other sources (Fresha, Instagram, etc.)
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache'
          };
          
          if (isGooglePlacesUrl) {
            console.log(`  🌍 Detected Google Places API URL`);
          }
          
          // Download image with reasonable timeout
          const response = await axios.get(url, { 
            responseType: 'arraybuffer',
            timeout: 4500, // 4.5 second timeout
            maxContentLength: 10 * 1024 * 1024, // 10MB max
            maxRedirects: 5, // Allow redirects (Google Places API uses 302 redirects)
            validateStatus: (status) => status >= 200 && status < 400, // Accept redirects and success
            headers
          });
          
          // response.data is already an ArrayBuffer when responseType is 'arraybuffer'
          const imageBuffer = Buffer.from(response.data);
          
          // Resize image
          await sharp(imageBuffer)
            .resize({
              width: config.THUMBNAIL_WIDTH || 400,
              height: config.THUMBNAIL_HEIGHT || 300,
              fit: 'cover',
              position: 'center'
            })
            .jpeg({ quality: 80 })
            .toBuffer()
            .then(data => fs.writeFile(outputPath, data));
          
          console.log(`  ✅ Saved thumbnail ${index} to ${publicPath}`);
          return publicPath;
        } catch (error) {
          if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
              console.error(`  ⏱️ Timeout downloading image ${index} for ${salon.name}`);
            } else if (error.response?.status) {
              console.error(`  ❌ HTTP ${error.response.status} downloading image ${index}`);
              // Log more details for Google Places API errors
              if (url.includes('maps.googleapis.com')) {
                console.error(`     Google API Error Details:`);
                console.error(`     URL: ${url.substring(0, 200)}`);
                console.error(`     Status: ${error.response.status}`);
                console.error(`     Response: ${JSON.stringify(error.response.data).substring(0, 200)}`);
                if (error.response.status === 403) {
                  console.error(`     💡 403 Forbidden - Check if API key is valid and has Places API enabled`);
                } else if (error.response.status === 400) {
                  console.error(`     💡 400 Bad Request - Photo reference might be expired or invalid`);
                }
              }
            } else {
              console.error(`  ❌ Network error downloading image ${index}: ${error.message}`);
            }
          } else {
            console.error(`  ❌ Error processing image ${index}: ${error instanceof Error ? error.message : 'Unknown'}`);
          }
          return null;
        }
      };
      
      // Race between download and timeout
      return Promise.race([downloadPromise(), timeoutPromise]).catch(() => null);
    });
    
    // Wait for all thumbnails to process (or fail)
    const results = await Promise.all(thumbnailPromises);
    
    // Filter out nulls (failed downloads)
    const localThumbnails = results.filter((path): path is string => path !== null);
    
    // Upload to Vercel Blob if we have local thumbnails and Blob token is configured
    let blobUrls: string[] = [];
    if (localThumbnails.length > 0 && process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        console.log('📤 Uploading thumbnails to Vercel Blob...');
        blobUrls = await uploadThumbnailsToBlob(localThumbnails, salon.name);
        
        if (blobUrls.length > 0) {
          console.log(`✅ Uploaded ${blobUrls.length} thumbnails to Vercel Blob`);
        }
      } catch (error) {
        console.error('Failed to upload to Vercel Blob, will use local paths:', error);
        // Continue with local paths if Blob upload fails
      }
    }
    
    // Return the processed thumbnails with both local and blob URLs
    if (localThumbnails.length > 0) {
      console.log(`✅ Successfully processed ${localThumbnails.length} thumbnails for ${salon.name}`);
      return NextResponse.json({ 
        localThumbnails,
        blobUrls: blobUrls.length > 0 ? blobUrls : undefined
      });
    } else {
      console.log(`⚠️ Failed to process any thumbnails for ${salon.name}`);
      return NextResponse.json(
        { error: 'Failed to process thumbnails' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error in process-thumbnails route:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process thumbnails' },
      { status: 500 }
    );
  }
}

/**
 * Create a safe filename based on a salon name
 * 
 * @param salonName - The salon name to convert to a safe filename
 * @returns A sanitized filename string
 */
function createSafeFilename(salonName: string): string {
  return salonName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 30); // Limit length
}