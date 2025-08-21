import axios from 'axios';
import { getSalonListSystemPrompt, buildSalonListPrompt, buildSalonDetailPrompt, config } from '../config/config';
import { perplexityRateLimiter } from './rateLimiter';

export type PerplexityModel = 'sonar-deep-research' | 'sonar-pro' | 'sonar';

// No longer using model fallbacks - we'll extract JSON from any response format

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface PerplexityErrorResponse {
  error?: {
    message: string;
    [key: string]: unknown;
  };
}

export class RetryableError extends Error {
  constructor(message: string, public attempt: number, public maxAttempts: number, public nextRetryMs: number) {
    super(message);
    this.name = 'RetryableError';
  }
}

const isRetryableError = (status?: number): boolean => {
  // Retry on rate limits, auth errors, server errors, and certain network errors
  // 401: Sometimes transient auth issues
  // 429: Rate limit
  // 500: Internal server error
  // 502: Bad gateway
  // 503: Service unavailable
  // 504: Gateway timeout
  return status === 401 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504 || !status;
};

const calculateBackoff = (attempt: number, baseDelay: number = 1000, status?: number): number => {
  // Exponential backoff with jitter: min(baseDelay * 2^attempt + random, maxDelay)
  // Different max delays based on error type
  let maxDelay = 600000; // 10 minutes default max for 401/500 errors
  
  if (status === 429) {
    maxDelay = 300000; // 5 minutes for rate limit
  } else if (status === 503 || status === 502 || status === 504) {
    maxDelay = 120000; // 2 minutes for gateway/availability issues
  }
  
  const exponential = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 1000; // Add up to 1 second of random jitter
  return Math.min(exponential + jitter, maxDelay);
};

const MAX_RETRIES = 5; // Increased from 3 to allow more retries for 401/500 errors

export class PerplexityClient {
  private apiUrl: string;
  private apiKey: string;
  private model: PerplexityModel;

  constructor(model: PerplexityModel = 'sonar') {
    this.apiUrl = process.env.PERPLEXITY_API_URL || 'https://api.perplexity.ai/chat/completions';
    this.apiKey = process.env.PERPLEXITY_API_KEY || '';
    this.model = model;
    
    if (!this.apiKey) {
      throw new Error('Perplexity API key is not configured');
    }
  }

  private async makeRequest(messages: ChatMessage[]) {
    let attempt = 0;
    
    while (true) {
      try {
        // Wait for rate limit slot
        await perplexityRateLimiter.waitForSlot();
        
        const response = await axios.post(
          this.apiUrl,
          {
            model: this.model,
            messages,
            temperature: 0.0,
            response_format: {
              type: "text"
            },
            max_tokens: 4096 // Reduced to avoid truncation
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`
            }
          }
        );

        if (!response.data?.choices?.[0]?.message?.content) {
          throw new Error('Invalid response format from Perplexity API');
        }

        // Record successful request for rate limiting
        perplexityRateLimiter.recordRequest();
        
        return response.data.choices[0].message.content;

      } catch (error) {
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          const errorResponse = error.response?.data as PerplexityErrorResponse;
          const errorMessage = errorResponse?.error?.message || error.message;
          
          console.error('Perplexity API error:', {
            attempt: attempt + 1,
            status,
            data: errorResponse
          });

          // Handle different error types with specific strategies
          if (status === 429) {
            // Rate limit error - use rate limiter's backoff
            perplexityRateLimiter.handle429Error();
            attempt++;
            const waitTime = perplexityRateLimiter.getTimeUntilNextSlot();
            console.warn(`🚫 Rate limit hit - waiting ${Math.round(waitTime/1000)}s before retry ${attempt}/${MAX_RETRIES}`);
            throw new RetryableError(
              `Rate limit hit (Retrying ${attempt}/${MAX_RETRIES} in ${Math.round(waitTime/1000)}s): ${errorMessage}`,
              attempt,
              MAX_RETRIES,
              waitTime
            );
          } else if (status === 401) {
            // Auth error - might be transient, retry with exponential backoff
            if (attempt < MAX_RETRIES) {
              attempt++;
              const backoffMs = calculateBackoff(attempt, 2000, status); // Start with 2s for auth errors
              console.warn(`🔐 Auth error (401) - waiting ${Math.round(backoffMs/1000)}s before retry ${attempt}/${MAX_RETRIES}`);
              throw new RetryableError(
                `Auth error (Retrying ${attempt}/${MAX_RETRIES} in ${Math.round(backoffMs/1000)}s): ${errorMessage}`,
                attempt,
                MAX_RETRIES,
                backoffMs
              );
            }
          } else if (status === 500) {
            // Internal server error - retry with longer backoff
            if (attempt < MAX_RETRIES) {
              attempt++;
              const backoffMs = calculateBackoff(attempt, 3000, status); // Start with 3s for server errors
              console.warn(`💥 Server error (500) - waiting ${Math.round(backoffMs/1000)}s before retry ${attempt}/${MAX_RETRIES}`);
              throw new RetryableError(
                `Server error (Retrying ${attempt}/${MAX_RETRIES} in ${Math.round(backoffMs/1000)}s): ${errorMessage}`,
                attempt,
                MAX_RETRIES,
                backoffMs
              );
            }
          } else if (isRetryableError(status) && attempt < MAX_RETRIES) {
            // Other retryable errors (502, 503, 504, network errors)
            attempt++;
            const backoffMs = calculateBackoff(attempt, 1000, status);
            console.warn(`⚠️ Error ${status} - waiting ${Math.round(backoffMs/1000)}s before retry ${attempt}/${MAX_RETRIES}`);
            throw new RetryableError(
              `Perplexity API error (Retrying ${attempt}/${MAX_RETRIES} in ${Math.round(backoffMs/1000)}s): ${errorMessage}`,
              attempt,
              MAX_RETRIES,
              backoffMs
            );
          }

          // Final error after all retries exhausted
          const finalMessage = status === 401 
            ? `Authentication failed after ${attempt} attempts. Please check your API key.`
            : status === 500
            ? `Server error persisted after ${attempt} attempts. The service may be experiencing issues.`
            : `Perplexity API error (Final after ${attempt} attempts): ${errorMessage}`;
            
          throw new Error(finalMessage);
        }
        throw error;
      }
    }
  }

  private parseJsonResponse(content: string, isArrayExpected: boolean = false) {
    // Enhanced logging
    console.log('=== Parse JSON Response Debug ===');
    console.log('Response length:', content.length);
    console.log('First 200 chars:', content.substring(0, 200));
    console.log('Last 200 chars:', content.substring(Math.max(0, content.length - 200)));
    
    // Check for thinking tags (common with sonar-deep-research model)
    const hasThinkingTags = content.includes('<think>') || content.includes('</think>');
    if (hasThinkingTags) {
      console.log('INFO: Response contains thinking tags - will extract JSON from full response');
    }
    
    // Check for markdown indicators
    if (content.includes('```')) {
      console.log('INFO: Response contains markdown code blocks');
    }
    
    // Strategy 1: Try direct parse (works if response is pure JSON)
    const trimmedContent = content.trim();
    if (trimmedContent.startsWith('[') || trimmedContent.startsWith('{')) {
      try {
        console.log('Attempting direct JSON parse...');
        const parsed = JSON.parse(trimmedContent);
        console.log('✓ Direct parse successful');
        return parsed;
      } catch (e1) {
        console.log('✗ Direct parse failed:', e1 instanceof Error ? e1.message : 'Unknown error');
      }
    }
    
    // Strategy 2: If there are thinking tags, try to extract JSON after them
    if (hasThinkingTags) {
      const thinkEndIndex = content.lastIndexOf('</think>');
      if (thinkEndIndex !== -1) {
        const afterThinking = content.substring(thinkEndIndex + 8).trim();
        if (afterThinking) {
          console.log('Attempting to parse content after thinking tags...');
          try {
            const parsed = JSON.parse(afterThinking);
            console.log('✓ Successfully extracted JSON after thinking tags');
            return parsed;
          } catch {
            console.log('✗ No valid JSON found after thinking tags, will search entire content');
          }
        }
      }
    }

    // Strategy 3: Extract from markdown code blocks
    console.log('Attempting markdown extraction...');
    const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/;
    const match = content.match(codeBlockRegex);
    if (match?.[1]) {
      try {
        const parsed = JSON.parse(match[1].trim());
        console.log('✓ Markdown extraction successful');
        return parsed;
      } catch (e2) {
        console.log('✗ Markdown extraction failed:', e2 instanceof Error ? e2.message : 'Unknown error');
      }
    }

    // Strategy 4: Find JSON structure anywhere in text (including within thinking tags)
    console.log('Attempting JSON structure extraction...');
    
    // For objects (salon details), find the most complete JSON object
    if (!isArrayExpected) {
      // Look for a complete JSON object with "name" field (required for salon details)
      const objectRegex = /\{[^{}]*"name"[^{}]*\}/g; // Find objects containing "name" (removed 's' flag for compatibility)
      const matches = content.matchAll(objectRegex);
      
      let bestMatch = null;
      let bestMatchLength = 0;
      
      for (const match of matches) {
        const jsonStr = match[0];
        try {
          // Try to find the complete object by balancing braces
          let braceCount = 0;
          const startIdx = content.indexOf(jsonStr);
          let endIdx = startIdx;
          
          for (let i = startIdx; i < content.length; i++) {
            if (content[i] === '{') braceCount++;
            if (content[i] === '}') {
              braceCount--;
              if (braceCount === 0) {
                endIdx = i;
                break;
              }
            }
          }
          
          const completeJson = content.substring(startIdx, endIdx + 1);
          const parsed = JSON.parse(completeJson);
          
          // Check if this is a valid salon object and larger than previous matches
          if (parsed.name && completeJson.length > bestMatchLength) {
            bestMatch = parsed;
            bestMatchLength = completeJson.length;
            console.log(`Found potential salon object with ${Object.keys(parsed).length} fields`);
          }
        } catch {
          // Continue searching
        }
      }
      
      if (bestMatch) {
        console.log('✓ Successfully extracted salon details object');
        return bestMatch;
      }
      
      // Fallback: Find any JSON object
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        try {
          const extracted = content.substring(jsonStart, jsonEnd + 1);
          const parsed = JSON.parse(extracted);
          console.log('✓ JSON object extraction successful');
          return parsed;
        } catch (e) {
          console.log('✗ JSON object extraction failed:', e instanceof Error ? e.message : 'Unknown error');
        }
      }
    }
    
    // For arrays, look for JSON array with quoted strings
    if (isArrayExpected) {
      // First try to find a proper JSON array with quoted strings
      const jsonArrayRegex = /\[\s*"[^"]+"/; // Look for array starting with quoted string
      const arrayMatch = content.match(jsonArrayRegex);
      
      if (arrayMatch) {
        const startIndex = content.indexOf(arrayMatch[0]);
        const endIndex = content.indexOf(']', startIndex);
        
        if (startIndex !== -1 && endIndex !== -1) {
          try {
            const extracted = content.substring(startIndex, endIndex + 1);
            console.log('Found JSON array with quoted strings, extracting...');
            const parsed = JSON.parse(extracted);
            
            // Validate it contains actual salon names, not just numbers or references
            if (Array.isArray(parsed) && parsed.length > 0 && 
                parsed.every(item => typeof item === 'string' && item.length > 1 && !(/^\d+$/.test(item)))) {
              console.log('✓ Valid salon list extracted');
              return parsed;
            }
          } catch (e) {
            console.log('✗ JSON array extraction failed:', e instanceof Error ? e.message : 'Unknown error');
          }
        }
      }
      
      // Fallback: Look for the last array bracket, but validate it's not just reference numbers
      const lastArrayStart = content.lastIndexOf('[');
      const lastArrayEnd = content.lastIndexOf(']');
      
      if (lastArrayStart !== -1 && lastArrayEnd !== -1 && lastArrayEnd > lastArrayStart) {
        try {
          const extracted = content.substring(lastArrayStart, lastArrayEnd + 1);
          console.log('Extracted potential JSON from end:', extracted.substring(0, 100) + '...');
          const parsed = JSON.parse(extracted);
          
          // Check if it's just a reference number like [38] and reject it
          if (Array.isArray(parsed) && parsed.length === 1 && /^\d+$/.test(String(parsed[0]))) {
            console.log('✗ Rejected reference number array:', parsed);
            throw new Error('Found reference number, not salon names');
          }
          
          console.log('✓ JSON extraction from end successful');
          return parsed;
        } catch (e) {
          console.log('✗ JSON extraction from end failed:', e instanceof Error ? e.message : 'Unknown error');
        }
      }
    }

    // Strategy 5: For salon lists, try line-by-line extraction
    if (isArrayExpected) {
      console.log('Attempting line-by-line salon extraction...');
      const lines = content.split('\n');
      const salons: string[] = [];
      const salonSet = new Set<string>(); // Use Set to avoid duplicates
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Skip empty lines, thinking markers, and reference indicators
        if (!trimmedLine || trimmedLine.startsWith('<') || trimmedLine.startsWith('From [')) {
          continue;
        }
        
        // Try various patterns to extract salon names
        const patterns = [
          /^\d+\.\s+(.+?)(?:\s+(?:in|at|on)\s+.+)?$/,  // "1. Salon Name" or "1. Salon Name in Location"
          /^[-*•]\s+(.+?)(?:\s+(?:in|at|on)\s+.+)?$/,  // "- Salon Name" or "• Salon Name in Location"
          /"([^"]+)"/,  // Quoted salon names
          /^([A-Z][^,\[\]\{\}]+?)(?:\s*[-–]\s*|\s+in\s+|\s+at\s+|,|$)/,  // Capitalized names followed by separator
        ];
        
        for (const pattern of patterns) {
          const match = trimmedLine.match(pattern);
          if (match && match[1]) {
            const salonName = match[1].trim();
            
            // Validate it's a reasonable salon name
            if (salonName && 
                salonName.length > 2 && 
                salonName.length < 100 &&
                !salonName.match(/^\d+$/) && // Not just numbers
                !salonName.includes('[') && 
                !salonName.includes(']') &&
                !salonName.includes('{') &&
                !salonName.includes('}') &&
                !salonName.toLowerCase().includes('from') &&
                !salonName.toLowerCase().startsWith('the user') &&
                !salonName.toLowerCase().startsWith('okay') &&
                !salonSet.has(salonName)) { // Avoid duplicates
              
              salonSet.add(salonName);
              salons.push(salonName);
              console.log(`  Found salon: "${salonName}"`);
              break; // Move to next line after finding a match
            }
          }
        }
      }
      
      if (salons.length > 0) {
        console.log(`✓ Extracted ${salons.length} salons using line parsing`);
        return salons;
      } else {
        console.log('✗ No valid salon names found in line-by-line extraction');
      }
    }

    // Strategy 6: Try both array and object extraction (opposite of expected)
    console.log('Attempting alternate JSON structure...');
    const altStart = content.indexOf(isArrayExpected ? '{' : '[');
    const altEnd = content.lastIndexOf(isArrayExpected ? '}' : ']');
    
    if (altStart !== -1 && altEnd !== -1 && altEnd > altStart) {
      try {
        const extracted = content.substring(altStart, altEnd + 1);
        const parsed = JSON.parse(extracted);
        console.log('✓ Alternate JSON extraction successful');
        return parsed;
      } catch {
        console.log('✗ Alternate JSON extraction failed');
      }
    }

    // All strategies failed
    console.error('=== All parsing strategies failed ===');
    console.error('Content length:', content.length);
    
    // Log a portion of the content to help debug
    if (content.length > 1000) {
      console.error('First 500 chars:', content.substring(0, 500));
      console.error('Middle 500 chars:', content.substring(Math.floor(content.length/2) - 250, Math.floor(content.length/2) + 250));
      console.error('Last 500 chars:', content.substring(content.length - 500));
    } else {
      console.error('Full content:', content);
    }
    
    throw new Error('Failed to parse Perplexity API response - all strategies exhausted. Check console for full response.');
  }

  /**
   * Extracts an array of salon names from various response formats
   * Uses multiple strategies to handle different AI response patterns
   */
  private extractSalonArray(content: string): string[] {
    console.log('Extracting salon array from response using enhanced strategies');
    
    const allSalons: string[] = [];
    const seenNames = new Set<string>();
    
    // Helper to add unique salon names
    const addSalon = (name: string) => {
      const normalized = name.toLowerCase().trim();
      if (!seenNames.has(normalized) && name.length > 0) {
        seenNames.add(normalized);
        allSalons.push(name);
      }
    };
    
    // Strategy 1: Try to find and parse JSON arrays
    const arrayMatches = content.match(/\[\s*[\s\S]*?\]/g);
    if (arrayMatches) {
      for (const match of arrayMatches) {
        try {
          const parsed = JSON.parse(match);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Check if the array contains actual salon names
            const validItems = parsed.filter(item => {
              if (typeof item === 'string') {
                const trimmed = item.trim();
                return trimmed.length > 3 && 
                       trimmed.length < 100 &&
                       !trimmed.match(/^\[?\d+\]?$/) &&
                       !trimmed.toLowerCase().includes('business') &&
                       !trimmed.toLowerCase().includes('salon name');
              }
              return false;
            });
            
            if (validItems.length > 0) {
              console.log(`Found ${validItems.length} salons in JSON array`);
              validItems.forEach(item => addSalon(item));
            }
          }
        } catch (e) {
          // Continue to next match
        }
      }
    }
    
    // Strategy 2: Look for numbered/bulleted lists in the content
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines, very short lines, and obvious headers
      if (!trimmed || trimmed.length < 3) continue;
      
      // Skip category headers and meta text
      if (trimmed.toLowerCase().includes('here are') ||
          trimmed.toLowerCase().includes('list of') ||
          trimmed.toLowerCase().includes('beauty salons:') ||
          trimmed.toLowerCase().includes('hair salons:') ||
          trimmed.toLowerCase().includes('nail salons:') ||
          trimmed.toLowerCase().includes('day spas') ||
          trimmed.toLowerCase().includes('skin clinics') ||
          trimmed.toLowerCase().includes('lash studios') ||
          trimmed.toLowerCase().includes('brow studios') ||
          trimmed.toLowerCase().includes('lash and brow') ||
          trimmed.toLowerCase().includes('massage centers') ||
          trimmed.toLowerCase().includes('wellness centers') ||
          trimmed.toLowerCase().includes('aesthetics centers') ||
          trimmed.toLowerCase().includes('based on') ||
          trimmed.toLowerCase().includes('let me') ||
          trimmed.toLowerCase().includes('i found') ||
          trimmed.toLowerCase().includes('i\'ll') ||
          trimmed.toLowerCase().includes('searching for') ||
          trimmed.toLowerCase().includes('looking for') ||
          trimmed.toLowerCase().includes('results:') ||
          trimmed.toLowerCase().includes('total:') ||
          trimmed.toLowerCase().includes('note:') ||
          trimmed.toLowerCase().includes('summary:') ||
          trimmed.toLowerCase().includes('this gives me') ||
          trimmed.toLowerCase().includes('after removing') ||
          trimmed.toLowerCase().includes('is listed') ||
          trimmed.toLowerCase().includes('are listed') ||
          trimmed.toLowerCase().includes('multiple times') ||
          trimmed.toLowerCase().includes('same business') ||
          trimmed.toLowerCase().includes('title (') ||
          trimmed.toLowerCase().includes('summary paragraph') ||
          trimmed.toLowerCase().includes('main body') ||
          trimmed.toLowerCase().includes('conclusion (') ||
          trimmed.toLowerCase().includes('make sure to') ||
          trimmed.toLowerCase().includes('newtown\'s hair salon scene') ||
          trimmed.match(/^\s*\(\d+\)\s*:?\s*$/) || // Just "(16):" or similar
          trimmed.match(/^[A-Za-z\s&]+\s+\(\d+\)\s*:?\s*$/)) { // "Hair Salons (16):" patterns
        continue;
      }
      
      // Match various list formats with better extraction
      let salonName = trimmed;
      
      // Remove list markers (numbers, bullets, dashes)
      salonName = salonName.replace(/^\d+\.\s*/, ''); // "1. "
      salonName = salonName.replace(/^[-•*●◆▪]\s*/, ''); // "- ", "• ", etc.
      salonName = salonName.replace(/^\(\d+\)\s*/, ''); // "(1) "
      salonName = salonName.replace(/^\[\d+\]\s*/, ''); // "[1] "
      
      // Remove quotes
      salonName = salonName.replace(/^["']|["']$/g, '');
      
      // Remove trailing punctuation
      salonName = salonName.replace(/[,;]$/, '');
      
      // Clean up the name
      salonName = salonName.trim();
      
      // Clean up incomplete listings indicator
      if (salonName.includes('(incomplete')) {
        salonName = salonName.replace(/\s*\(incomplete.*?\)/gi, '').trim();
      }
      
      // Remove "appears to be" cutoff text
      if (salonName.includes('(appears to be')) {
        salonName = salonName.replace(/\s*\(appears to be.*$/gi, '').trim();
      }
      
      // Remove other parenthetical notes
      if (salonName.includes('(also') || salonName.includes('(same as') || salonName.includes('(not')) {
        salonName = salonName.replace(/\s*\([^)]*(?:also|same as|not)[^)]*\)/gi, '').trim();
      }
      
      // Validate it's a reasonable salon name
      if (salonName.length > 3 && 
          salonName.length < 100 &&
          !salonName.includes('```') &&
          !salonName.includes('{{') &&
          !salonName.includes('}}') &&
          !salonName.startsWith('{') &&
          !salonName.startsWith('[') &&
          !salonName.startsWith('<') &&
          !salonName.startsWith('http') &&
          !salonName.match(/^\d+$/) &&
          !salonName.toLowerCase().includes('business ') &&
          !salonName.toLowerCase().includes('salon name') &&
          !salonName.toLowerCase().includes('example') &&
          !salonName.toLowerCase().includes('placeholder') &&
          !salonName.toLowerCase().includes('test salon') &&
          !salonName.toLowerCase().includes('[name]') &&
          !salonName.toLowerCase().includes('{name}') &&
          !salonName.match(/^bella\s*$/i)) { // Skip just "Bella" without more context
        
        // Additional check: must contain at least one letter
        if (/[a-zA-Z]/.test(salonName)) {
          addSalon(salonName);
        }
      }
    }
    
    // Strategy 3: Look for salon names within specific patterns
    // E.g., "Salon: Name" or "Name (Hair Salon)" patterns
    const patternMatches = content.match(/(?:^|\n)([A-Z][^\n]*?(?:Salon|Beauty|Hair|Nails?|Spa|Skin|Lash|Brow|Studio|Bar|Clinic|Center|Centre|Wellness|Aesthetics|Massage|Relaxation)[^\n]*?)(?:\n|$)/gmi);
    if (patternMatches) {
      for (const match of patternMatches) {
        let name = match.trim();
        
        // Remove list markers if present
        name = name.replace(/^\d+\.\s*/, '');
        name = name.replace(/^[-•*●◆▪]\s*/, '');
        
        // Don't add if it's just a category header
        if (!name.toLowerCase().includes(':') && 
            !name.toLowerCase().startsWith('list of') &&
            !name.toLowerCase().startsWith('here are') &&
            name.length > 5 &&
            name.length < 100) {
          addSalon(name);
        }
      }
    }
    
    // Strategy 4: If we have very few results, try a more aggressive extraction
    if (allSalons.length < 10) {
      console.log('Few results found, trying aggressive extraction...');
      
      // Look for capitalized phrases that could be business names
      const capitalizedPhrases = content.match(/(?:^|\n)([A-Z][A-Za-z0-9\s&'\-]+)(?:\n|$)/gm);
      if (capitalizedPhrases) {
        for (const phrase of capitalizedPhrases) {
          const cleaned = phrase.trim();
          
          // Basic validation
          if (cleaned.length > 5 && 
              cleaned.length < 80 &&
              !cleaned.toLowerCase().includes('here') &&
              !cleaned.toLowerCase().includes('list') &&
              !cleaned.toLowerCase().includes('based') &&
              !cleaned.toLowerCase().includes('note') &&
              !cleaned.toLowerCase().includes('total') &&
              !cleaned.toLowerCase().includes('found') &&
              !cleaned.toLowerCase().includes('search') &&
              !cleaned.toLowerCase().includes('result') &&
              !cleaned.match(/^[A-Z][a-z]+\s+[A-Z][a-z]+:/) && // Not a header like "Beauty Salons:"
              /[a-zA-Z]/.test(cleaned)) {
            addSalon(cleaned);
          }
        }
      }
    }
    
    console.log(`✅ Extracted ${allSalons.length} unique salons using enhanced strategies`);
    
    if (allSalons.length === 0) {
      console.warn('No salons could be extracted from response');
      console.log('Response sample:', content.substring(0, 500));
    } else if (allSalons.length < 5) {
      console.warn(`Only ${allSalons.length} salons extracted - response may be incomplete`);
      console.log('Extracted salons:', allSalons);
    } else {
      console.log(`First 5 salons: ${allSalons.slice(0, 5).join(', ')}`);
    }
    
    return allSalons;
  }

  async listSalons(suburb: string): Promise<string[]> {
    console.log(`Listing salons for suburb: ${suburb} using model: ${this.model}`);
    
    while (true) {
      try {
        const content = await this.makeRequest([
          {
            role: 'system',
            content: getSalonListSystemPrompt(),
          },
          {
            role: 'user',
            content: buildSalonListPrompt(suburb)
          }
        ]);

        console.log('Raw response received from Perplexity');
        
        // First try the standard JSON parsing
        try {
          const data = this.parseJsonResponse(content, true); // Expecting array
          
          if (Array.isArray(data)) {
            // Check if we got a suspicious single result that might be a reference number
            if (data.length === 1) {
              const singleItem = data[0];
              console.warn(`⚠️ Only 1 salon returned: "${singleItem}"`);
              
              // Check if it's likely a reference number or bad response
              if (typeof singleItem === 'string' && 
                  (singleItem.match(/^\d+$/) || // Just numbers
                   singleItem.length < 3 || // Too short to be a salon name
                   singleItem.toLowerCase().includes('reference') ||
                   singleItem.toLowerCase().includes('from'))) {
                console.error(`❌ Rejected suspicious single result: "${singleItem}"`);
                throw new Error('Received invalid single-item response, likely a reference number');
              }
              
              // Still suspicious but might be valid
              console.warn(`⚠️ Only 1 salon returned - this might be correct if the suburb is small`);
            }
            console.log(`Successfully parsed ${data.length} salons`);
            return data;
          } else if (typeof data === 'object' && Array.isArray(data.salons)) {
            console.log(`Successfully parsed ${data.salons.length} salons from object`);
            return data.salons;
          }
        } catch (parseError) {
          console.log('Standard JSON parsing failed, trying enhanced extraction');
          console.log('Parse error:', parseError instanceof Error ? parseError.message : 'Unknown error');
        }
        
        // If standard parsing failed, use the enhanced extraction method
        const extractedSalons = this.extractSalonArray(content);
        
        if (extractedSalons.length > 0) {
          console.log(`Successfully extracted ${extractedSalons.length} salons using enhanced method`);
          return extractedSalons;
        }
        
        console.error('No salons could be extracted from response');
        throw new Error('Failed to extract salon list from response');
      } catch (error) {
        if (error instanceof RetryableError) {
          await new Promise(resolve => setTimeout(resolve, error.nextRetryMs));
          continue;
        }
        throw error;
      }
    }
  }

  async getSalonDetails(salonName: string, suburb: string) {
    console.log(`Getting salon details for ${salonName} using model: ${this.model}`);
    
    while (true) {
      try {
        const content = await this.makeRequest([
          {
            role: 'system',
            content: config.SALON_DETAIL_PROMPTS.system
          },
          {
            role: 'user',
            content: buildSalonDetailPrompt(salonName, suburb)
          }
        ]);

        console.log('Raw response received for salon details');
        const data = this.parseJsonResponse(content, false); // Expecting object
        console.log(`Successfully parsed salon details using model: ${this.model}`);
        return data;
      } catch (error) {
        if (error instanceof RetryableError) {
          await new Promise(resolve => setTimeout(resolve, error.nextRetryMs));
          continue;
        }
        throw error;
      }
    }
  }
}

// PerplexityModel type is already exported at the top of the file