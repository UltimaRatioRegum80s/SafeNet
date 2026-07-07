import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Shield, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LEGAL_VERSIONS } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

const CONSENT_STORAGE_KEY = "nabornet_legal_consent";

interface ConsentRecord {
  termsVersion: string;
  privacyVersion: string;
  consentedAt: string;
}

function getStoredConsent(): ConsentRecord | null {
  try {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function isConsentValid(consent: ConsentRecord | null): boolean {
  if (!consent) return false;
  return (
    consent.termsVersion === LEGAL_VERSIONS.terms &&
    consent.privacyVersion === LEGAL_VERSIONS.privacy
  );
}

interface LegalGateProps {
  children: React.ReactNode;
}

export function LegalGate({ children }: LegalGateProps) {
  const [hasConsented, setHasConsented] = useState<boolean | null>(null);
  const [termsChecked, setTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const consent = getStoredConsent();
    setHasConsented(isConsentValid(consent));
  }, []);

  const handleAccept = async () => {
    if (!termsChecked || !privacyChecked) return;

    setIsSubmitting(true);
    
    try {
      await apiRequest("POST", "/api/legal/consent", {
        termsVersion: LEGAL_VERSIONS.terms,
        privacyVersion: LEGAL_VERSIONS.privacy,
      });
    } catch (error) {
      console.warn("Failed to save consent to server (will retry on login):", error);
    }

    const consentRecord: ConsentRecord = {
      termsVersion: LEGAL_VERSIONS.terms,
      privacyVersion: LEGAL_VERSIONS.privacy,
      consentedAt: new Date().toISOString(),
    };
    
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consentRecord));
    setHasConsented(true);
    setIsSubmitting(false);
  };

  if (hasConsented === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (hasConsented) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="legal-gate">
      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-4 py-6">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Welcome to NaborNet</h1>
          <p className="text-muted-foreground mt-2">
            Community safety through neighborhood awareness
          </p>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-600 dark:text-amber-400">Important Notice</p>
              <p className="text-amber-600/80 dark:text-amber-400/80 mt-1">
                NaborNet is a community reporting tool. It is <strong>not an emergency service</strong> and 
                is <strong>not affiliated with police</strong>. Reports are user-generated and may be unverified.
              </p>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 border rounded-lg bg-card mb-6">
          <div className="p-4 space-y-4">
            <h2 className="font-semibold">Before you continue, please review:</h2>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1">
                  <Link href="/legal/terms" className="font-medium text-primary hover:underline">
                    Terms of Service
                  </Link>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your rights and responsibilities when using NaborNet, including content 
                    guidelines and usage policies.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <Shield className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1">
                  <Link href="/legal/privacy" className="font-medium text-primary hover:underline">
                    Privacy Policy
                  </Link>
                  <p className="text-sm text-muted-foreground mt-1">
                    How we collect, use, and protect your personal information, including 
                    location data.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t pt-4 mt-4 space-y-3">
              <div className="flex items-center gap-3">
                <Checkbox 
                  id="terms-consent" 
                  checked={termsChecked}
                  onCheckedChange={(checked) => setTermsChecked(checked === true)}
                  data-testid="checkbox-terms"
                />
                <label htmlFor="terms-consent" className="text-sm cursor-pointer">
                  I have read and agree to the{" "}
                  <Link href="/legal/terms" className="text-primary hover:underline">Terms of Service</Link>
                </label>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox 
                  id="privacy-consent" 
                  checked={privacyChecked}
                  onCheckedChange={(checked) => setPrivacyChecked(checked === true)}
                  data-testid="checkbox-privacy"
                />
                <label htmlFor="privacy-consent" className="text-sm cursor-pointer">
                  I have read and agree to the{" "}
                  <Link href="/legal/privacy" className="text-primary hover:underline">Privacy Policy</Link>
                </label>
              </div>
            </div>
          </div>
        </ScrollArea>

        <Button
          onClick={handleAccept}
          disabled={!termsChecked || !privacyChecked || isSubmitting}
          className="w-full h-12 text-base"
          data-testid="btn-accept-legal"
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Processing...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              <span>Accept and Continue</span>
            </div>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Version: Terms v{LEGAL_VERSIONS.terms} · Privacy v{LEGAL_VERSIONS.privacy}
        </p>
      </div>
    </div>
  );
}
