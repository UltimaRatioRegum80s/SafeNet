import { AlertTriangle, Phone } from "lucide-react";

interface DisclaimerBannerProps {
  compact?: boolean;
}

export function DisclaimerBanner({ compact = false }: DisclaimerBannerProps) {
  if (compact) {
    return (
      <div 
        className="bg-amber-500/10 border-b border-amber-500/20 px-3 py-2"
        data-testid="disclaimer-banner-compact"
      >
        <div className="flex items-center justify-center gap-2 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span>
            Community reports only — <strong>not an emergency service</strong>. 
            Call <Phone className="h-3 w-3 inline mx-0.5" />10111 for emergencies.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3"
      data-testid="disclaimer-banner"
    >
      <div className="flex items-start gap-3 max-w-2xl mx-auto">
        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-amber-600 dark:text-amber-400">
            <strong>NaborNet is a community reporting tool.</strong> It is not an emergency 
            service and is not affiliated with police or government agencies. Reports are 
            user-generated and may be unverified.
          </p>
          <p className="text-amber-600/80 dark:text-amber-400/80 mt-1">
            For emergencies, call <strong>10111</strong> (Namibia/South Africa) or your local emergency number.
          </p>
        </div>
      </div>
    </div>
  );
}
