import { useState, useEffect } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Eye, EyeOff } from 'lucide-react';

export default function ResponsiveHelper() {
  const [isVisible, setIsVisible] = useState(false);
  const [screenSize, setScreenSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateScreenSize = () => {
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateScreenSize();
    window.addEventListener('resize', updateScreenSize);
    return () => window.removeEventListener('resize', updateScreenSize);
  }, []);

  // Only show in development
  if (import.meta.env.PROD) {
    return null;
  }

  const getBreakpoint = (width: number) => {
    if (width < 640) return 'xs';
    if (width < 768) return 'sm';
    if (width < 1024) return 'md';
    if (width < 1280) return 'lg';
    if (width < 1536) return 'xl';
    return '2xl';
  };

  const getDeviceType = (width: number) => {
    if (width < 768) return 'Mobile';
    if (width < 1024) return 'Tablet';
    return 'Desktop';
  };

  const breakpoint = getBreakpoint(screenSize.width);
  const deviceType = getDeviceType(screenSize.width);

  return (
    <>
      {/* Toggle Button */}
      <div className="fixed bottom-4 left-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsVisible(!isVisible)}
          className="bg-background"
          data-testid="responsive-helper-toggle"
        >
          {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          <span className="ml-1 text-xs">Responsive</span>
        </Button>
      </div>

      {/* Responsive Info Panel */}
      {isVisible && (
        <div className="fixed top-4 left-4 z-50 bg-background border rounded-lg shadow-lg p-3 max-w-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">DEV MODE</Badge>
              <span className="text-sm font-medium">Responsive Helper</span>
            </div>
            
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Screen:</span>
                <span className="font-mono">{screenSize.width}×{screenSize.height}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Breakpoint:</span>
                <Badge variant="secondary" className="text-xs">{breakpoint}</Badge>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Device:</span>
                <Badge 
                  variant={deviceType === 'Mobile' ? 'destructive' : deviceType === 'Tablet' ? 'default' : 'outline'}
                  className="text-xs"
                >
                  {deviceType}
                </Badge>
              </div>
            </div>

            <div className="pt-2 border-t">
              <div className="text-xs text-muted-foreground">
                <div className="font-medium mb-1">Tailwind Breakpoints:</div>
                <div className="space-y-0.5 font-mono">
                  <div className={`${screenSize.width >= 640 ? 'text-green-600' : 'text-gray-400'}`}>sm: 640px+</div>
                  <div className={`${screenSize.width >= 768 ? 'text-green-600' : 'text-gray-400'}`}>md: 768px+</div>
                  <div className={`${screenSize.width >= 1024 ? 'text-green-600' : 'text-gray-400'}`}>lg: 1024px+</div>
                  <div className={`${screenSize.width >= 1280 ? 'text-green-600' : 'text-gray-400'}`}>xl: 1280px+</div>
                  <div className={`${screenSize.width >= 1536 ? 'text-green-600' : 'text-gray-400'}`}>2xl: 1536px+</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Screen Size Overlay for Quick Reference */}
      {isVisible && (
        <div className="fixed top-4 right-4 z-50 bg-black/80 text-white px-2 py-1 rounded text-sm font-mono">
          {screenSize.width}×{screenSize.height} | {breakpoint} | {deviceType}
        </div>
      )}
    </>
  );
}