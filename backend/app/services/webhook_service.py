"""
Webhook Sender Utility
-----------------------
Posts formatted alert blocks to a Slack or Discord incoming webhook URL.
Compatible with both platforms' JSON payload formats.
"""
import os
import json
import urllib.request
import logging

logger = logging.getLogger("fleetflow.webhooks")

WEBHOOK_URL = os.getenv("WEBHOOK_URL", "").strip()


def format_slack_card(title: str, message: str, alert_type: str = "info") -> dict:
    """Format rich Slack blocks layout."""
    emoji_map = {"warning": "⚠️", "error": "🚨", "info": "ℹ️", "success": "✅"}
    emoji = emoji_map.get(alert_type, "📋")
    return {
        "text": f"{emoji} *{title}*\n{message}",
        "blocks": [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": f"{emoji} {title}"},
            },
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": message},
            },
        ],
    }


def format_discord_embed(title: str, message: str, alert_type: str = "info") -> dict:
    """Format rich Discord embed layout."""
    color_map = {"warning": 16753920, "error": 15746887, "info": 3908856, "critical": 15746887}
    color = color_map.get(alert_type, 3908856)
    return {
        "content": f"**{title}**",
        "embeds": [
            {
                "title": title,
                "description": message,
                "color": color,
            }
        ],
    }


def send_webhook_alert(title: str, message: str, alert_type: str = "info") -> bool:
    """
    Send an alert to the configured webhook URL.

    Returns True if the message was sent successfully, False otherwise.
    If WEBHOOK_URL is empty, silently returns False (webhooks disabled).
    """
    if not WEBHOOK_URL:
        return False

    # Emoji mapping
    emoji_map = {
        "warning": "⚠️",
        "error": "🚨",
        "info": "ℹ️",
        "success": "✅",
    }
    emoji = emoji_map.get(alert_type, "📋")

    # Build payload compatible with both Slack and Discord webhooks
    payload = {
        "content": f"{emoji} **{title}**\n{message}",  # Discord
        "text": f"{emoji} *{title}*\n{message}",       # Slack
    }

    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            WEBHOOK_URL,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            logger.info(f"Webhook sent ({resp.status}): {title}")
            return True
    except Exception as e:
        logger.error(f"Webhook send failed: {e}")
        return False
