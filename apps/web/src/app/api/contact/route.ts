import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: NextRequest) {
  try {
    const { name, email, subject, message } = await request.json();

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
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

    // Email content
    const mailOptions = {
      from: `"${process.env.FROM_NAME || "FitNudge Contact"}" <${process.env.FROM_EMAIL}>`,
      to: process.env.REPLY_TO_EMAIL || process.env.FROM_EMAIL,
      replyTo: email,
      subject: `[FitNudge Contact] ${subject}`,
      text: `
Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}
      `,
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
    .field { margin-bottom: 16px; }
    .label { font-weight: 600; color: #374151; margin-bottom: 4px; }
    .value { color: #1f2937; }
    .message-box { background: white; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">New Contact Form Submission</h2>
    </div>
    <div class="content">
      <div class="field">
        <div class="label">Name</div>
        <div class="value">${name}</div>
      </div>
      <div class="field">
        <div class="label">Email</div>
        <div class="value"><a href="mailto:${email}">${email}</a></div>
      </div>
      <div class="field">
        <div class="label">Subject</div>
        <div class="value">${subject}</div>
      </div>
      <div class="message-box">
        <div class="label">Message</div>
        <div class="value" style="white-space: pre-wrap;">${message}</div>
      </div>
    </div>
  </div>
</body>
</html>
      `,
    };

    // Send email
    await transporter.sendMail(mailOptions);

    // Social media links for email
    const socialLinks = {
      twitter: "https://twitter.com/fitnudgeapp",
      instagram: "https://instagram.com/fitnudgeapp",
      facebook: "https://facebook.com/fitnudgeapp",
      linkedin: "https://linkedin.com/company/fitnudgeapp",
      tiktok: "https://tiktok.com/@fitnudgeapp",
    };

    // Send auto-reply to user
    const autoReplyOptions = {
      from: `"${process.env.FROM_NAME || "FitNudge"}" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: "Thanks for contacting FitNudge!",
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 40px 30px; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
    .header p { margin: 10px 0 0; opacity: 0.9; font-size: 16px; }
    .content { background: #ffffff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; }
    .content p { color: #374151; line-height: 1.6; margin: 0 0 16px; }
    .social-section { background: #f9fafb; padding: 24px; border-radius: 8px; margin: 24px 0; text-align: center; }
    .social-section h3 { margin: 0 0 16px; color: #1f2937; font-size: 16px; font-weight: 600; }
    .social-links { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }
    .social-link { display: inline-block; padding: 10px 16px; background: #2563eb; color: white !important; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500; }
    .social-link:hover { background: #1d4ed8; }
    .footer { background: #1f2937; padding: 24px 30px; border-radius: 0 0 12px 12px; text-align: center; }
    .footer p { color: #9ca3af; font-size: 14px; margin: 0; }
    .footer a { color: #60a5fa; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Thanks for reaching out!</h1>
      <p>We're excited to hear from you</p>
    </div>
    <div class="content">
      <p>Hi ${name},</p>
      <p>Thank you for contacting FitNudge! We've received your message and will get back to you within 24-48 hours.</p>
      <p>We're building the ultimate AI-powered accountability partner to help you achieve your goals, whether it's fitness, learning, meditation, or any positive habit you want to build.</p>
      
      <div class="social-section">
        <h3>Follow us for updates on our launch</h3>
        <div class="social-links">
          <a href="${socialLinks.instagram}" class="social-link">Instagram</a>
          <a href="${socialLinks.twitter}" class="social-link">Twitter</a>
          <a href="${socialLinks.tiktok}" class="social-link">TikTok</a>
          <a href="${socialLinks.facebook}" class="social-link">Facebook</a>
          <a href="${socialLinks.linkedin}" class="social-link">LinkedIn</a>
        </div>
      </div>
      
      <p>Best regards,<br><strong>The FitNudge Team</strong></p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} FitNudge. All rights reserved.</p>
      <p style="margin-top: 8px;"><a href="https://fitnudge.app">fitnudge.app</a></p>
    </div>
  </div>
</body>
</html>
      `,
    };

    await transporter.sendMail(autoReplyOptions);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
