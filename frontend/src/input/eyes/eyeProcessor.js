import { DIRECTIONS, normalizeDirectionLabel } from "../shared/timingUtils";

const DEFAULT_DIRECTION_DEBOUNCE_MS = 80;
const DEFAULT_HYSTERESIS_THRESHOLD = 0.06;
const DEFAULT_DEBOUNCE_MS = 200;
const DEFAULT_MIN_STABLE_FRAMES = 2;
const DEFAULT_COMMAND_DELAY_MS = 120;
const DEFAULT_REPEAT_DELAY_MS = 180;
const DEFAULT_SELECTION_DWELL_MS = 650;
const DEFAULT_SELECTION_RELEASE_MIN_MS = 80;

function clamp01(value) {
	if (value <= 0) return 0;
	if (value >= 1) return 1;
	return value;
}

function classifyDirection(gazeX, gazeY, state, normalizedConfig) {
	const center = normalizedConfig.center;
	const yBias = normalizedConfig.yBias;
	const centerBuffer = normalizedConfig.centerBuffer;
	const hysteresisThreshold = normalizedConfig.hysteresisThreshold;

	const dx = gazeX - center.x;
	const dy = gazeY - (center.y + yBias);
	const radialDistance = Math.hypot(dx, dy);

	const centerThreshold = 0.08 + centerBuffer;
	if (radialDistance <= centerThreshold) {
		return DIRECTIONS.CENTER;
	}

	const minDirectionDistance = 0.15 + centerBuffer * 0.5;
	if (radialDistance < minDirectionDistance) {
		return DIRECTIONS.CENTER;
	}

	let nextDirection;
	if (Math.abs(dx) >= Math.abs(dy)) {
		nextDirection = dx < 0 ? DIRECTIONS.LEFT : DIRECTIONS.RIGHT;
	} else {
		nextDirection = dy < 0 ? DIRECTIONS.UP : DIRECTIONS.DOWN;
	}

	if (
		state.lastDirection &&
		state.lastDirection !== nextDirection &&
		Number.isFinite(state.lastGazeX) &&
		Number.isFinite(state.lastGazeY)
	) {
		const lastDx = state.lastGazeX - center.x;
		const lastDy = state.lastGazeY - (center.y + yBias);
		const movementDistance = Math.hypot(dx - lastDx, dy - lastDy);
		if (movementDistance < hysteresisThreshold) {
			return state.lastDirection;
		}
	}

	return nextDirection;
}

export function createEyeProcessor(config = {}) {
	const center = config?.center || { x: 0, y: 0 };
	const yBias = Number(config?.yBias || 0);
	const centerBuffer = Number(config?.centerBuffer || 0);
	const hysteresisThreshold = Math.max(
		0,
		Number(config?.hysteresisThreshold ?? DEFAULT_HYSTERESIS_THRESHOLD)
	);
	const directionDebounceMs = Math.max(
		0,
		Number(config?.directionDebounceMs ?? DEFAULT_DIRECTION_DEBOUNCE_MS)
	);
	const debounceMs = Math.max(0, Number(config?.debounceMs ?? DEFAULT_DEBOUNCE_MS));
	const minStableFrames = Math.max(
		1,
		Number(config?.minStableFrames ?? DEFAULT_MIN_STABLE_FRAMES)
	);
	const commandDelay = Math.max(0, Number(config?.commandDelay ?? DEFAULT_COMMAND_DELAY_MS));
	const repeatEnabled = !!config?.repeatEnabled;
	const repeatDelay = Math.max(30, Number(config?.repeatDelay ?? DEFAULT_REPEAT_DELAY_MS));
	const selectionMethod = normalizeDirectionLabel(config?.selectionMethod) || DIRECTIONS.RIGHT;
	const selectionDwell = Math.max(
		120,
		Number(config?.selectionDwell ?? DEFAULT_SELECTION_DWELL_MS)
	);
	const selectionReleaseMin = Math.max(
		0,
		Number(config?.selectionReleaseMin ?? DEFAULT_SELECTION_RELEASE_MIN_MS)
	);

	const normalizedConfig = {
		center,
		yBias,
		centerBuffer,
		hysteresisThreshold,
	};

	const state = {
		lastDirection: DIRECTIONS.CENTER,
		lastDirectionTime: 0,
		rawDirection: null,
		rawStartTime: 0,
		stableFrames: 0,
		navLock: null,
		lastCommandTime: 0,
		selectionStartTime: null,
		selectionTriggered: false,
		briefSelectionArmed: false,
		pendingNavDirection: null,
		lastGazeX: Number.NaN,
		lastGazeY: Number.NaN,
	};

	function process(input) {
		const now = Number.isFinite(input?.timestamp) ? Number(input.timestamp) : Date.now();
		const gazeX = Number(input?.gazeX);
		const gazeY = Number(input?.gazeY);
		const rawHeldMs = state.rawDirection ? Math.max(0, now - state.rawStartTime) : 0;
		const lastCommandAgo = state.lastCommandTime ? Math.max(0, now - state.lastCommandTime) : 0;

		if (!Number.isFinite(gazeX) || !Number.isFinite(gazeY)) {
			return {
				command: null,
				debug: {
					direction: DIRECTIONS.CENTER,
					isStable: false,
					reason: "INVALID_INPUT",
					state: "idle",
					progress: 0,
					selectionMethod,
					selectionStartMs: state.selectionStartTime,
					selectionDwell,
					rawHeldMs,
					stableFrames: state.stableFrames,
					lastCommandAgo,
				},
			};
		}

		const classifiedDirection = classifyDirection(gazeX, gazeY, state, normalizedConfig);
		state.lastGazeX = gazeX;
		state.lastGazeY = gazeY;

		let direction = classifiedDirection;
		if (classifiedDirection !== state.lastDirection) {
			if (now - state.lastDirectionTime >= directionDebounceMs) {
				state.lastDirection = classifiedDirection;
				state.lastDirectionTime = now;
			} else {
				direction = state.lastDirection || classifiedDirection;
			}
		}

		let command = null;
		let reason = "HOLDING";
		let debugState = "idle";
		let isStable = false;

		if (direction === DIRECTIONS.CENTER) {
			debugState = "center-hold";
			const hadSelectionHold = state.selectionStartTime != null;
			const holdElapsedMs = hadSelectionHold ? now - state.selectionStartTime : 0;
			state.briefSelectionArmed =
				selectionMethod !== DIRECTIONS.CENTER &&
				hadSelectionHold &&
				!state.selectionTriggered &&
				holdElapsedMs >= selectionReleaseMin &&
				holdElapsedMs < selectionDwell;
			state.pendingNavDirection = state.briefSelectionArmed ? selectionMethod : null;

			if (state.briefSelectionArmed && now - state.lastCommandTime >= commandDelay) {
				command = state.pendingNavDirection;
				state.lastCommandTime = now;
				reason = "RELEASE_TO_MOVE";
			}

			state.navLock = null;
			state.rawDirection = null;
			state.rawStartTime = 0;
			state.stableFrames = 0;
			state.selectionStartTime = null;
			state.selectionTriggered = false;
			state.briefSelectionArmed = false;
			state.pendingNavDirection = null;
			if (!command) reason = "CENTER";
		} else if (direction === selectionMethod) {
			debugState = selectionMethod === DIRECTIONS.CENTER ? "center-hold" : "direction-hold";
			if (state.selectionStartTime == null) {
				state.selectionStartTime = now;
				state.selectionTriggered = false;
			}

			if (
				!state.selectionTriggered &&
				now - state.selectionStartTime >= selectionDwell &&
				now - state.lastCommandTime >= commandDelay
			) {
				command = "FORWARD";
				state.selectionTriggered = true;
				state.lastCommandTime = now;
				reason = "SELECTION_DWELL";
			} else if (!state.selectionTriggered) {
				reason = "SELECTION_HOLD";
			} else {
				reason = "SELECTION_LOCKED";
			}

			state.rawDirection = null;
			state.rawStartTime = 0;
			state.stableFrames = 0;
			state.pendingNavDirection = null;
		} else {
			state.selectionStartTime = null;
			state.selectionTriggered = false;
			state.briefSelectionArmed = false;
			state.pendingNavDirection = null;

			if (state.navLock && direction === state.navLock) {
				if (repeatEnabled) {
					if (now - state.lastCommandTime >= repeatDelay) {
						command = direction;
						state.lastCommandTime = now;
						reason = "REPEAT";
					} else {
						reason = "REPEAT_DELAY";
					}
				} else {
					reason = "NAV_LOCKED";
					debugState = "nav-locked";
				}
			} else {
				if (direction !== state.rawDirection) {
					state.rawDirection = direction;
					state.rawStartTime = now;
					state.stableFrames = 1;
				} else {
					state.stableFrames += 1;
				}

				const rawHeldMs = now - state.rawStartTime;
				isStable = rawHeldMs >= debounceMs && state.stableFrames >= minStableFrames;

				if (!isStable) {
					reason = rawHeldMs < debounceMs ? "DEBOUNCE" : "STABILITY";
				} else if (now - state.lastCommandTime < commandDelay) {
					reason = "COMMAND_DELAY";
				} else if (state.pendingNavDirection !== direction) {
					state.pendingNavDirection = direction;
					state.navLock = direction;
					state.lastCommandTime = now;
					command = direction;
					reason = "EMIT";
				} else {
					reason = "HOLDING";
				}
			}
		}

		const selectionProgress =
			state.selectionStartTime == null
				? 0
				: clamp01((now - state.selectionStartTime) / Math.max(selectionDwell, 1));

		return {
			command,
			debug: {
				direction,
				isStable,
				reason,
				state: debugState,
				progress: selectionProgress,
				selectionMethod,
				selectionStartMs: state.selectionStartTime,
				selectionDwell,
				rawHeldMs: state.rawDirection ? Math.max(0, now - state.rawStartTime) : 0,
				stableFrames: state.stableFrames,
				lastCommandAgo: state.lastCommandTime ? Math.max(0, now - state.lastCommandTime) : 0,
			},
		};
	}

	return {
		process,
	};
}

export default createEyeProcessor;
