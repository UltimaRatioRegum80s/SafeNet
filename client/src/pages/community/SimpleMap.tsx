import { useState, useEffect, useMemo } from 'react';
import SimpleMapView from '../../components/SimpleMapView';
import { MAP_STYLES, availableMapStyles, resolveInitialStyle, type MapStyle } from '@/lib/mapTiles';
import { useFeedIncidents } from '@/features/incidents/useFeedIncidents';
import { useSearchParamsWouter } from '@/router/useSearchParamsWouter';
import GroupFilterTabs, { type GroupFilter } from '@/components/GroupFilterTabs';
import { resolveToV2Type } from '@/features/report/taxonomyV2';
import { Circle, Clock, Sun, Moon, Globe } from 'lucide-react';
import { CenteredFilterModal, type FilterOption } from '@/components/CenteredFilterModal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Allowed values for radius/time filters (must match useFeedIncidents)
const ALLOWED_RADIUS_KM = [1, 3, 5, 10] as const;
const ALLOWED_SINCE_HOURS = [24, 72, 168] as const;
const DEFAULT_RADIUS_KM = 5;
const DEFAULT_SINCE_HOURS = 72;

// Filter options for centered modals
const RADIUS_OPTIONS: FilterOption[] = [
  { value: '1', label: '1 km', icon: <Circle size={16} /> },
  { value: '3', label: '3 km', icon: <Circle size={16} /> },
  { value: '5', label: '5 km', icon: <Circle size={16} /> },
  { value: '10', label: '10 km', icon: <Circle size={16} /> },
];

const TIME_OPTIONS: FilterOption[] = [
  { value: '24', label: '24 hours', icon: <Clock size={16} /> },
  { value: '72', label: '3 days', icon: <Clock size={16} /> },
  { value: '168', label: '7 days', icon: <Clock size={16} /> },
];

const MAP_STYLE_ICONS: Record<MapStyle, JSX.Element> = {
  light: <Sun size={16} />,
  dark: <Moon size={16} />,
  satellite: <Globe size={16} />,
};

// Only offer styles this build can actually render — a style with no configured
// tile provider would otherwise look like a broken map rather than a missing
// setting. See client/src/lib/mapTiles.ts.
const MAP_STYLE_OPTIONS: FilterOption[] = availableMapStyles().map((style) => ({
  value: style,
  label: MAP_STYLES[style].label,
  icon: MAP_STYLE_ICONS[style],
}));

export default function SimpleMap() {
  const searchParams = useSearchParamsWouter();
  const [focusCoords, setFocusCoords] = useState<{lat: number, lng: number, zoom?: number, highlight?: boolean, severity?: string} | null>(null);
  
  // Modal state for mobile filters
  const [activeModal, setActiveModal] = useState<'radius' | 'time' | 'style' | null>(null);
  
  // Map style state (lifted from SimpleMapView for parent control). Falls back
  // to a style with a configured tile provider when Light has none.
  const [mapStyle, setMapStyle] = useState<MapStyle>(() => resolveInitialStyle("light") ?? "light");
  
  // Derive radius/time from URL (single source of truth)
  const radiusKm = useMemo(() => {
    const urlRadius = searchParams.get('radiusKm');
    const parsed = urlRadius ? parseInt(urlRadius, 10) : DEFAULT_RADIUS_KM;
    return (ALLOWED_RADIUS_KM as readonly number[]).includes(parsed) ? parsed : DEFAULT_RADIUS_KM;
  }, [searchParams]);
  
  const sinceHours = useMemo(() => {
    const urlSince = searchParams.get('sinceHours');
    const parsed = urlSince ? parseInt(urlSince, 10) : DEFAULT_SINCE_HOURS;
    return (ALLOWED_SINCE_HOURS as readonly number[]).includes(parsed) ? parsed : DEFAULT_SINCE_HOURS;
  }, [searchParams]);
  
  // Pass URL-derived values to hook
  const { incidents } = useFeedIncidents({ radiusKm, sinceHours });
  
  // Derive group filter directly from URL (single source of truth)
  const groupFilter = useMemo<GroupFilter>(() => {
    const urlGroup = searchParams.get('group');
    if (urlGroup && ['services', 'nabor_note', 'emergency', 'critical'].includes(urlGroup)) {
      return urlGroup as GroupFilter;
    }
    return 'all';
  }, [searchParams]);
  
  // Update URL when filter changes (URL = single source of truth)
  const handleFilterChange = (newFilter: GroupFilter) => {
    const newParams = new URLSearchParams(window.location.search);
    if (newFilter === 'all') {
      newParams.delete('group');
    } else {
      newParams.set('group', newFilter);
    }
    
    const newSearch = newParams.toString();
    const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
    window.history.pushState({}, '', newUrl);
  };
  
  // Update URL when radius changes
  const handleRadiusChange = (newRadius: string) => {
    const newParams = new URLSearchParams(window.location.search);
    const parsed = parseInt(newRadius, 10);
    if (parsed === DEFAULT_RADIUS_KM) {
      newParams.delete('radiusKm');
    } else {
      newParams.set('radiusKm', newRadius);
    }
    const newSearch = newParams.toString();
    const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
    window.history.pushState({}, '', newUrl);
  };
  
  // Update URL when time window changes
  const handleSinceHoursChange = (newSince: string) => {
    const newParams = new URLSearchParams(window.location.search);
    const parsed = parseInt(newSince, 10);
    if (parsed === DEFAULT_SINCE_HOURS) {
      newParams.delete('sinceHours');
    } else {
      newParams.set('sinceHours', newSince);
    }
    const newSearch = newParams.toString();
    const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
    window.history.pushState({}, '', newUrl);
  };
  
  // Transform incidents for the map component
  const allMapIncidents = useMemo(() => {
    return incidents.map(incident => ({
      id: incident.id,
      lat: Number(incident.latitude || incident.lat || 0),
      lng: Number(incident.longitude || incident.lng || 0),
      title: incident.title || 'Incident',
      description: incident.description || 'No description',
      type: incident.type || 'safety_alert'
    })).filter(incident => 
      Number.isFinite(incident.lat) && 
      Number.isFinite(incident.lng) &&
      Math.abs(incident.lat) <= 90 && 
      Math.abs(incident.lng) <= 180
    );
  }, [incidents]);
  
  // Apply group filter (display-only, doesn't affect fetch/cache)
  const mapIncidents = useMemo(() => {
    if (groupFilter === 'all') return allMapIncidents;
    
    return allMapIncidents.filter(incident => {
      const v2Type = resolveToV2Type(incident.type);
      return v2Type?.groupId === groupFilter;
    });
  }, [allMapIncidents, groupFilter]);

  // Parse URL parameters for map focusing
  useEffect(() => {
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const zoom = searchParams.get('z');
    const highlight = searchParams.get('highlight');
    const severity = searchParams.get('severity');
    const focusIncidentId = searchParams.get('focus');

    // Priority 1: focus=incidentId - lookup incident coords from loaded incidents
    if (focusIncidentId && allMapIncidents.length > 0) {
      const incident = allMapIncidents.find(i => i.id === focusIncidentId);
      if (incident && Number.isFinite(incident.lat) && Number.isFinite(incident.lng)) {
        console.log("[SIMPLE MAP PAGE] Focusing on incident:", { id: focusIncidentId, lat: incident.lat, lng: incident.lng });
        
        setFocusCoords({
          lat: incident.lat,
          lng: incident.lng,
          zoom: 18,
          highlight: highlight === '1',
          severity: severity || undefined
        });

        // Clear focus parameters from URL after processing
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('focus');
        newParams.delete('highlight');
        newParams.delete('severity');
        
        const newSearch = newParams.toString();
        const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
        window.history.replaceState({}, '', newUrl);
        return;
      }
    }

    // Priority 2: lat/lng coordinates
    if (lat && lng) {
      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);
      const zoomNum = zoom ? parseInt(zoom) : 18;
      
      if (Number.isFinite(latNum) && Number.isFinite(lngNum) && 
          Math.abs(latNum) <= 90 && Math.abs(lngNum) <= 180) {
        
        console.log("[SIMPLE MAP PAGE] Focusing on coordinates:", { lat: latNum, lng: lngNum, zoom: zoomNum, highlight: highlight === '1', severity });
        
        setFocusCoords({
          lat: latNum,
          lng: lngNum,
          zoom: zoomNum,
          highlight: highlight === '1',
          severity: severity || undefined
        });

        // Clear focus parameters from URL after processing
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('lat');
        newParams.delete('lng');
        newParams.delete('z');
        newParams.delete('highlight');
        newParams.delete('severity');
        
        const newSearch = newParams.toString();
        const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [searchParams, allMapIncidents]);

  console.log("[SIMPLE MAP PAGE] Rendering with", mapIncidents.length, "of", allMapIncidents.length, "incidents (filter:", groupFilter + ")", focusCoords ? `focus: ${focusCoords.lat}, ${focusCoords.lng}` : '');

  return (
    <div className="md:min-h-screen md:bg-background md:text-foreground">
      {/* Mobile: Full-screen map with compact filter controls */}
      <div className="md:hidden relative">
        {/* Radius and time filters - bottom center, compact circular buttons */}
        <div className="nn-map-filters fixed bottom-[calc(env(safe-area-inset-bottom,0px)+24px)] left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3">
          <button
            onClick={() => setActiveModal('radius')}
            className="relative h-11 w-11 rounded-full bg-gray-200/90 dark:bg-gray-800/90 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-white shadow-lg backdrop-blur-sm flex items-center justify-center"
            data-testid="map-select-radius"
            aria-label={`Radius: ${radiusKm} km`}
          >
            <Circle size={18} />
            <span className="absolute -bottom-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center shadow">{radiusKm}</span>
          </button>
          <button
            onClick={() => setActiveModal('time')}
            className="relative h-11 w-11 rounded-full bg-gray-200/90 dark:bg-gray-800/90 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-white shadow-lg backdrop-blur-sm flex items-center justify-center"
            data-testid="map-select-time"
            aria-label={`Time: ${sinceHours === 24 ? '24h' : sinceHours === 72 ? '3d' : '7d'}`}
          >
            <Clock size={18} />
            <span className="absolute -bottom-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center shadow">{sinceHours === 24 ? '24h' : sinceHours === 72 ? '3d' : '7d'}</span>
          </button>
          <button
            onClick={() => setActiveModal('style')}
            className="h-11 w-11 rounded-full bg-gray-200/90 dark:bg-gray-800/90 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-white shadow-lg backdrop-blur-sm flex items-center justify-center"
            data-testid="map-select-style"
            aria-label={`Map style: ${mapStyle}`}
          >
            {mapStyle === 'light' && <Sun size={18} />}
            {mapStyle === 'dark' && <Moon size={18} />}
            {mapStyle === 'satellite' && <Globe size={18} />}
          </button>
        </div>
        
        {/* Centered filter modals */}
        <CenteredFilterModal
          isOpen={activeModal === 'radius'}
          onClose={() => setActiveModal(null)}
          title="Search Radius"
          options={RADIUS_OPTIONS}
          selectedValue={String(radiusKm)}
          onSelect={handleRadiusChange}
        />
        <CenteredFilterModal
          isOpen={activeModal === 'time'}
          onClose={() => setActiveModal(null)}
          title="Time Window"
          options={TIME_OPTIONS}
          selectedValue={String(sinceHours)}
          onSelect={handleSinceHoursChange}
        />
        <CenteredFilterModal
          isOpen={activeModal === 'style'}
          onClose={() => setActiveModal(null)}
          title="Map Style"
          options={MAP_STYLE_OPTIONS}
          selectedValue={mapStyle}
          onSelect={(value) => setMapStyle(value as MapStyle)}
        />
        
        <SimpleMapView 
          incidents={mapIncidents}
          focusCoords={focusCoords}
          categoryFilter={groupFilter}
          onCategoryFilterChange={handleFilterChange}
          mapStyle={mapStyle}
          onMapStyleChange={setMapStyle}
        />
      </div>

      {/* Desktop: Wider layout with filter tabs */}
      <div className="hidden md:block">
        <div className="mx-auto w-[95%] px-2 py-6">
          <div className="mb-4 px-2 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Community Safety Map</h1>
              <p className="text-muted-foreground">Real-time incident reporting and monitoring</p>
            </div>
          </div>
          
          {/* Desktop filter tabs + radius/time controls */}
          <div className="mb-4 rounded-lg border border-border bg-card">
            <GroupFilterTabs 
              value={groupFilter} 
              onChange={handleFilterChange}
            />
            {/* Radius and time filters (matching Feed styling) */}
            <div className="flex items-center gap-3 px-4 py-2 border-t border-border">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Radius:</span>
                <Select value={String(radiusKm)} onValueChange={handleRadiusChange}>
                  <SelectTrigger className="w-[80px] h-8 text-xs" data-testid="map-select-radius-desktop">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 km</SelectItem>
                    <SelectItem value="3">3 km</SelectItem>
                    <SelectItem value="5">5 km</SelectItem>
                    <SelectItem value="10">10 km</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Time:</span>
                <Select value={String(sinceHours)} onValueChange={handleSinceHoursChange}>
                  <SelectTrigger className="w-[80px] h-8 text-xs" data-testid="map-select-time-desktop">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">24h</SelectItem>
                    <SelectItem value="72">3 days</SelectItem>
                    <SelectItem value="168">7 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          {/* Map spans full available width */}
          <div className="mb-6 w-full">
            <SimpleMapView 
              incidents={mapIncidents}
              focusCoords={focusCoords}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
