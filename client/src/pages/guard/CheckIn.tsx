import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { useToast } from '../../hooks/use-toast';
import { useAuthStore } from '../../store/auth';
import ImageUpload from '../../components/ImageUpload';
import { MapPin, QrCode, Camera, CheckCircle, ArrowLeft } from 'lucide-react';

export default function CheckIn() {
  const [, setLocation] = useLocation();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [method, setMethod] = useState<'gps' | 'qr'>('gps');
  const [location, setLocationState] = useState<{ lat: number; lng: number } | null>(null);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string>('');

  // Get method and QR code from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const methodParam = urlParams.get('method') as 'gps' | 'qr';
    const qrParam = urlParams.get('qr');
    
    if (methodParam) setMethod(methodParam);
    if (qrParam) setQrCode(qrParam);
  }, []);

  // Get current location for GPS check-in
  useEffect(() => {
    if (method === 'gps') {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocationState({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          toast({
            title: "Location Error",
            description: "Unable to get your current location. Please enable location services.",
            variant: "destructive",
          });
        }
      );
    }
  }, [method, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (method === 'gps' && !location) {
      toast({
        title: "Location Required",
        description: "Please allow location access for GPS check-in.",
        variant: "destructive",
      });
      return;
    }

    if (method === 'qr' && !qrCode) {
      toast({
        title: "QR Code Required",
        description: "Please scan a QR code first.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Mock check-in submission - would integrate with Firebase
      const checkinData = {
        guardId: user?.id,
        method,
        location: location || { lat: 0, lng: 0 },
        qrCode: method === 'qr' ? qrCode : undefined,
        notes,
        photos: photos.length,
        timestamp: new Date(),
        batteryLevel: await getBatteryLevel(),
      };

      console.log('Check-in data:', checkinData);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      toast({
        title: "Check-in Successful",
        description: `Successfully checked in via ${method.toUpperCase()}`,
      });

      setLocation('/guard');
    } catch (error: any) {
      toast({
        title: "Check-in Failed",
        description: error.message || "Failed to submit check-in",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getBatteryLevel = async (): Promise<number> => {
    if ('getBattery' in navigator) {
      try {
        const battery = await (navigator as any).getBattery();
        return Math.round(battery.level * 100);
      } catch {
        return 0;
      }
    }
    return 0;
  };

  const handleBack = () => {
    setLocation('/guard');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center mb-6">
          <Button 
            variant="ghost" 
            onClick={handleBack}
            className="mr-4"
            data-testid="back-button"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Patrol Check-in</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Check-in Method */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                {method === 'gps' ? (
                  <MapPin className="w-5 h-5 mr-2 text-green-600" />
                ) : (
                  <QrCode className="w-5 h-5 mr-2 text-primary" />
                )}
                {method === 'gps' ? 'GPS Check-in' : 'QR Code Check-in'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {method === 'gps' ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    Using your current location for check-in
                  </p>
                  {location ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center">
                        <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                        <span className="text-green-800">Location acquired</span>
                      </div>
                      <p className="text-sm text-green-700 mt-1">
                        Lat: {location.lat.toFixed(6)}, Lng: {location.lng.toFixed(6)}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-amber-800">Getting your location...</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    QR Code scanned for check-in
                  </p>
                  {qrCode && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center">
                        <CheckCircle className="w-5 h-5 text-blue-600 mr-2" />
                        <span className="text-blue-800">QR Code: {qrCode}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notes (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="notes">Patrol Notes</Label>
              <Textarea
                id="notes"
                placeholder="Add any observations or notes about this checkpoint..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-2"
                data-testid="checkin-notes"
              />
            </CardContent>
          </Card>

          {/* Photo Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Camera className="w-5 h-5 mr-2" />
                Photos (Optional)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ImageUpload
                onImagesSelected={setPhotos}
                maxImages={3}
                maxSize={5}
              />
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full h-12 text-lg"
            disabled={loading || (method === 'gps' && !location)}
            data-testid="submit-checkin"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Submitting Check-in...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                Complete Check-in
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
