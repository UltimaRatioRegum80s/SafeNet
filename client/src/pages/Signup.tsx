import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Loader2 } from 'lucide-react';
import logoLight from '@assets/Logo_1755373407688.png';
import logoDark from '@assets/Logo dark mode_1755373493360.png';
import { signupWithEmail } from '../lib/auth';
import { useAuthStore } from '../store/auth';
import { useToast } from '../hooks/use-toast';
import { countries, citiesByCountry, neighbourhoodsByCity, type Country } from '../lib/locationData';

export default function Signup() {
  const [, setLocation] = useLocation();
  const { setUser } = useAuthStore();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    role: '' as '' | 'private_citizen' | 'security_organisation' | 'government_service',
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
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
    if (!formData.password) newErrors.password = "Password is required";
    else if (formData.password.length < 6) newErrors.password = "Password must be at least 6 characters";
    if (formData.confirmPassword !== formData.password) newErrors.confirmPassword = "Passwords do not match";
    if (!formData.country) newErrors.country = "Country is required";
    if (!formData.city) newErrors.city = "City is required";
    if (!formData.neighbourhood.trim()) newErrors.neighbourhood = "Neighbourhood is required";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isFormValid = () => {
    return Boolean(
      formData.role && formData.name.trim() && formData.email.trim() &&
      formData.password.length >= 6 && formData.confirmPassword === formData.password &&
      formData.country && formData.city && formData.neighbourhood.trim()
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      // Create a real account with a password, and persist the neighbourhood
      // this form already collects. Signup previously called the anonymous
      // join endpoint, which left the account with no password to log back
      // in with and dropped the neighbourhood entirely.
      //
      // Every account is created as a resident. Selecting "I represent ..."
      // below grants no official standing: representing a municipality,
      // police station, fire brigade or security service is claimed
      // afterwards through Community Services, where an administrator who
      // does not own the application verifies it independently.
      const user = await signupWithEmail({
        username: formData.name,
        email: formData.email,
        password: formData.password,
        role: 'private',
        country: formData.country,
        city: formData.city,
        neighbourhood: formData.neighbourhood,
      });
      setUser(user);

      const representsService = formData.role !== 'private_citizen';

      // Respect the access gate rather than assuming approval.
      if (user.accessStatus === 'pending') {
        toast({
          title: "Account created",
          description: "Check your email to verify your address. Your community access is awaiting approval.",
        });
        setLocation('/pending');
        return;
      }

      toast({
        title: "Welcome to NaborNet!",
        description: representsService
          ? "Check your email to verify your address, then apply under Community Services to have your organisation verified."
          : "Check your email to verify your address.",
      });
      setLocation(representsService ? '/community/services' : '/community/dashboard');
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message || "Unable to create account. Please try again.",
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
    
    if (neighbourhoodsByCity[city]) {
      setNeighbourhoodLoading(false);
    } else {
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
    return formData.city && (!neighbourhoodsByCity[formData.city] || formData.neighbourhoodType === 'manual');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <img 
            src={logoDark} 
            alt="NaborNet" 
            className="w-16 h-16 mx-auto mb-4 dark:block hidden" 
          />
          <img 
            src={logoLight} 
            alt="NaborNet" 
            className="w-16 h-16 mx-auto mb-4 dark:hidden block" 
          />
          <h1 className="text-3xl font-bold mb-2">Join NaborNet</h1>
          <p className="text-slate-300 mb-4">Create your account to connect with your neighborhood</p>
          <p className="text-slate-400 text-sm">
            Already have an account? <Link href="/login" className="text-cyan-400 hover:text-cyan-300">Sign in here</Link>
          </p>
        </div>

        {/* Closed Beta Notice */}
        <div className="max-w-md mx-auto mb-4">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-center">
            <p className="text-amber-400 font-semibold text-sm">
              Closed Beta
            </p>
            <p className="text-amber-300/80 text-xs mt-1">
              Registration is currently limited to invited users only. Contact the NaborNet team for access.
            </p>
          </div>
        </div>

        {/* Signup Form */}
        <div className="max-w-md mx-auto">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-center">Create Account</CardTitle>
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
                      <Label htmlFor="security-org" className="text-slate-300">I represent a security service</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="government_service" id="government-service" className="text-cyan-400" />
                      <Label htmlFor="government-service" className="text-slate-300">I represent a municipality, police or fire service</Label>
                    </div>
                  </RadioGroup>
                  <p className="text-slate-400 text-xs mt-2">
                    Everyone joins as a resident. Representing a service is verified separately &mdash;
                    after signing in you can apply under Community Services, and an administrator
                    confirms it independently before any service listing goes live.
                  </p>
                  {errors.role && <p className="text-red-400 text-sm mt-1">{errors.role}</p>}
                </div>

                {/* Name */}
                <div>
                  <Label htmlFor="name" className="text-slate-300">Name *</Label>
                  <Input
                    id="name"
                    data-testid="input-name"
                    placeholder="Your full name or organisation name"
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
                    placeholder="your.email@example.com"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, email: e.target.value }));
                      setErrors(prev => ({ ...prev, email: '' }));
                    }}
                    className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                  />
                  {errors.email && <p className="text-red-400 text-sm mt-1">{errors.email}</p>}
                </div>

                {/* Password */}
                <div>
                  <Label htmlFor="password" className="text-slate-300">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    data-testid="input-password"
                    placeholder="At least 6 characters"
                    value={formData.password}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, password: e.target.value }));
                      setErrors(prev => ({ ...prev, password: '' }));
                    }}
                    className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                  />
                  {errors.password && <p className="text-red-400 text-sm mt-1">{errors.password}</p>}
                </div>

                {/* Confirm password */}
                <div>
                  <Label htmlFor="confirm-password" className="text-slate-300">Confirm password *</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    data-testid="input-confirm-password"
                    placeholder="Re-enter your password"
                    value={formData.confirmPassword}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, confirmPassword: e.target.value }));
                      setErrors(prev => ({ ...prev, confirmPassword: '' }));
                    }}
                    className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                  />
                  {errors.confirmPassword && <p className="text-red-400 text-sm mt-1">{errors.confirmPassword}</p>}
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
                  data-testid="button-create-account"
                >
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-600" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-slate-800 px-2 text-slate-400">or continue with</span>
                </div>
              </div>

              <a
                href="/api/auth/google"
                className="flex items-center justify-center gap-2 w-full rounded-md border border-slate-600 bg-slate-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-600 transition-colors"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Sign up with Google
              </a>

              <div className="text-center mt-6">
                <p className="text-slate-400 text-sm">
                  By creating an account, you agree to our terms of service
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}