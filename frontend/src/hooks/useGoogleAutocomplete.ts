'use client';

import { useEffect, useRef, MutableRefObject } from 'react';

interface UseGoogleAutocompleteProps {
  inputRef: MutableRefObject<HTMLInputElement | null>;
  onPlaceSelect: (place: google.maps.places.PlaceResult) => void;
  enabled?: boolean;
}

export function useGoogleAutocomplete({ inputRef, onPlaceSelect, enabled = true }: UseGoogleAutocompleteProps) {
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!enabled || !inputRef.current || !window.google || !window.google.maps || !window.google.maps.places) {
      return;
    }

    // Create the autocomplete instance
    autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'au' },
      types: ['(regions)']
    });

    // Add the place_changed event listener
    const listener = autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current?.getPlace();
      if (place) {
        onPlaceSelect(place);
      }
    });

    // Cleanup function
    return () => {
      if (autocompleteRef.current) {
        google.maps.event.removeListener(listener);
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [inputRef, onPlaceSelect, enabled]);

  return autocompleteRef;
}