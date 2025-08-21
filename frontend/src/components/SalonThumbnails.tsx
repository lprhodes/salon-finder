import Image from 'next/image';
import { useState } from 'react';

type Props = {
  thumbnails?: string[];
  localThumbnails?: string[];
  salonName: string;
  maxDisplay?: number;
};

export default function SalonThumbnails({ 
  thumbnails = [], 
  localThumbnails = [], 
  salonName,
  maxDisplay = 3
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Prioritize local thumbnails, then fallback to remote thumbnails
  const displayThumbnails = localThumbnails.length > 0 
    ? localThumbnails 
    : thumbnails;
  
  // Limit number of thumbnails to display
  const limitedThumbnails = displayThumbnails.slice(0, maxDisplay);
  
  // If no thumbnails are available, return null
  if (limitedThumbnails.length === 0) {
    return null;
  }

  const handleNext = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === limitedThumbnails.length - 1 ? 0 : prevIndex + 1
    );
  };

  const handlePrevious = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? limitedThumbnails.length - 1 : prevIndex - 1
    );
  };

  return (
    <div className="relative mb-4 mt-2">
      <div className="w-full h-48 relative overflow-hidden rounded-md">
        {limitedThumbnails.map((src, index) => {
          // Check if it's a local path or remote URL
          const imgSrc = src.startsWith('/') ? src : src;
          
          return (
            <Image
              key={index}
              src={imgSrc}
              alt={`${salonName} salon image ${index + 1}`}
              fill
              sizes="(max-width: 768px) 100vw, 300px"
              className={`object-cover transition-opacity duration-300 ${
                index === currentIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              onError={(e) => {
                // Handle image loading error by hiding this image
                e.currentTarget.style.display = 'none';
              }}
            />
          );
        })}
      </div>
      
      {limitedThumbnails.length > 1 && (
        <div className="absolute inset-0 flex items-center justify-between px-2">
          <button 
            onClick={handlePrevious}
            className="bg-black/50 text-white p-1 rounded-full"
            aria-label="Previous image"
          >
            ◀
          </button>
          <button 
            onClick={handleNext}
            className="bg-black/50 text-white p-1 rounded-full"
            aria-label="Next image"
          >
            ▶
          </button>
        </div>
      )}
      
      {limitedThumbnails.length > 1 && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
          {limitedThumbnails.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full ${
                index === currentIndex ? 'bg-white' : 'bg-white/50'
              }`}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}