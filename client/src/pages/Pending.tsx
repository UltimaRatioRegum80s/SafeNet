import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Clock, CheckCircle, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth';
import { logout } from '@/lib/auth';
import logoLight from '@assets/Logo_1755373407688.png';
import logoDark from '@assets/Logo dark mode_1755373493360.png';

export default function Pending() {
  const { user, logout: clearAuth } = useAuthStore();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    name: user?.username || '',
    city: '',
    reason: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch('/api/access/request-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed to submit');
      setSubmitted(true);
      toast({ title: "Request submitted", description: "We'll review your request and get back to you." });
    } catch {
      toast({ title: "Error", description: "Could not submit your request. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    clearAuth();
    window.location.href = '/';
  };

  return (
    <div className="nn-auth min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-lg">
        <div className="text-center mb-8">
          <img src={logoLight} alt="NaborNet" className="w-16 h-16 mx-auto mb-4 dark:hidden block" />
          <img src={logoDark} alt="NaborNet" className="w-16 h-16 mx-auto mb-4 hidden dark:block" />
          <h1 className="text-2xl font-bold mb-2">Access Pending</h1>
          <p className="text-muted-foreground">
            Your NaborNet account has been created. An administrator needs to approve your access before you can use the community features.
          </p>
        </div>

        {submitted ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Request Submitted</h2>
              <p className="text-muted-foreground mb-4">
                Thanks for providing your details. We'll review your request and notify you once approved.
              </p>
              <p className="text-sm text-muted-foreground">
                You can close this page and check back later.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" />
                Tell Us About Yourself
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Help us process your request faster by sharing a few details. This is optional but recommended.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Your Name</Label>
                  <Input
                    id="name"
                    placeholder="Full name"
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="city">City / Neighbourhood</Label>
                  <Input
                    id="city"
                    placeholder="e.g., Swakopmund, Walvis Bay"
                    value={form.city}
                    onChange={(e) => setForm(prev => ({ ...prev, city: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="reason">Why do you want to join NaborNet?</Label>
                  <Textarea
                    id="reason"
                    placeholder="Brief reason for requesting access..."
                    rows={3}
                    value={form.reason}
                    onChange={(e) => setForm(prev => ({ ...prev, reason: e.target.value }))}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting...</>
                  ) : (
                    'Submit Request'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="text-center mt-6">
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
