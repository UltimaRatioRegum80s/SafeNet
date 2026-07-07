import { useState } from "react";
import { AlertTriangle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";
import { resendVerificationEmail } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface EmailVerificationBannerProps {
  variant?: "banner" | "inline";
}

export function EmailVerificationBanner({ variant = "banner" }: EmailVerificationBannerProps) {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [isResending, setIsResending] = useState(false);

  if (!user || user.emailVerified) {
    return null;
  }

  const handleResend = async () => {
    setIsResending(true);
    try {
      await resendVerificationEmail();
      toast({
        title: "Verification email sent",
        description: "Check your inbox (and spam folder) for a message from NaborNet.",
      });
    } catch (error: any) {
      // Handle specific error cases with neutral messaging
      const errorMessage = error.message || "";
      if (errorMessage.includes("already verified")) {
        toast({
          title: "Email already verified",
          description: "Your email address has already been verified. You can continue using the app.",
        });
      } else if (errorMessage.includes("wait")) {
        toast({
          title: "Resend cooldown active",
          description: errorMessage,
        });
      } else {
        toast({
          title: "Unable to send email",
          description: "Something went wrong. You can try again in a moment.",
          variant: "destructive",
        });
      }
    } finally {
      setIsResending(false);
    }
  };

  if (variant === "inline") {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-center" data-testid="verification-inline-notice">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Mail className="h-5 w-5 text-amber-500" />
          <span className="font-medium text-amber-200">Email verification needed</span>
        </div>
        <p className="text-sm text-white/70 mb-3">
          A verified email is needed to report incidents. Check your inbox (and spam folder) for the verification link.
        </p>
        <Button
          onClick={handleResend}
          disabled={isResending}
          variant="outline"
          size="sm"
          className="border-amber-500/50 text-amber-200 hover:bg-amber-500/20"
          data-testid="button-resend-verification"
        >
          {isResending ? "Sending..." : "Resend verification email"}
        </Button>
      </div>
    );
  }

  return (
    <div 
      className="fixed top-0 left-0 right-0 z-50 bg-amber-600 text-white px-4 py-2 flex items-center justify-between gap-3"
      data-testid="verification-banner"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm truncate">
          Email verification needed — check your inbox
        </span>
      </div>
      <Button
        onClick={handleResend}
        disabled={isResending}
        size="sm"
        variant="secondary"
        className="bg-white/20 hover:bg-white/30 text-white border-0 text-xs px-2 py-1 h-7 flex-shrink-0"
        data-testid="button-resend-verification-banner"
      >
        {isResending ? "Sending..." : "Resend"}
      </Button>
    </div>
  );
}
