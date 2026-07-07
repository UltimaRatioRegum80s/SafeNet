import { MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocationStore, LocationStatus } from "@/store/locationStore";

interface LocationRequiredBannerProps {
  className?: string;
}

export function LocationRequiredBanner({ className }: LocationRequiredBannerProps) {
  const locationStatus = useLocationStore(s => s.locationStatus);
  const permission = useLocationStore(s => s.permission);

  const handleRetryLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => {
          window.location.reload();
        },
        (err) => {
          console.warn("[LocationBanner] Retry failed:", err.message);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  };

  if (locationStatus === 'ok') {
    return null;
  }

  const getMessage = (): { title: string; description: string } => {
    if (locationStatus === 'denied' || permission === 'denied') {
      return {
        title: "Location access denied",
        description: "Enable location in your browser settings to view incidents near you."
      };
    }
    if (locationStatus === 'unavailable') {
      return {
        title: "Location unavailable",
        description: "Unable to determine your location. Please enable GPS or check your device settings."
      };
    }
    if (locationStatus === 'stale') {
      return {
        title: "Location may be outdated",
        description: "Your last known location is being used. Enable GPS for accurate results."
      };
    }
    if (locationStatus === 'pending') {
      return {
        title: "Acquiring location...",
        description: "Please allow location access when prompted."
      };
    }
    return {
      title: "Location required",
      description: "Enable location to see incidents near you."
    };
  };

  const { title, description } = getMessage();
  const showRetryButton = locationStatus === 'denied' || locationStatus === 'unavailable';
  const isPending = locationStatus === 'pending';

  return (
    <div 
      className={`flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 ${className || ''}`}
      data-testid="location-required-banner"
    >
      <div className="flex-shrink-0">
        {isPending ? (
          <RefreshCw className="h-5 w-5 text-amber-500 animate-spin" />
        ) : (
          <MapPin className="h-5 w-5 text-amber-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-600 dark:text-amber-400">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {showRetryButton && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetryLocation}
          className="flex-shrink-0"
          data-testid="retry-location-button"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      )}
    </div>
  );
}
