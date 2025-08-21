import React from 'react';

interface GoogleMapEmbedProps {
  latitude: number;
  longitude: number;
  name: string;
  address?: string;
  width?: number;
  height?: number;
  zoom?: number;
  className?: string;
}

/**
 * Component to display an embedded Google Map
 * Uses Google Maps Embed API (doesn't require Maps Static API)
 */
export default function GoogleMapEmbed({
  latitude,
  longitude,
  name,
  address,
  width = 600,
  height = 400,
  zoom = 16,
  className = ''
}: GoogleMapEmbedProps) {
  if (!latitude || !longitude) {
    return (
      <div className={`bg-gray-200 flex items-center justify-center ${className}`} 
           style={{ width, height }}>
        <p className="text-gray-500">Location not available</p>
      </div>
    );
  }
  
  // Build the embed URL without API key - using the free embed option
  // This uses the Google Maps search embed which doesn't require an API key
  const coordinates = `${latitude},${longitude}`;
  const embedUrl = `https://maps.google.com/maps?q=${coordinates}&t=&z=${zoom}&ie=UTF8&iwloc=&output=embed`;
  
  return (
    <div className={`relative overflow-hidden rounded-lg shadow-lg ${className}`}>
      <iframe
        width={width}
        height={height}
        frameBorder="0"
        src={embedUrl}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="w-full h-full"
        title={`Map showing ${name} location`}
      />
      
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