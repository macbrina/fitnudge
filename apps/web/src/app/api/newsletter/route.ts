import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    // Validate required fields
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Create transporter using SMTP settings from environment
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_PORT === "465",
      auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    // Notify admin of new subscriber
    const adminMailOptions = {
      from: `"${process.env.FROM_NAME || "FitNudge Newsletter"}" <${process.env.FROM_EMAIL}>`,
      to: process.env.REPLY_TO_EMAIL || process.env.FROM_EMAIL,
      subject: `[FitNudge] New Blog Newsletter Subscriber`,
      text: `
New blog newsletter subscription:

Email: ${email}
Date: ${new Date().toISOString()}
      `,
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0066ff; color: #ffffff; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
    .field { margin-bottom: 16px; }
    .label { font-weight: 600; color: #374151; margin-bottom: 4px; }
    .value { color: #1f2937; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0; color: #ffffff;">🎉 New Blog Newsletter Subscriber</h2>
    </div>
    <div class="content">
      <div class="field">
        <div class="label">Email</div>
        <div class="value"><a href="mailto:${email}">${email}</a></div>
      </div>
      <div class="field">
        <div class="label">Subscribed At</div>
        <div class="value">${new Date().toLocaleString()}</div>
      </div>
    </div>
  </div>
</body>
</html>
      `,
    };

    // Send admin notification
    await transporter.sendMail(adminMailOptions);

    // Social media links for email
    const socialLinks = {
      twitter: "https://twitter.com/fitnudgeapp",
      instagram: "https://instagram.com/fitnudgeapp",
      facebook: "https://facebook.com/fitnudgeapp",
      linkedin: "https://linkedin.com/company/fitnudgeapp",
      tiktok: "https://tiktok.com/@fitnudgeapp",
    };

    // Send confirmation to subscriber
    const subscriberMailOptions = {
      from: `"${process.env.FROM_NAME || "FitNudge"}" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: "Welcome to the FitNudge Blog! 📚",
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #0066ff 0%, #1d4ed8 100%); color: #ffffff; padding: 40px 30px; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
    .header p { margin: 10px 0 0; opacity: 0.9; font-size: 16px; }
    .content { background: #ffffff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; }
    .content p { color: #374151; line-height: 1.6; margin: 0 0 16px; }
    .highlight-box { background: #eff6ff; padding: 20px; border-radius: 8px; border-left: 4px solid #0066ff; margin: 24px 0; }
    .highlight-box h3 { margin: 0 0 12px; color: #1e40af; font-size: 16px; }
    .highlight-box ul { margin: 0; padding-left: 20px; color: #374151; }
    .highlight-box li { margin-bottom: 8px; }
    .social-section { background: #f9fafb; padding: 24px; border-radius: 8px; margin: 24px 0; text-align: center; }
    .social-section h3 { margin: 0 0 16px; color: #1f2937; font-size: 16px; font-weight: 600; }
    .social-links { display: inline-block; }
    .social-link { display: inline-block; padding: 10px 16px; margin: 4px; background: #0066ff; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500; }
    .social-link:hover { background: #1d4ed8; }
    .footer { background: #1f2937; padding: 24px 30px; border-radius: 0 0 12px 12px; text-align: center; }
    .footer p { color: #9ca3af; font-size: 14px; margin: 0; }
    .footer a { color: #60a5fa; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff;">You're subscribed! 🎉</h1>
      <p style="margin: 10px 0 0; opacity: 0.9; font-size: 16px; color: #ffffff;">Welcome to the FitNudge Blog</p>
    </div>
    <div class="content">
      <p>Hey there!</p>
      <p>Thanks for subscribing to our blog newsletter. You'll now receive the latest articles on habit building, productivity tips, and success stories directly in your inbox.</p>
      
      <div class="highlight-box">
        <h3>What you'll get:</h3>
        <ul>
          <li>Expert tips on building lasting habits</li>
          <li>Productivity hacks and strategies</li>
          <li>Inspiring success stories from our community</li>
          <li>Exclusive insights on goal achievement</li>
        </ul>
      </div>
      
      <div class="social-section">
        <h3>Follow us for daily motivation</h3>
        <div class="social-links">
          <a href="${socialLinks.instagram}" class="social-link">Instagram</a>
          <a href="${socialLinks.twitter}" class="social-link">Twitter</a>
          <a href="${socialLinks.tiktok}" class="social-link">TikTok</a>
          <a href="${socialLinks.facebook}" class="social-link">Facebook</a>
          <a href="${socialLinks.linkedin}" class="social-link">LinkedIn</a>
        </div>
      </div>
      
      <p>Happy reading!<br><strong>The FitNudge Team</strong></p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} FitNudge. All rights reserved.</p>
      <p style="margin-top: 8px;"><a href="https://fitnudge.app">fitnudge.app</a> | <a href="https://fitnudge.app/blog">Read our blog</a></p>
    </div>
  </div>
</body>
</html>
      `,
    };

    await transporter.sendMail(subscriberMailOptions);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }
}
