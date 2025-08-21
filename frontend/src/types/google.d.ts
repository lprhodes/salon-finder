/// <reference types="@types/google.maps" />

declare namespace google {
  namespace maps {
    namespace places {
      interface PlaceResult {
        formatted_address?: string;
        name?: string;
        place_id?: string;
        geometry?: {
          location: {
            lat(): number;
            lng(): number;
          };
        };
      }
    }
  }
}