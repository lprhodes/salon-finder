import { put, del, list } from '@vercel/blob';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Upload a local image file to Vercel Blob storage
 * @param localPath - Local file path relative to public/thumbnails
 * @param salonName - Name of the salon for organization
 * @returns The public URL of the uploaded blob
 */
export async function uploadThumbnailToBlob(
  localPath: string
): Promise<string> {
  try {
    // Construct the full path to the local file
    const fullPath = path.join(process.cwd(), 'public', 'thumbnails', localPath);
    
    // Read the file
    const fileBuffer = await fs.readFile(fullPath);
    
    // Create a blob path with salon name and filename
    // Format: salon_name/photo_1.jpg (no salons/ prefix)
    const blobPath = localPath;
    
    console.log(`📤 Uploading to Vercel Blob: ${blobPath}`);
    
    // Upload to Vercel Blob
    const blob = await put(blobPath, fileBuffer, {
      access: 'public',
      addRandomSuffix: false, // Keep the exact path we specify
      allowOverwrite: true, // Allow overwriting existing blobs
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    
    console.log(`✅ Uploaded to Blob: ${blob.url}`);
    
    return blob.url;
  } catch (error) {
    console.error(`❌ Failed to upload ${localPath} to Blob:`, error);
    throw error;
  }
}

/**
 * Upload multiple thumbnails to Vercel Blob storage
 * @param localPaths - Array of local file paths relative to public/thumbnails
 * @param salonName - Name of the salon for organization
 * @returns Array of blob URLs in the same order as input paths
 */
export async function uploadThumbnailsToBlob(
  localPaths: string[],
  salonName: string
): Promise<string[]> {
  console.log(`\n=== BLOB UPLOAD ===`);
  console.log(`Uploading ${localPaths.length} thumbnails for ${salonName}`);
  
  try {
    // Upload all thumbnails in parallel
    const uploadPromises = localPaths.map(localPath => 
      uploadThumbnailToBlob(localPath)
    );
    
    const blobUrls = await Promise.all(uploadPromises);
    
    console.log(`✅ Successfully uploaded ${blobUrls.length} thumbnails to Vercel Blob`);
    return blobUrls;
  } catch (error) {
    console.error('Failed to upload thumbnails to Blob:', error);
    // Return empty array on failure - we'll keep using local paths
    return [];
  }
}

/**
 * Delete a blob from Vercel Blob storage
 * @param blobUrl - The URL of the blob to delete
 */
export async function deleteBlobThumbnail(blobUrl: string): Promise<void> {
  try {
    await del(blobUrl, {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    console.log(`🗑️ Deleted blob: ${blobUrl}`);
  } catch (error) {
    console.error(`Failed to delete blob ${blobUrl}:`, error);
  }
}

/**
 * List all blobs for a specific salon
 * @param salonName - Name of the salon
 * @returns List of blob objects
 */
export async function listSalonBlobs(salonName: string) {
  try {
    // Create safe salon name for path
    const safeSalonName = salonName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 30);
    
    const prefix = `${safeSalonName}/`;
    
    const { blobs } = await list({
      prefix,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    
    return blobs;
  } catch (error) {
    console.error(`Failed to list blobs for ${salonName}:`, error);
    return [];
  }
}