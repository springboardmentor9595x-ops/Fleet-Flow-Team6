import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import HTTPException, status
from config import settings

logger = logging.getLogger(__name__)

def send_otp_email(email: str, name: str, otp: str):
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"{otp} is your FleetFlow verification code"
        msg["From"] = f"FleetFlow <{settings.EMAIL_FROM}>"
        msg["To"] = email

        html = f"""
        <html>
          <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 0;">
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 2rem 0;">
              <tr>
                <td align="center">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 1.5rem; overflow: hidden; box-shadow: 0 20px 60px rgba(15,23,42,0.06); border: 1.5px solid rgba(15,23,42,0.04);">
                    <!-- Header -->
                    <tr>
                      <td align="center" style="background: linear-gradient(135deg, #6366f1 0%, #3b82f6 100%); padding: 2.5rem 2rem;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 1.75rem; font-weight: 700; letter-spacing: -0.02em;">FleetFlow</h1>
                        <p style="color: rgba(255,255,255,0.85); margin: 0.375rem 0 0 0; font-size: 0.875rem;">Premium Fleet Ops Platform</p>
                      </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                      <td style="padding: 2.5rem 2.25rem;">
                        <h2 style="margin: 0 0 1rem 0; font-size: 1.375rem; font-weight: 700; color: #0f172a;">Your One-Time Verification Code</h2>
                        <p style="margin: 0 0 1.5rem 0; font-size: 0.9375rem; color: #475569;">
                          Hello {name},<br><br>
                          Please enter the following 6-digit OTP code to verify your email address and complete your login. This code is valid for 5 minutes.
                        </p>
                        <!-- OTP Display -->
                        <div align="center" style="margin: 2rem auto; font-family: monospace; font-size: 2.5rem; font-weight: bold; letter-spacing: 0.5rem; color: #3b82f6; background-color: #eff6ff; border: 1.5px dashed #bfdbfe; padding: 1rem 2rem; border-radius: 1rem; width: fit-content;">
                          {otp}
                        </div>
                        <p style="margin: 2rem 0 0 0; font-size: 0.8125rem; color: #94a3b8; line-height: 1.5;">
                          If you did not request this verification code, please ignore this email.
                        </p>
                      </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                      <td align="center" style="background-color: #f1f5f9; padding: 1.5rem 2rem; border-top: 1px solid rgba(15,23,42,0.04);">
                        <p style="margin: 0; font-size: 0.75rem; color: #64748b;">&copy; 2026 FleetFlow. All rights reserved.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
        """
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT) as server:
            server.starttls()
            server.login(settings.EMAIL_USER, settings.EMAIL_PASSWORD)
            server.sendmail(settings.EMAIL_FROM, email, msg.as_string())
        logger.info(f"Verification OTP successfully sent to {email}")
    except smtplib.SMTPAuthenticationError as e:
        error_msg = (
            "Gmail SMTP Authentication Failed (535). "
            f"Please verify EMAIL_USER ({settings.EMAIL_USER}) and ensure EMAIL_PASSWORD "
            "is a 16-character Google App Password (not your personal account password)."
        )
        logger.error(f"{error_msg}. Details: {e}")
        print(f"\n[SMTP AUTH ERROR] {error_msg}")
        print(f"[FALLBACK OTP] Code for {email} ({name}): >>> {otp} <<<\n")
    except Exception as e:
        error_msg = f"SMTP Connection/Send Failed: {e}"
        logger.error(error_msg)
        print(f"\n[SMTP CONNECTION ERROR] {error_msg}")
        print(f"[FALLBACK OTP] Code for {email} ({name}): >>> {otp} <<<\n")


def send_maintenance_reminder_email(email: str, name: str, vehicle_reg: str, maintenance_type: str, service_date: str):
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"[FleetFlow] Service Reminder: Vehicle {vehicle_reg} Due Tomorrow!"
        msg["From"] = f"FleetFlow Operations <{settings.EMAIL_FROM}>"
        msg["To"] = email

        html = f"""
        <html>
          <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 0;">
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 2rem 0;">
              <tr>
                <td align="center">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 1.5rem; overflow: hidden; box-shadow: 0 20px 60px rgba(15,23,42,0.06); border: 1.5px solid rgba(15,23,42,0.04);">
                    <!-- Header -->
                    <tr>
                      <td align="center" style="background: linear-gradient(135deg, #d97706 0%, #b45309 100%); padding: 2rem 2rem;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 1.5rem; font-weight: 700;">FleetFlow Vehicle Maintenance Reminder</h1>
                        <p style="color: rgba(255,255,255,0.9); margin: 0.25rem 0 0 0; font-size: 0.875rem;">1-Day Prior Operational Alert</p>
                      </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                      <td style="padding: 2.25rem;">
                        <h2 style="margin: 0 0 1rem 0; font-size: 1.25rem; font-weight: 700; color: #0f172a;">Vehicle Scheduled for Service Tomorrow</h2>
                        <p style="margin: 0 0 1.25rem 0; font-size: 0.9375rem; color: #475569;">
                          Hello <strong>{name}</strong>,<br><br>
                          This is an automated reminder that your assigned vehicle <strong>{vehicle_reg}</strong> is scheduled for <strong>{maintenance_type}</strong> service tomorrow (Date: <strong>{service_date}</strong>).
                        </p>
                        <div style="background-color: #fef3c7; border-left: 4px solid #d97706; padding: 1rem; border-radius: 0.5rem; margin: 1.5rem 0;">
                          <p style="margin: 0; font-size: 0.875rem; color: #92400e; font-weight: 600;">
                            🛠️ Action Required: Please prepare vehicle {vehicle_reg} and report to designated service facility on schedule.
                          </p>
                        </div>
                        <p style="margin: 1.5rem 0 0 0; font-size: 0.8125rem; color: #94a3b8;">
                          If you have any questions, please contact your Fleet Manager or Dispatcher.
                        </p>
                      </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                      <td align="center" style="background-color: #f1f5f9; padding: 1.25rem 2rem; border-top: 1px solid rgba(15,23,42,0.04);">
                        <p style="margin: 0; font-size: 0.75rem; color: #64748b;">&copy; 2026 FleetFlow Logistics. Automated Maintenance Alert System.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
        """
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT) as server:
            server.starttls()
            server.login(settings.EMAIL_USER, settings.EMAIL_PASSWORD)
            server.sendmail(settings.EMAIL_FROM, email, msg.as_string())
        logger.info(f"Maintenance reminder email successfully sent to driver {email} for vehicle {vehicle_reg}")
        print(f"[EMAIL SENT] Maintenance 1-day reminder email sent to driver {email} ({name}) for vehicle {vehicle_reg}")
    except Exception as e:
        logger.error(f"Failed to send maintenance reminder email: {e}")
        print(f"\n[MAINTENANCE EMAIL REMINDER] Email to {email} ({name}) for vehicle {vehicle_reg}: >>> Service Due Tomorrow ({service_date}) <<<\n")

