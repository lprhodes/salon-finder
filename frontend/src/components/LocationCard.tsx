import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import GoogleMapEmbed from "./GoogleMapEmbed";
import { Salon } from "@/types";

interface LocationCardProps {
  salon: Salon;
}

/**
 * Location card component to display salon location with map
 * Shows in the review page as a dedicated card
 */
export default function LocationCard({ salon }: LocationCardProps) {
  // Check if we have coordinates to display a map
  const hasCoordinates = salon.coordinates?.latitude && salon.coordinates?.longitude;
  
  if (!hasCoordinates && !salon.address) {
    // Don't show the card if we have no location information
    return null;
  }
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>📍</span>
          <span>Location</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Address Section */}
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">{salon.name}</h3>
          {salon.address && (
            <p className="text-muted-foreground">{salon.address}</p>
          )}
        </div>
        
        {/* Map Section */}
        {hasCoordinates && (
          <div className="w-full rounded-lg overflow-hidden">
            <GoogleMapEmbed
              latitude={salon.coordinates!.latitude}
              longitude={salon.coordinates!.longitude}
              name={salon.name}
              address={salon.address}
              width={600}
              height={400}
              zoom={14}
              className="w-full"
            />
          </div>
        )}
        
        {/* Additional Location Info */}
        <div className="space-y-2 pt-2">
          {/* Coordinates Display (optional) */}
          {hasCoordinates && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">Coordinates:</span>{' '}
              {salon.coordinates!.latitude.toFixed(6)}, {salon.coordinates!.longitude.toFixed(6)}
            </div>
          )}
          
          {/* Get Directions Button */}
          {hasCoordinates && (
            <div className="flex gap-2">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${salon.coordinates!.latitude},${salon.coordinates!.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Get Directions
              </a>
              
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${salon.name} ${salon.address || ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                View on Google Maps
              </a>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}