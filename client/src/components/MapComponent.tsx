import { useEffect, useRef } from 'react';

interface MapMarker {
  id: string;
  type: 'crime' | 'safety_alert' | 'suspicious' | 'emergency' | 'guard' | 'incident';
  position: { lat: number; lng: number };
  title: string;
  data?: any;
}

interface MapComponentProps {
  markers: MapMarker[];
  height?: string;
  onMarkerClick?: (marker: MapMarker) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
}

export default function MapComponent({ 
  markers, 
  height = "400px", 
  onMarkerClick,
  center = { lat: 37.7749, lng: -122.4194 }, // San Francisco default
  zoom = 13 
}: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // For now, show a placeholder map
    // In a real implementation, this would integrate with Google Maps, MapLibre, or similar
    if (mapRef.current) {
      // Clear existing content
      mapRef.current.innerHTML = '';
      
      // Create main container
      const container = document.createElement('div');
      container.style.cssText = `
        width: 100%; 
        height: ${height}; 
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: white;
        font-family: system-ui;
        position: relative;
        overflow: hidden;
      `;
      
      // Create header section
      const headerDiv = document.createElement('div');
      headerDiv.style.cssText = 'text-align: center; z-index: 2;';
      
      const title = document.createElement('h3');
      title.style.cssText = 'margin: 0; font-size: 24px; font-weight: 600;';
      title.textContent = 'Interactive Community Map';
      
      const subtitle = document.createElement('p');
      subtitle.style.cssText = 'margin: 8px 0 0 0; opacity: 0.9;';
      subtitle.textContent = `Showing ${markers.length} incidents in your neighborhood`;
      
      headerDiv.appendChild(title);
      headerDiv.appendChild(subtitle);
      
      // Create grid background
      const gridBackground = document.createElement('div');
      gridBackground.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-image: 
          linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px);
        background-size: 50px 50px;
        opacity: 0.3;
      `;
      
      // Create markers
      markers.forEach((marker, index) => {
        const x = 20 + (index * 15) % 60;
        const y = 20 + Math.floor(index / 4) * 15;
        const color = getMarkerColor(marker.type);
        
        const markerElement = document.createElement('div');
        markerElement.setAttribute('data-marker-id', marker.id);
        markerElement.style.cssText = `
          position: absolute;
          left: ${x}%;
          top: ${y}%;
          width: 20px;
          height: 20px;
          background: ${color};
          border: 2px solid white;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          z-index: 10;
          transition: transform 0.2s;
        `;
        
        // Safely set title using textContent (no XSS risk)
        markerElement.title = marker.title;
        
        // Add hover effects
        markerElement.addEventListener('mouseenter', () => {
          markerElement.style.transform = 'scale(1.2)';
        });
        markerElement.addEventListener('mouseleave', () => {
          markerElement.style.transform = 'scale(1)';
        });
        
        // Add click listener
        markerElement.addEventListener('click', () => {
          if (onMarkerClick) {
            onMarkerClick(marker);
          }
        });
        
        container.appendChild(markerElement);
      });
      
      // Assemble the map
      container.appendChild(headerDiv);
      container.appendChild(gridBackground);
      mapRef.current.appendChild(container);
    }
  }, [markers, height, onMarkerClick]);

  return <div ref={mapRef} data-testid="map-component" style={{ height }} />;
}

function getMarkerColor(type: string): string {
  switch (type) {
    case 'crime': return '#DC2626';
    case 'safety_alert': return '#2563EB';
    case 'suspicious': return '#7C3AED';
    case 'emergency': return '#EF4444';
    default: return '#6B7280';
  }
}