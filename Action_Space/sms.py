from twilio.rest import Client
from dotenv import load_dotenv
import os

load_dotenv()


_TERMINAL_FAILURE_STATUSES = {"failed", "undelivered", "canceled"}


def _friendly_error_message(error_code, fallback):
    if str(error_code) == "21608":
        return "Twilio trial account can send SMS only to verified recipient numbers. Verify this phone in Twilio Console."
    return fallback


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
        msg = client.messages.create(
            messaging_service_sid=messaging_service_sid,
            body=message,
            to=to_phone,
        )

        # Fetch once to return the latest known delivery state.
        latest = client.messages(msg.sid).fetch()
        status = (latest.status or msg.status or "unknown").lower()
        error_code = latest.error_code
        error_message = latest.error_message

        if status in _TERMINAL_FAILURE_STATUSES:
            friendly = _friendly_error_message(error_code, error_message or "Message failed before delivery")
            return {
                "success": False,
                "status": status,
                "sid": msg.sid,
                "to": to_phone,
                "error_code": error_code,
                "error": friendly,
                "message": f"SMS failed ({status})",
            }

        if status == "delivered":
            user_message = "SMS delivered"
        elif status in {"queued", "accepted", "scheduled", "sending", "sent"}:
            user_message = f"SMS accepted by Twilio ({status}); delivery is not confirmed yet"
        else:
            user_message = f"SMS submitted ({status})"

        return {
            "success": True,
            "status": status,
            "sid": msg.sid,
            "to": to_phone,
            "message": user_message,
        }
    except Exception as e:
        return {
            "success": False,
            "status": "error",
            "error": str(e),
            "message": "Failed to send SMS",
        }
