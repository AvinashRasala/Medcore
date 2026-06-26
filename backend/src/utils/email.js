const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

// Resend's shared sandbox domain. Without your own verified domain, Resend
// only allows sending TO the email address you signed up to Resend with —
// this is a Resend safety restriction, not a bug. Once you verify your own
// domain in the Resend dashboard, change FROM_EMAIL to something like
// "MedCore <noreply@yourdomain.com>" and it'll work for any recipient.
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "MedCore <onboarding@resend.dev>";

/**
 * Sends an account verification email containing a link the user must
 * click before they're allowed to log in.
 */
async function sendVerificationEmail({ to, name, token }) {
  const verifyUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/verify-email?token=${token}`;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: "Verify your MedCore account",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #0F4C4C;">Welcome to MedCore, ${name}!</h2>
          <p style="color: #2D3436; font-size: 15px; line-height: 1.6;">
            Please confirm your email address to activate your account.
          </p>
          <a href="${verifyUrl}"
             style="display: inline-block; background: #0F4C4C; color: #fff; padding: 12px 24px;
                    border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
            Verify Email Address
          </a>
          <p style="color: #5B6362; font-size: 13px;">
            Or copy this link into your browser:<br>
            <span style="color: #1C7373;">${verifyUrl}</span>
          </p>
          <p style="color: #8B9290; font-size: 12px; margin-top: 24px;">
            This link expires in 24 hours. If you didn't create this account, you can ignore this email.
          </p>
        </div>
      `,
    });

    // IMPORTANT: the Resend SDK does NOT throw on API-level failures (like
    // "recipient not allowed in sandbox mode" or "domain not verified") —
    // it returns { data, error } instead. Without checking `error` here,
    // a failed send looks identical to a successful one in the server log,
    // which is exactly the kind of silent failure that's easy to miss.
    if (error) {
      console.error(
        `❌ Verification email to ${to} FAILED to send. Resend says: ${error.message}` +
          (error.name === "validation_error"
            ? " — this usually means you're on Resend's free sandbox and tried to send to an address other than the one you signed up to Resend with."
            : "")
      );
      return { sent: false, error };
    }

    console.log(`✅ Verification email sent to ${to} (Resend id: ${data?.id})`);
    return { sent: true };
  } catch (err) {
    // Network-level failure (Resend unreachable, bad API key format, etc.)
    console.error("Failed to send verification email (network/exception):", err.message);
    return { sent: false, error: err };
  }
}

module.exports = { sendVerificationEmail };
