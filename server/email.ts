import { Resend } from 'resend';
import crypto from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);

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
): Promise<boolean> {
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;
  
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
      console.error('❌ [EMAIL] Verification email failed:', error);
      return false;
    }

    console.log(`📧 [EMAIL] Verification email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ [EMAIL] Failed to send verification email:', error);
    return false;
  }
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
  username: string
): Promise<boolean> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  
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
      console.error('❌ [EMAIL] Password reset email failed:', error);
      return false;
    }

    console.log(`📧 [EMAIL] Password reset email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ [EMAIL] Failed to send password reset email:', error);
    return false;
  }
}
