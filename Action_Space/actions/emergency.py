from datetime import datetime
import os
from Action_Space.sms import send_sms


def emergency_alert(payload=None):
    payload = payload or {}

    default_phone = os.getenv("EMERGENCY_PHONE", "+359897827404")
    phone = payload.get("phone", default_phone)

    message = payload.get(
        "message",
        f"""🚨 EMERGENCY ALERT
User needs immediate assistance!

Time: {datetime.now().strftime("%H:%M:%S")}
""",
    )

    result = send_sms(phone, message)

    if result["success"]:
        return {
            "status": "executed",
            "action": "emergency",
            "success": True,
            "message": result.get("message", "Emergency SMS sent"),
            "data": result,
        }

    return {
        "status": "error",
        "action": "emergency",
        "success": False,
        "message": result["message"],
        "error": result.get("error"),
    }

