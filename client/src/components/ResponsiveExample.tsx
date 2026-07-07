import useResponsive from '../hooks/useResponsive';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';

// Example component showing how to use responsive design
export default function ResponsiveExample() {
  const { isMobile, isTablet, isDesktop, breakpoint } = useResponsive();

  return (
    <Card className="m-4">
      <CardHeader>
        <CardTitle>Responsive Design Example</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Different layouts for different screen sizes */}
        <div className={`
          grid gap-4
          ${isMobile ? 'grid-cols-1' : ''}
          ${isTablet ? 'grid-cols-2' : ''}
          ${isDesktop ? 'grid-cols-3' : ''}
        `}>
          <div className="p-4 bg-blue-100 rounded">
            <h3 className="font-semibold">Current Device</h3>
            <p>
              {isMobile && "📱 Mobile View"}
              {isTablet && "📱 Tablet View"}
              {isDesktop && "🖥️ Desktop View"}
            </p>
            <p className="text-sm text-gray-600">Breakpoint: {breakpoint}</p>
          </div>

          {/* Show/hide elements based on screen size */}
          <div className="p-4 bg-green-100 rounded">
            <h3 className="font-semibold">Conditional Content</h3>
            {isMobile && <p>Mobile-only content</p>}
            {isTablet && <p>Tablet-specific content</p>}
            {isDesktop && <p>Desktop-enhanced content</p>}
          </div>

          {/* Different button styles for different screens */}
          <div className="p-4 bg-purple-100 rounded">
            <h3 className="font-semibold">Responsive Buttons</h3>
            <Button 
              size={isMobile ? "sm" : isTablet ? "default" : "lg"}
              className={`
                w-full 
                ${isMobile ? 'text-xs' : ''}
                ${isTablet ? 'text-sm' : ''}
                ${isDesktop ? 'text-base' : ''}
              `}
            >
              {isMobile ? "Tap" : isTablet ? "Touch" : "Click"} Me
            </Button>
          </div>
        </div>

        {/* Tailwind responsive classes example */}
        <div className="mt-4 p-4 bg-yellow-100 rounded">
          <h3 className="font-semibold mb-2">Tailwind Responsive Classes</h3>
          <div className="text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl">
            This text size changes with screen size
          </div>
          <div className="mt-2 hidden sm:block md:hidden lg:block">
            This shows on sm and lg+ but hides on md
          </div>
        </div>
      </CardContent>
    </Card>
  );
}