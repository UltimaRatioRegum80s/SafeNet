import { LEGAL_VERSIONS } from "@shared/schema";
import PublicLayout from "@/components/public/PublicLayout";

export default function Privacy() {
  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 py-12" data-testid="privacy-page">
        <div className="prose prose-sm dark:prose-invert">
          <p className="text-muted-foreground text-sm">
            Version {LEGAL_VERSIONS.privacy} — Last updated: December 2024
          </p>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 my-6">
            <p className="text-blue-600 dark:text-blue-400 font-medium m-0">
              🔒 Your Privacy Matters
            </p>
            <p className="text-sm text-blue-600/80 dark:text-blue-400/80 mt-2 mb-0">
              NaborNet is committed to protecting your privacy. This policy explains 
              what data we collect, how we use it, and your rights regarding your information.
            </p>
          </div>

          <h2>1. Information We Collect</h2>
          
          <h3>1.1 Information You Provide</h3>
          <ul>
            <li><strong>Account Information:</strong> Email address, username, password (encrypted), 
            and location preferences (country, city, neighbourhood)</li>
            <li><strong>Incident Reports:</strong> Report content, descriptions, photos, and 
            associated metadata</li>
            <li><strong>Communications:</strong> Messages you send through the platform</li>
          </ul>

          <h3>1.2 Automatically Collected Information</h3>
          <ul>
            <li><strong>Location Data:</strong> GPS coordinates when you submit reports or 
            use location-based features (with your permission)</li>
            <li><strong>Device Information:</strong> Device type, operating system, browser type</li>
            <li><strong>Usage Data:</strong> Features used, pages visited, interaction patterns</li>
            <li><strong>Log Data:</strong> IP addresses, access times, and error logs</li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <p>We use collected information to:</p>
          <ul>
            <li>Provide and improve the NaborNet service</li>
            <li>Display relevant local incident reports</li>
            <li>Send notifications about nearby incidents (with your permission)</li>
            <li>Maintain platform safety and prevent abuse</li>
            <li>Comply with legal obligations</li>
            <li>Analyze usage patterns to improve the service</li>
          </ul>

          <h2>3. Information Sharing</h2>
          
          <h3>3.1 Public Information</h3>
          <p>The following information is visible to other users:</p>
          <ul>
            <li>Your username (not email)</li>
            <li>Incident reports you submit (location and content)</li>
            <li>Your general neighbourhood (if you choose to display it)</li>
          </ul>

          <h3>3.2 We Do NOT Share</h3>
          <ul>
            <li>Your email address with other users</li>
            <li>Your exact home location</li>
            <li>Your personal data with advertisers</li>
            <li>Your information with third parties for their marketing</li>
          </ul>

          <h3>3.3 Legal Disclosure</h3>
          <p>
            We may disclose information when required by law, court order, or to 
            protect the safety of our users or the public.
          </p>

          <h2>4. Anonymous Reporting</h2>
          <p>
            NaborNet offers anonymous reporting options. When you report anonymously:
          </p>
          <ul>
            <li>Your username is hidden from the public report</li>
            <li>We still retain internal records for moderation purposes</li>
            <li>Verified authorities may request access in serious cases</li>
          </ul>

          <h2>5. Data Security</h2>
          <p>We implement security measures including:</p>
          <ul>
            <li>Encrypted data transmission (HTTPS/TLS)</li>
            <li>Secure password hashing</li>
            <li>Regular security audits</li>
            <li>Access controls and monitoring</li>
          </ul>
          <p>
            However, no system is 100% secure. Use strong passwords and protect 
            your account credentials.
          </p>

          <h2>6. Data Retention</h2>
          <ul>
            <li><strong>Account Data:</strong> Retained while your account is active</li>
            <li><strong>Incident Reports:</strong> Retained for community safety record-keeping</li>
            <li><strong>Log Data:</strong> Retained for 90 days for security purposes</li>
          </ul>
          <p>
            You may request deletion of your account and associated data at any time.
          </p>

          <h2>7. Your Rights</h2>
          <p>Under applicable data protection laws, you have the right to:</p>
          <ul>
            <li><strong>Access:</strong> Request a copy of your personal data</li>
            <li><strong>Correction:</strong> Update or correct inaccurate information</li>
            <li><strong>Deletion:</strong> Request deletion of your account and data</li>
            <li><strong>Portability:</strong> Receive your data in a portable format</li>
            <li><strong>Objection:</strong> Object to certain processing of your data</li>
          </ul>
          <p>
            To exercise these rights, contact us at{" "}
            <a href="mailto:privacy@nabornet.com" className="text-primary">privacy@nabornet.com</a>
          </p>

          <h2>8. Location Permissions</h2>
          <p>
            NaborNet uses location data to show you relevant local incidents. 
            You can control location access through:
          </p>
          <ul>
            <li>Your device's location settings</li>
            <li>Browser permissions for location access</li>
            <li>In-app location preferences</li>
          </ul>
          <p>
            Disabling location may limit some features but you can still use the 
            Service by manually selecting your area.
          </p>

          <h2>9. Cookies and Local Storage</h2>
          <p>We use cookies and local storage for:</p>
          <ul>
            <li>Maintaining your login session</li>
            <li>Remembering your preferences (theme, notifications)</li>
            <li>Storing consent records</li>
          </ul>
          <p>We do not use tracking cookies for advertising purposes.</p>

          <h2>10. Children's Privacy</h2>
          <p>
            NaborNet is not intended for users under 13 years of age. We do not 
            knowingly collect information from children. If you believe a child 
            has provided us with personal information, please contact us.
          </p>

          <h2>11. International Users</h2>
          <p>
            NaborNet primarily serves users in Southern Africa (Namibia, South Africa, 
            Botswana). Data may be stored and processed in servers located in various 
            jurisdictions. By using the Service, you consent to this transfer.
          </p>

          <h2>12. Policy Updates</h2>
          <p>
            We may update this Privacy Policy periodically. We will notify you of 
            significant changes and request re-consent where required by law. 
            Continued use after changes constitutes acceptance.
          </p>

          <h2>13. Contact Us</h2>
          <p>For privacy-related questions or requests:</p>
          <ul>
            <li>Email: <a href="mailto:privacy@nabornet.com" className="text-primary">privacy@nabornet.com</a></li>
            <li>Subject line: "Privacy Request - [Your Topic]"</li>
          </ul>

          <div className="border-t pt-6 mt-8">
            <p className="text-sm text-muted-foreground">
              By using NaborNet, you acknowledge that you have read and understood 
              this Privacy Policy and consent to the collection and use of your 
              information as described.
            </p>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
