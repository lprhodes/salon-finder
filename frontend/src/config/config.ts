// import dotenv from "dotenv";
import path from "path";

export const config = {
  /** Perplexity API key from environment variables */
  API_KEY: process.env.PERPLEXITY_API_KEY || "dummy-key",

  /** Flag to enable testing mode (limits processing to first salon) */
  TESTING_MODE: process.env.TESTING_MODE === "true",

  /** Perplexity API endpoint URL */
  API_URL: "https://api.perplexity.ai/chat/completions",

  /** Google Places API key from environment variables */
  GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY || "",

  /** Flag indicating if Google Places integration is enabled */
  USE_GOOGLE_PLACES: Boolean(process.env.GOOGLE_PLACES_API_KEY),

  /** Width for thumbnail image resizing */
  THUMBNAIL_WIDTH: parseInt(process.env.THUMBNAIL_WIDTH || "400", 10),

  /** Height for thumbnail image resizing */
  THUMBNAIL_HEIGHT: parseInt(process.env.THUMBNAIL_HEIGHT || "300", 10),

  /** Directory path for storing downloaded thumbnails */
  THUMBNAILS_DIR: path.join(process.cwd(), "public", "thumbnails"),

  /** Maximum number of thumbnails to download per salon */
  MAX_THUMBNAILS_PER_SALON: 3,

  /** Delay between API requests in milliseconds */
  REQUEST_DELAY: 1000,

  /** Default file name for salon results */
  RESULTS_FILENAME: "salon-results.json",

  /** Default file name for progress tracking */
  PROGRESS_FILENAME: "salon-progress.txt",

  /** Service categories recognized by the system */
  VALID_SERVICE_CATEGORIES: Object.freeze([
    "Teeth",
    "Cosmetics",
    "Waxing",
    "Brows",
    "Hair",
    "Tan",
    "Skin",
    "Laser",
    "Spa",
    "Lashes",
    "Nails",
    "Makeup",
  ]),

  /** System and user prompts for fetching salon lists */
  SALON_LIST_PROMPTS: {
    system: `You are a comprehensive local business directory researcher specializing in beauty, wellness, and personal care establishments. Your goal is to find as many relevant businesses as possible.`,
    user: `I need a comprehensive list of ALL beauty and wellness businesses currently operating in {SUBURB}, NSW, Australia.

Search for and include:
- Hair salons, hairdressers, and hair studios
- Beauty salons, beauticians, and beauty parlors
- Nail salons, nail bars, and nail studios
- Day spas, wellness centers, and relaxation centers
- Lash extensions, lash bars, and brow studios
- Skin clinics, dermatology clinics, and aesthetics centers
- Massage parlors, Thai massage, remedial massage
- Waxing salons and laser hair removal clinics
- Makeup studios and cosmetic services
- Any other beauty or personal care services

Do NOT include:
- Men's-only barber shops (unless they also offer beauty services)
- Tattoo parlors
- Piercing studios
- Medical clinics (unless they offer cosmetic treatments)
- Gyms or fitness centers

Please be thorough and find as many businesses as possible - aim for 40-60+ establishments if they exist in the area. Include businesses even if you're not 100% certain they're still operating. It's better to include too many than too few.

List each business by its full, exact name as shown in business directories or on their storefronts.`,
  },

  /** Salon detail prompt sections */
  SALON_DETAIL_PROMPTS: {
    system:
      "You are a JSON API endpoint. You MUST return ONLY valid JSON objects without any markdown formatting, code blocks, or explanatory text. Your entire response must start with { and end with } and be valid JSON.",

    intro:
      'I need detailed information about "{SALON_NAME}" salon in {SUBURB}. Use data and thumbnails from fresha.com wherever available.  Please search thoroughly and provide:',

    basicInfo: `1. Basic information:
     - Full business name
     - Complete street address
     - Precise coordinates (longitude and latitude)
     - Brief description of the salon
     - Main service offered`,

    servicesAndCategories: `2. Services and categories:
      - Service categories ONLY from this list: {VALID_SERVICE_CATEGORIES}
      - Top services with prices in numbers (no currency symbols)`,

    businessInfo: `3. Business information:
      - Rating out of 5 and number of reviews
      - Contact number
      - Contact email
      - Instagram handle
      - Website URL
      - Online booking link if available
      - Business hours in 24-hour format (HH:MM) or "closed"`,

    photos: `4. Photos:
      - Find 2-3 REAL image URLs from their:
        * Website
        * Google Business listing
        * Social media profiles
      - Photos should show the salon, their work, or storefront
      - Must be actual, working URLs (no placeholders)`,

    outro: `CRITICAL JSON FORMATTING RULES:
- Return ONLY the JSON object
- Do NOT wrap in markdown code blocks
- Do NOT include \`\`\`json or \`\`\`
- Start your response with { and end with }
- If you cannot find a value, use empty values: '', [], or {}
- Your ENTIRE response must be valid JSON

Use this exact format as an example:
{
    "name": "Aleisha Jane Beauty",
    "address": "340 Crown St, Surry Hills NSW 2010, Australia",
    "coordinates": {
      "longitude": 151.2148784,
      "latitude": -33.8814479
    },
    "description": "Aleisha-Jane Beauty is a multi-award winning, boutique beauty salon, found nestled among the vibrant strip of Crown Street Surry Hills. We offer a beautiful selection of luxe beauty & bespoke facial treatments, along with Meticulous Brow Artistry , Waxing and much more.",
    "primaryService": "Tan",
    "serviceCategories": [
      "Spa",
      "Brows",
      "Lashes",
      "Makeup",
      "Skin"
    ],
    "services": [
      {
        "item": "Rapid 2hr Spray Tan",
        "price": 45
      },
      {
        "item": "Ladies Brows \u2013 Professional Brow Shaping",
        "price": 39
      },
      {
        "item": "Express Balancing Facial",
        "price": 68
      },
      {
        "item": "Full Makeup",
        "price": 99
      },
      {
        "item": "XXX Brazilian Wax",
        "price": 49.5
      },
      {
        "item": "Mini-Microdermabrasion",
        "price": 99
      }
    ],
    "rating": {
      "stars": 4.8,
      "numberOfReviewers": 505
    },
    "contactNumber": "(02) 9331 3236",
    "contactEmail": "some@email.com",
    "instagram": "@aleishajane",
    "website": "https://apps.kitomba.com/bookings/aleishajaneenterprise",
    "bookingLink": "https://apps.kitomba.com/bookings/alei#services",
    "businessHours": {
      "monday": {
        "open": "10:00",
        "close": "16:30"
      },
      "tuesday": {
        "open": "10:30",
        "close": "20:00"
      },
      "wednesday": {
        "open": "10:30",
        "close": "20:00"
      },
      "thursday": {
        "open": "10:30",
        "close": "20:00"
      },
      "friday": {
        "open": "10:00",
        "close": "18:00"
      },
      "saturday": {
        "open": "09:00",
        "close": "16:00"
      },
      "sunday": {
        "open": "closed",
        "close": "closed"
      }
    },
    "thumbnails": [
      "photo_01.jpg",
      "photo_03.jpg"
    ]
}`,
  },
};

/**
 * Builds the salon list user prompt
 */
export function buildSalonListPrompt(suburb: string): string {
  return config.SALON_LIST_PROMPTS.user.replace("{SUBURB}", suburb);
}

/**
 * Gets the system prompt for salon list requests
 */
export const getSalonListSystemPrompt = () => config.SALON_LIST_PROMPTS.system;
/**
 * Builds the complete salon detail prompt
 */
export function buildSalonDetailPrompt(
  salonName: string,
  suburb: string
): string {
  const {
    intro,
    basicInfo,
    servicesAndCategories,
    businessInfo,
    photos,
    outro,
  } = config.SALON_DETAIL_PROMPTS;
  return [
    intro.replace("{SALON_NAME}", salonName).replace("{SUBURB}", suburb),
    basicInfo,
    servicesAndCategories.replace(
      "{VALID_SERVICE_CATEGORIES}",
      config.VALID_SERVICE_CATEGORIES.join(", ")
    ),
    businessInfo,
    photos,
    outro,
  ].join("\n\n");
}

/**
 * Log a warning message with yellow coloring
 */
export function logWarning(message: string): void {
  console.warn("\x1b[33m%s\x1b[0m", `Warning: ${message}`);
}

// Display warnings based on configuration
if (!config.USE_GOOGLE_PLACES) {
  logWarning(
    "Google Places API key not provided. Will use Perplexity data only."
  );
}

if (config.API_KEY === "dummy-key") {
  logWarning(
    "Using dummy API key. Set PERPLEXITY_API_KEY in .env file for actual use."
  );
}
