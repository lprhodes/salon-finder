export interface Salon {
  name: string;
  address?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  description?: string;
  primaryService?: string;
  contactNumber?: string;
  website?: string;
  bookingLink?: string;
  rating?: {
    stars: number;
    numberOfReviewers: number;
  };
  services?: {
    item: string;
    price: number;
  }[];
  priceRange?: string;
  thumbnails?: string[];
  localThumbnails?: string[];
  businessHours?: {
    monday: { open: string; close: string };
    tuesday: { open: string; close: string };
    wednesday: { open: string; close: string };
    thursday: { open: string; close: string };
    friday: { open: string; close: string };
    saturday: { open: string; close: string };
    sunday: { open: string; close: string };
  };
  serviceCategories?: string[];
  // Error tracking for failed fetches
  fetchError?: string;
  // Legacy fields kept for backward compatibility
  phone?: string;
  openingHours?: { [key: string]: string };
}

export const ServiceCategories = [
  'Haircut',
  'Color',
  'Style',
  'Treatment',
  'Extensions',
  'Spa',
  'Other'
] as const;

export type ServiceCategory = typeof ServiceCategories[number];

export function isValidServiceCategory(category: string): category is ServiceCategory {
  return ServiceCategories.includes(category as ServiceCategory);
}