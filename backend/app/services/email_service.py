import smtplib
import os
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.config import load_backend_env

load_backend_env()

logger = logging.getLogger("fleetflow.email")


class EmailDeliveryError(Exception):
    """Raised when email delivery fails via SMTP."""
    pass


class EmailConfigurationError(EmailDeliveryError):
    """Raised when SMTP credentials are not properly configured."""
    pass


def get_smtp_config():
    """Retrieve SMTP configuration from environment variables."""
    load_backend_env()
    host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    port_str = os.getenv("SMTP_PORT", "587")
    try:
        port = int(port_str)
    except ValueError:
        port = 587
    user = os.getenv("SMTP_USERNAME") or os.getenv("SMTP_USER", "")
    password = os.getenv("SMTP_PASSWORD", "")
    from_email = os.getenv("SMTP_FROM_EMAIL") or user or "no-reply@fleetflow.com"
    from_name = os.getenv("SMTP_FROM_NAME", "FleetFlow")
    return host, port, user, password, from_email, from_name


def validate_smtp_config():
    """Validate that SMTP configuration contains real credentials, not placeholders."""
    host, port, user, password, from_email, from_name = get_smtp_config()

    user_clean = user.strip() if user else ""
    user_lower = user_clean.lower()
    pass_clean = password.strip() if password else ""
    pass_lower = pass_clean.lower()

    # If using Gmail, Google App Passwords may have spaces (e.g. 4x4 characters)
    if "gmail" in host.lower() and " " in pass_clean:
        pass_clean = pass_clean.replace(" ", "")
        pass_lower = pass_clean.lower()

    # Safe development logs (NEVER log password or secrets)
    print("[EMAIL] SMTP configuration loaded")
    print(f"[EMAIL] SMTP host: {host}")
    print(f"[EMAIL] SMTP port: {port}")
    print(f"[EMAIL] SMTP username configured: {'YES' if bool(user_clean) else 'NO'}")
    print(f"[EMAIL] SMTP password configured: {'YES' if bool(pass_clean) else 'NO'}")

    placeholder_user_values = [
        "your-email", "your_email", "your-username", "your_username",
        "smtp_username", "changeme", "example.com"
    ]
    placeholder_pass_values = [
        "your-app-password", "your_app_password", "your-password", "your_password",
        "smtp_password", "changeme", "password", "placeholder", "123456", "secret"
    ]

    is_user_placeholder = (
        not user_clean
        or any(p in user_lower for p in placeholder_user_values)
    )

    is_pass_placeholder = (
        not pass_clean
        or any(p in pass_lower for p in placeholder_pass_values)
    )

    missing_or_invalid = []
    if not host or not host.strip():
        missing_or_invalid.append("SMTP_HOST")
    if is_user_placeholder:
        missing_or_invalid.append("SMTP_USERNAME")
    if is_pass_placeholder:
        missing_or_invalid.append("SMTP_PASSWORD")

    if missing_or_invalid:
        err_msg = (
            f"SMTP configuration is incomplete or uses placeholder values ({', '.join(missing_or_invalid)}). "
            "Please configure your real SMTP credentials (such as Gmail address and Google App Password) in backend/.env."
        )
        raise EmailConfigurationError(err_msg)

    return host, port, user_clean, pass_clean, from_email, from_name


def send_otp_email(to_email: str, full_name: str, otp: str) -> bool:
    """
    Send a 6-digit email verification OTP to the user.
    Raises EmailConfigurationError if SMTP is not configured.
    Raises EmailDeliveryError if SMTP delivery fails.
    Returns True on success.
    """
    to_email = to_email.strip().lower()
    host, port, user, password, from_email, from_name = validate_smtp_config()

    # Plain text version
    text_body = f"""FleetFlow - Email Verification

Hello {full_name},

Thank you for creating your FleetFlow account.

Your verification code is:
{otp}

This OTP will expire in 10 minutes.

If you did not create this account, please ignore this email.

Regards,
FleetFlow Team
"""

    # Rich HTML version
    html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FleetFlow Email Verification</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #0b0f19;
      color: #e2e8f0;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }}
    .wrapper {{
      max-width: 540px;
      margin: 40px auto;
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }}
    .header {{
      background: linear-gradient(135deg, #2563eb, #4f46e5);
      padding: 32px 24px;
      text-align: center;
    }}
    .header h1 {{
      margin: 0;
      color: #ffffff;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }}
    .header p {{
      margin: 6px 0 0;
      color: rgba(255, 255, 255, 0.85);
      font-size: 15px;
      font-weight: 500;
    }}
    .content {{
      padding: 32px 32px 24px;
      line-height: 1.6;
    }}
    .content h2 {{
      color: #f9fafb;
      font-size: 18px;
      margin-top: 0;
      margin-bottom: 12px;
    }}
    .otp-box {{
      background: #1e293b;
      border: 2px dashed #4f46e5;
      border-radius: 12px;
      padding: 24px;
      margin: 24px 0;
      text-align: center;
    }}
    .otp-code {{
      font-family: 'Courier New', Courier, monospace;
      font-size: 38px;
      font-weight: 800;
      letter-spacing: 10px;
      color: #60a5fa;
      margin: 0;
    }}
    .otp-desc {{
      font-size: 13px;
      color: #94a3b8;
      margin-top: 10px;
    }}
    .notice {{
      font-size: 13px;
      color: #6b7280;
      border-top: 1px solid #1f2937;
      padding-top: 16px;
      margin-top: 24px;
    }}
    .footer {{
      background: #0b0f19;
      padding: 16px 24px;
      text-align: center;
      color: #4b5563;
      font-size: 12px;
      border-top: 1px solid #1f2937;
    }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>🚚 FleetFlow</h1>
      <p>Email Verification</p>
    </div>
    <div class="content">
      <h2>Hello {full_name},</h2>
      <p>Thank you for creating your FleetFlow account. Please use the verification code below to verify your email address:</p>
      
      <div class="otp-box">
        <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 8px;">Your verification code is:</div>
        <div class="otp-code">{otp}</div>
        <div class="otp-desc">This OTP will expire in 10 minutes.</div>
      </div>

      <p style="color: #cbd5e1; font-size: 14px;">Enter this 6-digit verification code on the FleetFlow verification page to activate your account.</p>

      <div class="notice">
        <p>If you did not request this verification code, please ignore this email.</p>
        <p style="margin-bottom: 0;">Regards,<br><strong>FleetFlow Team</strong></p>
      </div>
    </div>
    <div class="footer">
      &copy; 2026 FleetFlow Logistics & Fleet Management System
    </div>
  </div>
</body>
</html>
"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "FleetFlow - Email Verification Code"
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = to_email

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    print("[EMAIL] Connecting to SMTP server")

    try:
        with smtplib.SMTP(host, port, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(user, password)
            print("[EMAIL] SMTP authentication successful")
            server.sendmail(from_email, to_email, msg.as_string())
        print("[EMAIL] Verification email sent successfully")
        return True
    except smtplib.SMTPAuthenticationError as e:
        error_msg = f"SMTP authentication failed: Invalid Gmail address or Google App Password ({e})"
        print(f"[EMAIL ERROR] {error_msg}")
        raise EmailDeliveryError(error_msg)
    except Exception as e:
        error_msg = str(e)
        print(f"[EMAIL ERROR] Failed to send email to {to_email}: {error_msg}")
        raise EmailDeliveryError(f"SMTP delivery failed: {error_msg}")


def send_verification_email(to_email: str, full_name: str, token: str) -> bool:
    """Legacy alias for link/token-based verification."""
    return send_otp_email(to_email, full_name, token)
