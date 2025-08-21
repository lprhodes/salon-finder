import React from 'react';

interface GoogleStaticMapProps {
  latitude: number;
  longitude: number;
  name: string;
  address?: string;
  width?: number;
  height?: number;
  zoom?: number;
  mapType?: 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
  className?: string;
}

/**
 * Component to display a static Google Map with a location pin
 * Uses Google Maps Static API
 */
export default function GoogleStaticMap({
  latitude,
  longitude,
  name,
  address,
  width = 600,
  height = 400,
  zoom = 16,
  mapType = 'roadmap',
  className = ''
}: GoogleStaticMapProps) {
  // Get API key from environment - must use NEXT_PUBLIC_ prefix for client-side access
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  
  if (!apiKey) {
    return (
      <div className={`bg-gray-200 flex items-center justify-center ${className}`} 
           style={{ width, height }}>
        <p className="text-gray-500">Map unavailable (API key not configured)</p>
      </div>
    );
  }
  
  if (!latitude || !longitude) {
    return (
      <div className={`bg-gray-200 flex items-center justify-center ${className}`} 
           style={{ width, height }}>
        <p className="text-gray-500">Location not available</p>
      </div>
    );
  }
  
  // Build the static map URL
  const baseUrl = 'https://maps.googleapis.com/maps/api/staticmap';
  
  // Create parameters
  const params = new URLSearchParams({
    center: `${latitude},${longitude}`,
    zoom: zoom.toString(),
    size: `${width}x${height}`,
    maptype: mapType,
    key: apiKey,
    scale: '2' // Higher quality for retina displays
  });
  
  // Add a red marker at the location
  const markerParam = `color:red|label:${name.charAt(0).toUpperCase()}|${latitude},${longitude}`;
  params.append('markers', markerParam);
  
  // Add custom styling for a cleaner look (optional)
  const styles = [
    'feature:poi|visibility:off', // Hide points of interest
    'feature:transit|visibility:off' // Hide transit stations
  ];
  styles.forEach(style => params.append('style', style));
  
  const mapUrl = `${baseUrl}?${params.toString()}`;
  
  return (
    <div className={`relative overflow-hidden rounded-lg shadow-lg ${className}`}>
      <img 
        src={mapUrl}
        alt={`Map showing ${name} location`}
        width={width}
        height={height}
        className="w-full h-auto"
        loading="lazy"
      />
      
      {/* Optional overlay with address */}
      {address && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
          <p className="text-white text-sm font-medium drop-shadow-lg">
            📍 {address}
          </p>
        </div>
      )}
      
      {/* Link to open in Google Maps */}
      <a 
        href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-2 right-2 bg-white/90 hover:bg-white text-gray-700 px-3 py-1 rounded-full text-sm font-medium shadow-md transition-colors"
      >
        Open in Maps ↗
      </a>
    </div>
  );
}