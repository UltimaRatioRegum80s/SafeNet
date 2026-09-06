import { Resend } from 'resend';
import crypto from 'crypto';

/**
 * Resend is created lazily. It used to be constructed at module scope, but
 * the Resend constructor THROWS when the API key is missing — and this module
 * is imported by server/routes.ts, so an unset RESEND_API_KEY took the whole
 * server down at boot. The static shell still served, every /api call hung,
 * and the app sat on "Loading NaborNet..." forever.
 *
 * Email is not critical-path for the server booting, so a missing key now
 * degrades to "not sent" and is logged, rather than killing the process.
 */
let resendClient: Resend | null | undefined;

/**
 * The outcome of one attempt to send. Availability and delivery are separate
 * things: `not_configured` means we never tried, `rejected` means the
 * provider refused the message, `error` means the call itself failed. Callers
 * must not collapse any of these into "sent".
 */
export type EmailOutcome =
  | { sent: true }
  | { sent: false; reason: "not_configured" | "rejected" | "error" };

/**
 * Log without the recipient, the token or the key. `kind` is the template
 * name, never an address.
 */
function logOutcome(kind: string, outcome: EmailOutcome, detail?: unknown): void {
  if (outcome.sent) {
    console.log(`📧 [EMAIL] ${kind}: accepted by the provider`);
    return;
  }
  if (outcome.reason === "not_configured") {
    console.warn(`[EMAIL] ${kind}: not sent - RESEND_API_KEY is not configured`);
    return;
  }
  // Provider diagnostics only. The address is interpolated nowhere here.
  const error = detail as { name?: string; message?: string } | undefined;
  console.error(
    `❌ [EMAIL] ${kind}: not sent (${outcome.reason})`,
    error?.name ?? "unknown",
    error?.message ?? "",
  );
}

let warnedAboutMissingKey = false;

function getResend(): Resend | null {
  if (resendClient) return resendClient;

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Not memoised as "permanently unavailable": re-reading the environment
    // each time costs nothing and means delivery configured after boot starts
    // working, rather than staying dead until the process restarts. The
    // warning is only emitted once so it cannot flood the log.
    if (!warnedAboutMissingKey) {
      console.warn(
        "[EMAIL] RESEND_API_KEY is not set - verification and password reset emails will not be sent.",
      );
      warnedAboutMissingKey = true;
    }
    return null;
  }

  try {
    resendClient = new Resend(key);
  } catch (error) {
    // The Resend constructor throws on an unusable key. It used to run at
    // module scope, which took the whole server down at boot because
    // server/routes.ts imports this file. Never let it escape.
    console.error("[EMAIL] Could not construct the Resend client", (error as Error)?.name);
    return null;
  }
  warnedAboutMissingKey = false;
  return resendClient;
}

/** Test seam: forget the memoised client so a new key is picked up. */
export function resetEmailClientForTests(): void {
  resendClient = undefined;
  warnedAboutMissingKey = false;
}

const APP_NAME = process.env.APP_NAME || 'NaborNet';
const FROM_EMAIL = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const APP_URL = process.env.APP_URL || (process.env.REPLIT_DEV_DOMAIN 
  ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
  : 'http://localhost:5000');

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function sendVerificationEmail(
  email: string,
  token: string,
  username: string
): Promise<EmailOutcome> {
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;
  const resend = getResend();
  if (!resend) {
    const outcome = { sent: false, reason: "not_configured" } as const;
    logOutcome("verification", outcome);
    return outcome;
  }

  try {
    const { error } = await resend.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: `Verify your ${APP_NAME} account`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            <h1 style="color: #0f172a; font-size: 24px; margin-bottom: 16px;">Welcome to ${APP_NAME}!</h1>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              Hi ${username},<br><br>
              Please verify your email address to start reporting incidents in your community.
            </p>
            <div style="margin: 32px 0; text-align: center;">
              <a href="${verifyUrl}" style="display: inline-block; background: #0ea5e9; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Verify Email
              </a>
            </div>
            <p style="color: #94a3b8; font-size: 14px; line-height: 1.5;">
              This link expires in 24 hours.<br>
              If you didn't create an account, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
            <p style="color: #94a3b8; font-size: 12px;">
              ${APP_NAME} - Community Safety Platform<br>
              <a href="${APP_URL}" style="color: #0ea5e9; text-decoration: none;">${APP_URL}</a>
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      const outcome = { sent: false, reason: "rejected" } as const;
      logOutcome("verification", outcome, error);
      return outcome;
    }

    logOutcome("verification", { sent: true });
    return { sent: true };
  } catch (error) {
    const outcome = { sent: false, reason: "error" } as const;
    logOutcome("verification", outcome, error);
    return outcome;
  }
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
  username: string
): Promise<EmailOutcome> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  const resend = getResend();
  if (!resend) {
    const outcome = { sent: false, reason: "not_configured" } as const;
    logOutcome("password reset", outcome);
    return outcome;
  }

  try {
    const { error } = await resend.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: `Reset your ${APP_NAME} password`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            <h1 style="color: #0f172a; font-size: 24px; margin-bottom: 16px;">Reset Your Password</h1>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              Hi ${username},<br><br>
              We received a request to reset your password. Click the button below to choose a new password.
            </p>
            <div style="margin: 32px 0; text-align: center;">
              <a href="${resetUrl}" style="display: inline-block; background: #0ea5e9; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Reset Password
              </a>
            </div>
            <p style="color: #94a3b8; font-size: 14px; line-height: 1.5;">
              This link expires in 1 hour.<br>
              If you didn't request a password reset, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
            <p style="color: #94a3b8; font-size: 12px;">
              ${APP_NAME} - Community Safety Platform<br>
              <a href="${APP_URL}" style="color: #0ea5e9; text-decoration: none;">${APP_URL}</a>
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      const outcome = { sent: false, reason: "rejected" } as const;
      logOutcome("password reset", outcome, error);
      return outcome;
    }

    logOutcome("password reset", { sent: true });
    return { sent: true };
  } catch (error) {
    const outcome = { sent: false, reason: "error" } as const;
    logOutcome("password reset", outcome, error);
    return outcome;
  }
}
