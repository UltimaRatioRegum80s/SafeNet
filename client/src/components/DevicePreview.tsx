import { useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Monitor, Tablet, Smartphone, X } from 'lucide-react';

interface DevicePreviewProps {
  children: React.ReactNode;
}

type DeviceType = 'mobile' | 'tablet' | 'desktop' | null;

const deviceConfigs = {
  mobile: {
    width: 390,
    height: 844,
    name: 'Mobile (390x844)',
    icon: Smartphone,
  },
  tablet: {
    width: 820,
    height: 1180,
    name: 'Tablet (820x1180)',
    icon: Tablet,
  },
  desktop: {
    width: '100%',
    height: '100%',
    name: 'Desktop (Full)',
    icon: Monitor,
  },
};

export default function DevicePreview({ children }: DevicePreviewProps) {
  const [activeDevice, setActiveDevice] = useState<DeviceType>(null);

  // Only show in development
  if (import.meta.env.PROD) {
    return <>{children}</>;
  }

  if (!activeDevice) {
    return (
      <div className="relative">
        {children}
        
        {/* Floating Device Preview Controls */}
        <div className="fixed bottom-4 right-4 z-50 bg-background border rounded-lg shadow-lg p-2 flex gap-2">
          <Badge variant="outline" className="text-xs">DEV MODE</Badge>
          {Object.entries(deviceConfigs).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <Button
                key={key}
                variant="ghost"
                size="sm"
                onClick={() => setActiveDevice(key as DeviceType)}
                className="flex items-center gap-1"
                data-testid={`preview-${key}`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline text-xs">{key}</span>
              </Button>
            );
          })}
        </div>
      </div>
    );
  }

  const device = deviceConfigs[activeDevice];

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* Device Preview Controls */}
      <div className="mb-4 flex items-center justify-between bg-white rounded-lg p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Badge variant="outline">DEV MODE</Badge>
          <div className="flex gap-2">
            {Object.entries(deviceConfigs).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <Button
                  key={key}
                  variant={activeDevice === key ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveDevice(key as DeviceType)}
                  className="flex items-center gap-1"
                  data-testid={`preview-${key}`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-xs">{config.name}</span>
                </Button>
              );
            })}
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setActiveDevice(null)}
          data-testid="close-preview"
        >
          <X className="w-4 h-4" />
          <span className="ml-1">Exit Preview</span>
        </Button>
      </div>

      {/* Device Frame */}
      <div className="flex justify-center">
        <div 
          className="bg-black rounded-[20px] shadow-xl overflow-hidden border-4 border-gray-900 relative"
          style={{
            width: typeof device.width === 'string' ? device.width : `${device.width}px`,
            height: typeof device.height === 'string' ? device.height : `${device.height}px`,
            maxWidth: '100%',
            maxHeight: 'calc(100vh - 120px)',
          }}
        >
          {/* Mobile Status Bar Simulation */}
          {activeDevice === 'mobile' && (
            <div className="absolute top-0 left-0 right-0 z-10 h-11 bg-black flex items-center justify-between px-6 text-white text-sm">
              <div className="flex items-center gap-1">
                <span>19:32</span>
              </div>
              <div className="flex items-center gap-1">
                <span>4G</span>
                <span>46%</span>
                <div className="w-6 h-3 border border-white rounded-sm">
                  <div className="w-2/3 h-full bg-white rounded-sm"></div>
                </div>
              </div>
            </div>
          )}
          <div 
            className="w-full h-full overflow-auto"
            style={{
              paddingTop: activeDevice === 'mobile' ? '44px' : '0',
              borderRadius: activeDevice === 'mobile' ? '16px' : '8px',
            }}
          >
            {children}
          </div>
        </div>
      </div>
      
      {/* Device Info */}
      <div className="mt-4 text-center text-sm text-gray-600">
        Previewing: {device.name}
        {typeof device.width === 'number' && typeof device.height === 'number' && (
          <span className="ml-2">({device.width}×{device.height}px)</span>
        )}
      </div>
    </div>
  );
}