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

  // Use the autocomplete hook (must be called unconditionally for React hooks rules)
  useGoogleAutocomplete({
    inputRef,
    onPlaceSelect: onSelect || (() => {}),
    enabled: isGoogleMapsAvailable && !!onSelect,
  });

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