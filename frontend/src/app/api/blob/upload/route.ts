import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import sharp from 'sharp';
import { config } from '@/config/config';

export async function POST(request: NextRequest) {
  try {
    // Check if BLOB_READ_WRITE_TOKEN is configured
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('BLOB_READ_WRITE_TOKEN is not configured');
      return NextResponse.json(
        { error: 'Blob storage is not configured. Please set BLOB_READ_WRITE_TOKEN environment variable.' },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const salonName = formData.get('salonName') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Create a safe salon name for the path
    const safeSalonName = salonName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 30);

    // Check if this is an image
    const isImage = file.type.startsWith('image/');
    
    // Generate filename with timestamp
    const timestamp = Date.now();
    const originalExt = file.name.split('.').pop();
    // Use .jpg extension for images since we convert them to JPEG
    const fileExt = isImage ? 'jpg' : originalExt;
    const fileName = `photo_${timestamp}.${fileExt}`;
    const blobPath = `${safeSalonName}/${fileName}`;

    console.log(`📤 Uploading to Vercel Blob: ${blobPath}`);

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Process the buffer based on file type
    let processedBuffer: Buffer = buffer;

    if (isImage) {
      console.log(`🔄 Resizing image to ${config.THUMBNAIL_WIDTH}x${config.THUMBNAIL_HEIGHT}...`);
      
      try {
        // Resize and optimize the image using the same settings as thumbnail processor
        const resizedBuffer = await sharp(buffer)
          .resize({
            width: config.THUMBNAIL_WIDTH || 400,
            height: config.THUMBNAIL_HEIGHT || 300,
            fit: 'cover',
            position: 'center'
          })
          .jpeg({ 
            quality: 85,
            progressive: true
          })
          .toBuffer();
        
        processedBuffer = Buffer.from(resizedBuffer);
        
        console.log(`✅ Image resized successfully`);
      } catch (resizeError) {
        console.error('⚠️ Failed to resize image, uploading original:', resizeError);
        // Continue with original buffer if resize fails
      }
    }

    // Upload to Vercel Blob
    const blob = await put(blobPath, processedBuffer, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: isImage ? 'image/jpeg' : file.type,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    console.log(`✅ Uploaded to Blob: ${blob.url}`);

    return NextResponse.json({ 
      url: blob.url,
      pathname: blob.pathname 
    });
  } catch (error) {
    console.error('Upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Failed to upload file',
        details: errorMessage,
        hint: errorMessage.includes('token') ? 'BLOB_READ_WRITE_TOKEN may be invalid or expired' : undefined
      },
      { status: 500 }
    );
  }
}