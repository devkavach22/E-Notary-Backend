const nodemailer = require("nodemailer");

// ─── Random 6 digit OTP banao ────────────────────────────
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ─── Email Transporter Setup ─────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ─── OTP Email Template ───────────────────────────────────
const sendOTPEmail = async (email, otp, purpose) => {
  const subject =
    purpose === "email_verify"
      ? "E-Notary - Email Verification OTP"
      : "E-Notary - Mobile Verification OTP";

  const purposeText =
    purpose === "email_verify"
      ? "verify your email address"
      : "verify your mobile number";

  const message = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>E-Notary OTP</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f7; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: linear-gradient(135deg, #e8193c, #c0122e); padding: 36px 40px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:26px; font-weight:800; letter-spacing:1px;">⚖️ E-NOTARY</h1>
              <p style="margin:6px 0 0; color:rgba(255,255,255,0.85); font-size:13px; letter-spacing:2px; text-transform:uppercase;">India's Legal Execution Infrastructure</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 40px 20px;">
              <p style="margin:0 0 8px; color:#444; font-size:15px;">Hello,</p>
              <p style="margin:0 0 28px; color:#444; font-size:15px; line-height:1.6;">
                You requested an OTP to <strong>${purposeText}</strong> on E-Notary.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <div style="background: linear-gradient(135deg, #fff0f3, #ffe4e9); border: 2px dashed #e8193c; border-radius: 12px; padding: 24px 48px; text-align:center;">
                      <p style="margin:0 0 6px; color:#999; font-size:12px; text-transform:uppercase; letter-spacing:2px;">Your OTP Code</p>
                      <h1 style="margin: 0; font-size: 48px; font-weight: 900; letter-spacing: 16px; color: #e8193c; font-family: 'Courier New', monospace;">${otp}</h1>
                    </div>
                  </td>
                </tr>
              </table>
              <p style="margin:28px 0 0; text-align:center; color:#666; font-size:14px;">⏱️ This OTP is valid for <strong style="color:#e8193c;">10 minutes</strong> only.</p>
              <hr style="border:none; border-top:1px solid #f0f0f0; margin: 28px 0;" />
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#fff8f0; border-left: 4px solid #f5a623; border-radius:6px; padding:14px 16px;">
                    <p style="margin:0; color:#7a5200; font-size:13px; line-height:1.6;">⚠️ <strong>Do not share this OTP</strong> with anyone. E-Notary will never ask for your OTP via call or message.</p>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0; color:#999; font-size:12px; text-align:center;">If you did not request this OTP, please ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9f9f9; padding:24px 40px; text-align:center; border-top:1px solid #f0f0f0;">
              <p style="margin:0 0 6px; color:#bbb; font-size:12px;">© ${new Date().getFullYear()} E-Notary by Kavach Global Connect Pvt. Ltd.</p>
              <p style="margin:0; color:#bbb; font-size:12px;">India's Legal Execution Infrastructure</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from: `"E-Notary" <${process.env.EMAIL_USER}>`,
    to: email,
    subject,
    html: message,
  });
};

// ─── Approval Email Template ──────────────────────────────
const sendApprovalEmail = async (email, fullName) => {
  const message = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Account Approved</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f7; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: linear-gradient(135deg, #e8193c, #c0122e); padding: 36px 40px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:26px; font-weight:800;">⚖️ E-NOTARY</h1>
              <p style="margin:6px 0 0; color:rgba(255,255,255,0.85); font-size:13px; letter-spacing:2px; text-transform:uppercase;">India's Legal Execution Infrastructure</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 36px 40px 0;">
              <span style="font-size:60px;">✅</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px 20px; text-align:center;">
              <h2 style="margin:0 0 12px; color:#1a1a1a; font-size:22px;">Account Approved!</h2>
              <p style="margin:0 0 20px; color:#555; font-size:15px; line-height:1.7;">
                Dear <strong>${fullName}</strong>,<br/>
                Congratulations! Your advocate account on <strong>E-Notary</strong> has been
                <strong style="color:#27ae60;">approved</strong> by our admin team.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#f0fff6; border: 1px solid #b2dfdb; border-radius:10px; padding:20px 24px; text-align:left;">
                    <p style="margin:0 0 8px; color:#1a1a1a; font-size:14px;">✅ &nbsp;Your profile is now <strong>live</strong> on E-Notary</p>
                    <p style="margin:0 0 8px; color:#1a1a1a; font-size:14px;">✅ &nbsp;Clients can now book you for notarisation</p>
                    <p style="margin:0; color:#1a1a1a; font-size:14px;">✅ &nbsp;Login to your dashboard to get started</p>
                  </td>
                </tr>
              </table>
              <p style="margin:28px 0 0; color:#777; font-size:13px;">
                Questions? Contact us at
                <a href="mailto:${process.env.EMAIL_USER}" style="color:#e8193c;">${process.env.EMAIL_USER}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9f9f9; padding:24px 40px; text-align:center; border-top:1px solid #f0f0f0;">
              <p style="margin:0 0 6px; color:#bbb; font-size:12px;">© ${new Date().getFullYear()} E-Notary by Kavach Global Connect Pvt. Ltd.</p>
              <p style="margin:0; color:#bbb; font-size:12px;">India's Legal Execution Infrastructure</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from: `"E-Notary" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "🎉 E-Notary - Your Advocate Account Has Been Approved!",
    html: message,
  });
};

// ─── Rejection Email Template ─────────────────────────────
const sendRejectionEmail = async (email, fullName, reason) => {
  const message = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Account Rejected</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f7; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: linear-gradient(135deg, #e8193c, #c0122e); padding: 36px 40px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:26px; font-weight:800;">⚖️ E-NOTARY</h1>
              <p style="margin:6px 0 0; color:rgba(255,255,255,0.85); font-size:13px; letter-spacing:2px; text-transform:uppercase;">India's Legal Execution Infrastructure</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 36px 40px 0;">
              <span style="font-size:60px;">❌</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px 20px; text-align:center;">
              <h2 style="margin:0 0 12px; color:#1a1a1a; font-size:22px;">Account Not Approved</h2>
              <p style="margin:0 0 20px; color:#555; font-size:15px; line-height:1.7;">
                Dear <strong>${fullName}</strong>,<br/>
                We regret to inform you that your advocate account on <strong>E-Notary</strong>
                has been <strong style="color:#e8193c;">rejected</strong> by our admin team.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#fff5f5; border: 1px solid #ffcccc; border-left: 4px solid #e8193c; border-radius:10px; padding:20px 24px; text-align:left;">
                    <p style="margin:0 0 8px; color:#c0122e; font-size:13px; text-transform:uppercase; letter-spacing:1px; font-weight:bold;">Reason for Rejection:</p>
                    <p style="margin:0; color:#333; font-size:15px; line-height:1.6;">${reason}</p>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
                <tr>
                  <td style="background:#fff8f0; border: 1px solid #ffe0b2; border-radius:10px; padding:20px 24px; text-align:left;">
                    <p style="margin:0 0 8px; color:#7a5200; font-size:14px; font-weight:bold;">📌 What you can do:</p>
                    <p style="margin:0 0 6px; color:#555; font-size:14px;">• Fix the issue mentioned above</p>
                    <p style="margin:0 0 6px; color:#555; font-size:14px;">• Re-register with correct documents</p>
                    <p style="margin:0; color:#555; font-size:14px;">• Contact support if you need help</p>
                  </td>
                </tr>
              </table>
              <p style="margin:28px 0 0; color:#777; font-size:13px;">
                For support, contact us at
                <a href="mailto:${process.env.EMAIL_USER}" style="color:#e8193c;">${process.env.EMAIL_USER}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9f9f9; padding:24px 40px; text-align:center; border-top:1px solid #f0f0f0;">
              <p style="margin:0 0 6px; color:#bbb; font-size:12px;">© ${new Date().getFullYear()} E-Notary by Kavach Global Connect Pvt. Ltd.</p>
              <p style="margin:0; color:#bbb; font-size:12px;">India's Legal Execution Infrastructure</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from: `"E-Notary" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "E-Notary - Update on Your Advocate Account Application",
    html: message,
  });
};

// ─── Forget Password OTP Email Template ──────────────────
const sendForgetPasswordOTP = async (email, otp) => {
  const message = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Reset Password OTP</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f7; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: linear-gradient(135deg, #e8193c, #c0122e); padding: 36px 40px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:26px; font-weight:800; letter-spacing:1px;">⚖️ E-NOTARY</h1>
              <p style="margin:6px 0 0; color:rgba(255,255,255,0.85); font-size:13px; letter-spacing:2px; text-transform:uppercase;">India's Legal Execution Infrastructure</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 36px 40px 0;">
              <span style="font-size:60px;">🔐</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px 20px;">
              <p style="margin:0 0 8px; color:#444; font-size:15px;">Hello,</p>
              <p style="margin:0 0 28px; color:#444; font-size:15px; line-height:1.6;">
                Aapne <strong>E-Notary</strong> pe password reset request kiya hai. Neeche diya gaya OTP use karein.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <div style="background: linear-gradient(135deg, #fff0f3, #ffe4e9); border: 2px dashed #e8193c; border-radius: 12px; padding: 24px 48px; text-align:center;">
                      <p style="margin:0 0 6px; color:#999; font-size:12px; text-transform:uppercase; letter-spacing:2px;">Password Reset OTP</p>
                      <h1 style="margin: 0; font-size: 48px; font-weight: 900; letter-spacing: 16px; color: #e8193c; font-family: 'Courier New', monospace;">${otp}</h1>
                    </div>
                  </td>
                </tr>
              </table>
              <p style="margin:28px 0 0; text-align:center; color:#666; font-size:14px;">⏱️ Yeh OTP sirf <strong style="color:#e8193c;">10 minutes</strong> ke liye valid hai.</p>
              <hr style="border:none; border-top:1px solid #f0f0f0; margin: 28px 0;" />
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#fff8f0; border-left: 4px solid #f5a623; border-radius:6px; padding:14px 16px;">
                    <p style="margin:0; color:#7a5200; font-size:13px; line-height:1.6;">⚠️ <strong>Yeh OTP kisi ke saath share na karein.</strong> E-Notary kabhi bhi call ya message pe OTP nahi maangta.</p>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0; color:#999; font-size:12px; text-align:center;">Agar aapne yeh request nahi kiya, toh is email ko ignore karein.</p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9f9f9; padding:24px 40px; text-align:center; border-top:1px solid #f0f0f0;">
              <p style="margin:0 0 6px; color:#bbb; font-size:12px;">© ${new Date().getFullYear()} E-Notary by Kavach Global Connect Pvt. Ltd.</p>
              <p style="margin:0; color:#bbb; font-size:12px;">India's Legal Execution Infrastructure</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from: `"E-Notary" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "🔐 E-Notary - Password Reset OTP",
    html: message,
  });
};

module.exports = {
  generateOTP,
  sendOTPEmail,
  sendApprovalEmail,
  sendRejectionEmail,
  sendForgetPasswordOTP, // ← naya
};