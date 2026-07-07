import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, MapPin, Clock, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import { useSubmitIncident } from '@/features/report/useSubmitIncident';

export default function ReportFull() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const submitIncident = useSubmitIncident();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: '',
    severity: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    location: '',
    isAnonymous: false
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const incidentTypes = [
    'Car Accident', 'Emergency Alarm', 'Break In/Burglary', 'Construction Work',
    'Fire Emergency', 'SOS/Need Help', 'Lost Pet', 'Suspicious Person',
    'Hit & Run', 'Traffic Issue', 'Lost & Found', 'Violence/Fight',
    'Other'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.description.trim() || !formData.type) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Get current location if possible
      let currentLat = -22.5597; // Default to Windhoek
      let currentLng = 17.0658;
      
      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          currentLat = position.coords.latitude;
          currentLng = position.coords.longitude;
        } catch (geoError) {
          console.log('Using default location (Windhoek)');
        }
      }

      // Submit incident using the proper hook (which handles map navigation)
      await submitIncident({
        title: formData.title,
        description: formData.description,
        type: formData.type.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        severity: formData.severity,
        category: formData.type,
        latitude: currentLat,
        longitude: currentLng,
        isAnonymous: formData.isAnonymous
      });
      
      toast({
        title: "Report Submitted",
        description: "Your detailed report has been submitted. Redirecting to map...",
      });
      
      // Navigation is now handled by submitIncident hook
      
    } catch (error) {
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your report. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background dark:bg-background">
      <Header title="Report Incident" subtitle="Detailed incident reporting" />
      
      <div className="max-w-2xl mx-auto p-4">
        <div className="mb-4">
          <Button 
            variant="ghost" 
            onClick={() => setLocation('/community/report')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Quick Report
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Detailed Incident Report
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Provide detailed information about the incident to help your community stay informed.
            </p>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Anonymous Reporting Option */}
              <div className="flex items-center space-x-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <Checkbox 
                  id="anonymous-full" 
                  checked={formData.isAnonymous} 
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isAnonymous: checked as boolean }))}
                  data-testid="anonymous-checkbox-full"
                />
                <Label htmlFor="anonymous-full" className="text-sm font-medium">
                  Report anonymously
                </Label>
                <div className="text-xs text-muted-foreground ml-2">
                  Your identity will be hidden from the community
                </div>
              </div>

              {/* Incident Type */}
              <div className="space-y-2">
                <Label htmlFor="type">Incident Type *</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select incident type" />
                  </SelectTrigger>
                  <SelectContent>
                    {incidentTypes.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="Brief title for the incident"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  data-testid="input-title"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Provide detailed information about what happened, when, and any other relevant details..."
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  data-testid="input-description"
                />
                <p className="text-xs text-muted-foreground">
                  💡 Tip: Describe what you saw, not who you think did it.
                </p>
              </div>

              {/* Severity */}
              <div className="space-y-2">
                <Label htmlFor="severity">Severity Level</Label>
                <Select value={formData.severity} onValueChange={(value) => setFormData(prev => ({ ...prev, severity: value as any }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="location">Specific Location (Optional)</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    id="location"
                    placeholder="Street address, landmark, or specific location details"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    className="pl-10"
                    data-testid="input-location"
                  />
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Your approximate location will be used if not specified
                </p>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full"
                  size="lg"
                  data-testid="submit-detailed-report"
                >
                  {isSubmitting ? 'Submitting Report...' : 'Submit Detailed Report'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}