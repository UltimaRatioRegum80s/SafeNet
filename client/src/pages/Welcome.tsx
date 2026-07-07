import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { MapPin, Users, AlertTriangle, Loader2 } from 'lucide-react';
import logoLight from '@assets/Logo_1755373407688.png';
import logoDark from '@assets/Logo dark mode_1755373493360.png';
import { joinCommunity } from '../lib/auth';
import { useAuthStore } from '../store/auth';
import { useToast } from '../hooks/use-toast';
import { countries, citiesByCountry, neighbourhoodsByCity, type Country } from '../lib/locationData';
import { useLocation, Link } from 'wouter';

export default function Welcome() {
  const [, setLocation] = useLocation();
  const { setUser } = useAuthStore();
  const { toast } = useToast();

  // Single form data
  const [formData, setFormData] = useState({
    role: '' as '' | 'private_citizen' | 'security_organisation' | 'government_service',
    name: '',
    email: '',
    country: '' as '' | Country,
    city: '',
    neighbourhood: '',
    neighbourhoodType: 'select' as 'select' | 'manual'
  });

  const [isLoading, setIsLoading] = useState(false);
  const [neighbourhoodLoading, setNeighbourhoodLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.role) newErrors.role = "Role is required";
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = "Valid email is required";
    if (!formData.country) newErrors.country = "Country is required";
    if (!formData.city) newErrors.city = "City is required";
    if (!formData.neighbourhood.trim()) newErrors.neighbourhood = "Neighbourhood is required";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isFormValid = () => {
    return formData.role && formData.name.trim() && formData.email.trim() && formData.country && formData.city && formData.neighbourhood.trim();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      // Convert to the format expected by the existing API
      const roleMapping = {
        'private_citizen': 'private' as const,
        'security_organisation': 'security_org' as const,
        'government_service': 'security_org' as const // Map government service to security org for now
      };
      
      const joinData = {
        username: formData.name, // Map name to username for backend compatibility
        email: formData.email, // Include email in signup data
        role: formData.role ? roleMapping[formData.role] : 'private' as const,
        country: formData.country,
        city: formData.city
      };
      
      const user = await joinCommunity(joinData);
      setUser(user);
      toast({
        title: "Welcome to NaborNet!",
        description: "You've successfully joined your community",
      });
      setLocation('/community/dashboard');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Unable to join community. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCountryChange = (country: Country) => {
    const firstCity = citiesByCountry[country][0];
    setFormData(prev => ({ 
      ...prev, 
      country, 
      city: firstCity,
      neighbourhood: '',
      neighbourhoodType: 'select'
    }));
    setErrors(prev => ({ ...prev, country: '', city: '', neighbourhood: '' }));
  };

  const handleCityChange = async (city: string) => {
    setFormData(prev => ({ 
      ...prev, 
      city,
      neighbourhood: '',
      neighbourhoodType: 'select'
    }));
    setErrors(prev => ({ ...prev, city: '', neighbourhood: '' }));
    
    // Load neighbourhoods for the selected city
    if (neighbourhoodsByCity[city]) {
      setNeighbourhoodLoading(false);
    } else {
      // For cities without predefined neighbourhoods, auto-switch to manual input
      setFormData(prev => ({ ...prev, neighbourhoodType: 'manual' }));
    }
  };

  const getAvailableNeighbourhoods = () => {
    if (!formData.city) return [];
    return neighbourhoodsByCity[formData.city] || [];
  };

  const shouldShowNeighbourhoodSelect = () => {
    return formData.city && neighbourhoodsByCity[formData.city] && formData.neighbourhoodType === 'select';
  };

  const shouldShowNeighbourhoodInput = () => {
    return formData.city && (
      !neighbourhoodsByCity[formData.city] || 
      formData.neighbourhoodType === 'manual'
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <img 
              src={logoLight} 
              alt="NaborNet Logo" 
              className="w-16 h-16 dark:hidden"
            />
            <img 
              src={logoDark} 
              alt="NaborNet Logo" 
              className="w-16 h-16 hidden dark:block"
            />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Welcome to NaborNet</h1>
            <p className="text-slate-300 text-lg mb-4">Your neighborhood safety community platform for Windhoek</p>
            <div className="flex gap-4 justify-center">
              <Link href="/login">
                <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                  Sign In
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="bg-cyan-500 hover:bg-cyan-600 text-white">
                  Join Community
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Feature Preview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-800 border-slate-700 text-center">
            <CardContent className="p-6">
              <MapPin className="w-8 h-8 text-cyan-400 mx-auto mb-4" />
              <h3 className="text-white font-semibold mb-2">Interactive Map</h3>
              <p className="text-slate-300 text-sm">View incidents and safety reports in your area</p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700 text-center">
            <CardContent className="p-6">
              <Users className="w-8 h-8 text-cyan-400 mx-auto mb-4" />
              <h3 className="text-white font-semibold mb-2">Community Feed</h3>
              <p className="text-slate-300 text-sm">Stay informed with neighborhood updates</p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700 text-center">
            <CardContent className="p-6">
              <AlertTriangle className="w-8 h-8 text-cyan-400 mx-auto mb-4" />
              <h3 className="text-white font-semibold mb-2">Quick Reporting</h3>
              <p className="text-slate-300 text-sm">Report incidents with custom icons</p>
            </CardContent>
          </Card>
        </div>

        {/* Authentication - Single Form */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-center">Join Your Community</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Role Selection */}
              <div>
                <Label className="text-slate-300">Role *</Label>
                <RadioGroup 
                  value={formData.role} 
                  onValueChange={(value: 'private_citizen' | 'security_organisation' | 'government_service') => {
                    setFormData(prev => ({ ...prev, role: value }));
                    setErrors(prev => ({ ...prev, role: '' }));
                  }}
                  className="flex flex-col space-y-2 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="private_citizen" id="private-citizen" className="text-cyan-400" />
                    <Label htmlFor="private-citizen" className="text-slate-300">Private citizen</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="security_organisation" id="security-org" className="text-cyan-400" />
                    <Label htmlFor="security-org" className="text-slate-300">Security organisation</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="government_service" id="government-service" className="text-cyan-400" />
                    <Label htmlFor="government-service" className="text-slate-300">Government service</Label>
                  </div>
                </RadioGroup>
                {errors.role && <p className="text-red-400 text-sm mt-1">{errors.role}</p>}
              </div>

              {/* Name */}
              <div>
                <Label htmlFor="name" className="text-slate-300">Name *</Label>
                <Input
                  id="name"
                  data-testid="input-name"
                  placeholder="Your full name or organisation/service name"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, name: e.target.value }));
                    setErrors(prev => ({ ...prev, name: '' }));
                  }}
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                />
                {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
              </div>

              {/* Email */}
              <div>
                <Label htmlFor="email" className="text-slate-300">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  data-testid="input-email"
                  placeholder="Your email address"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, email: e.target.value }));
                    setErrors(prev => ({ ...prev, email: '' }));
                  }}
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                />
                {errors.email && <p className="text-red-400 text-sm mt-1">{errors.email}</p>}
              </div>

              {/* Country */}
              <div>
                <Label className="text-slate-300">Country *</Label>
                <Select value={formData.country} onValueChange={handleCountryChange}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map(country => (
                      <SelectItem key={country} value={country}>{country}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.country && <p className="text-red-400 text-sm mt-1">{errors.country}</p>}
              </div>

              {/* City/Town */}
              <div>
                <Label className="text-slate-300">City/Town *</Label>
                <Select 
                  value={formData.city} 
                  onValueChange={handleCityChange}
                  disabled={!formData.country}
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder={formData.country ? "Select city/town" : "Select country first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {formData.country && citiesByCountry[formData.country].map(city => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.city && <p className="text-red-400 text-sm mt-1">{errors.city}</p>}
              </div>

              {/* Neighbourhood */}
              <div>
                <Label className="text-slate-300">Neighbourhood *</Label>
                
                {shouldShowNeighbourhoodSelect() && (
                  <div className="space-y-2">
                    <Select 
                      value={formData.neighbourhood} 
                      onValueChange={(value) => {
                        if (value === 'other_manual') {
                          setFormData(prev => ({ ...prev, neighbourhoodType: 'manual', neighbourhood: '' }));
                        } else {
                          setFormData(prev => ({ ...prev, neighbourhood: value }));
                          setErrors(prev => ({ ...prev, neighbourhood: '' }));
                        }
                      }}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="Select neighbourhood" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableNeighbourhoods().map(neighbourhood => (
                          <SelectItem key={neighbourhood} value={neighbourhood}>{neighbourhood}</SelectItem>
                        ))}
                        <SelectItem value="other_manual">Other (type manually)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {shouldShowNeighbourhoodInput() && (
                  <div className="space-y-2">
                    <Input
                      data-testid="input-neighbourhood-manual"
                      placeholder="Enter your neighbourhood"
                      value={formData.neighbourhood}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, neighbourhood: e.target.value }));
                        setErrors(prev => ({ ...prev, neighbourhood: '' }));
                      }}
                      className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                    />
                    {neighbourhoodsByCity[formData.city] && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFormData(prev => ({ ...prev, neighbourhoodType: 'select', neighbourhood: '' }))}
                        className="text-cyan-400 hover:text-cyan-300 text-xs"
                      >
                        Choose from list instead
                      </Button>
                    )}
                  </div>
                )}

                {neighbourhoodLoading && (
                  <div className="flex items-center space-x-2 text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading neighbourhoods...</span>
                  </div>
                )}

                {errors.neighbourhood && <p className="text-red-400 text-sm mt-1">{errors.neighbourhood}</p>}
              </div>

              <Button 
                type="submit" 
                className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
                disabled={!isFormValid() || isLoading}
                data-testid="button-join-community"
              >
                {isLoading ? 'Joining...' : 'Join Community'}
              </Button>
            </form>

            <div className="text-center mt-6 space-y-4">
              <div className="flex space-x-4">
                <Link href="/login" className="flex-1">
                  <Button variant="outline" className="w-full border-slate-600 text-slate-300 hover:bg-slate-700">
                    Already have an account? Sign In
                  </Button>
                </Link>
              </div>
              <p className="text-slate-400 text-sm">
                No account required • Local community platform • Anonymous reporting available
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}