import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import InputManager from "../input/manager/InputManager";
import { useEyeTracking } from "../input/eyes/useEyeTracking";

const BACKEND_SERVER = "http://localhost:8000";
const HEAD_SERVER = BACKEND_SERVER;

const getInitialCenterBuffer = () => {
	try {
		const saved = localStorage.getItem("centerBuffer");
		return saved ? parseFloat(saved) : 0.05;
	} catch {
		return 0.05;
	}
};

const getInitialCommandDelay = () => {
	try {
		const saved = localStorage.getItem("eyeCommandDelay");
		return saved ? parseFloat(saved) : 120;
	} catch {
		return 120;
	}
};

const getInitialYBias = () => {
	try {
		const saved = localStorage.getItem("eyeYBias");
		return saved ? parseFloat(saved) : 0;
	} catch {
		return 0;
	}
};

const getInitialEyeHoldRepeatEnabled = () => {
	try {
		return localStorage.getItem("eyeHoldRepeatEnabled") === "1";
	} catch {
		return false;
	}
};

const getInitialEyeHoldRepeatDelay = () => {
	try {
		const saved = localStorage.getItem("eyeHoldRepeatDelay");
		return saved ? parseFloat(saved) : 180;
	} catch {
		return 180;
	}
};

const getSelectionMethod = () => {
	try {
		const saved = (localStorage.getItem("eyeSelectionMethod") || "right").toLowerCase();
		if (saved === "closed") return "center";
		if (["left", "right", "up", "down", "center"].includes(saved)) return saved;
		return "right";
	} catch {
		return "right";
	}
};

const getSelectionDwell = () => {
	try {
		const saved = localStorage.getItem("eyeSelectionDwell");
		return saved ? parseInt(saved, 10) : 650;
	} catch {
		return 650;
	}
};

const getHeadSelectionMethod = () => {
	try {
		return (localStorage.getItem("headSelectionMethod") || "forward").toUpperCase();
	} catch {
		return "FORWARD";
	}
};

const getInitialCenterSelectMinConfidence = () => {
	try {
		const saved = parseFloat(localStorage.getItem("cnnCenterSelectMinConfidence") || "");
		return Number.isFinite(saved) ? Math.max(0.55, Math.min(0.99, saved)) : 0.82;
	} catch {
		return 0.82;
	}
};

const getInitialCenterSelectNoiseDelta = () => {
	try {
		const saved = parseFloat(localStorage.getItem("cnnCenterSelectNoiseDelta") || "");
		return Number.isFinite(saved) ? Math.max(0.01, Math.min(0.2, saved)) : 0.06;
	} catch {
		return 0.06;
	}
};

const InputControlContext = createContext(null);

export function InputControlProvider({ children }) {
	const [mode, setMode] = useState(() => {
		try {
			return localStorage.getItem("controlMode") || "off";
		} catch {
			return "off";
		}
	});

	const enabled = mode !== "off";

	const [holdDuration, setHoldDuration] = useState(500);
	const [sensorSettings, setSensorSettings] = useState({
		alpha: 0.5,
		threshold: 1.5,
		deadzone: 1.0,
	});

	const [eyeDebug, setEyeDebug] = useState(null);
	const [headDebug, setHeadDebug] = useState(null);

	const [cnnReady, setCnnReady] = useState(false);
	const [gazeLabel, setGazeLabel] = useState("—");
	const [cnnDebug, setCnnDebug] = useState(null);

	const [eyeHoldRepeatEnabled, setEyeHoldRepeatEnabledState] = useState(getInitialEyeHoldRepeatEnabled);
	const [eyeHoldRepeatDelay, setEyeHoldRepeatDelayState] = useState(getInitialEyeHoldRepeatDelay);
	const [centerSelectMinConfidence, setCenterSelectMinConfidenceState] = useState(getInitialCenterSelectMinConfidence);
	const [centerSelectNoiseDelta, setCenterSelectNoiseDeltaState] = useState(getInitialCenterSelectNoiseDelta);

	const modeRef = useRef(mode);
	const handlerRef = useRef(null);

	const configRef = useRef(null);
	const autoCenterDoneRef = useRef(false);

	const centerRef = useRef({ x: 0, y: 0 });
	const yBiasRef = useRef(getInitialYBias());
	const centerBufferRef = useRef(getInitialCenterBuffer());
	const commandDelayRef = useRef(getInitialCommandDelay());
	const eyeHoldRepeatEnabledRef = useRef(eyeHoldRepeatEnabled);
	const eyeHoldRepeatDelayRef = useRef(eyeHoldRepeatDelay);
	const centerSelectMinConfidenceRef = useRef(centerSelectMinConfidence);
	const centerSelectNoiseDeltaRef = useRef(centerSelectNoiseDelta);

	const dispatch = useCallback((cmd) => {
		if (modeRef.current === "off") return;
		if (!cmd || typeof handlerRef.current !== "function") return;
		handlerRef.current(cmd);
	}, []);

	const inputManagerRef = useRef(null);
	if (!inputManagerRef.current) {
		inputManagerRef.current = new InputManager(dispatch, modeRef.current);
	}

	function buildManagerConfig() {
		return {
			center: centerRef.current,
			yBias: yBiasRef.current,
			centerBuffer: centerBufferRef.current,
			commandDelay: commandDelayRef.current,
			switchDebounceMs: 30,
			selectionReleaseMin: 80,
			selectionMethod: getSelectionMethod().toUpperCase(),
			selectionDwell: getSelectionDwell(),
			repeatEnabled: eyeHoldRepeatEnabledRef.current,
			repeatDelay: eyeHoldRepeatDelayRef.current,
			holdDuration,
			headSelectionMethod: getHeadSelectionMethod(),
			cnnMinConfidence: 0.45,
			centerSelectMinConfidence: centerSelectMinConfidenceRef.current,
			centerSelectNoiseDelta: centerSelectNoiseDeltaRef.current,
		};
	}

	useEffect(() => {
		modeRef.current = mode;
		inputManagerRef.current?.setMode(mode);
		configRef.current = buildManagerConfig();
		try {
			localStorage.setItem("controlMode", mode);
		} catch {
			// ignore storage errors
		}
	}, [mode]);

	useEffect(() => {
		configRef.current = buildManagerConfig();
	}, [holdDuration]);

	useEffect(() => {
		eyeHoldRepeatEnabledRef.current = eyeHoldRepeatEnabled;
	}, [eyeHoldRepeatEnabled]);

	useEffect(() => {
		eyeHoldRepeatDelayRef.current = eyeHoldRepeatDelay;
	}, [eyeHoldRepeatDelay]);

	useEffect(() => {
		centerSelectMinConfidenceRef.current = centerSelectMinConfidence;
	}, [centerSelectMinConfidence]);

	useEffect(() => {
		centerSelectNoiseDeltaRef.current = centerSelectNoiseDelta;
	}, [centerSelectNoiseDelta]);

	const register = useCallback((fn) => {
		handlerRef.current = fn;
	}, []);

	const unregister = useCallback(() => {
		handlerRef.current = null;
	}, []);

	const setControlMode = useCallback((newMode) => {
		setMode(newMode);
	}, []);

	const setYBias = useCallback((value) => {
		yBiasRef.current = Number(value) || 0;
		configRef.current = buildManagerConfig();
		try {
			localStorage.setItem("eyeYBias", String(yBiasRef.current));
		} catch {
			// ignore storage errors
		}
	}, []);

	const setCenterBuffer = useCallback((value) => {
		centerBufferRef.current = Number(value) || 0;
		configRef.current = buildManagerConfig();
		try {
			localStorage.setItem("centerBuffer", String(centerBufferRef.current));
		} catch {
			// ignore storage errors
		}
	}, []);

	const setCommandDelay = useCallback((value) => {
		commandDelayRef.current = Number(value) || 0;
		configRef.current = buildManagerConfig();
		try {
			localStorage.setItem("eyeCommandDelay", String(commandDelayRef.current));
		} catch {
			// ignore storage errors
		}
	}, []);

	const setEyeHoldRepeatEnabled = useCallback((enabledValue) => {
		const next = !!enabledValue;
		setEyeHoldRepeatEnabledState(next);
		eyeHoldRepeatEnabledRef.current = next;
		configRef.current = buildManagerConfig();
		try {
			localStorage.setItem("eyeHoldRepeatEnabled", next ? "1" : "0");
		} catch {
			// ignore storage errors
		}
	}, []);

	const setEyeHoldRepeatDelay = useCallback((value) => {
		const next = Number(value) || 180;
		setEyeHoldRepeatDelayState(next);
		eyeHoldRepeatDelayRef.current = next;
		configRef.current = buildManagerConfig();
		try {
			localStorage.setItem("eyeHoldRepeatDelay", String(next));
		} catch {
			// ignore storage errors
		}
	}, []);

	const setCenterSelectMinConfidence = useCallback((value) => {
		const next = Math.max(0.55, Math.min(0.99, Number(value) || 0.82));
		setCenterSelectMinConfidenceState(next);
		centerSelectMinConfidenceRef.current = next;
		configRef.current = buildManagerConfig();
		try {
			localStorage.setItem("cnnCenterSelectMinConfidence", String(next));
		} catch {
			// ignore storage errors
		}
	}, []);

	const setCenterSelectNoiseDelta = useCallback((value) => {
		const next = Math.max(0.01, Math.min(0.2, Number(value) || 0.06));
		setCenterSelectNoiseDeltaState(next);
		centerSelectNoiseDeltaRef.current = next;
		configRef.current = buildManagerConfig();
		try {
			localStorage.setItem("cnnCenterSelectNoiseDelta", String(next));
		} catch {
			// ignore storage errors
		}
	}, []);

	const { eyeReady, eyeCentered, eyeTracking, recenterEyes } = useEyeTracking({
		mode,
		inputManagerRef,
		configRef,
		setEyeDebug,
		centerRef,
		centerBufferRef,
		autoCenterDoneRef,
	});

	useEffect(() => {
		if (mode !== "cnn") {
			setCnnReady(false);
			setGazeLabel("—");
			setCnnDebug(null);
			return;
		}

		let ws;
		let reconnectTimer;

		const connectWs = () => {
			const wsUrl = "ws://localhost:8000/ws/predict";
			ws = new WebSocket(wsUrl);

			ws.onopen = () => {
				setCnnReady(true);
			};

			ws.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					const name = String(data?.name || "").toUpperCase();
					const confidence = Number(data?.confidence);
					if (name) {
						const confidenceText = Number.isFinite(confidence) ? confidence.toFixed(2) : "0.00";
						setGazeLabel(`${name} (${confidenceText})`);
					}

					const result = inputManagerRef.current?.handleCNN(
						{
							name: data.name,
							confidence: data.confidence,
							timestamp: Date.now(),
						},
						configRef.current
					);
					const processorDebug = result?.debug || {};
					const fallbackSelectionMethod = String(configRef.current?.selectionMethod || "RIGHT").toUpperCase();

					setCnnDebug({
						...processorDebug,
						direction: String(processorDebug.direction || "NONE").toUpperCase(),
						confidence: Number.isFinite(Number(processorDebug.confidence)) ? Number(processorDebug.confidence) : 0,
						isStable: Boolean(processorDebug.isStable),
						stable: Boolean(processorDebug.isStable),
						stableFrames: Number(processorDebug.stableFrames || 0),
						reason: String(processorDebug.reason || "HOLDING"),
						selectionMethod: String(processorDebug.selectionMethod || fallbackSelectionMethod).toUpperCase(),
						selectionStartMs: Math.max(0, Number(processorDebug.selectionStartMs || 0)),
						selectionDwell: Math.max(0, Number(processorDebug.selectionDwell || configRef.current?.selectionDwell || 0)),
						progress: Math.max(0, Math.min(1, Number(processorDebug.progress || 0))),
					});
				} catch {
					// ignore malformed frame
				}
			};

			ws.onerror = () => {
				setCnnReady(false);
			};

			ws.onclose = () => {
				setCnnReady(false);
				setGazeLabel("—");
				if (modeRef.current === "cnn") {
					reconnectTimer = setTimeout(connectWs, 2000);
				}
			};
		};

		connectWs();

		return () => {
			if (reconnectTimer) clearTimeout(reconnectTimer);
			if (ws) ws.close();
		};
	}, [mode]);

	useEffect(() => {
		if (mode !== "head") return;

		if (window.location.hostname !== "localhost") {
			fetch(`${HEAD_SERVER}/settings`)
				.then((response) => response.json())
				.then((settings) => {
					setSensorSettings({
						alpha: settings.alpha ?? 0.5,
						threshold: settings.threshold ?? 1.5,
						deadzone: settings.deadzone ?? 1.0,
					});
				})
				.catch(() => {
					// keep defaults
				});
		}

		let ws;
		let reconnectTimer;

		const connect = () => {
			const wsUrl = `${BACKEND_SERVER.replace("http", "ws")}/ws/head`;

			ws = new WebSocket(wsUrl);

			ws.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					console.log("[HEAD FRONTEND]", data);
					const command = data?.command || data?.cmd;
					setHeadDebug({
						direction: command || "NONE",
						confidence: data?.confidence ?? 0,
						...(data?.debug || {}),
					});
					inputManagerRef.current?.handleHead(
						{
							command,
							confidence: data?.confidence,
							timestamp: data?.timestamp,
							debug: data?.debug,
						},
						configRef.current
					);
				} catch {
					// ignore malformed frame
				}
			};

			ws.onclose = () => {
				if (modeRef.current === "head") {
					reconnectTimer = setTimeout(connect, 2000);
				}
			};
		};

		connect();

		return () => {
			if (reconnectTimer) clearTimeout(reconnectTimer);
			if (ws) ws.close();
		};
	}, [mode]);

	const updateSensorSettings = useCallback((newSettings) => {
		setSensorSettings(newSettings);
		if (window.location.hostname !== "localhost") {
			fetch(`${HEAD_SERVER}/settings`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(newSettings),
			}).catch(() => {
				// ignore update errors
			});
		}
	}, []);

	return (
		<InputControlContext.Provider
			value={{
				mode,
				setControlMode,
				enabled,
				register,
				unregister,
				dispatch,
				holdDuration,
				setHoldDuration,
				sensorSettings,
				updateSensorSettings,
				eyeReady,
				eyeCentered,
				eyeTracking,
				eyeDebug,
				headDebug,
				recenterEyes,
				setYBias,
				setCenterBuffer,
				setCommandDelay,
				eyeHoldRepeatEnabled,
				setEyeHoldRepeatEnabled,
				eyeHoldRepeatDelay,
				setEyeHoldRepeatDelay,
				cnnReady,
				gazeLabel,
				cnnDebug,
				centerSelectMinConfidence,
				setCenterSelectMinConfidence,
				centerSelectNoiseDelta,
				setCenterSelectNoiseDelta,
			}}
		>
			{children}
		</InputControlContext.Provider>
	);
}

export const useInputControl = () => useContext(InputControlContext);

export const useHeadControl = () => {
	const ctx = useContext(InputControlContext);
	return {
		enabled: ctx.enabled,
		register: ctx.register,
		unregister: ctx.unregister,
		toggle: () => ctx.setControlMode(ctx.mode === "off" ? "head" : "off"),
		holdDuration: ctx.holdDuration,
		setHoldDuration: ctx.setHoldDuration,
		sensorSettings: ctx.sensorSettings,
		updateSensorSettings: ctx.updateSensorSettings,
	};
};
