"""
Email Service for SMTP email sending
Supports Namecheap Private Email and other SMTP providers
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
from typing import Optional
from app.core.config import settings
from app.services.logger import logger


class EmailService:
    """Service for sending emails via SMTP"""

    def __init__(self):
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_username = settings.SMTP_USERNAME
        self.smtp_password = settings.SMTP_PASSWORD
        self.from_email = settings.FROM_EMAIL
        self.from_name = settings.FROM_NAME
        self.reply_to_email = settings.REPLY_TO_EMAIL
        self.base_url = settings.BASE_URL

        # Format From header with display name using proper email formatting
        self.from_header = formataddr((self.from_name, self.from_email))

    def send_verification_email(self, user_email: str, code: str) -> bool:
        """
        Send email verification code to user

        Args:
            user_email: Recipient email address
            code: 6-digit verification code

        Returns:
            bool: True if email sent successfully, False otherwise
        """
        try:
            subject = "Verify your FitNudge account"
            body = self._create_verification_email_body(code)

            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = self.from_header
            message["To"] = user_email
            message["Reply-To"] = self.reply_to_email

            # Add plain text part
            text_part = MIMEText(body, "plain")
            message.attach(text_part)

            # Send email
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_username, self.smtp_password)
                server.sendmail(self.from_email, user_email, message.as_string())

            logger.info(
                "Verification email sent",
                {"to": user_email, "code": code[:2] + "****"},
            )
            return True

        except Exception as e:
            logger.error(
                "Failed to send verification email",
                {
                    "to": user_email,
                    "error": str(e),
                    "smtp_host": self.smtp_host,
                    "smtp_port": self.smtp_port,
                },
            )
            return False

    def send_password_reset_email(self, user_email: str, reset_token: str) -> bool:
        """
        Send password reset email to user (for future use)

        Args:
            user_email: Recipient email address
            reset_token: Password reset token

        Returns:
            bool: True if email sent successfully, False otherwise
        """
        try:
            subject = "Reset your FitNudge password"
            body = self._create_password_reset_email_body(reset_token)

            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = self.from_header
            message["To"] = user_email
            message["Reply-To"] = self.reply_to_email

            # Add plain text part
            text_part = MIMEText(body, "plain")
            message.attach(text_part)

            # Send email
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_username, self.smtp_password)
                server.sendmail(self.from_email, user_email, message.as_string())

            logger.info(
                "Password reset email sent",
                {"to": user_email},
            )
            return True

        except Exception as e:
            logger.error(
                "Failed to send password reset email",
                {
                    "to": user_email,
                    "error": str(e),
                },
            )
            return False

    def _create_verification_email_body(self, code: str) -> str:
        """Create email body for verification code"""
        return f"""Hi there!

Welcome to FitNudge! Please verify your email address by entering the code below:

Verification Code: {code}

This code will expire in 24 hours.

If you didn't create an account with FitNudge, please ignore this email.

Best regards,
The FitNudge Team
"""

    def _create_password_reset_email_body(self, reset_token: str) -> str:
        """Create email body for password reset"""
        # Web URL with Universal Links/App Links support
        # This will automatically open the app if installed, or redirect to App Store/Play Store
        web_url = f"{self.base_url}/reset-password?token={reset_token}"

        return f"""Hi there!

You requested to reset your FitNudge password. 

Click this link to reset your password:
{web_url}

If you have the FitNudge app installed, it will open automatically. If not, you'll be redirected to download it.

Alternatively, you can manually enter this reset token in the app:
{reset_token}

This token will expire in 1 hour.

If you didn't request a password reset, please ignore this email.

Best regards,
The FitNudge Team
"""


# Create singleton instance
email_service = EmailService()
