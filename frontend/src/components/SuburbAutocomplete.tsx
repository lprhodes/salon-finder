'use client';

import { useEffect, useRef, useState } from 'react';
import { useGoogleAutocomplete } from '@/hooks/useGoogleAutocomplete';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (place: google.maps.places.PlaceResult) => void;
}

export default function SuburbAutocomplete({ value, onChange, onSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isGoogleMapsAvailable, setIsGoogleMapsAvailable] = useState(false);

  useEffect(() => {
    // Check if Google Maps API is available
    if (window.google?.maps?.places) {
      setIsGoogleMapsAvailable(true);
    }
  }, []);

  // Only use the autocomplete hook if Google Maps is available
  if (isGoogleMapsAvailable && onSelect) {
    useGoogleAutocomplete({
      inputRef,
      onPlaceSelect: onSelect,
    });
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Enter a suburb in Australia (e.g., Bondi Beach, NSW)"
      className="w-full p-2 border rounded bg-white"
    />
  );
}