import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Loader2 } from 'lucide-react';
import logoLight from '@assets/Logo_1755373407688.png';
import logoDark from '@assets/Logo dark mode_1755373493360.png';
import { loginWithEmail } from '../lib/auth';
import { useAuthStore } from '../store/auth';
import { useToast } from '../hooks/use-toast';

export default function Login() {
  const [, setLocation] = useLocation();
  const { setUser } = useAuthStore();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = "Valid email is required";
    if (!formData.password.trim()) newErrors.password = "Password is required";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isFormValid = () => {
    return formData.email.trim() && formData.password.trim();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      const user = await loginWithEmail(formData);
      setUser(user);
      toast({
        title: "Welcome back!",
        description: "You have successfully signed in to NaborNet",
      });
      setLocation('/community/dashboard');
    } catch (error: any) {
      toast({
        title: "Sign In Failed",
        description: error.message || "Invalid email or password. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="nn-auth min-h-screen bg-background dark:bg-background text-foreground dark:text-foreground">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <img 
            src={logoLight} 
            alt="NaborNet" 
            className="w-16 h-16 mx-auto mb-4 dark:hidden block" 
          />
          <img 
            src={logoDark} 
            alt="NaborNet" 
            className="w-16 h-16 mx-auto mb-4 hidden dark:block" 
          />
          <h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
          <p className="text-muted-foreground mb-4">Sign in to your NaborNet account</p>
          <p className="text-muted-foreground text-sm">
            Don't have an account? <Link href="/signup" className="text-primary hover:text-primary/80">Create one here</Link>
          </p>
        </div>

        {/* Login Form */}
        <div className="max-w-md mx-auto">
          <Card className="bg-card dark:bg-card border-border dark:border-border">
            <CardHeader>
              <CardTitle className="text-foreground dark:text-foreground text-center">Sign In</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email */}
                <div>
                  <Label htmlFor="email" className="text-foreground dark:text-foreground">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    data-testid="input-email"
                    placeholder="your.email@example.com"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, email: e.target.value }));
                      if (errors.email) {
                        setErrors(prev => ({ ...prev, email: '' }));
                      }
                    }}
                    className="bg-background dark:bg-background border-border dark:border-border text-foreground dark:text-foreground"
                    required
                  />
                  {errors.email && <p className="text-destructive text-sm mt-1">{errors.email}</p>}
                </div>

                {/* Password */}
                <div>
                  <Label htmlFor="password" className="text-foreground dark:text-foreground">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    data-testid="input-password"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, password: e.target.value }));
                      if (errors.password) {
                        setErrors(prev => ({ ...prev, password: '' }));
                      }
                    }}
                    className="bg-background dark:bg-background border-border dark:border-border text-foreground dark:text-foreground"
                    required
                  />
                  {errors.password && <p className="text-destructive text-sm mt-1">{errors.password}</p>}
                </div>

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={!isFormValid() || isLoading}
                  data-testid="button-sign-in"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Signing In...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or continue with</span>
                </div>
              </div>

              <a
                href="/api/auth/google"
                className="flex items-center justify-center gap-2 w-full rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Sign in with Google
              </a>

              <div className="text-center mt-6">
                <p className="text-muted-foreground text-sm">
                  Forgot your password? <Link href="/forgot-password" className="text-primary hover:text-primary/80">Reset it here</Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}