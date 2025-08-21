import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);

/**
 * Uses Claude to clean up and extract salon names from messy Perplexity output
 * Using a temp file approach for better handling of complex input
 */
export async function cleanSalonListWithClaude(rawOutput: string): Promise<string[]> {
  console.log('\n=== CLAUDE CLEANUP ===');
  console.log('Processing raw output with Claude...');
  
  const prompt = `Extract all unique salon/beauty business names from the text below.

Rules:
1. Return ONLY a JSON array of strings
2. Remove ALL duplicates (each business should appear only once)
3. Remove ALL annotations in parentheses like "(incomplete listing)", "(appears to be", "(also listed", etc.
4. Skip category headers like "Hair Salons (16):", "Day Spas:", etc.
5. Skip meta text like "This gives me a total", "After removing duplicates", etc.
6. Only include actual business names, not descriptions or notes
7. Clean up names - e.g., "Bella (incomplete listing)" becomes "Bella"

Return format - ONLY this, nothing else:
["Business 1", "Business 2", "Business 3"]

Text to process:
${rawOutput}`;

  // Write prompt to temp file
  const tempFile = path.join(os.tmpdir(), `claude-prompt-${Date.now()}.txt`);
  
  try {
    await writeFileAsync(tempFile, prompt, 'utf-8');
    
    // Execute claude command with the temp file using --print flag
    const command = `cat "${tempFile}" | /opt/homebrew/bin/claude --print --model sonnet`;
    
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      timeout: 20000, // 20 second timeout
      shell: '/bin/bash'
    });
    
    // Clean up temp file
    await unlinkAsync(tempFile).catch(() => {}); // Ignore errors
    
    if (stderr && !stderr.includes('Warning')) {
      console.error('Claude stderr:', stderr);
    }
    
    // Try to parse the Claude response as JSON
    try {
      // Look for JSON array in the response
      const jsonMatch = stdout.match(/\[\s*[\s\S]*?\]/); 
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }
      
      const cleanedList = JSON.parse(jsonMatch[0]);
      
      if (!Array.isArray(cleanedList)) {
        throw new Error('Claude did not return an array');
      }
      
      // Additional validation
      const validSalons = cleanedList.filter(name => 
        typeof name === 'string' && 
        name.length > 2 && 
        name.length < 100 &&
        !name.toLowerCase().includes('salon name') &&
        !name.toLowerCase().includes('business')
      );
      
      console.log(`✅ Claude cleaned ${validSalons.length} salons from raw output`);
      return validSalons;
      
    } catch (parseError) {
      console.error('Failed to parse Claude response as JSON:', parseError);
      console.log('Claude response (first 500 chars):', stdout.substring(0, 500));
      throw new Error('Could not extract salon list from Claude response');
    }
    
  } catch (error) {
    // Clean up temp file on error
    await unlinkAsync(tempFile).catch(() => {});
    console.error('Error calling Claude:', error);
    throw error;
  }
}

/**
 * Alternative method that works better with the actual Claude CLI
 */
export async function cleanSalonListWithClaudeStdin(rawOutput: string): Promise<string[]> {
  console.log('\n=== CLAUDE CLEANUP ===');
  console.log(`Processing ${rawOutput.length} characters with Claude...`);
  
  // First, let's do a quick pre-cleanup to help Claude
  const lines = rawOutput.split('\n');
  const preCleanedLines: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip obvious non-salon lines
    if (trimmed && 
        !trimmed.match(/^(Hair|Beauty|Nail|Day|Lash|Skin)\s+(Salons?|Studios?|Clinics?)\s*\(\d+\):/i) &&
        !trimmed.match(/^This gives me/i) &&
        !trimmed.match(/^After removing/i) &&
        !trimmed.match(/is listed multiple times/i) &&
        !trimmed.match(/^(Title|Summary|Main Body|Conclusion)/i) &&
        trimmed.length > 2) {
      preCleanedLines.push(trimmed);
    }
  }
  
  const preCleanedText = preCleanedLines.join('\n');
  console.log(`Pre-cleaned to ${preCleanedLines.length} potential salon lines`);
  
  const prompt = `You are a JSON formatter. Extract ONLY actual beauty/salon business names from the text below.

RULES:
1. Return ONLY a valid JSON array of strings, nothing else
2. Each string should be a clean business name
3. Remove ALL parenthetical notes like "(incomplete)", "(already listed)", "(in Balmain, not Newtown)"
4. Skip entries that are:
   - Addresses (e.g., "3/325 King St, Newtown")
   - Service descriptions (e.g., "Beard Trimming, Men's Shaving")
   - AI reasoning (e.g., "Let me check", "I need to", "That's 35 businesses")
   - Category headers (e.g., "Hair Salons (16):")
5. Remove duplicates - each business appears only once
6. For entries like "Bella (incomplete name)" just return "Bella"
7. Skip businesses marked as "not in Newtown" or from other suburbs

EXAMPLE INPUT:
A.H Salon Newtown
Bella (incomplete name)
Let me check if there are more
De Beautilash & Nail Bar (in Balmain, not Newtown)
3/325 King St, Newtown
Beard Trimming, Men's Shaving

EXAMPLE OUTPUT:
["A.H Salon Newtown", "Bella"]

NOW PROCESS THIS TEXT AND RETURN ONLY THE JSON ARRAY:
${preCleanedText}`;

  // Write prompt to temp file to avoid shell escaping issues
  const tempFile = path.join(os.tmpdir(), `claude-prompt-${Date.now()}.txt`);
  
  try {
    await writeFileAsync(tempFile, prompt, 'utf-8');
    
    // Use claude directly with the file using --print flag
    const command = `/opt/homebrew/bin/claude --print --model sonnet < "${tempFile}"`;
    
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 1024 * 1024 * 10,
      timeout: 20000, // 20 second timeout
      shell: '/bin/bash'
    });
    
    // Clean up temp file
    await unlinkAsync(tempFile).catch(() => {});
    
    if (stderr && !stderr.includes('Warning')) {
      console.error('Claude stderr:', stderr);
    }
    
    // Find JSON array in response - Claude might add some text before/after
    const jsonMatch = stdout.match(/\[\s*[\s\S]*?\]/);
    
    if (!jsonMatch) {
      console.error('No JSON array found in Claude response');
      console.log('Claude response sample:', stdout.substring(0, 300));
      
      // Fallback: return the pre-cleaned lines if Claude fails
      console.log('Falling back to pre-cleaned lines');
      const fallbackSalons = preCleanedLines
        .map(line => line.replace(/\s*\([^)]*\)/g, '').trim())
        .filter(name => name.length > 2 && name.length < 100);
      
      // Remove duplicates
      return [...new Set(fallbackSalons)];
    }
    
    const cleanedList = JSON.parse(jsonMatch[0]);
    
    if (!Array.isArray(cleanedList)) {
      throw new Error('Parsed result is not an array');
    }
    
    // Remove duplicates and validate
    const uniqueSalons = [...new Set(cleanedList)].filter(name =>
      typeof name === 'string' &&
      name.length > 2 &&
      name.length < 100
    );
    
    console.log(`✅ Claude extracted ${uniqueSalons.length} unique salons`);
    return uniqueSalons;
    
  } catch (error) {
    // Clean up temp file on error
    await unlinkAsync(tempFile).catch(() => {});
    console.error('Error processing with Claude:', error);
    
    // Ultimate fallback: just clean the pre-cleaned lines
    console.log('Using fallback extraction method');
    const fallbackSalons = preCleanedLines
      .map(line => line.replace(/\s*\([^)]*\)/g, '').trim())
      .filter(name => name.length > 2 && name.length < 100 && /[a-zA-Z]/.test(name));
    
    // Remove duplicates
    const uniqueFallback = [...new Set(fallbackSalons)];
    console.log(`Fallback extracted ${uniqueFallback.length} salons`);
    
    if (uniqueFallback.length > 0) {
      return uniqueFallback;
    }
    
    throw error;
  }
}