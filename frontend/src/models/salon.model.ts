import { Schema, model, models, Document, Types } from 'mongoose';

// Address Sub-schema
const AddressSchema = new Schema({
  street: String,
  suburb: { type: String, index: true },
  city: String,
  state: String,
  postcode: String,
  country: String,
  fullAddress: { type: String, required: true }
}, { _id: false });

// Coordinates Sub-schema (GeoJSON Point)
const PointSchema = new Schema({
  type: {
    type: String,
    enum: ['Point'],
    required: true,
    default: 'Point'
  },
  coordinates: {
    type: [Number], // [longitude, latitude]
    required: true
  }
}, { _id: false });

// SalonService Sub-schema
const SalonServiceSchema = new Schema({
  item: { type: String, required: true },
  price: { type: Number, required: true },
  durationMinutes: Number,
  description: String
}, { _id: false });

// SalonRating Sub-schema
const SalonRatingSchema = new Schema({
  stars: { type: Number, required: true, min: 0, max: 5 },
  numberOfReviewers: { type: Number, required: true, min: 0 }
}, { _id: false });

// DayHours Sub-schema
const DayHoursSchema = new Schema({
  open: { type: String, match: /^(?:[01]\d|2[0-3]):[0-5]\d$/ },
  close: { type: String, match: /^(?:[01]\d|2[0-3]):[0-5]\d$/ },
  isClosed: { type: Boolean, required: true, default: false }
}, { _id: false });

// BusinessHours Sub-schema
const BusinessHoursSchema = new Schema({
  hours: {
    monday: DayHoursSchema,
    tuesday: DayHoursSchema,
    wednesday: DayHoursSchema,
    thursday: DayHoursSchema,
    friday: DayHoursSchema,
    saturday: DayHoursSchema,
    sunday: DayHoursSchema
  }
}, { _id: false });

// Discount Sub-schema
const DiscountSchema = new Schema({
  title: { type: String, required: true },
  tag: String,
  description: String,
  terms: String,
  validUntil: Date,
  isVip: { type: Boolean, default: false },
  code: String
}, { _id: false });

// Main Salon Schema
export interface ISalon extends Document {
  _id: Types.ObjectId;
  name: string;
  address?: {
    street?: string;
    suburb?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    fullAddress: string;
  };
  googlePlaceId?: string;
  location?: {
    type: string;
    coordinates: number[];
  };
  description?: string;
  primaryService?: string;
  serviceCategories?: string[];
  services?: Array<{
    item: string;
    price: number;
    durationMinutes?: number;
    description?: string;
  }>;
  instagramHandle?: string;
  instagramBusinessId?: string;
  instagramFeed?: string[];
  rating?: {
    stars: number;
    numberOfReviewers: number;
  };
  contactNumber?: string;
  email?: string;
  website?: string;
  bookingLink?: string;
  businessHours?: {
    hours: {
      [key: string]: {
        open?: string;
        close?: string;
        isClosed: boolean;
      };
    };
  };
  thumbnails?: string[];
  discounts?: Array<{
    title: string;
    tag?: string;
    description?: string;
    terms?: string;
    validUntil?: Date;
    isVip?: boolean;
    code?: string;
  }>;
  salonTypeFilter?: string;
  category?: string;
  priceRange?: string;
  isSpotlighted?: boolean;
  isTrending: boolean;
  trendingRank?: number;
  createdAt?: Date;
  updatedAt?: Date;
  isLocationPotentiallyIncorrect?: boolean;
  locationAccuracyIssueType?: string;
  lastLocationAccuracyCheck?: Date;
  cachedGoogleRating?: number;
  cachedGoogleReviewCount?: number;
  lastGoogleDataUpdate?: Date;
  googleDataStale?: boolean;
  lastGoogleApiCall?: Date;
  googleApiCallsToday?: number;
  googleApiCallsResetDate?: Date;
}

const SalonSchema = new Schema<ISalon>({
  name: { type: String, required: true, index: true },
  address: AddressSchema,
  googlePlaceId: { type: String, unique: true, sparse: true },
  location: { type: PointSchema, index: '2dsphere' },
  description: String,
  primaryService: String,
  serviceCategories: [String],
  services: { type: [SalonServiceSchema], default: [] },
  instagramHandle: String,
  instagramBusinessId: String,
  instagramFeed: [String],
  rating: SalonRatingSchema,
  contactNumber: String,
  email: String,
  website: String,
  bookingLink: String,
  businessHours: BusinessHoursSchema,
  thumbnails: [String],
  discounts: { type: [DiscountSchema], default: [] },
  salonTypeFilter: { type: String, index: true },
  category: { type: String, index: true },
  priceRange: { type: String, index: true },
  isSpotlighted: { type: Boolean, default: false, index: true },
  isTrending: { type: Boolean, default: false, index: true },
  trendingRank: { type: Number, index: true, sparse: true },
  isLocationPotentiallyIncorrect: { type: Boolean, default: false, index: true },
  locationAccuracyIssueType: {
    type: String,
    enum: ['MISSING', 'OUT_OF_BOUNDS', 'ADDRESS_MISMATCH', 'ZERO_COORDS']
  },
  lastLocationAccuracyCheck: Date,
  cachedGoogleRating: { type: Number, min: 0, max: 5 },
  cachedGoogleReviewCount: { type: Number, min: 0 },
  lastGoogleDataUpdate: Date,
  googleDataStale: { type: Boolean, default: false },
  lastGoogleApiCall: Date,
  googleApiCallsToday: { type: Number, default: 0 },
  googleApiCallsResetDate: Date
}, { timestamps: true });

// Text index for text search
SalonSchema.index(
  {
    name: 'text',
    description: 'text',
    primaryService: 'text',
    'address.fullAddress': 'text',
    'address.suburb': 'text',
    'address.city': 'text',
    'address.state': 'text',
    'address.postcode': 'text',
    serviceCategories: 'text',
    category: 'text'
  },
  {
    weights: {
      name: 10,
      'address.suburb': 8,
      'address.city': 6,
      primaryService: 5,
      serviceCategories: 4,
      category: 3,
      'address.fullAddress': 2,
      description: 1,
      'address.state': 1,
      'address.postcode': 1
    },
    name: 'salon_text_search_index'
  }
);

// Compound index for filtering and sorting
SalonSchema.index({ 'rating.stars': -1, createdAt: -1 });
SalonSchema.index({ salonTypeFilter: 1, category: 1 });

export const Salon = models.Salon || model<ISalon>('Salon', SalonSchema);