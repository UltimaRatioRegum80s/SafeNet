import { LEGAL_VERSIONS } from "@shared/schema";
import PublicLayout from "@/components/public/PublicLayout";

export default function Terms() {
  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 py-12" data-testid="terms-page">
        <div className="prose prose-sm dark:prose-invert">
          <p className="text-muted-foreground text-sm">
            Version {LEGAL_VERSIONS.terms} — Last updated: December 2024
          </p>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 my-6">
            <p className="text-amber-600 dark:text-amber-400 font-medium m-0">
              ⚠️ BETA SERVICE NOTICE
            </p>
            <p className="text-sm text-amber-600/80 dark:text-amber-400/80 mt-2 mb-0">
              NaborNet is currently in beta testing. Features may change, and the service 
              may experience interruptions. Use at your own discretion.
            </p>
          </div>

          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using NaborNet ("the Service"), you agree to be bound by these 
            Terms of Service. If you do not agree to these terms, do not use the Service.
          </p>

          <h2>2. Service Description</h2>
          <p>
            NaborNet is a community information-sharing platform that allows users to 
            report and view incidents in their neighborhood. The Service is designed to 
            facilitate community communication and awareness.
          </p>

          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 my-6">
            <h3 className="text-red-600 dark:text-red-400 font-bold mt-0">
              🚨 CRITICAL DISCLAIMERS
            </h3>
            <ul className="text-sm space-y-2 mb-0">
              <li>
                <strong>NaborNet is NOT an emergency service.</strong> For emergencies, 
                call your local emergency number (e.g., 10111 in Namibia, 10111 in South Africa).
              </li>
              <li>
                <strong>NaborNet is NOT affiliated with police or government agencies.</strong> 
                Reports are user-generated community content.
              </li>
              <li>
                <strong>Information may be unverified.</strong> Users submit reports that 
                may contain inaccuracies, incomplete information, or errors.
              </li>
              <li>
                <strong>Do not rely solely on NaborNet for safety decisions.</strong> Always 
                verify information through official channels when making safety-critical decisions.
              </li>
            </ul>
          </div>

          <h2>3. User Responsibilities</h2>
          <p>When using NaborNet, you agree to:</p>
          <ul>
            <li>Provide accurate and truthful information in your reports</li>
            <li>Not submit false, misleading, or malicious reports</li>
            <li>Not use the Service to harass, threaten, or harm others</li>
            <li>Not impersonate emergency services or official authorities</li>
            <li>Respect the privacy of individuals depicted in reports</li>
            <li>Comply with all applicable local laws and regulations</li>
          </ul>
          <p className="text-sm bg-muted/50 p-3 rounded-lg border border-border mt-3">
            <strong>Important:</strong> Users must report observations and facts and must not 
            present allegations or suspicions as confirmed facts or criminal guilt. Use neutral 
            language (e.g., "suspicious activity observed" rather than accusations).
          </p>

          <h2>4. Content Guidelines</h2>
          <p>You may not submit content that:</p>
          <ul>
            <li>Contains false emergency reports or hoaxes</li>
            <li>Includes hate speech, discrimination, or harassment</li>
            <li>Violates the privacy of identifiable individuals</li>
            <li>Contains illegal content or promotes illegal activities</li>
            <li>Is spam, commercial advertising, or off-topic</li>
          </ul>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 my-4">
            <p className="text-amber-600 dark:text-amber-400 font-medium m-0">
              🚫 No Personal Data / Doxxing
            </p>
            <p className="text-sm mt-2 mb-0">
              You may not post, request, or share personal information about any individual 
              (names, phone numbers, addresses, ID numbers, vehicle registration numbers, 
              workplace details, etc.), including for suspected offenders. Report serious 
              crimes to authorities (10111) instead of publishing identifying details on NaborNet.
            </p>
          </div>

          <p>
            We reserve the right to remove content and suspend users who violate these guidelines.
          </p>

          <h2>5. Location Data</h2>
          <p>
            The Service uses location data to provide relevant local information. By using 
            NaborNet, you consent to the collection and use of location data as described 
            in our Privacy Policy. You can control location permissions through your device settings.
          </p>

          <h2>6. Limitation of Liability</h2>
          <p>
            NaborNet is provided "as is" without warranties of any kind. We are not 
            responsible for:
          </p>
          <ul>
            <li>The accuracy, completeness, or reliability of user-submitted content</li>
            <li>Decisions you make based on information from the Service</li>
            <li>Service interruptions, delays, or technical issues</li>
            <li>Any damages arising from your use of the Service</li>
          </ul>

          <h2>7. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless NaborNet, its operators, and 
            affiliates from any claims, damages, or expenses arising from your use of 
            the Service or violation of these terms.
          </p>

          <h2>8. Modifications</h2>
          <p>
            We may update these Terms of Service at any time. Continued use of the 
            Service after changes constitutes acceptance of the new terms. We will 
            notify users of significant changes and require re-acceptance of updated terms.
          </p>

          <h2>9. Termination</h2>
          <p>
            We reserve the right to suspend or terminate your access to the Service 
            at any time for violations of these terms or for any other reason at our 
            sole discretion.
          </p>

          <h2>10. Governing Law</h2>
          <p>
            These Terms shall be governed by the laws of the Republic of Namibia. 
            Any disputes shall be resolved in the courts of Windhoek, Namibia.
          </p>

          <h2>11. Contact</h2>
          <p>
            For questions about these Terms of Service, please contact us at: 
            <a href="mailto:legal@nabornet.com" className="text-primary">legal@nabornet.com</a>
          </p>

          <div className="border-t pt-6 mt-8">
            <p className="text-sm text-muted-foreground">
              By using NaborNet, you acknowledge that you have read, understood, and 
              agree to be bound by these Terms of Service.
            </p>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
