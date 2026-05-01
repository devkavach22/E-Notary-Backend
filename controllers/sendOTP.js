const nodemailer = require("nodemailer");

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

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


const sendAdminNewAdvocateNotification = async (advocate) => {
  const adminEmail = process.env.ADMIN_EMAIL // same email used for sending — your admin inbox

  const dob = advocate.dateOfBirth
    ? new Date(advocate.dateOfBirth).toLocaleDateString("en-IN")
    : "N/A";

  const message = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>New Advocate Registration</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f7; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a237e, #283593); padding: 36px 40px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:24px; font-weight:800; letter-spacing:1px;">⚖️ E-NOTARY — Admin Panel</h1>
              <p style="margin:8px 0 0; color:rgba(255,255,255,0.8); font-size:13px; letter-spacing:2px; text-transform:uppercase;">New Advocate Registration Alert</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 40px 20px;">
              <p style="margin:0 0 6px; color:#333; font-size:16px; font-weight:600;">👤 A new advocate has registered and requires your review.</p>
              <p style="margin:0 0 24px; color:#666; font-size:14px;">Please verify the documents and take action (Approve / Reject).</p>

              <!-- Details Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0e0e0; border-radius:10px; overflow:hidden;">
                <tr style="background:#f5f5f5;">
                  <td style="padding:10px 16px; font-size:13px; color:#555; font-weight:700; width:40%; border-bottom:1px solid #e0e0e0;">Field</td>
                  <td style="padding:10px 16px; font-size:13px; color:#555; font-weight:700; border-bottom:1px solid #e0e0e0;">Value</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px; font-size:14px; color:#333; border-bottom:1px solid #f0f0f0; font-weight:600;">Full Name</td>
                  <td style="padding:10px 16px; font-size:14px; color:#1a237e; border-bottom:1px solid #f0f0f0; font-weight:700;">${advocate.fullName}</td>
                </tr>
                <tr style="background:#fafafa;">
                  <td style="padding:10px 16px; font-size:14px; color:#333; border-bottom:1px solid #f0f0f0; font-weight:600;">Date of Birth</td>
                  <td style="padding:10px 16px; font-size:14px; color:#333; border-bottom:1px solid #f0f0f0;">${dob}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px; font-size:14px; color:#333; border-bottom:1px solid #f0f0f0; font-weight:600;">Gender</td>
                  <td style="padding:10px 16px; font-size:14px; color:#333; border-bottom:1px solid #f0f0f0; text-transform:capitalize;">${advocate.gender}</td>
                </tr>
                <tr style="background:#fafafa;">
                  <td style="padding:10px 16px; font-size:14px; color:#333; border-bottom:1px solid #f0f0f0; font-weight:600;">Email</td>
                  <td style="padding:10px 16px; font-size:14px; color:#333; border-bottom:1px solid #f0f0f0;">${advocate.email}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px; font-size:14px; color:#333; border-bottom:1px solid #f0f0f0; font-weight:600;">Mobile</td>
                  <td style="padding:10px 16px; font-size:14px; color:#333; border-bottom:1px solid #f0f0f0;">${advocate.mobile}</td>
                </tr>
                <tr style="background:#fafafa;">
                  <td style="padding:10px 16px; font-size:14px; color:#333; border-bottom:1px solid #f0f0f0; font-weight:600;">Aadhaar Number</td>
                  <td style="padding:10px 16px; font-size:14px; color:#333; border-bottom:1px solid #f0f0f0; font-family:monospace; letter-spacing:2px;">${advocate.aadhaarNumber}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px; font-size:14px; color:#333; border-bottom:1px solid #f0f0f0; font-weight:600;">PAN Number</td>
                  <td style="padding:10px 16px; font-size:14px; color:#333; border-bottom:1px solid #f0f0f0; font-family:monospace; letter-spacing:2px;">${advocate.panNumber}</td>
                </tr>
                <tr style="background:#fafafa;">
                  <td style="padding:10px 16px; font-size:14px; color:#333; border-bottom:1px solid #f0f0f0; font-weight:600;">Bar Council Number</td>
                  <td style="padding:10px 16px; font-size:14px; color:#1a237e; border-bottom:1px solid #f0f0f0; font-weight:700; font-family:monospace;">${advocate.barCouncilNumber}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px; font-size:14px; color:#333; border-bottom:1px solid #f0f0f0; font-weight:600;">Bar Council State</td>
                  <td style="padding:10px 16px; font-size:14px; color:#333; border-bottom:1px solid #f0f0f0;">${advocate.barCouncilState}</td>
                </tr>
                <tr style="background:#fafafa;">
                  <td style="padding:10px 16px; font-size:14px; color:#333; font-weight:600;">Year of Enrollment</td>
                  <td style="padding:10px 16px; font-size:14px; color:#333;">${advocate.yearOfEnrollment}</td>
                </tr>
              </table>

              <!-- Documents note -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
                <tr>
                  <td style="background:#e8f4fd; border:1px solid #bbdefb; border-left:4px solid #1565c0; border-radius:8px; padding:14px 16px;">
                    <p style="margin:0 0 6px; color:#1565c0; font-size:13px; font-weight:700;">📄 Documents Uploaded:</p>
                    <p style="margin:0; color:#333; font-size:13px; line-height:1.8;">
                      ✅ Aadhaar Front &nbsp;|&nbsp; ✅ Aadhaar Back &nbsp;|&nbsp; ✅ PAN Card &nbsp;|&nbsp; ✅ Bar Council Certificate &nbsp;|&nbsp; ✅ Live Selfie
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Advocate ID reference for admin -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
                <tr>
                  <td style="background:#f0f4ff; border:1px solid #c5cae9; border-left:4px solid #1a237e; border-radius:8px; padding:14px 16px;">
                    <p style="margin:0 0 4px; color:#1a237e; font-size:13px; font-weight:700;">🆔 Advocate ID (for admin panel lookup):</p>
                    <p style="margin:0; color:#333; font-size:14px; font-family:monospace; letter-spacing:1px;">${advocate._id}</p>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0; color:#999; font-size:12px; text-align:center;">
                This is an automated notification from E-Notary. Please do not reply to this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
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
    from: `"E-Notary System" <${process.env.EMAIL_USER}>`,
    to: adminEmail,
    subject: `🔔 New Advocate Registration — ${advocate.fullName} (Action Required)`,
    html: message,
  });
};


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


const sendBookingEmailToUser = async ({
  userEmail, userName, advocateName, caseType, bookingId,
}) => {
  const message = `
<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" 
        style="background:#fff;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#e8193c,#c0122e);
            padding:36px 40px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;">
              ⚖️ E-NOTARY
            </h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;
              letter-spacing:2px;text-transform:uppercase;">
              India's Legal Execution Infrastructure
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="color:#1a1a1a;margin:0 0 16px;">Request Submitted!</h2>
            <p style="color:#555;font-size:15px;line-height:1.7;">
              Dear <strong>${userName}</strong>,
            </p>
            <p style="color:#555;font-size:15px;line-height:1.7;">
              Your request has been sent to <strong>${advocateName}</strong>. 
              The advocate will review your case and contact you to schedule a meeting.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" 
              style="background:#f9f9f9;border:1px solid #e0e0e0;
              border-radius:10px;margin:20px 0;">
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #e0e0e0;">
                  <span style="color:#888;font-size:13px;">Booking ID</span><br/>
                  <strong style="color:#333;font-family:monospace;">${bookingId}</strong>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #e0e0e0;">
                  <span style="color:#888;font-size:13px;">Advocate</span><br/>
                  <strong style="color:#333;">${advocateName}</strong>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;">
                  <span style="color:#888;font-size:13px;">Case Type</span><br/>
                  <strong style="color:#333;">${caseType}</strong>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#fff8f0;border-left:4px solid #f5a623;
                  border-radius:6px;padding:14px 16px;">
                  <p style="margin:0;color:#7a5200;font-size:13px;line-height:1.6;">
                    The advocate will reach out to you shortly to confirm 
                    the meeting date and time.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f9f9f9;padding:24px 40px;
            text-align:center;border-top:1px solid #f0f0f0;">
            <p style="margin:0;color:#bbb;font-size:12px;">
              © ${new Date().getFullYear()} E-Notary by Kavach Global Connect Pvt. Ltd.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from: `"E-Notary" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: `📋 Booking Request Sent — ${advocateName} | E-Notary`,
    html: message,
  });
};

const sendBookingEmailToAdvocate = async ({
  advocateEmail, advocateName, userName,
  userMobile, caseType, message, bookingId,
}) => {
  const emailBody = `
<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" 
        style="background:#fff;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#1a237e,#283593);
            padding:36px 40px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;">
              ⚖️ E-NOTARY
            </h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;
              letter-spacing:2px;text-transform:uppercase;">
              New Client Request
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="color:#1a1a1a;margin:0 0 16px;">New Client Request!</h2>
            <p style="color:#555;font-size:15px;line-height:1.7;">
              Dear <strong>${advocateName}</strong>,
            </p>
            <p style="color:#555;font-size:15px;line-height:1.7;">
              A new client wants your legal assistance. 
              Please review and schedule a meeting with them.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" 
              style="background:#f9f9f9;border:1px solid #e0e0e0;
              border-radius:10px;margin:20px 0;">
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #e0e0e0;">
                  <span style="color:#888;font-size:13px;">Booking ID</span><br/>
                  <strong style="color:#333;font-family:monospace;">${bookingId}</strong>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #e0e0e0;">
                  <span style="color:#888;font-size:13px;">Client Name</span><br/>
                  <strong style="color:#1a237e;">${userName}</strong>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #e0e0e0;">
                  <span style="color:#888;font-size:13px;">Client Mobile</span><br/>
                  <strong style="color:#333;">${userMobile}</strong>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #e0e0e0;">
                  <span style="color:#888;font-size:13px;">Case Type</span><br/>
                  <strong style="color:#333;">${caseType}</strong>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;">
                  <span style="color:#888;font-size:13px;">Message from Client</span><br/>
                  <strong style="color:#333;">${message}</strong>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#e8f4fd;border-left:4px solid #1565c0;
                  border-radius:6px;padding:14px 16px;">
                  <p style="margin:0;color:#1565c0;font-size:13px;line-height:1.6;">
                    Please login to your dashboard and schedule a meeting 
                    with this client at your earliest convenience.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f9f9f9;padding:24px 40px;
            text-align:center;border-top:1px solid #f0f0f0;">
            <p style="margin:0;color:#bbb;font-size:12px;">
              © ${new Date().getFullYear()} E-Notary by Kavach Global Connect Pvt. Ltd.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from: `"E-Notary" <${process.env.EMAIL_USER}>`,
    to: advocateEmail,
    subject: `🔔 New Client Request — ${userName} | E-Notary`,
    html: emailBody,
  });
};

const sendMeetingConfirmationToUser = async ({
  userEmail, userName, advocateName,
  caseType, meetingDate, meetingTime, meetLink, bookingId,
}) => {
  const message = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Meeting Confirmed</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
        style="background:#fff;border-radius:12px;overflow:hidden;
        box-shadow:0 4px 20px rgba(0,0,0,0.08);">
 
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#e8193c,#c0122e);
            padding:36px 40px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;">
              ⚖️ E-NOTARY
            </h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;
              letter-spacing:2px;text-transform:uppercase;">
              India's Legal Execution Infrastructure
            </p>
          </td>
        </tr>
 
        <!-- Icon -->
        <tr>
          <td align="center" style="padding:36px 40px 0;">
            <span style="font-size:60px;">📅</span>
          </td>
        </tr>
 
        <!-- Body -->
        <tr>
          <td style="padding:24px 40px 20px;text-align:center;">
            <h2 style="margin:0 0 12px;color:#1a1a1a;font-size:22px;">
              Meeting Confirmed!
            </h2>
            <p style="color:#555;font-size:15px;line-height:1.7;">
              Dear <strong>${userName}</strong>,<br/>
              Your meeting with <strong>${advocateName}</strong> has been
              <strong style="color:#27ae60;">confirmed</strong>.
              Please join the video call at the scheduled time.
            </p>
 
            <!-- Meeting Details -->
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#f9f9f9;border:1px solid #e0e0e0;
              border-radius:10px;margin:20px 0;text-align:left;">
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #e0e0e0;">
                  <span style="color:#888;font-size:13px;">Booking ID</span><br/>
                  <strong style="color:#333;font-family:monospace;font-size:13px;">
                    ${bookingId}
                  </strong>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #e0e0e0;">
                  <span style="color:#888;font-size:13px;">Advocate</span><br/>
                  <strong style="color:#333;">${advocateName}</strong>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #e0e0e0;">
                  <span style="color:#888;font-size:13px;">Case Type</span><br/>
                  <strong style="color:#333;">${caseType}</strong>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #e0e0e0;">
                  <span style="color:#888;font-size:13px;">📅 Date</span><br/>
                  <strong style="color:#1a237e;">${meetingDate}</strong>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #e0e0e0;">
                  <span style="color:#888;font-size:13px;">🕐 Time</span><br/>
                  <strong style="color:#1a237e;">${meetingTime}</strong>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;">
                  <span style="color:#888;font-size:13px;">🎥 Video Call Link</span><br/>
                  <a href="${meetLink}"
                    style="color:#e8193c;font-weight:700;font-size:14px;
                    word-break:break-all;">${meetLink}</a>
                </td>
              </tr>
            </table>
 
            <!-- Join Button -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
              <tr>
                <td align="center">
                  <a href="${meetLink}"
                    style="display:inline-block;background:linear-gradient(135deg,#e8193c,#c0122e);
                    color:#fff;font-size:15px;font-weight:700;padding:14px 40px;
                    border-radius:8px;text-decoration:none;">
                    🎥 Join Video Call
                  </a>
                </td>
              </tr>
            </table>
 
            <!-- Warning -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#fff8f0;border-left:4px solid #f5a623;
                  border-radius:6px;padding:14px 16px;text-align:left;">
                  <p style="margin:0;color:#7a5200;font-size:13px;line-height:1.6;">
                    ⚠️ Please join the call on time. The link is valid only for
                    this specific meeting. Do not share it with anyone.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
 
        <!-- Footer -->
        <tr>
          <td style="background:#f9f9f9;padding:24px 40px;
            text-align:center;border-top:1px solid #f0f0f0;">
            <p style="margin:0 0 6px;color:#bbb;font-size:12px;">
              © ${new Date().getFullYear()} E-Notary by Kavach Global Connect Pvt. Ltd.
            </p>
            <p style="margin:0;color:#bbb;font-size:12px;">
              India's Legal Execution Infrastructure
            </p>
          </td>
        </tr>
 
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from: `"E-Notary" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: `📅 Meeting Confirmed — ${meetingDate} at ${meetingTime} | E-Notary`,
    html: message,
  });
};


const sendTemplateSubmissionEmail = async ({
  advocateEmail,
  advocateName,
  userName,
  userEmail,
  userMobile,
  templateTitle,
  practiceArea,
  category,
  submissionId,
  filledFields,
}) => {
  const fieldsRows = filledFields
    .map(
      (f) => `
        <tr>
          <td style="padding:10px 16px;font-size:14px;color:#333;font-weight:600;
            border-bottom:1px solid #f0f0f0;background:#fafafa;width:40%;">
            ${f.fieldName}
          </td>
          <td style="padding:10px 16px;font-size:14px;color:#1a237e;
            border-bottom:1px solid #f0f0f0;">
            ${f.value !== null && f.value !== undefined && String(f.value).trim() !== ""
          ? String(f.value)
          : "<em style='color:#aaa;'>—</em>"}
          </td>
        </tr>`
    )
    .join("");

  const message = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>New Document Submission</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
        style="background:#fff;border-radius:12px;overflow:hidden;
        box-shadow:0 4px 20px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a237e,#283593);
            padding:36px 40px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;">
              ⚖️ E-NOTARY
            </h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;
              letter-spacing:2px;text-transform:uppercase;">
              India's Legal Execution Infrastructure
            </p>
          </td>
        </tr>

        <!-- Icon -->
        <tr>
          <td align="center" style="padding:32px 40px 0;">
            <span style="font-size:56px;">📄</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:20px 40px 10px;">
            <h2 style="margin:0 0 10px;color:#1a1a1a;font-size:21px;">
              New Document Submitted!
            </h2>
            <p style="color:#555;font-size:15px;line-height:1.7;margin:0 0 20px;">
              Dear <strong>${advocateName}</strong>,<br/>
              A client has submitted a filled document on <strong>E-Notary</strong>
              that requires your attention.
            </p>

            <!-- Template Info Card -->
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#f0f4ff;border:1px solid #c5cae9;
              border-left:4px solid #1a237e;border-radius:8px;margin-bottom:20px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 6px;color:#1a237e;font-size:13px;
                    font-weight:700;text-transform:uppercase;letter-spacing:1px;">
                    📋 Document Details
                  </p>
                  <p style="margin:0 0 4px;color:#333;font-size:14px;">
                    <strong>Title:</strong> ${templateTitle}
                  </p>
                  <p style="margin:0 0 4px;color:#333;font-size:14px;">
                    <strong>Case Type:</strong> ${practiceArea}
                  </p>
                  <p style="margin:0 0 4px;color:#333;font-size:14px;">
                    <strong>Case Relation:</strong> ${category}
                  </p>
                  <p style="margin:0;color:#333;font-size:13px;font-family:monospace;">
                    <strong>Submission ID:</strong> ${submissionId}
                  </p>
                </td>
              </tr>
            </table>

            <!-- Client Info Card -->
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#e8f4fd;border:1px solid #bbdefb;
              border-left:4px solid #1565c0;border-radius:8px;margin-bottom:24px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 6px;color:#1565c0;font-size:13px;
                    font-weight:700;text-transform:uppercase;letter-spacing:1px;">
                    👤 Client Information
                  </p>
                  <p style="margin:0 0 4px;color:#333;font-size:14px;">
                    <strong>Name:</strong> ${userName}
                  </p>
                  <p style="margin:0 0 4px;color:#333;font-size:14px;">
                    <strong>Email:</strong> ${userEmail}
                  </p>
                  <p style="margin:0;color:#333;font-size:14px;">
                    <strong>Mobile:</strong> ${userMobile}
                  </p>
                </td>
              </tr>
            </table>

            <!-- Filled Fields Table -->
            <p style="margin:0 0 10px;color:#555;font-size:14px;font-weight:700;">
              📝 Submitted Field Values:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"
              style="border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;
              margin-bottom:24px;">
              <tr style="background:#1a237e;">
                <td style="padding:10px 16px;font-size:13px;color:#fff;
                  font-weight:700;width:40%;">Field</td>
                <td style="padding:10px 16px;font-size:13px;color:#fff;
                  font-weight:700;">Value</td>
              </tr>
              ${fieldsRows}
            </table>

            <!-- Note -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#fff8f0;border-left:4px solid #f5a623;
                  border-radius:6px;padding:14px 16px;">
                  <p style="margin:0;color:#7a5200;font-size:13px;line-height:1.6;">
                    ⚠️ Please login to your <strong>E-Notary dashboard</strong>
                    to review and process this submission at your earliest convenience.
                  </p>
                </td>
              </tr>
            </table>

            <p style="margin:24px 0 0;color:#999;font-size:12px;text-align:center;">
              This is an automated notification from E-Notary. Please do not reply.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9f9f9;padding:24px 40px;
            text-align:center;border-top:1px solid #f0f0f0;">
            <p style="margin:0 0 6px;color:#bbb;font-size:12px;">
              © ${new Date().getFullYear()} E-Notary by Kavach Global Connect Pvt. Ltd.
            </p>
            <p style="margin:0;color:#bbb;font-size:12px;">
              India's Legal Execution Infrastructure
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from: `"E-Notary" <${process.env.EMAIL_USER}>`,
    to: advocateEmail,
    subject: `📄 New Document Submitted — ${userName} | ${templateTitle} | E-Notary`,
    html: message,
  });
};


const sendTemplateAcceptedEmail = async ({
  userEmail, userName, advocateName, templateTitle, practiceArea, category, submissionId,
}) => {
  const message = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
        style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#e8193c,#c0122e);padding:36px 40px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;">⚖️ E-NOTARY</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;letter-spacing:2px;text-transform:uppercase;">
              India's Legal Execution Infrastructure
            </p>
          </td>
        </tr>
        <tr><td align="center" style="padding:36px 40px 0;"><span style="font-size:56px;">✅</span></td></tr>
        <tr>
          <td style="padding:24px 40px 20px;text-align:center;">
            <h2 style="margin:0 0 12px;color:#1a1a1a;font-size:22px;">Document Accepted!</h2>
            <p style="color:#555;font-size:15px;line-height:1.7;">
              Dear <strong>${userName}</strong>,<br/>
              Great news! Your submitted document has been
              <strong style="color:#27ae60;">accepted</strong> by <strong>${advocateName}</strong>.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#f0fff6;border:1px solid #b2dfdb;border-radius:10px;margin:20px 0;text-align:left;">
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #e0e0e0;">
                  <span style="color:#888;font-size:13px;">Document</span><br/>
                  <strong style="color:#333;">${templateTitle}</strong>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #e0e0e0;">
                  <span style="color:#888;font-size:13px;">Case Type</span><br/>
                  <strong style="color:#333;">${practiceArea}</strong>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #e0e0e0;">
                  <span style="color:#888;font-size:13px;">Category</span><br/>
                  <strong style="color:#333;">${category}</strong>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;">
                  <span style="color:#888;font-size:13px;">Submission ID</span><br/>
                  <strong style="color:#333;font-family:monospace;">${submissionId}</strong>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#e8f4fd;border-left:4px solid #1565c0;border-radius:6px;padding:14px 16px;text-align:left;">
                  <p style="margin:0;color:#1565c0;font-size:13px;line-height:1.6;">
                    The advocate will contact you shortly to proceed further with your case.
                  </p>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0;color:#999;font-size:12px;">
              This is an automated notification from E-Notary. Please do not reply.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9f9f9;padding:24px 40px;text-align:center;border-top:1px solid #f0f0f0;">
            <p style="margin:0 0 6px;color:#bbb;font-size:12px;">© ${new Date().getFullYear()} E-Notary by Kavach Global Connect Pvt. Ltd.</p>
            <p style="margin:0;color:#bbb;font-size:12px;">India's Legal Execution Infrastructure</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from: `"E-Notary" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: `✅ Document Accepted — ${templateTitle} | E-Notary`,
    html: message,
  });
};


const sendTemplateRejectedEmail = async ({
  userEmail, userName, advocateName, templateTitle, practiceArea, category, submissionId, reason,
}) => {
  const message = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
        style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#e8193c,#c0122e);padding:36px 40px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;">⚖️ E-NOTARY</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;letter-spacing:2px;text-transform:uppercase;">
              India's Legal Execution Infrastructure
            </p>
          </td>
        </tr>
        <tr><td align="center" style="padding:36px 40px 0;"><span style="font-size:56px;">❌</span></td></tr>
        <tr>
          <td style="padding:24px 40px 20px;text-align:center;">
            <h2 style="margin:0 0 12px;color:#1a1a1a;font-size:22px;">Document Not Accepted</h2>
            <p style="color:#555;font-size:15px;line-height:1.7;">
              Dear <strong>${userName}</strong>,<br/>
              We regret to inform you that your submitted document has been
              <strong style="color:#e8193c;">rejected</strong> by <strong>${advocateName}</strong>.
            </p>
            <!-- Document Info -->
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#f9f9f9;border:1px solid #e0e0e0;border-radius:10px;margin:16px 0;text-align:left;">
              <tr>
                <td style="padding:12px 20px;border-bottom:1px solid #e0e0e0;">
                  <span style="color:#888;font-size:13px;">Document</span><br/>
                  <strong style="color:#333;">${templateTitle}</strong>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 20px;border-bottom:1px solid #e0e0e0;">
                  <span style="color:#888;font-size:13px;">Case Type</span><br/>
                  <strong style="color:#333;">${practiceArea}</strong>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 20px;">
                  <span style="color:#888;font-size:13px;">Submission ID</span><br/>
                  <strong style="color:#333;font-family:monospace;">${submissionId}</strong>
                </td>
              </tr>
            </table>
            <!-- Reason -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
              <tr>
                <td style="background:#fff5f5;border:1px solid #ffcccc;border-left:4px solid #e8193c;
                  border-radius:8px;padding:16px 20px;text-align:left;">
                  <p style="margin:0 0 8px;color:#c0122e;font-size:13px;font-weight:bold;
                    text-transform:uppercase;letter-spacing:1px;">Reason for Rejection:</p>
                  <p style="margin:0;color:#333;font-size:15px;line-height:1.6;">${reason}</p>
                </td>
              </tr>
            </table>
            <!-- What to do -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#fff8f0;border-left:4px solid #f5a623;border-radius:6px;
                  padding:14px 16px;text-align:left;">
                  <p style="margin:0 0 6px;color:#7a5200;font-size:13px;font-weight:bold;">📌 What you can do:</p>
                  <p style="margin:0 0 4px;color:#555;font-size:14px;">• Review the reason above and correct your submission</p>
                  <p style="margin:0 0 4px;color:#555;font-size:14px;">• Re-submit the document with updated information</p>
                  <p style="margin:0;color:#555;font-size:14px;">• Contact the advocate if you need clarification</p>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0;color:#999;font-size:12px;">
              This is an automated notification from E-Notary. Please do not reply.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9f9f9;padding:24px 40px;text-align:center;border-top:1px solid #f0f0f0;">
            <p style="margin:0 0 6px;color:#bbb;font-size:12px;">© ${new Date().getFullYear()} E-Notary by Kavach Global Connect Pvt. Ltd.</p>
            <p style="margin:0;color:#bbb;font-size:12px;">India's Legal Execution Infrastructure</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from: `"E-Notary" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: `❌ Document Not Accepted — ${templateTitle} | E-Notary`,
    html: message,
  });
};


const sendInviteEmail = async ({
  toEmail,
  toName,
  inviterName,
  templateTitle,
  acceptLink,
  loginLink,
  inviteToken,
  isRegistered,  // ✅ NEW
}) => {
  const message = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>You're Invited</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
        style="background:#fff;border-radius:12px;overflow:hidden;
        box-shadow:0 4px 20px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#e8193c,#c0122e);
            padding:36px 40px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;">
              ⚖️ E-NOTARY
            </h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;
              letter-spacing:2px;text-transform:uppercase;">
              India's Legal Execution Infrastructure
            </p>
          </td>
        </tr>

        <!-- Icon -->
        <tr>
          <td align="center" style="padding:36px 40px 0;">
            <span style="font-size:60px;">📩</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:24px 40px 20px;text-align:center;">
            <h2 style="margin:0 0 12px;color:#1a1a1a;font-size:22px;">
              You have been invited!
            </h2>
            <p style="color:#555;font-size:15px;line-height:1.7;">
              Dear <strong>${toName}</strong>,<br/>
              <strong>${inviterName}</strong> has invited you to fill your details
              for the legal document <strong>"${templateTitle}"</strong> on E-Notary.
            </p>

            <!-- Info Card -->
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#f0f4ff;border:1px solid #c5cae9;
              border-left:4px solid #1a237e;border-radius:8px;
              margin:20px 0;text-align:left;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 6px;color:#1a237e;font-size:13px;
                    font-weight:700;text-transform:uppercase;letter-spacing:1px;">
                    📋 Document Details
                  </p>
                  <p style="margin:0 0 4px;color:#333;font-size:14px;">
                    <strong>Document:</strong> ${templateTitle}
                  </p>
                  <p style="margin:0 0 4px;color:#333;font-size:14px;">
                    <strong>Invited by:</strong> ${inviterName}
                  </p>
                  <p style="margin:8px 0 0;color:#333;font-size:13px;">
                    <strong>Your Invite Token:</strong>
                  </p>
                  <p style="margin:4px 0 0;color:#e8193c;font-size:12px;
                    font-family:monospace;word-break:break-all;
                    background:#fff0f3;padding:8px;border-radius:6px;">
                    ${inviteToken}
                  </p>
                </td>
              </tr>
            </table>

            <!-- Steps -->
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#f9f9f9;border:1px solid #e0e0e0;
              border-radius:10px;margin:0 0 24px;text-align:left;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 10px;color:#333;font-size:14px;font-weight:700;">
                    📌 Steps to follow:
                  </p>
                  <p style="margin:0 0 6px;color:#555;font-size:14px;">
                    1️⃣ &nbsp;Click "Accept Invite" to confirm your participation
                  </p>
                  <p style="margin:0 0 6px;color:#555;font-size:14px;">
                    2️⃣ &nbsp;${isRegistered
      ? 'Click "Login to App" to login to your E-Notary account'
      : 'Click "Register to App" to create your E-Notary account'}
                  </p>
                  <p style="margin:0;color:#555;font-size:14px;">
                    3️⃣ &nbsp;Fill in your required details for the document
                  </p>
                </td>
              </tr>
            </table>

            <!-- Accept Button -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 12px;">
              <tr>
                <td align="center">
                  <a href="${acceptLink}"
                    style="display:inline-block;
                    background:linear-gradient(135deg,#e8193c,#c0122e);
                    color:#fff;font-size:15px;font-weight:700;
                    padding:14px 40px;border-radius:8px;text-decoration:none;">
                    ✅ Accept Invite
                  </a>
                </td>
              </tr>
            </table>

            <!-- ✅ NEW: Login ya Register button -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              <tr>
                <td align="center">
                  <a href="${loginLink}"
                    style="display:inline-block;
                    background:linear-gradient(135deg,#1a237e,#283593);
                    color:#fff;font-size:15px;font-weight:700;
                    padding:14px 40px;border-radius:8px;text-decoration:none;">
                    ${isRegistered ? '🔐 Login to App' : '📝 Register to App'}
                  </a>
                </td>
              </tr>
            </table>

            <!-- Warning -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#fff8f0;border-left:4px solid #f5a623;
                  border-radius:6px;padding:14px 16px;text-align:left;">
                  <p style="margin:0;color:#7a5200;font-size:13px;line-height:1.6;">
                    ⚠️ This invite link and token is <strong>unique to you</strong>.
                    Please do not share it with anyone.
                    If you did not expect this invite, please ignore this email.
                  </p>
                </td>
              </tr>
            </table>

            <p style="margin:24px 0 0;color:#999;font-size:12px;text-align:center;">
              This is an automated notification from E-Notary. Please do not reply.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9f9f9;padding:24px 40px;
            text-align:center;border-top:1px solid #f0f0f0;">
            <p style="margin:0 0 6px;color:#bbb;font-size:12px;">
              © ${new Date().getFullYear()} E-Notary by Kavach Global Connect Pvt. Ltd.
            </p>
            <p style="margin:0;color:#bbb;font-size:12px;">
              India's Legal Execution Infrastructure
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from: `"E-Notary" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `📩 You're Invited — ${templateTitle} | E-Notary`,
    html: message,
  });
};

module.exports = {
  generateOTP,
  sendOTPEmail,
  sendAdminNewAdvocateNotification,
  sendApprovalEmail,
  sendRejectionEmail,
  sendForgetPasswordOTP,
  sendBookingEmailToUser,
  sendBookingEmailToAdvocate,
  sendMeetingConfirmationToUser,
  sendTemplateSubmissionEmail,
  sendTemplateAcceptedEmail,
  sendTemplateRejectedEmail,
  sendInviteEmail
};