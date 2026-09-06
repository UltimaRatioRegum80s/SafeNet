import { useEffect, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, Mail, RefreshCw } from 'lucide-react';

type VerifyStatus = 'loading' | 'success' | 'error' | 'expired' | 'already_verified';

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<VerifyStatus>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setStatus('error');
      setMessage('No verification token was found in this link.');
      return;
    }

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          setStatus('success');
          setMessage('Your email address has been verified.');
        } else {
          const errorMsg = data.error || '';
          if (errorMsg.toLowerCase().includes('expired') || errorMsg.toLowerCase().includes('invalid')) {
            setStatus('expired');
            setMessage('This verification link has expired or is no longer valid.');
          } else if (errorMsg.toLowerCase().includes('already')) {
            setStatus('already_verified');
            setMessage('Your email address is already verified.');
          } else {
            setStatus('error');
            setMessage(errorMsg || 'Verification could not be completed.');
          }
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Unable to reach the server. Check your connection and try again.');
      });
  }, []);

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-12 w-12 text-primary animate-spin" />;
      case 'success':
      case 'already_verified':
        return <CheckCircle className="h-12 w-12 text-green-500" />;
      case 'expired':
        return <RefreshCw className="h-12 w-12 text-amber-500" />;
      case 'error':
        return <XCircle className="h-12 w-12 text-destructive" />;
    }
  };

  const getStatusTitle = () => {
    switch (status) {
      case 'loading':
        return 'Verifying...';
      case 'success':
        return 'Email Verified';
      case 'already_verified':
        return 'Already Verified';
      case 'expired':
        return 'Link Expired';
      case 'error':
        return 'Verification Issue';
    }
  };

  return (
    <div className="nn-auth min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md" data-testid="verify-email-card">
        <CardHeader className="text-center">
          <CardTitle className="flex flex-col items-center gap-4">
            {getStatusIcon()}
            <span>{getStatusTitle()}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">{message}</p>
          
          {(status === 'success' || status === 'already_verified') && (
            <Button onClick={() => setLocation('/community/map')} className="w-full" data-testid="btn-go-to-app">
              Continue to App
            </Button>
          )}
          
          {status === 'expired' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                You can request a new verification email after logging in.
              </p>
              <Link href="/login">
                <Button variant="outline" className="w-full" data-testid="btn-back-to-login">
                  <Mail className="mr-2 h-4 w-4" />
                  Go to Login
                </Button>
              </Link>
            </div>
          )}
          
          {status === 'error' && (
            <div className="space-y-3">
              <Link href="/login">
                <Button variant="outline" className="w-full" data-testid="btn-back-to-login">
                  <Mail className="mr-2 h-4 w-4" />
                  Go to Login
                </Button>
              </Link>
              <p className="text-xs text-muted-foreground">
                If you continue to have issues, you can request a new verification email after logging in.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
