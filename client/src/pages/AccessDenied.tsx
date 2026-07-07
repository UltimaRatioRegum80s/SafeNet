import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { XCircle, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { logout } from '@/lib/auth';
import logoLight from '@assets/Logo_1755373407688.png';
import logoDark from '@assets/Logo dark mode_1755373493360.png';

export default function AccessDenied() {
  const { logout: clearAuth } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    clearAuth();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-lg">
        <div className="text-center mb-8">
          <img src={logoLight} alt="NaborNet" className="w-16 h-16 mx-auto mb-4 dark:hidden block" />
          <img src={logoDark} alt="NaborNet" className="w-16 h-16 mx-auto mb-4 hidden dark:block" />
        </div>

        <Card>
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Access Denied</h1>
            <p className="text-muted-foreground mb-4">
              Your request to join NaborNet was not approved at this time. If you believe this is a mistake, please contact the NaborNet team.
            </p>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
