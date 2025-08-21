import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Direct Claude processing with a very focused prompt
 */
export async function cleanSalonListDirect(rawOutput: string): Promise<string[]> {
  console.log('\n=== CLAUDE DIRECT CLEANUP ===');
  
  // Create a very direct prompt optimized for speed
  const prompt = `Extract ALL beauty/salon business names from this text and return as JSON array.
Rules:
- Include actual business names only
- Remove parenthetical notes: (incomplete), (already listed), etc
- Skip if marked "not in [target suburb]" or "in [other suburb]"
- Skip addresses, service descriptions, AI reasoning text
- Each name should appear only once
Text:
${rawOutput.substring(0, 8000)}

Return JSON array:`;

  try {
    // Use echo with proper escaping and --print flag for non-interactive mode
    const escapedPrompt = prompt.replace(/'/g, "'\\''").replace(/"/g, '\\"').replace(/\$/g, '\\$');
    const command = `echo '${escapedPrompt}' | /opt/homebrew/bin/claude --print --model sonnet`;
    
    console.log('Executing Claude with --print flag...');
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 1024 * 1024 * 10,
      timeout: 15000, // Reduced timeout since we're limiting input
      shell: '/bin/bash'
    });
    
    if (stderr && !stderr.includes('Warning')) {
      console.error('Claude stderr:', stderr);
    }
    
    // Extract JSON array from response
    const jsonMatch = stdout.match(/\[\s*(?:"[^"]*"(?:\s*,\s*"[^"]*")*\s*)?\]/);
    
    if (jsonMatch) {
      try {
        const salons = JSON.parse(jsonMatch[0]);
        console.log(`✅ Claude extracted ${salons.length} salons`);
        return salons;
      } catch (e) {
        console.error('Failed to parse JSON:', e);
      }
    }
    
    console.error('No valid JSON array in Claude response');
    console.log('Response:', stdout.substring(0, 500));
    
    // Simple fallback extraction
    const lines = rawOutput.split('\n');
    const salons: string[] = [];
    const seen = new Set<string>();
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Basic filtering
      if (trimmed.length > 3 && 
          trimmed.length < 100 &&
          !trimmed.includes('Let me') &&
          !trimmed.includes('I need') &&
          !trimmed.includes('They want') &&
          !trimmed.includes('businesses') &&
          !trimmed.match(/^\d+/) &&
          !trimmed.match(/^(Hair|Beauty|Nail) Salons/i) &&
          /[A-Za-z]/.test(trimmed)) {
        
        // Clean parenthetical notes
        const cleaned = trimmed.replace(/\s*\([^)]*\)/g, '').trim();
        
        if (cleaned && !seen.has(cleaned.toLowerCase())) {
          seen.add(cleaned.toLowerCase());
          salons.push(cleaned);
        }
      }
    }
    
    console.log(`Fallback: extracted ${salons.length} salons`);
    return salons;
    
  } catch (error) {
    console.error('Error calling Claude:', error);
    throw error;
  }
}