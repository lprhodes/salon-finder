# Salon Finder

A simple tool that finds salons in a specified suburb and gathers detailed information about each one.

## What This Tool Does

- Searches for salons in your chosen suburb
- Gathers information like name, address, services, prices, ratings, and contact details
- Downloads and saves thumbnail images
- Saves all results to a file and copies them to your clipboard

## Quick Start Guide

### 1. Prerequisites

You need:
- Node.js installed on your computer
- A Perplexity API key
- A Google Places API key (optional but recommended for better results)

### 2. Setup

1. Open your terminal or command prompt
2. Navigate to the salon-finder folder:
   ```
   cd path/to/salon-finder
   ```
3. Install required packages:
   ```
   npm install
   ```

### 3. Configuration

1. Create a configuration file by copying the example:
   ```
   cp .env.example .env
   ```
2. Edit the `.env` file and add:
   ```
   PERPLEXITY_API_KEY=your_api_key_here
   GOOGLE_PLACES_API_KEY=your_google_api_key_here (optional)
   TARGET_SUBURB=Newtown, Sydney, AU
   PERPLEXITY_MODEL=sonar-deep-research
   TESTING_MODE=false
   ```

The `PERPLEXITY_MODEL` defaults to "sonar-deep-research" if not specified.

### 4. Running the Tool

You can run the tool in two ways:

1. Specifying the suburb directly:
```
npm start --"Newtown, Sydney, AU"
```
2. Using the suburb from your .env file:
```
npm start
```

The results will be:
- Displayed in the terminal
- Saved to `salon-results.json`
- Copied to your clipboard for easy pasting

### 5. Common Issues

- **Command not found**: Make sure you've installed Node.js and are in the correct folder
- **Permission errors**: Try running the command with administrator privileges
- **API errors**: Check that your API keys are correctly entered in the .env file

For debugging, check `salon-progress.txt` which contains detailed information about what happened during the search.

## Frontend Application

This project also includes a Next.js frontend application for searching and displaying salon information.

### Frontend Setup

1. Navigate to the frontend folder:
   ```
   cd frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a configuration file by copying the example:
   ```
   cp .env.example .env
   ```

4. Edit the `.env` file and add:
   ```
   PERPLEXITY_API_KEY=your_api_key_here
   GOOGLE_PLACES_API_KEY=your_google_api_key_here (optional)
   ```

5. Start the development server:
   ```
   npm run dev
   ```

6. Open your browser and navigate to `http://localhost:3000`

### Google Places Integration

The application uses Google Places API to enhance and fill in missing salon details. This feature:

- Only triggers when essential data is missing from the Perplexity API response
- Fills in missing information like:
  - Business hours
  - Contact phone numbers
  - Websites
  - Ratings and reviews
  - Business addresses
- Preserves all data already provided by Perplexity API
