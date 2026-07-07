import { useQuery } from "@tanstack/react-query";
import { useLocationStore } from "@/store/locationStore";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";

const KENYA_BBOX = {
  minLat: -5.0,
  maxLat: 5.0,
  minLng: 34.0,
  maxLng: 42.0,
};

function isInKenya(lat: number, lng: number): boolean {
  return (
    lat >= KENYA_BBOX.minLat &&
    lat <= KENYA_BBOX.maxLat &&
    lng >= KENYA_BBOX.minLng &&
    lng <= KENYA_BBOX.maxLng
  );
}

export function KenyaFieldTestBadge() {
  const { currentLocation } = useLocationStore();
  
  const { data: geoStatus } = useQuery<{ kenyaFieldTestEnabled: boolean }>({
    queryKey: ["/api/geo/status"],
  });
  
  if (!geoStatus?.kenyaFieldTestEnabled) {
    return null;
  }
  
  if (!currentLocation) {
    return null;
  }
  
  const inKenya = isInKenya(currentLocation.latitude, currentLocation.longitude);
  
  if (!inKenya) {
    return null;
  }
  
  return (
    <div className="flex justify-center py-1">
      <Badge 
        variant="outline" 
        className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs gap-1 flex items-center"
        data-testid="kenya-field-test-badge"
      >
        <MapPin className="h-3 w-3" />
        Kenya Field Test (Private Beta)
      </Badge>
    </div>
  );
}
