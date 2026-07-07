import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Phone, Shield, Info } from "lucide-react";
import PublicLayout from "@/components/public/PublicLayout";

export default function Safety() {
  return (
    <PublicLayout>
      <div className="py-12 md:py-16 px-4">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-[var(--pub-text)] mb-4">Safety & Limitations</h1>
            <p className="text-[var(--pub-text-secondary)] mb-8">
              Important information about what NaborNet can and cannot do.
            </p>
          </div>

          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <Phone className="h-6 w-6 text-red-400 flex-shrink-0 mt-1" />
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-[var(--pub-text)]">In an Emergency</h2>
                <p className="text-[var(--pub-text-secondary)]">
                  <strong>NaborNet is not an emergency service.</strong> In an emergency, contact 
                  local emergency services. Examples by region:
                </p>
                <ul className="text-[var(--pub-text-secondary)] space-y-1 mt-3">
                  <li><strong>Namibia:</strong> 10111 (Police) / 211 (Ambulance)</li>
                  <li><strong>Kenya:</strong> 999 or 112 (Emergency)</li>
                </ul>
                <p className="text-[var(--pub-text-secondary)] text-sm mt-3 opacity-75">
                  Do not rely on NaborNet for emergency response. We cannot dispatch help.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[var(--pub-surface)] border border-[var(--pub-border)] rounded-xl p-6 space-y-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[var(--pub-text)] flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                Important Limitations
              </h2>
              
              <div className="space-y-4">
                <div className="bg-[var(--pub-bg)] rounded-lg p-4">
                  <h3 className="font-medium text-[var(--pub-text)] mb-2">Unverified Information</h3>
                  <p className="text-sm text-[var(--pub-text-secondary)]">
                    All reports on NaborNet are submitted by community members and are not verified, 
                    investigated, or fact-checked. Information may be inaccurate, incomplete, or 
                    mistaken. Always use your own judgement.
                  </p>
                </div>

                <div className="bg-[var(--pub-bg)] rounded-lg p-4">
                  <h3 className="font-medium text-[var(--pub-text)] mb-2">No Authority or Guarantee</h3>
                  <p className="text-sm text-[var(--pub-text-secondary)]">
                    NaborNet has no authority, no enforcement capability, and no official status. 
                    We do not guarantee the accuracy, timeliness, or completeness of any information. 
                    We are not liable for actions taken based on reports.
                  </p>
                </div>

                <div className="bg-[var(--pub-bg)] rounded-lg p-4">
                  <h3 className="font-medium text-[var(--pub-text)] mb-2">Location Approximation</h3>
                  <p className="text-sm text-[var(--pub-text-secondary)]">
                    Report locations are approximate and based on user-provided GPS data. They may 
                    not reflect the exact location of incidents. Location accuracy varies by device 
                    and conditions.
                  </p>
                </div>

                <div className="bg-[var(--pub-bg)] rounded-lg p-4">
                  <h3 className="font-medium text-[var(--pub-text)] mb-2">Temporary Data</h3>
                  <p className="text-sm text-[var(--pub-text-secondary)]">
                    Reports are automatically removed after a short period. NaborNet is designed 
                    for current situational awareness, not historical records or evidence.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[var(--pub-surface)] border border-[var(--pub-border)] rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold text-[var(--pub-text)] flex items-center gap-2">
              <Shield className="h-5 w-5 text-[var(--pub-accent)]" />
              Safe Use Guidelines
            </h2>
            <ul className="space-y-3 text-[var(--pub-text-secondary)]">
              <li className="flex items-start gap-2">
                <span className="text-[var(--pub-accent)] mt-1">•</span>
                <span>Treat all reports as unverified observations, not facts</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--pub-accent)] mt-1">•</span>
                <span>Do not take confrontational action based on reports</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--pub-accent)] mt-1">•</span>
                <span>Report only what you directly observe, not rumours</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--pub-accent)] mt-1">•</span>
                <span>Respect others' privacy when reporting</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--pub-accent)] mt-1">•</span>
                <span>Contact authorities for serious matters, not NaborNet</span>
              </li>
            </ul>
          </div>

          <div className="bg-[var(--pub-surface)] border border-[var(--pub-border)] rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold text-[var(--pub-text)] flex items-center gap-2">
              <Info className="h-5 w-5 text-[var(--pub-accent)]" />
              Legal Notice
            </h2>
            <p className="text-[var(--pub-text-secondary)] text-sm">
              By using NaborNet, you acknowledge that information is user-generated and unverified. 
              NaborNet, its operators, and affiliates are not responsible for the accuracy of reports 
              or any actions taken based on them. Use of this service is at your own risk.
            </p>
            <p className="text-[var(--pub-text-secondary)] text-sm">
              For complete terms and conditions, please read our{" "}
              <Link href="/legal/terms" className="text-[var(--pub-accent)] hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/legal/privacy" className="text-[var(--pub-accent)] hover:underline">
                Privacy Policy
              </Link>.
            </p>
          </div>

          <div className="text-center pt-4">
            <Link href="/">
              <Button className="border border-[var(--pub-border)] bg-transparent text-[var(--pub-text-secondary)] hover:bg-[var(--pub-surface)]">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
