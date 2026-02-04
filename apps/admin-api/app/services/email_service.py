"""
Email Service for Admin API - password reset and data export emails
Uses SMTP from .env.local
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from email.utils import formataddr
from app.core.config import settings


def send_data_export_email(to_email: str, user_name: str, export_data: str) -> bool:
    """
    Send data export email with user's data as JSON attachment.
    """
    try:
        subject = "Your FitNudge Data Export"
        body = f"""Hi {user_name}!

Your FitNudge data export is ready. Please find your data attached to this email as a JSON file.

This file contains all the data we have stored about you. If you have any questions, please contact us at {settings.REPLY_TO_EMAIL}.

Best regards,
The FitNudge Team
"""
        from_header = formataddr((settings.FROM_NAME, settings.FROM_EMAIL))
        message = MIMEMultipart("mixed")
        message["Subject"] = subject
        message["From"] = from_header
        message["To"] = to_email
        message["Reply-To"] = settings.REPLY_TO_EMAIL

        text_part = MIMEText(body, "plain")
        message.attach(text_part)

        attachment = MIMEBase("application", "json")
        attachment.set_payload(export_data.encode("utf-8"))
        encoders.encode_base64(attachment)
        attachment.add_header(
            "Content-Disposition",
            "attachment",
            filename="fitnudge_data_export.json",
        )
        message.attach(attachment)

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.sendmail(settings.FROM_EMAIL, to_email, message.as_string())

        return True
    except Exception as e:
        print(f"[admin-api] Failed to send data export email: {e}")
        return False


def send_admin_password_reset_email(user_email: str, reset_token: str) -> bool:
    """
    Send password reset email for admin portal.
    Link points to admin portal reset-password page.
    """
    try:
        subject = "Reset your FitNudge Admin password"
        reset_url = f"{settings.ADMIN_PORTAL_URL}{settings.ADMIN_RESET_PASSWORD_PATH}?token={reset_token}"
        body = f"""Hi there,

You requested to reset your FitNudge Admin password.

Click this link to reset your password:
{reset_url}

This link will expire in 1 hour.

If you didn't request a password reset, please ignore this email.

Best regards,
The FitNudge Team
"""

        from_header = formataddr((settings.FROM_NAME, settings.FROM_EMAIL))
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = from_header
        message["To"] = user_email
        message["Reply-To"] = settings.REPLY_TO_EMAIL

        text_part = MIMEText(body, "plain")
        message.attach(text_part)

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.sendmail(settings.FROM_EMAIL, user_email, message.as_string())

        return True
    except Exception as e:
        print(f"[admin-api] Failed to send password reset email: {e}")
        return False
