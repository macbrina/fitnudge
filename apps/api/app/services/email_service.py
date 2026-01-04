"""
Email Service for SMTP email sending
Supports Namecheap Private Email and other SMTP providers
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
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

    async def send_data_export_email(
        self, to_email: str, user_name: str, export_data: str
    ) -> bool:
        """
        Send data export email with user's data as JSON attachment.

        Args:
            to_email: Recipient email address
            user_name: User's name for personalization
            export_data: JSON string of user's data

        Returns:
            bool: True if email sent successfully, False otherwise
        """
        try:
            subject = "Your FitNudge Data Export"
            body = self._create_data_export_email_body(user_name)

            message = MIMEMultipart("mixed")
            message["Subject"] = subject
            message["From"] = self.from_header
            message["To"] = to_email
            message["Reply-To"] = self.reply_to_email

            # Add plain text part
            text_part = MIMEText(body, "plain")
            message.attach(text_part)

            # Add JSON file attachment
            attachment = MIMEBase("application", "json")
            attachment.set_payload(export_data.encode("utf-8"))
            encoders.encode_base64(attachment)
            attachment.add_header(
                "Content-Disposition",
                "attachment",
                filename="fitnudge_data_export.json"
            )
            message.attach(attachment)

            # Send email
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_username, self.smtp_password)
                server.sendmail(self.from_email, to_email, message.as_string())

            logger.info(f"Data export email sent to {to_email}")
            return True

        except Exception as e:
            logger.error(
                "Failed to send data export email",
                {
                    "to": to_email,
                    "error": str(e),
                },
            )
            return False

    def _create_data_export_email_body(self, user_name: str) -> str:
        """Create email body for data export"""
        return f"""Hi {user_name}!

Your FitNudge data export is ready. Please find your data attached to this email as a JSON file.

This file contains all the data we have stored about you, including:
- Your profile information
- Goals and check-ins
- Fitness preferences
- Workout sessions
- Meal and hydration logs
- Achievements
- And more

If you have any questions about your data, please contact us at {self.reply_to_email}.

Best regards,
The FitNudge Team
"""


# Create singleton instance
email_service = EmailService()
