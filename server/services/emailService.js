/**
 * services/emailService.js
 * -------------------------
 * Sends transactional email via Gmail SMTP using Nodemailer.
 *
 * Configuration — all values come from server/.env:
 *
 *   SMTP_HOST      smtp.gmail.com
 *   SMTP_PORT      465
 *   SMTP_SECURE    true
 *   SMTP_USER      your-gmail-address@gmail.com
 *   SMTP_PASSWORD  your-16-char-gmail-app-password   (NOT your login password)
 *   MAIL_FROM      "Secure Cloud Storage" <your-gmail-address@gmail.com>
 *   CLIENT_URL     http://localhost:3000   (or your Render frontend URL)
 *
 * Gmail App Password setup:
 *   Google Account → Security → 2-Step Verification → App passwords
 *   Select app: "Mail", device: "Other" → copy the 16-char password
 *
 * SECURITY NOTES
 * ──────────────
 * • Credentials are NEVER logged or exposed to the frontend.
 * • The raw reset token is NEVER logged — only its existence.
 * • The transporter is lazily created so missing env vars are only
 *   detected at runtime (not at module load), giving a clear error.
 */

const nodemailer = require('nodemailer');

let _transporter = null;

/**
 * Returns (and caches) the Nodemailer transporter.
 * Throws a descriptive error if SMTP env vars are missing.
 */
function getTransporter() {
  if (_transporter) return _transporter;

  const required = ['SMTP_USER', 'SMTP_PASSWORD'];
  const missing  = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Email service not configured. Missing env vars: ${missing.join(', ')}. ` +
      'Add them to server/.env and restart the server.'
    );
  }

  _transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST     || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '465', 10),
    secure: process.env.SMTP_SECURE !== 'false', // default true
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    // Helps with corporate proxies / Render TLS
    tls: { rejectUnauthorized: false },
  });

  return _transporter;
}

/**
 * sendPasswordResetEmail
 * -----------------------
 * Sends the password-reset email to the user's registered address.
 *
 * @param {object} params
 * @param {string} params.toEmail    — recipient address (user's registered email)
 * @param {string} params.toName     — user's display name
 * @param {string} params.resetToken — raw (unhashed) token — embedded in the link
 *                                     NEVER logged; included in email body only
 */
async function sendPasswordResetEmail({ toEmail, toName, resetToken }) {
  const clientUrl  = process.env.CLIENT_URL || 'http://localhost:3000';
  const fromAddr   = process.env.MAIL_FROM  ||
                     `"Secure Cloud Storage" <${process.env.SMTP_USER}>`;

  const resetLink  = `${clientUrl}/reset-password?token=${resetToken}`;
  const expiryMins = 15;

  // ── Plain-text body ─────────────────────────────────────
  const textBody = [
    `Hi ${toName},`,
    '',
    'You requested a password reset for your Secure Cloud Storage account.',
    '',
    `Reset your password by clicking the link below (expires in ${expiryMins} minutes):`,
    '',
    resetLink,
    '',
    'If you did not request this, please ignore this email.',
    'Your password will not change unless you click the link above and create a new one.',
    '',
    '— Secure Cloud Storage Security Team',
  ].join('\n');

  // ── HTML body ───────────────────────────────────────────
  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
    <tr><td align="center">

      <!-- Card -->
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1d4ed8,#2563eb);padding:32px 40px;text-align:center;">
            <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:12px;margin-bottom:16px;">
              <!-- Shield icon (SVG inline) -->
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div style="color:white;font-size:22px;font-weight:800;letter-spacing:-0.5px;">
              Secure Cloud Storage
            </div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111827;">
              Reset your password
            </h1>
            <p style="margin:0 0 24px;font-size:16px;color:#6b7280;line-height:1.6;">
              Hi <strong style="color:#111827;">${toName}</strong>,
            </p>
            <p style="margin:0 0 28px;font-size:16px;color:#374151;line-height:1.6;">
              You requested a password reset for your account. Click the button below
              to create a new password.
            </p>

            <!-- CTA button -->
            <div style="text-align:center;margin-bottom:28px;">
              <a href="${resetLink}"
                 style="display:inline-block;background:#2563eb;color:#ffffff;
                        font-size:16px;font-weight:700;text-decoration:none;
                        padding:14px 36px;border-radius:10px;
                        box-shadow:0 4px 12px rgba(37,99,235,0.35);">
                Reset Password
              </a>
            </div>

            <!-- Expiry notice -->
            <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
              <p style="margin:0;font-size:14px;color:#713f12;">
                ⏰ This link expires in <strong>${expiryMins} minutes</strong>.
              </p>
            </div>

            <!-- Fallback link -->
            <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;">
              If the button doesn't work, copy and paste this URL into your browser:
            </p>
            <p style="margin:0 0 24px;font-size:13px;word-break:break-all;">
              <a href="${resetLink}" style="color:#2563eb;">${resetLink}</a>
            </p>

            <!-- Security notice -->
            <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;
                      border-top:1px solid #e5e7eb;padding-top:20px;">
              If you didn't request a password reset, you can safely ignore this email.
              Your password won't change.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;text-align:center;
                     border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:13px;color:#9ca3af;">
              © ${new Date().getFullYear()} Secure Cloud Storage &nbsp;·&nbsp;
              This is an automated security email — do not reply.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const transporter = getTransporter();

  await transporter.sendMail({
    from:    fromAddr,
    to:      toEmail,
    subject: 'Reset your Secure Cloud Storage password',
    text:    textBody,
    html:    htmlBody,
  });

  // Log that an email was sent — but NEVER log the token itself
  console.log(`[emailService] Password-reset email sent to ${toEmail}`);
}

module.exports = { sendPasswordResetEmail };
