import { NextResponse } from 'next/server';
import { PerplexityClient, type PerplexityModel, RetryableError } from '@/lib/perplexityClient';
import { ServerCache } from '@/lib/serverCache';
import { validateSalonList } from '@/lib/salonDataValidator';
import { cleanSalonListDirect } from '@/lib/claudeDirectProcessor';

interface ErrorResponse {
  error: string;
  isRetrying?: boolean;
  attempt?: number;
  maxAttempts?: number;
  nextRetryIn?: number;
}

export async function POST(request: Request) {
  try {
    const { suburb, model } = await request.json();
    
    if (!suburb) {
      return NextResponse.json(
        { error: 'Suburb is required' },
        { status: 400 }
      );
    }

    if (!process.env.PERPLEXITY_API_KEY) {
      return NextResponse.json(
        { error: 'Perplexity API key is not configured' },
        { status: 500 }
      );
    }

    const client = new PerplexityClient(model as PerplexityModel);
    console.log('\n=== SALON LIST REQUEST ===' );
    console.log('Suburb:', suburb);
    console.log('Model:', model || 'default');
    console.log('Timestamp:', new Date().toISOString());
    
    try {
      const salons = await client.listSalons(suburb);
      
      console.log('\n=== SALON LIST RESPONSE ===');
      console.log('Raw salon count:', salons.length);
      
      let cleanedSalons: string[] = [];
      
      // Check if Claude cleanup is available (disabled by default for now)
      const useClaudeCleanup = process.env.USE_CLAUDE_CLEANUP === 'true';
      
      if (useClaudeCleanup && salons.length > 0) {
        try {
          // Convert array to string if needed
          const rawText = Array.isArray(salons) 
            ? salons.join('\n')
            : String(salons);
          
          // Use Claude to clean up the salon list
          cleanedSalons = await cleanSalonListDirect(rawText);
          console.log(`✅ Claude cleaned salon count: ${cleanedSalons.length}`);
          
        } catch (claudeError) {
          console.error('Claude cleanup failed, falling back to validation:', claudeError);
          
          // Fallback to original validation method
          const validation = validateSalonList(salons);
          
          if (!validation.isValid) {
            console.error('❌ Salon list validation failed:', validation.issues);
            throw new Error(`Invalid salon data: ${validation.issues.join(', ')}`);
          }
          
          if (validation.issues.length > 0) {
            console.warn('⚠️ Salon list validation warnings:', validation.issues);
          }
          
          cleanedSalons = validation.cleaned;
        }
      } else {
        // Use original validation method (default for now)
        const validation = validateSalonList(salons);
        
        if (!validation.isValid) {
          console.error('❌ Salon list validation failed:', validation.issues);
          throw new Error(`Invalid salon data: ${validation.issues.join(', ')}`);
        }
        
        if (validation.issues.length > 0) {
          console.warn('⚠️ Salon list validation warnings:', validation.issues);
        }
        
        cleanedSalons = validation.cleaned;
      }
      
      console.log(`✅ Final salon count: ${cleanedSalons.length}`);
      
      if (cleanedSalons.length === 0) {
        console.warn('⚠️ No valid salons after cleaning');
        throw new Error('No valid salon data received from API');
      } else if (cleanedSalons.length === 1) {
        console.warn('⚠️ Only 1 salon after cleaning - may need retry');
        console.log('Single salon:', cleanedSalons[0]);
      } else {
        console.log('First 5 cleaned salons:', cleanedSalons.slice(0, 5));
      }
      
      // Convert to salon objects
      const salonObjects = cleanedSalons.map(name => ({ name }));
      
      // Save to server cache
      await ServerCache.saveSalonList(suburb, salonObjects, model);
      console.log(`📁 Saved ${salonObjects.length} validated salons to server cache for ${suburb}`);
      
      return NextResponse.json({
        suburb,
        salons: salonObjects,
        count: salonObjects.length,
        validationIssues: [], // No validation issues when using Claude or successful validation
        debug: {
          modelUsed: model || 'sonar-deep-research',
          timestamp: new Date().toISOString(),
          rawCount: salons.length,
          cleanedCount: cleanedSalons.length,
          firstFewSalons: cleanedSalons.slice(0, 3)
        }
      });
    } catch (error) {
      if (error instanceof RetryableError) {
        const response: ErrorResponse = {
          error: error.message,
          isRetrying: true,
          attempt: error.attempt,
          maxAttempts: error.maxAttempts,
          nextRetryIn: Math.round(error.nextRetryMs / 1000)
        };
        return NextResponse.json(response, { status: 503 });
      }
      throw error; // Let the outer catch block handle non-retryable errors
    }
    
  } catch (error) {
    console.error('Error in research-suburb route:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to research suburb' },
      { status: 500 }
    );
  }
}