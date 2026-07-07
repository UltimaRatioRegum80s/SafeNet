import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/auth';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { useToast } from '../../hooks/use-toast';
import QRScanner from '../../components/QRScanner';
import { 
  Shield, 
  QrCode, 
  MapPin, 
  TriangleAlert, 
  Route,
  Battery,
  Clock,
  Navigation
} from 'lucide-react';
import { useLocation } from 'wouter';

export default function GuardHome() {
  const [, setLocation] = useLocation();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(87);
  const [timeRemaining, setTimeRemaining] = useState('14:23');

  // Mock data - would be fetched from Firestore
  const currentShift = {
    site: 'Downtown Plaza',
    status: 'active',
    nextCheckpoint: {
      label: 'Main Entrance Gate',
      distance: 120,
      eta: 2
    }
  };

  const recentCheckins = [
    {
      id: '1',
      pointLabel: 'Security Office',
      timestamp: 'Today 2:15 PM',
      status: 'completed'
    },
    {
      id: '2',
      pointLabel: 'Parking Garage Level 2',
      timestamp: 'Today 1:45 PM',
      status: 'completed'
    }
  ];

  useEffect(() => {
    // Update battery level periodically
    const interval = setInterval(() => {
      if ('getBattery' in navigator) {
        (navigator as any).getBattery().then((battery: any) => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleQRScan = (qrCode: string) => {
    setShowQRScanner(false);
    toast({
      title: "QR Code Scanned",
      description: `Navigating to check-in for: ${qrCode}`,
    });
    setLocation('/guard/checkin?qr=' + qrCode);
  };

  const handleGPSCheckin = () => {
    setLocation('/guard/checkin?method=gps');
  };

  const handleReportIncident = () => {
    setLocation('/guard/incident');
  };

  const handleViewRoute = () => {
    setLocation('/guard/route');
  };

  const handleNavigateToCheckpoint = () => {
    toast({
      title: "Navigation Started",
      description: "Opening navigation to Main Entrance Gate",
    });
  };

  const handleSOSAlert = () => {
    toast({
      title: "SOS Alert Triggered",
      description: "Emergency alert sent to supervisors",
      variant: "destructive",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Guard Header */}
      <div className="bg-primary text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" data-testid="guard-name">
              {user?.username || 'Officer Sarah Chen'}
            </h1>
            <p className="text-blue-100">Current Shift: {currentShift.site}</p>
            <div className="flex items-center mt-2">
              <span className="status-indicator bg-green-500 mr-2"></span>
              <span className="text-sm">On Duty - {timeRemaining} remaining</span>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center text-sm text-blue-100 mb-1">
              <Battery className="w-4 h-4 mr-1" />
              Battery
            </div>
            <div className="text-lg font-bold" data-testid="battery-level">
              {batteryLevel}%
            </div>
          </div>
        </div>
      </div>

      {/* Current Route & Next Checkpoint */}
      <div className="p-6 bg-white border-b">
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          <Route className="w-5 h-5 mr-2" />
          Current Route: Evening Patrol
        </h2>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-amber-800">Next Checkpoint</h3>
              <p className="text-amber-700" data-testid="next-checkpoint">
                {currentShift.nextCheckpoint.label}
              </p>
              <p className="text-sm text-amber-600">
                Distance: {currentShift.nextCheckpoint.distance}m • ETA: {currentShift.nextCheckpoint.eta} min
              </p>
            </div>
            <div className="text-right">
              <MapPin className="text-amber-500 text-2xl" />
            </div>
          </div>
          <Button 
            className="w-full mt-4 bg-primary hover:bg-primary/90" 
            onClick={handleNavigateToCheckpoint}
            data-testid="navigate-checkpoint"
          >
            <Navigation className="w-4 h-4 mr-2" />
            Navigate to Checkpoint
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-4">
          <Button
            variant="outline"
            className="h-20 flex-col space-y-2 border-2 border-primary/20 hover:border-primary/40"
            onClick={() => setShowQRScanner(true)}
            data-testid="qr-checkin-button"
          >
            <QrCode className="text-primary text-2xl" />
            <div>
              <div className="font-medium">QR Check-in</div>
              <div className="text-sm text-gray-600">Scan patrol point</div>
            </div>
          </Button>
          
          <Button
            variant="outline"
            className="h-20 flex-col space-y-2 border-2 border-green-200 hover:border-green-400"
            onClick={handleGPSCheckin}
            data-testid="gps-checkin-button"
          >
            <MapPin className="text-green-600 text-2xl" />
            <div>
              <div className="font-medium">GPS Check-in</div>
              <div className="text-sm text-gray-600">Location-based</div>
            </div>
          </Button>
          
          <Button
            variant="outline"
            className="h-20 flex-col space-y-2 border-2 border-amber-200 hover:border-amber-400"
            onClick={handleReportIncident}
            data-testid="report-incident-button"
          >
            <TriangleAlert className="text-amber-600 text-2xl" />
            <div>
              <div className="font-medium">Report Incident</div>
              <div className="text-sm text-gray-600">Log new incident</div>
            </div>
          </Button>
          
          <Button
            variant="outline"
            className="h-20 flex-col space-y-2 border-2 border-blue-200 hover:border-blue-400"
            onClick={handleViewRoute}
            data-testid="view-route-button"
          >
            <Route className="text-blue-600 text-2xl" />
            <div>
              <div className="font-medium">View Route</div>
              <div className="text-sm text-gray-600">All patrol points</div>
            </div>
          </Button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="p-6 bg-gray-50">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Clock className="w-5 h-5 mr-2" />
          Recent Check-ins
        </h3>
        <div className="space-y-3">
          {recentCheckins.map((checkin) => (
            <Card key={checkin.id} className="border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium" data-testid={`checkin-${checkin.id}-label`}>
                      {checkin.pointLabel}
                    </h4>
                    <p className="text-sm text-gray-600" data-testid={`checkin-${checkin.id}-time`}>
                      {checkin.timestamp}
                    </p>
                  </div>
                  <div className="flex items-center">
                    <span className="status-indicator bg-green-500 mr-2"></span>
                    <Badge variant="secondary" className="text-green-600">
                      Completed
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Emergency SOS Button */}
      <Button
        className="floating-btn bg-red-500 hover:bg-red-600 text-white rounded-full w-16 h-16 shadow-lg"
        onClick={handleSOSAlert}
        data-testid="sos-button"
      >
        <TriangleAlert className="text-2xl" />
      </Button>

      {/* QR Scanner Modal */}
      <QRScanner
        isOpen={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScanSuccess={handleQRScan}
      />
    </div>
  );
}
