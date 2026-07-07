import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { QrCode, Camera, X } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (qrCode: string) => void;
}

export default function QRScanner({ isOpen, onClose, onScanSuccess }: QRScannerProps) {
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

  const startScanning = async () => {
    try {
      setScanning(true);
      
      // Mock QR scanning - would implement actual camera access
      // navigator.mediaDevices.getUserMedia({ video: true })
      
      // Simulate successful scan after 3 seconds
      setTimeout(() => {
        const mockQRCode = `QR_${Math.random().toString(36).substr(2, 9)}`;
        onScanSuccess(mockQRCode);
        setScanning(false);
        toast({
          title: "QR Code Scanned",
          description: `Successfully scanned: ${mockQRCode}`,
        });
      }, 3000);
      
    } catch (error) {
      console.error('Error starting camera:', error);
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions.",
        variant: "destructive",
      });
      setScanning(false);
    }
  };

  const stopScanning = () => {
    setScanning(false);
    // Stop camera stream if running
  };

  const handleClose = () => {
    stopScanning();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            QR Code Scanner
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {!scanning ? (
            <div className="text-center space-y-4">
              <div className="w-48 h-48 mx-auto bg-gray-100 rounded-lg flex items-center justify-center">
                <Camera className="w-16 h-16 text-gray-400" />
              </div>
              <p className="text-sm text-gray-600">
                Position the QR code within the camera frame to scan
              </p>
              <Button 
                onClick={startScanning} 
                className="w-full"
                data-testid="start-qr-scan"
              >
                <Camera className="w-4 h-4 mr-2" />
                Start Scanning
              </Button>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="w-48 h-48 mx-auto bg-black rounded-lg flex items-center justify-center relative">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover rounded-lg"
                  autoPlay
                  playsInline
                />
                <div className="absolute inset-0 border-2 border-primary rounded-lg animate-pulse"></div>
                <div className="absolute inset-4 border border-white/50 rounded-lg"></div>
              </div>
              <div className="animate-pulse">
                <p className="text-sm text-gray-600">Scanning for QR code...</p>
              </div>
              <Button 
                onClick={stopScanning} 
                variant="outline" 
                className="w-full"
                data-testid="stop-qr-scan"
              >
                <X className="w-4 h-4 mr-2" />
                Stop Scanning
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
