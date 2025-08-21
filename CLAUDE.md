# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Salon Finder is a Next.js application that searches for beauty salons in specified suburbs using the Perplexity API, with optional Google Places API integration for enhanced data enrichment.

## Development Commands

### Backend (Root Directory)
```bash
# Install dependencies
npm install

# Run the CLI tool (two ways)
npm start -- "Suburb Name, City, AU"  # Direct suburb specification
npm start                              # Uses TARGET_SUBURB from .env
```

### Frontend (frontend/ directory)
```bash
# Install dependencies
npm install

# Development server with Turbopack
npm run dev

# Production build
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Architecture Overview

### API Integration Flow
1. **Perplexity API**: Primary data source for salon discovery and details
   - Uses selected model consistently (no fallback) for best data quality
   - Implements sophisticated JSON parsing with 6 extraction strategies
   - Handles thinking tags and various response formats from all models
   - Rate limiting with exponential backoff for retries

2. **Google Places API**: Secondary enrichment for missing data
   - Only triggered when essential data is missing
   - Preserves all Perplexity data, only fills gaps
   - Enriched data is automatically saved back to cache
   - Photo URLs are properly formatted with API key and dimensions:
     - Uses Google Places Photo API format: `/place/photo?maxwidth=400&maxheight=300&photoreference={ref}&key={api_key}`
     - Validates photo references before constructing URLs
     - Includes both width and height parameters for proper sizing

3. **Caching Strategy**:
   - Initial salon details from Perplexity are cached
   - After Google Places enrichment, cache is updated with enriched data
   - After thumbnail processing, cache is updated with local thumbnail paths
   - Cache updates are logged as "Updated" vs "Created" for clarity

### Key Components

**Frontend API Routes** (`frontend/src/app/api/`):
- `research-suburb/route.ts`: Lists salons in a suburb
- `salon-details/route.ts`: Fetches detailed salon information
- `google-places/route.ts`: Enriches data with Google Places
- `save-salons/route.ts`: Persists salon data to MongoDB
- `process-thumbnails/route.ts`: Handles image downloading and processing

**Core Libraries** (`frontend/src/lib/`):
- `perplexityClient.ts`: Handles all Perplexity API interactions with retry logic and advanced JSON extraction
- `googlePlacesClient.ts`: Google Places integration for data enrichment
- `rateLimiter.ts`: Implements request throttling and backoff strategies
- `serverCache.ts`: File-based caching layer for salon data with automatic updates after enrichment
- `salonDataValidator.ts`: Data validation and normalization

## Configuration

### Environment Variables
Both root and frontend directories use `.env` files (copy from `.env.example`):
- `PERPLEXITY_API_KEY`: Required for Perplexity API access
- `GOOGLE_PLACES_API_KEY`: Optional, enables data enrichment
- `PERPLEXITY_LIST_MODEL`: Model for listing salons (default: sonar-deep-research)
- `PERPLEXITY_DETAIL_MODEL`: Model for salon details (default: sonar-deep-research)

### Perplexity Response Handling
The system uses advanced JSON extraction strategies to handle various response formats from all Perplexity models, including:

1. **Direct JSON** - Pure JSON responses (most common with simpler models)
2. **Thinking tags** - Responses wrapped in `<think>` tags (common with sonar-deep-research)
3. **Markdown blocks** - JSON within code blocks
4. **Embedded JSON** - JSON objects/arrays found anywhere in the response
5. **Line-by-line parsing** - For salon lists when JSON extraction fails

The extraction process uses multiple strategies:
- For salon details: Searches for the most complete JSON object with required fields like "name"
- For salon lists: Validates arrays contain actual salon names, not reference numbers
- Brace balancing to extract complete nested objects
- Smart detection of thinking tags to extract JSON from the full response

This approach ensures the selected model (e.g., sonar-deep-research) is always used for its superior data quality, while handling any response format it produces.

## Data Models

### Salon Data Structure
```typescript
{
  name: string
  address: string
  coordinates: { longitude: number, latitude: number }
  description: string
  primaryService: string
  serviceCategories: string[]  // From VALID_SERVICE_CATEGORIES
  services: Array<{ item: string, price: number }>
  rating: { stars: number, numberOfReviewers: number }
  contactNumber: string
  website: string
  businessHours: { [day]: { open: string, close: string } }
  thumbnails: string[]
}
```

### Valid Service Categories
Teeth, Cosmetics, Waxing, Brows, Hair, Tan, Skin, Laser, Spa, Lashes, Nails, Makeup

## Error Handling Patterns

The codebase implements comprehensive error handling:
- **401 errors**: Auth retries with exponential backoff (max 5 attempts)
- **429 errors**: Rate limit handling with calculated backoff
- **500 errors**: Server error retries with longer delays
- **Parse failures**: Multiple extraction strategies to find JSON in any response format

## Testing Considerations

- Set `TESTING_MODE=true` in `.env` to limit processing to first salon only
- Monitor `salon-progress.txt` for detailed debugging information
- Check console logs for JSON extraction strategy details and parsing attempts