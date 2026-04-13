import { normalizeDirectionLabel } from "../shared/timingUtils";

export function processHead(input, state, config) {
	const now = Date.now();
	const nextState = {
		lastCommandTime: state?.lastCommandTime ?? 0,
		holdCmd: state?.holdCmd ?? null,
		holdStart: state?.holdStart ?? 0,
		selectionTriggered: state?.selectionTriggered ?? false,
	};

	const commandDelay = Math.max(0, Number(config?.commandDelay ?? 120));
	const holdDuration = Math.max(100, Number(config?.holdDuration ?? 350));
	const selectionMethod = String(config?.headSelectionMethod || "FORWARD").toUpperCase();
	const rawDirection = normalizeDirectionLabel(input?.cmd);
	const direction = rawDirection || null;

	if (!direction || direction === "CENTER") {
		nextState.holdCmd = null;
		nextState.holdStart = 0;
		nextState.selectionTriggered = false;
		return {
			command: null,
			newState: nextState,
			debug: { direction: "CENTER", reason: "NEUTRAL" },
		};
	}

	if (direction !== nextState.holdCmd) {
		nextState.holdCmd = direction;
		nextState.holdStart = now;
		nextState.selectionTriggered = false;
	}

	if (direction === selectionMethod) {
		if (!nextState.selectionTriggered && now - nextState.holdStart >= holdDuration) {
			nextState.selectionTriggered = true;
			nextState.lastCommandTime = now;
			return {
				command: "FORWARD",
				newState: nextState,
				debug: { direction, reason: "SELECTION_HOLD" },
			};
		}

		return {
			command: null,
			newState: nextState,
			debug: { direction, reason: "HOLDING_SELECTION" },
		};
	}

	if (now - nextState.lastCommandTime < commandDelay) {
		return {
			command: null,
			newState: nextState,
			debug: { direction, reason: "COMMAND_DELAY" },
		};
	}

	nextState.lastCommandTime = now;
	return {
		command: direction,
		newState: nextState,
		debug: { direction, reason: "EMIT" },
	};
}

export default processHead;
