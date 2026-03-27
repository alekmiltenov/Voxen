from actions import call_caregiver, emergency_alert, chat_with_ai, turn_lights_on

ACTION_MAP = {
    1: call_caregiver,
    2: emergency_alert,
    3: chat_with_ai,
    4: turn_lights_on,
}

def execute_action(action_number: int):
    action_function = ACTION_MAP.get(action_number)

    if action_function is None:
        return {"status": "error", "message": "Invalid action"}

    return action_function()