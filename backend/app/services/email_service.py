import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv

load_dotenv()

def get_smtp_config():
    host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USERNAME") or os.getenv("SMTP_USER", "")
    password = os.getenv("SMTP_PASSWORD", "")
    from_email = os.getenv("SMTP_FROM_EMAIL") or user or "no-reply@fleetflow.com"
    from_name = os.getenv("SMTP_FROM_NAME", "FleetFlow")
    return host, port, user, password, from_email, from_name


def send_otp_email(to_email: str, full_name: str, otp: str) -> bool:
    """
    Send a 6-digit email verification OTP to the user.
    Returns True on success, False on failure.
    """
    host, port, user, password, from_email, from_name = get_smtp_config()

    # Plain text alternative
    text_body = f"""Hello {full_name},

Thank you for creating your FleetFlow account.

Your email verification OTP is:

{otp}

This OTP is valid for 10 minutes.

If you did not create this account, please ignore this email.

Regards,
FleetFlow Team
"""

    html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FleetFlow Email Verification OTP</title>
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
    .content {{
      padding: 32px 32px 24px;
      line-height: 1.6;
    }}
    .content h2 {{
      color: #f9fafb;
      font-size: 20px;
      margin-top: 0;
      margin-bottom: 12px;
    }}
    .otp-box {{
      background: #1e293b;
      border: 2px dashed #4f46e5;
      border-radius: 12px;
      padding: 20px;
      margin: 24px 0;
      text-align: center;
    }}
    .otp-code {{
      font-family: 'Courier New', Courier, monospace;
      font-size: 36px;
      font-weight: 800;
      letter-spacing: 10px;
      color: #60a5fa;
      margin: 0;
    }}
    .otp-desc {{
      font-size: 13px;
      color: #94a3b8;
      margin-top: 8px;
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
    </div>
    <div class="content">
      <h2>Hello {full_name},</h2>
      <p>Thank you for creating your FleetFlow account. Please use the verification code below to verify your email address and activate your account:</p>
      
      <div class="otp-box">
        <div class="otp-code">{otp}</div>
        <div class="otp-desc">Valid for 10 minutes</div>
      </div>

      <p style="color: #cbd5e1; font-size: 14px;">Enter this 6-digit OTP on the verification page to complete your signup.</p>

      <div class="notice">
        <p>If you did not create this account, please disregard this email. No further action is required.</p>
        <p style="margin-bottom: 0;">Regards,<br><strong>The FleetFlow Team</strong></p>
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
    msg["Subject"] = "FleetFlow Email Verification OTP"
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = to_email

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    is_placeholder = (
        not user or not password or not host or
        "your-email" in user.lower() or
        "your-app-password" in password.lower() or
        user.strip() == "" or
        password.strip() == ""
    )

    if is_placeholder:
        print(f"[WARN] SMTP credentials are not configured or contain default placeholder values. Skipping SMTP send. OTP for {to_email}: {otp}")
        return False

    try:
        with smtplib.SMTP(host, port, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(user, password)
            server.sendmail(from_email, to_email, msg.as_string())
        print(f"[EMAIL] Verification OTP sent successfully to {to_email}")
        return True
    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send OTP to {to_email}: {e}")
        return False


def send_verification_email(to_email: str, full_name: str, token: str) -> bool:
    """Legacy alias for link/token-based verification."""
    return send_otp_email(to_email, full_name, token)
