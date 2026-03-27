from twilio.rest import Client
from dotenv import load_dotenv
import os

load_dotenv()


def send_sms(to_phone: str, message: str):
    # Build client here so missing creds don't crash the import
    account_sid          = os.getenv("ACCOUNT_SID")
    auth_token           = os.getenv("AUTH_TOKEN")
    messaging_service_sid = os.getenv("MESSAGING_SERVICE_SID")

    if not all([account_sid, auth_token, messaging_service_sid]):
        return {
            "success": False,
            "status": "error",
            "error": "Twilio credentials not set in .env",
            "message": "SMS not sent — add ACCOUNT_SID, AUTH_TOKEN, MESSAGING_SERVICE_SID to .env",
        }

    try:
        client = Client(account_sid, auth_token)
        msg    = client.messages.create(
            messaging_service_sid=messaging_service_sid,
            body=message,
            to=to_phone,
        )
        return {
            "success": True,
            "status":  "sent",
            "sid":     msg.sid,
            "to":      to_phone,
            "message": "SMS sent successfully",
        }
    except Exception as e:
        return {
            "success": False,
            "status":  "error",
            "error":   str(e),
            "message": "Failed to send SMS",
        }
