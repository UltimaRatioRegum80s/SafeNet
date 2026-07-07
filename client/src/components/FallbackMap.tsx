import { MapPin, AlertTriangle, Shield, Eye } from 'lucide-react';

interface IncidentData {
  id: string;
  lat: number;
  lng: number;
  type: 'crime' | 'suspicious' | 'safety_alert' | 'emergency';
  title: string;
  description: string;
  timestamp: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  photos?: string[]; // Photo URLs for incident images
}

interface FallbackMapProps {
  incidents: IncidentData[];
  className?: string;
}

export default function FallbackMap({ incidents, className = "w-full h-96" }: FallbackMapProps) {
  const getIncidentIcon = (type: string) => {
    switch (type) {
      case 'crime': return AlertTriangle;
      case 'suspicious': return Eye;
      case 'safety_alert': return Shield;
      default: return MapPin;
    }
  };

  const getIncidentColor = (type: string, severity: string) => {
    if (type === 'crime') {
      switch (severity) {
        case 'critical': return 'text-red-600 bg-red-100';
        case 'high': return 'text-red-500 bg-red-50';
        case 'medium': return 'text-orange-500 bg-orange-50';
        default: return 'text-yellow-500 bg-yellow-50';
      }
    }
    if (type === 'suspicious') return 'text-purple-600 bg-purple-100';
    if (type === 'safety_alert') return 'text-blue-600 bg-blue-100';
    return 'text-gray-600 bg-gray-100';
  };

  return (
    <div className={className}>
      <div className="w-full h-full bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg border-2 border-dashed border-blue-200 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#grid)" />
          </svg>
        </div>

        {/* Header */}
        <div className="absolute top-4 left-4 right-4 z-10">
          <div className="bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                Interactive Community Map
              </h3>
              <span className="text-sm text-gray-600">
                Showing {incidents.length} incidents in your neighborhood
              </span>
            </div>
          </div>
        </div>

        {/* Incident markers positioned on map */}
        <div className="absolute inset-0 pt-20">
          {incidents.map((incident, index) => {
            const Icon = getIncidentIcon(incident.type);
            const colorClass = getIncidentColor(incident.type, incident.severity);
            
            // Position markers in a grid-like pattern for demo
            const x = 20 + (index % 3) * 30;
            const y = 20 + Math.floor(index / 3) * 25;
            
            return (
              <div
                key={incident.id}
                className="absolute group cursor-pointer"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                {/* Marker */}
                <div className={`w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center ${colorClass} transform transition-all duration-200 group-hover:scale-110`}>
                  <Icon className="w-4 h-4" />
                </div>

                {/* Popup on hover */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                  <div className="bg-white rounded-lg shadow-lg p-3 min-w-[200px] max-w-[250px] border">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-sm text-gray-900">{incident.title}</h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${colorClass}`}>
                        {incident.severity}
                      </span>
                    </div>
                    <div className="mb-2">
                      <span className="inline-block px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
                        {incident.category}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">{incident.description}</p>
                    <p className="text-xs text-gray-500">{incident.timestamp}</p>
                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white"></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Map controls simulation */}
        <div className="absolute top-4 right-4 z-10">
          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-sm">
            <button className="p-2 hover:bg-gray-100 rounded-t-lg border-b">
              <span className="text-lg font-bold">+</span>
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-b-lg">
              <span className="text-lg font-bold">-</span>
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <div className="bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-sm">
            <div className="flex items-center justify-center gap-4 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span>Crime</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                <span>Suspicious</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span>Safety Alert</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}