import { useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useToast } from '../../hooks/use-toast';
import { useAuthStore } from '../../store/auth';
import ImageUpload from '../../components/ImageUpload';
import { compressImage, toFile } from '../../lib/image';
import { uploadImages } from '../../lib/upload';
import { track } from '../../lib/analytics';
import { TriangleAlert, ArrowLeft, Send } from 'lucide-react';

const incidentCategories = [
  { value: 'suspicious', label: 'Suspicious Activity' },
  { value: 'break-in', label: 'Break-in' },
  { value: 'medical', label: 'Medical Emergency' },
  { value: 'fire', label: 'Fire/Safety' },
  { value: 'maintenance', label: 'Maintenance Issue' },
  { value: 'other', label: 'Other' },
];

const severityLevels = [
  { value: 'low', label: 'Low', color: 'text-green-600' },
  { value: 'medium', label: 'Medium', color: 'text-amber-600' },
  { value: 'high', label: 'High', color: 'text-red-600' },
  { value: 'critical', label: 'Critical', color: 'text-red-800' },
];

export default function IncidentReport() {
  const [, setLocation] = useLocation();
  const { user } = useAuthStore();
  const { toast } = useToast();
  
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [location, setLocationState] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  // Get current location
  useState(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationState({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.error('Error getting location:', error);
      }
    );
  });

  // Upload helper function
  async function prepareAndUpload(files: File[], signal?: AbortSignal) {
    // Enforce server limit (2) defensively
    const picked = files.slice(0, 2);

    const compressedFiles: File[] = [];
    for (const f of picked) {
      try {
        const blob = await compressImage(f, { maxEdge: 1600, quality: 0.78, preferWebP: true });
        const ext = blob.type.includes("webp") ? "webp" : "jpg";
        compressedFiles.push(toFile(blob, f, ext));
      } catch {
        // fallback: original file if compression fails
        compressedFiles.push(f);
      }
    }

    // POST to /api/uploads → returns [{ url, ... }]
    const results = await uploadImages(compressedFiles, signal);
    return results.map(r => r.url);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!category || !severity || !description.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Build base incident payload
      const payload: any = {
        guardId: user?.id,
        category,
        severity,
        description,
        location: location || { lat: 0, lng: 0 },
        timestamp: new Date(),
        status: 'open',
        photos: [],
      };

      // NEW: photos integration
      if (photos.length > 0) {
        controllerRef.current = new AbortController();
        setUploading(true);

        const urls = await prepareAndUpload(photos, controllerRef.current.signal);
        payload.photos = urls; // use URLs, not count
      }

      setLoading(true);

      // TODO: Replace with actual API call to /api/incidents
      console.log('Incident data with photo URLs:', payload);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Success UX
      toast({
        title: "Incident Reported",
        description: payload.photos?.length ? "Photos attached." : "Thanks for the quick report.",
      });
      
      setPhotos([]); // reset local state
      setLocation('/guard');
    } catch (err: any) {
      if (err?.name === "AbortError") {
        toast({ variant: "destructive", title: "Upload canceled" });
      } else {
        toast({ 
          variant: "destructive", 
          title: "Could not submit", 
          description: err?.message ?? "Please try again." 
        });
      }
    } finally {
      setUploading(false);
      setLoading(false);
      controllerRef.current = null;
    }
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
          <h1 className="text-2xl font-bold flex items-center">
            <TriangleAlert className="w-6 h-6 mr-2 text-amber-600" />
            Report Incident
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Category and Severity */}
          <Card>
            <CardHeader>
              <CardTitle>Incident Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="category">Category *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="mt-2" data-testid="category-select">
                    <SelectValue placeholder="Select incident category" />
                  </SelectTrigger>
                  <SelectContent>
                    {incidentCategories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="severity">Severity *</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger className="mt-2" data-testid="severity-select">
                    <SelectValue placeholder="Select severity level" />
                  </SelectTrigger>
                  <SelectContent>
                    {severityLevels.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        <span className={level.color}>{level.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description *</CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="description">Incident Description</Label>
              <Textarea
                id="description"
                placeholder="Provide a detailed description of the incident..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-2 min-h-32"
                required
                data-testid="incident-description"
              />
            </CardContent>
          </Card>

          {/* Photos */}
          <Card>
            <CardHeader>
              <CardTitle>Photos (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <ImageUpload
                onImagesSelected={(files: File[]) => setPhotos(files)}
                maxImages={5}
                maxSize={10}
              />
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardHeader>
              <CardTitle>Location</CardTitle>
            </CardHeader>
            <CardContent>
              {location ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-green-800 font-medium">Location captured</p>
                  <p className="text-sm text-green-700 mt-1">
                    Lat: {location.lat.toFixed(6)}, Lng: {location.lng.toFixed(6)}
                  </p>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-amber-800">Getting your location...</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full h-12 text-lg"
            disabled={uploading || loading || !category || !severity || !description.trim()}
            data-testid="submit-incident"
          >
            {uploading ? (
              "Uploading…"
            ) : loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Submitting Report...
              </>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                Submit Incident Report
              </>
            )}
          </Button>
          
          {uploading && (
            <button 
              className="text-xs underline opacity-80 mt-2" 
              onClick={() => controllerRef.current?.abort()}
              type="button"
            >
              Cancel upload
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
