import { NextResponse } from 'next/server';
import axios from 'axios';

/**
 * Test endpoint to debug Google Places photo download issues
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url } = body;
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    console.log('🧪 Testing photo URL:', url);
    
    // Try to download with minimal headers (for Google API)
    try {
      console.log('Attempt 1: Minimal headers (for Google API)');
      const response1 = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 5000,
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400, // Accept redirects
        headers: {
          'Accept': 'image/*'
        }
      });
      
      console.log('✅ Success with minimal headers');
      console.log('Response status:', response1.status);
      console.log('Content-Type:', response1.headers['content-type']);
      console.log('Content-Length:', response1.headers['content-length']);
      
      return NextResponse.json({
        success: true,
        method: 'minimal-headers',
        contentType: response1.headers['content-type'],
        contentLength: response1.headers['content-length'],
        status: response1.status
      });
    } catch (error1) {
      console.error('❌ Failed with minimal headers:', error1);
      
      if (axios.isAxiosError(error1)) {
        console.error('Error details:', {
          status: error1.response?.status,
          statusText: error1.response?.statusText,
          data: error1.response?.data ? 
            (typeof error1.response.data === 'string' ? 
              error1.response.data.substring(0, 500) : 
              Buffer.from(error1.response.data).toString('utf8').substring(0, 500)
            ) : 'No data',
          headers: error1.response?.headers
        });
      }
    }
    
    // Try with browser headers
    try {
      console.log('Attempt 2: Browser-like headers');
      const response2 = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 5000,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
        }
      });
      
      console.log('✅ Success with browser headers');
      console.log('Response status:', response2.status);
      console.log('Content-Type:', response2.headers['content-type']);
      console.log('Content-Length:', response2.headers['content-length']);
      
      return NextResponse.json({
        success: true,
        method: 'browser-headers',
        contentType: response2.headers['content-type'],
        contentLength: response2.headers['content-length'],
        status: response2.status
      });
    } catch (error2) {
      console.error('❌ Failed with browser headers:', error2);
      
      if (axios.isAxiosError(error2)) {
        console.error('Error details:', {
          status: error2.response?.status,
          statusText: error2.response?.statusText,
          data: error2.response?.data ? 
            (typeof error2.response.data === 'string' ? 
              error2.response.data.substring(0, 500) : 
              Buffer.from(error2.response.data).toString('utf8').substring(0, 500)
            ) : 'No data'
        });
      }
    }
    
    // Both methods failed
    return NextResponse.json({
      success: false,
      error: 'Failed to download image with both methods',
      url: url.substring(0, 200)
    }, { status: 500 });
    
  } catch (error) {
    console.error('Error in test-photo route:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to test photo' },
      { status: 500 }
    );
  }
}