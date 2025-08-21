# Salon Finder Web Interface

A Next.js web interface for the Salon Finder script that helps users find and get details about hair salons in Australian suburbs.

## Features

- Google Places Autocomplete for suburb selection (restricted to Australia)
- Step-by-step progress tracking of salon research
- Detailed salon information display
- JSON export functionality for salon data

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up Google Maps API:
   
   a. Go to the [Google Cloud Console](https://console.cloud.google.com/)
   
   b. Create a new project or select an existing one
   
   c. Enable the following APIs:
      - Places API
      - Maps JavaScript API
   
   d. Create credentials (API key):
      - In the Google Cloud Console, go to APIs & Services > Credentials
      - Click "Create Credentials" > "API key"
      - After creating the key, click "Edit"
      - Under "Application restrictions", select "HTTP referrers (web sites)"
      - Add your domains (for development add `localhost` and `127.0.0.1`)
      - Under "API restrictions", select "Restrict key"
      - Select only:
        * Places API
        * Maps JavaScript API
      - Click "Save"

3. Create a `.env.local` file in the root directory with the following variables:
```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
PERPLEXITY_API_KEY=your-perplexity-api-key
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Usage

1. Enter a suburb name in the search box and select from the Google Places autocomplete suggestions
2. Click "Search" to start the salon research process
3. The system will:
   - Research salons in the selected suburb
   - Fetch detailed information for each salon found
4. Once complete, you can view the results and download them as JSON

## Technologies Used

- Next.js 14
- TypeScript
- Tailwind CSS
- Google Places API
- Perplexity AI API

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps API key with Places API enabled | Yes |
| `PERPLEXITY_API_KEY` | Perplexity API authentication key | Yes |
| `PERPLEXITY_API_URL` | Perplexity API endpoint URL | No (defaults to https://api.perplexity.ai/chat/completions) |

## Troubleshooting

### Google Maps API Issues

1. **API Target Blocked Map Error**:
   - Make sure you've enabled both the Places API and Maps JavaScript API
   - Verify your API key restrictions are properly set
   - Check that your domain (localhost for development) is added to the allowed referrers

2. **Autocomplete Not Working**:
   - Confirm your API key is correctly set in `.env.local`
   - Check browser console for any API-related errors
   - Ensure Places API is enabled in Google Cloud Console

### Perplexity API Issues

1. **Authentication Errors**:
   - Verify your Perplexity API key is correctly set in `.env.local`
   - Check that the API key has sufficient permissions

2. **Response Format Errors**:
   - The application expects JSON responses from the Perplexity API
   - Check the console for any parsing errors

## Security Notes

- Keep your API keys secure and never commit them to version control
- Use appropriate API key restrictions in production
- Consider implementing rate limiting for production use