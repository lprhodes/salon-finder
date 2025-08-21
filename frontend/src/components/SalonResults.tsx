import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import SalonThumbnails from "./SalonThumbnails"
import { Salon } from "@/types"
 
type Props = {
  salons: Salon[];
  selectedSalons: Set<number>;
  showApprove?: boolean;
  onApprove?: () => void;
  disabled?: boolean;
  isExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  onSelectionChange: (index: number, selected: boolean) => void;
};

export default function SalonResults({ salons, selectedSalons, showApprove, 
  onApprove, onSelectionChange, disabled, isExpanded = false, onExpandedChange }: Props) {
  const selectedCount = selectedSalons.size;
  const allSelected = selectedCount === salons.length;

  const handleToggleAll = () => {
    if (allSelected) {
      salons.forEach((_, index) => {
        onSelectionChange(index, false);
      });
    } else {
      salons.forEach((_, index) => {
        onSelectionChange(index, true);
      });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              onClick={() => onExpandedChange?.(!isExpanded)}
              className="space-x-2"
            >
              <span>{isExpanded ? 'Hide' : 'View'} salons</span>
              <span className="text-muted-foreground">
                ({selectedCount} of {salons.length} selected)
              </span>
              <span className="text-xs">
                {isExpanded ? '▼' : '▶'}
              </span>
            </Button>
          </div>
          {isExpanded && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleAll}
              disabled={disabled}
            >
              {allSelected ? 'Deselect All' : 'Select All'}
            </Button>
          )}
          {showApprove && onApprove && (
            <Button
              onClick={onApprove}
              size="sm"
              className="ml-4"
            >
              Approve & Continue
            </Button>
          )}
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0 grid gap-3">
          {salons.map((salon, index) => (
            <Card key={index} className={`${
              selectedSalons.has(index) ? 'border-primary' : 'border-border'
            }`}>
              <CardContent className="pt-6">
                <div className="flex items-start space-x-4">
                  <Checkbox
                    checked={selectedSalons.has(index)}
                    onCheckedChange={(checked) => onSelectionChange(index, checked === true)}
                    disabled={disabled}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg mb-2">{salon.name}</CardTitle>
                    {/* Display salon thumbnails if available */}
                    {((salon.thumbnails?.length ?? 0) > 0 || (salon.localThumbnails?.length ?? 0) > 0) && (
                      <SalonThumbnails 
                        thumbnails={salon.thumbnails}
                        localThumbnails={salon.localThumbnails}
                        salonName={salon.name}
                      />
                    )}
                    {salon.address && (
                      <p className="text-muted-foreground text-sm mb-2">{salon.address}</p>
                    )}
                    <div className="grid gap-2">
                      {/* Contact Info */}
                      {salon.contactNumber && (
                        <div className="flex items-baseline gap-2 text-sm">
                          <span className="font-medium">Contact:</span>
                          <span className="text-muted-foreground">{salon.contactNumber}</span>
                        </div>
                      )}
                      
                      {/* Website */}
                      {salon.website && (
                        <div className="flex items-baseline gap-2 text-sm">
                          <span className="font-medium">Website:</span>
                          <span className="text-muted-foreground truncate">
                            <a href={salon.website} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                              {salon.website}
                            </a>
                          </span>
                        </div>
                      )}
                      
                      {/* Booking Link */}
                      {salon.bookingLink && (
                        <div className="flex items-baseline gap-2 text-sm">
                          <span className="font-medium">Booking:</span>
                          <span className="text-muted-foreground truncate">
                            <a href={salon.bookingLink} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                              Book Now
                            </a>
                          </span>
                        </div>
                      )}
                      
                      {/* Rating */}
                      {salon.rating?.stars && (
                        <div className="flex items-baseline gap-2 text-sm">
                          <span className="font-medium">Rating:</span>
                          <span className="text-muted-foreground">
                            {salon.rating.stars} ★ ({salon.rating.numberOfReviewers} reviews)
                          </span>
                        </div>
                      )}
                      
                      {/* Primary Service */}
                      {salon.primaryService && (
                        <div className="flex items-baseline gap-2 text-sm">
                          <span className="font-medium">Primary Service:</span>
                          <span className="text-muted-foreground">{salon.primaryService}</span>
                        </div>
                      )}
                      
                      {/* Service Categories */}
                      {salon.serviceCategories && salon.serviceCategories.length > 0 && (
                        <div className="flex items-baseline gap-2 text-sm">
                          <span className="font-medium">Service Categories:</span>
                          <span className="text-muted-foreground">{salon.serviceCategories.join(', ')}</span>
                        </div>
                      )}
                      
                      {/* Services */}
                      {salon.services && salon.services.length > 0 && (
                        <div className="flex flex-col gap-1 text-sm mt-2">
                          <span className="font-medium">Services:</span>
                          <div className="ml-4 grid gap-1">
                            {salon.services.map((service, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span>{service.item}</span>
                                <span>${service.price.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Description */}
                      {salon.description && (
                        <div className="text-sm mt-2">
                          <p className="font-medium">Description:</p>
                          <p className="text-muted-foreground">{salon.description}</p>
                        </div>
                      )}
                      
                      {/* Business Hours */}
                      {salon.businessHours && (
                        <div className="flex flex-col gap-1 text-sm mt-2">
                          <span className="font-medium">Business Hours:</span>
                          <div className="ml-4 grid gap-1">
                            {Object.entries(salon.businessHours).map(([day, hours]) => (
                              <div key={day} className="flex justify-between">
                                <span className="capitalize">{day}:</span>
                                <span>
                                  {hours.open === "closed" ? "Closed" : `${hours.open} - ${hours.close}`}
                                </span>
                              </div>
                            ))}
                          </div>
                       </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      )}
    </Card>
  );
}