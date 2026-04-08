const nodemailer = require('nodemailer');


// Email transporter configuration
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST ,
  port: process.env.MAIL_PORT ,
  secure: false, // true for 465, false for 587
  auth: {
    user: process.env.MAIL_USER ,
    pass: process.env.MAIL_PASS ,
  },
  tls: {
    rejectUnauthorized: false // For local testing only
  }
});

async function sendUserMail(recipient, subject, htmlContent) {
  try {
    if (!recipient) {
      console.warn('No recipient provided for confirmation email.');
      return;
    }

    const mailOptions = {
      from: process.env.MAIL_FROM ,
      to: recipient, 
      subject,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${recipient}. Message ID: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error('Failed to send  email:', err.message);
    throw err;
  }
  
  
}
// In ../Services/emailService.js
async function sendBulkMail(emails, subject, message) {
  try {
    // ✅ Filter valid email addresses
    const validEmails = (emails || []).filter(
      (e) => typeof e === "string" && e.includes("@")
    );

    if (validEmails.length === 0) {
      console.warn("⚠️ No valid recipients for custom emails.");
      return { success: false, message: "No valid email addresses provided." };
    }

    console.log(`📢 Sending custom email to ${validEmails.length} recipients...`);

    // ✅ Use Promise.allSettled for parallel sending (faster)
    const results = await Promise.allSettled(
      validEmails.map(async (email) => {
        const mailOptions = {
          from: process.env.MAIL_FROM || '"Inside Limpopo" <mosewadesmond919919@gmail.com>',
          to: email,
          subject: subject || "Inside Limpopo Update",
          html: `
            <div style="font-family: Arial, sans-serif; background-color: #f4f6fa; padding: 20px; color: #333;">
              <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <div style="background: #003366; color: #ffffff; padding: 25px; text-align: center;">
                  <h1 style="margin: 0; font-size: 24px; font-weight: bold;">${subject || "Inside Limpopo Update"}</h1>
                </div>
                
                <!-- Body -->
                <div style="padding: 25px;">
                  <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 0;">
                    ${message || "Hello, here’s your update!"}
                  </p>
                </div>
                
                <!-- Footer -->
                <div style="background: #f1f1f1; text-align: center; padding: 15px; font-size: 13px; color: #666;">
                  <p style="margin: 0;">Thank you for subscribing to <strong>Inside Limpopo</strong>!</p>
                  <p style="margin: 8px 0;">
                    <a href="http://localhost:3000/subscribe/unsubscribe" style="color: #003366; text-decoration: none;">Unsubscribe</a>
                  </p>
                  <p style="margin: 0; font-size: 12px; color: #999;">&copy; ${new Date().getFullYear()} Inside Limpopo. All rights reserved.</p>
                </div>
              </div>
            </div>
          `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent to ${email}. Message ID: ${info.messageId}`);
        return { email, success: true, messageId: info.messageId };
      })
    );

    // ✅ Summary
    const successCount = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;
    console.log(`📬 Custom email summary: ${successCount}/${validEmails.length} sent successfully.`);

    return {
      success: true,
      total: validEmails.length,
      sent: successCount,
      results,
    };
  } catch (err) {
    console.error("❌ Failed to send custom emails:", err.message);
    return { success: false, message: err.message };
  }
}




module.exports = {sendBulkMail, sendUserMail};
