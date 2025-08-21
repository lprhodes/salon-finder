/**
 * Salon Data Validator
 * Validates and cleans salon data from various sources including Perplexity API
 */

export interface ValidationResult {
  isValid: boolean;
  cleaned: any;
  issues: string[];
}

/**
 * Cleans salon name by removing annotations and parenthetical notes
 */
export function cleanSalonName(name: string): string {
  let cleaned = name.trim();
  
  // Remove parenthetical annotations like "(already listed)", "(duplicate)", etc.
  cleaned = cleaned.replace(/\s*\([^)]*(?:already listed|duplicate|incomplete|appears to be|same as|excluded|barber|barbershop|also listed|also offers|not directly relevant|not a spa|need to check|in\s+\w+,?\s*not\s+Newtown|in\s+\w+,?\s*excluded)\)/gi, '');
  
  // Remove location notes that indicate the salon is NOT in the target area
  cleaned = cleaned.replace(/\s*\([^)]*(?:not\s+in|in\s+(?:Glebe|Petersham|Erskineville|Eveleigh|Marrickville|Camperdown|Stanmore|Enmore|Redfern|Balmain|Chippendale|Pyrmont|Haymarket|Sydney CBD|Waterloo))[^)]*\)/gi, '');
  
  // Remove simple location markers that are redundant (like "(Newtown)" or "(Newtown location)")
  cleaned = cleaned.replace(/\s*\((?:Newtown|Newtown\s+location|has\s+a\s+Newtown\s+location)\)/gi, '');
  
  // Remove category labels in parentheses
  cleaned = cleaned.replace(/\s*\((?:hair\s+salon|nail\s+salon|beauty\s+salon|spa|massage)\)/gi, '');
  
  // Remove any remaining parenthetical content that looks like a note
  cleaned = cleaned.replace(/\s*\([^)]*(?:this|though|as|but|may|need|based|confirmed)\)/gi, '');
  
  // Remove trailing annotations that might not be in parentheses
  cleaned = cleaned.replace(/\s*-\s*(?:already listed|duplicate|incomplete|appears to be|same as|excluded|need to check).*/gi, '');
  
  // Special handling for entries like "Bella (incomplete name)" -> "Bella"
  if (cleaned.toLowerCase() === 'bella') {
    cleaned = 'Bella Beauty Salon'; // Give it a more complete name
  }
  
  // Remove trailing ellipsis (like "Bella...")
  cleaned = cleaned.replace(/\.{2,}$/, '');
  
  // Clean up any double spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

/**
 * Validates if a string is likely a salon name
 */
export function isValidSalonName(name: any): boolean {
  if (typeof name !== 'string') return false;
  
  const trimmed = name.trim();
  
  // Check basic length requirements
  if (trimmed.length < 2 || trimmed.length > 100) return false;
  
  // Reject entries that are clearly AI reasoning
  if (trimmed.startsWith('They want') ||
      trimmed.startsWith('That\'s ') ||
      trimmed.startsWith('So I have') ||
      trimmed.includes('businesses that are confirmed') ||
      trimmed.includes('user asked for') ||
      trimmed.includes('Let me') ||
      trimmed.includes('I need to') ||
      trimmed.includes('I have') ||
      trimmed.includes('I\'ve') ||
      trimmed.includes('I think') ||
      trimmed.includes('I will') ||
      trimmed.includes('I\'ll')) {
    return false;
  }
  
  // Reject if it's just an address
  if (trimmed.match(/^\d+[\s\/]\w+\s+(Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Place|Pl),?\s+\w+$/i)) {
    return false;
  }
  
  // Reject if it's a service description, not a business name
  if (trimmed.match(/^(Beard Trimming|Men's Shaving|Head Shave|Men's Haircut|Gel Nails|Manicure|Nail Art|Pedicure|Fish Pedicure|Dermaplaning|Microdermabrasion|Threading|Acne Facial|Henna Tattoos|Eyelash Extensions|Brow Lamination|Eyebrow Shaping|LED Light Therapy|Hair Transplants|Laser Hair Removal|Dermal Fillers|Blow Dry|Hair Extensions|Balayage|Children's Haircut|Makeup Service|Facial|Brow Shape|Rejuvenating Facial)/i)) {
    return false;
  }
  
  // Extra scrutiny for very long names (likely prompts or descriptions)
  if (trimmed.length > 50) {
    // Check if it contains location patterns that suggest it's a prompt
    const locationPatterns = [
      /\bin\s+[A-Z][a-z]+,?\s+(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)/,  // "in Newtown, NSW"
      /\bAustralia\b.*\bAustralia\b/i,  // Duplicate "Australia"
      /\b(locate|find|search|list)\b/i,  // Action words
      /\b(all|every|each|any)\s+salons?\b/i,  // Quantifiers with salons
    ];
    
    for (const pattern of locationPatterns) {
      if (pattern.test(trimmed)) return false;
    }
  }
  
  // Reject if it's just numbers (likely a reference)
  if (/^\d+$/.test(trimmed)) return false;
  
  // Reject incomplete names and single words that are too generic
  if (trimmed.toLowerCase() === 'new' || 
      trimmed.toLowerCase() === 'bella' ||
      trimmed.toLowerCase() === 'african salon' ||
      trimmed.toLowerCase() === 'now' ||
      trimmed.toLowerCase() === 'menzone' ||
      trimmed.match(/^[A-Z][a-z]+$/)) { // Single capitalized word
    // Allow certain single-word salon names that are known to be valid
    const validSingleWords = ['bob', 'scissorhands', 'noddys', 'guilles'];
    if (!validSingleWords.includes(trimmed.toLowerCase())) {
      return false;
    }
  }
  
  // Additional checks for AI reasoning text
  if (trimmed.includes('need to exclude') ||
      trimmed.includes('need to check') ||
      trimmed.includes('already listed') ||
      trimmed.includes('appears to be') ||
      trimmed.includes('location not specified') ||
      trimmed.includes('but listed') ||
      trimmed.includes('as per search results') ||
      trimmed.includes('I need to') ||
      trimmed.includes('Let me') ||
      trimmed.includes('Now I') ||
      trimmed.includes('should be excluded') ||
      trimmed.includes('verify which') ||
      trimmed.includes('go through') ||
      trimmed.includes('compile this list') ||
      trimmed.includes('extract the relevant') ||
      trimmed.includes('check if') ||
      trimmed.includes('organize them') ||
      trimmed.includes('remove duplicates') ||
      trimmed.includes('based on the criteria') ||
      trimmed.includes('category:') ||
      trimmed.includes('categories:')) {
    return false;
  }

  // Reject if it contains reference markers or meta text
  const invalidPatterns = [
    /^\[?\d+\]?$/,  // [1], [23], 1, 23, etc.
    /^from\s+\[/i,  // "from [1]"
    /^reference\s+/i,  // "reference 1"
    /^result\s+\d+/i,  // "Result 1", "Result 9:"
    /^okay\s*,?\s*i/i,  // "Okay, I" or similar
    /^the\s+user/i,  // "The user"
    /^here\s+(are|is)/i,  // "Here are", "Here is"
    /^based\s+on/i,  // "Based on"
    /^according\s+to/i,  // "According to"
    /^\s*<.*>\s*$/,  // HTML/XML tags
    /^```/,  // Markdown code blocks
    /^list\s+(of\s+)?.*salons?\s+in/i,  // "List beauty and hair salons in..."
    /^find\s+.*salons?\s+in/i,  // "Find salons in..."
    /^search\s+for\s+.*salons?/i,  // "Search for salons"
    /^salon\s+name\s+\d+$/i,  // "Salon Name 1", "Salon Name 2", etc.
    /^example\s+salon/i,  // "Example Salon"
    /^let\s+me\s+/i,  // "Let me check", "Let me create", etc.
    /^i\s+(need|will|should|must)\s+/i,  // "I need to", "I will", etc.
    /^now\s+i('ll|'ll|ll)\s+/i,  // "Now I'll"
    /^beauty\s+salons?:?$/i,  // "Beauty Salons:"
    /^hair\s+salons?:?$/i,  // "Hair Salons:"
    /^nail\s+salons?:?$/i,  // "Nail Salons:"
    /^day\s+spas?.*:?$/i,  // "Day Spas & Wellness Centers:"
    /^lash\s+and\s+brow.*:?$/i,  // "Lash and Brow Studios:"
    /^skin\s+clinics?.*:?$/i,  // "Skin Clinics & Aesthetics Centers:"
    /^spas?:?$/i,  // "Spas:"
    /^exclude\s+/i,  // "Exclude barbershops"
    /^deduplicate\s+/i,  // "Deduplicate entries"
    /^use\s+the\s+exact/i,  // "Use the exact..."
    /^all\s+others?\s+appear/i,  // "All others appear to be"
    /^i('ll|'ll|ll)\s+use\s+the/i,  // "I'll use the"
    /^test\s+salon/i,  // "Test Salon"
    /^sample\s+salon/i,  // "Sample Salon"
    /^placeholder/i,  // Any placeholder text
    /^beauty\s+and\s+hair\s+salons?\s+in/i,  // "Beauty and hair salons in..."
    /^hair\s+salons?\s+in/i,  // "Hair salons in..."
    /^nail\s+salons?\s+in/i,  // "Nail salons in..."
    /^all\s+salons?\s+in/i,  // "All salons in..."
    /^this\s+gives\s+me/i,  // "This gives me a total..."
    /^after\s+removing/i,  // "After removing duplicates"
    /^title\s+\(/i,  // "Title (# level)"
    /^summary\s+paragraph/i,  // "Summary paragraph"
    /^main\s+body/i,  // "Main Body Sections"
    /^conclusion\s+\(/i,  // "Conclusion (## level)"
    /^i('ll|'ll|ll)\s+make\s+sure/i,  // "I'll make sure to write"
    /^newtown's\s+hair\s+salon\s+scene/i,  // Essay-like content
    /\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT),\s+Australia,?\s+(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)/i,  // Duplicate state names
  ];
  
  for (const pattern of invalidPatterns) {
    if (pattern.test(trimmed)) return false;
  }
  
  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(trimmed)) return false;
  
  // Reject if it's too generic or meta
  const genericTerms = [
    'thinking', 'processing', 'loading', 'error', 'undefined', 
    'null', 'none', 'n/a', 'not found', 'unavailable',
    'hair salons', 'beauty salons', 'nail salons', 'day spas',
    'lash studios', 'skin clinics', 'wellness centers', 'massage centers',
    'lash extension studios', 'massage parlors', 'waxing and hair removal clinics',
    'makeup studios', 'hair salons and barbershops'
  ];
  
  const lowerName = trimmed.toLowerCase();
  for (const term of genericTerms) {
    if (lowerName === term) return false;
  }
  
  return true;
}

/**
 * Cleans and validates a salon list from Perplexity or cache
 */
export function validateSalonList(data: any): ValidationResult {
  const issues: string[] = [];
  let cleaned: string[] = [];
  
  // If it's not an array, try to extract salon names
  if (!Array.isArray(data)) {
    issues.push('Data is not an array');
    
    // If it's a string, try to parse it
    if (typeof data === 'string') {
      const lines = data.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (isValidSalonName(trimmed)) {
          cleaned.push(trimmed);
        }
      }
    } else if (data && typeof data === 'object') {
      // If it's an object with a salons property
      if (data.salons && Array.isArray(data.salons)) {
        data = data.salons;
      } else {
        return {
          isValid: false,
          cleaned: [],
          issues: ['Invalid data structure']
        };
      }
    }
  }
  
  // Process array data
  if (Array.isArray(data)) {
    for (const item of data) {
      // Handle salon objects
      if (item && typeof item === 'object' && item.name) {
        const cleanedName = cleanSalonName(item.name);
        if (isValidSalonName(cleanedName)) {
          cleaned.push(cleanedName);
        } else {
          issues.push(`Invalid salon name: ${item.name}`);
        }
      } 
      // Handle string salon names
      else if (typeof item === 'string') {
        // Skip category headers and summary lines
        if (item.match(/^(Hair|Beauty|Nail|Day|Lash|Skin|Massage)\s+(Salons?|Studios?|Clinics?|Centers?|Spas?)\s*\(\d+\):/i) ||
            item.match(/^This gives me a total/i) ||
            item.match(/^After removing duplicates/i) ||
            item.match(/is listed multiple times/i) ||
            item.match(/^(Title|Summary|Main Body|Conclusion)\s*\(/i) ||
            item.match(/^They want/i) ||
            item.match(/^That's \d+ businesses/i) ||
            item.match(/^So I have/i) ||
            item.match(/^\d+\/\d+\s+\w+\s+(Street|St|Road|Rd)/i) ||
            item.includes('establishments if they exist') ||
            item.includes('businesses that are confirmed')) {
          issues.push(`Skipped meta text: ${item}`);
          continue;
        }
        
        // Check if item indicates it's NOT in the target area before cleaning
        if (item.match(/\((?:in\s+(?:Glebe|Petersham|Erskineville|Eveleigh|Marrickville|Camperdown|Stanmore|Enmore|Redfern),?\s*)?not\s+(?:in\s+)?Newtown\)/i)) {
          issues.push(`Rejected out-of-area salon: ${item}`);
          continue;
        }
        
        const cleanedName = cleanSalonName(item);
        if (isValidSalonName(cleanedName)) {
          cleaned.push(cleanedName);
        } else if (item.includes('(') && item.includes(')')) {
          // Log items that had annotations
          issues.push(`Cleaned annotated item: ${item} -> ${cleanedName || 'invalid'}`);
        } else {
          issues.push(`Rejected item: ${item}`);
        }
      }
      // Log rejected non-string items
      else {
        issues.push(`Rejected non-string item: ${JSON.stringify(item)}`);
      }
    }
  }
  
  // Remove duplicates
  const uniqueCleaned = Array.from(new Set(cleaned));
  if (uniqueCleaned.length < cleaned.length) {
    issues.push(`Removed ${cleaned.length - uniqueCleaned.length} duplicates`);
  }
  cleaned = uniqueCleaned;
  
  // Check if we have any valid salons
  const isValid = cleaned.length > 0;
  
  if (!isValid) {
    issues.push('No valid salon names found after cleaning');
  } else if (cleaned.length === 1) {
    issues.push('Warning: Only 1 salon found - may need to retry with different model');
  }
  
  return {
    isValid,
    cleaned,
    issues
  };
}

/**
 * Validates a single salon object with detailed information
 */
export function validateSalonDetails(salon: any): ValidationResult {
  const issues: string[] = [];
  const cleaned: any = {};
  
  // Required: name
  if (!isValidSalonName(salon?.name)) {
    issues.push('Invalid or missing salon name');
    return {
      isValid: false,
      cleaned: salon,
      issues
    };
  }
  cleaned.name = salon.name.trim();
  
  // Clean address
  if (salon.address && typeof salon.address === 'string') {
    const address = salon.address.trim();
    // Reject if address looks like a reference
    if (!/^\d+$/.test(address) && address.length > 5) {
      cleaned.address = address;
    } else {
      issues.push('Invalid address format');
    }
  }
  
  // Clean coordinates
  if (salon.coordinates) {
    const lat = parseFloat(salon.coordinates.latitude);
    const lng = parseFloat(salon.coordinates.longitude);
    
    if (!isNaN(lat) && !isNaN(lng) && 
        lat >= -90 && lat <= 90 && 
        lng >= -180 && lng <= 180) {
      cleaned.coordinates = {
        latitude: lat,
        longitude: lng
      };
    } else {
      issues.push('Invalid coordinates');
    }
  }
  
  // Clean rating
  if (salon.rating) {
    const stars = parseFloat(salon.rating.stars);
    const reviewers = parseInt(salon.rating.numberOfReviewers);
    
    if (!isNaN(stars) && stars >= 0 && stars <= 5) {
      cleaned.rating = {
        stars,
        numberOfReviewers: isNaN(reviewers) ? 0 : Math.max(0, reviewers)
      };
    } else {
      issues.push('Invalid rating data');
    }
  }
  
  // Clean arrays (services, serviceCategories, thumbnails)
  const arrayFields = ['services', 'serviceCategories', 'thumbnails'];
  for (const field of arrayFields) {
    if (salon[field] && Array.isArray(salon[field])) {
      const cleanedArray = salon[field].filter((item: any) => {
        if (typeof item === 'string') {
          const trimmed = item.trim();
          return trimmed.length > 0 && !/^\d+$/.test(trimmed);
        }
        return false;
      });
      
      if (cleanedArray.length > 0) {
        cleaned[field] = cleanedArray;
      }
    }
  }
  
  // Copy over other valid string fields
  const stringFields = [
    'description', 'primaryService', 'contactNumber', 
    'contactEmail', 'website', 'instagram', 'bookingLink', 'priceRange'
  ];
  
  for (const field of stringFields) {
    if (salon[field] && typeof salon[field] === 'string') {
      const value = salon[field].trim();
      if (value.length > 0 && !/^\d+$/.test(value)) {
        cleaned[field] = value;
      }
    }
  }
  
  // Business hours
  if (salon.businessHours && typeof salon.businessHours === 'object') {
    cleaned.businessHours = salon.businessHours;
  }
  
  // Preserve meta information
  if (salon._meta) {
    cleaned._meta = salon._meta;
  }
  
  return {
    isValid: issues.length === 0 || (issues.length > 0 && cleaned.name),
    cleaned,
    issues
  };
}

/**
 * Batch validates and cleans an array of salons
 */
export function validateSalonBatch(salons: any[]): {
  valid: any[];
  invalid: any[];
  totalIssues: string[];
} {
  const valid: any[] = [];
  const invalid: any[] = [];
  const totalIssues: string[] = [];
  
  if (!Array.isArray(salons)) {
    return {
      valid: [],
      invalid: [salons],
      totalIssues: ['Input is not an array']
    };
  }
  
  for (const salon of salons) {
    const result = validateSalonDetails(salon);
    
    if (result.isValid) {
      valid.push(result.cleaned);
    } else {
      invalid.push(salon);
    }
    
    if (result.issues.length > 0) {
      totalIssues.push(...result.issues.map(issue => `${salon?.name || 'Unknown'}: ${issue}`));
    }
  }
  
  return {
    valid,
    invalid,
    totalIssues
  };
}