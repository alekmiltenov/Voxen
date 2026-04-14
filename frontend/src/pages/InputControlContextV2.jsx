import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import InputManager from "../input/manager/InputManager";
import { useEyeTracking } from "../input/eyes/useEyeTracking";
import { DIRECTIONS, normalizeDirectionLabel } from "../input/shared/timingUtils";

const BACKEND_SERVER = "http://localhost:8000";
const HEAD_SERVER = BACKEND_SERVER;
const CONTROL_CONFIG_DEFAULTS_KEY = "controlConfigDefaults";

const DEFAULT_CONTROL_CONFIG = {
	eyes: {
		selectionMethod: "right",
		selectionDwell: 650,
			commandDelay: 120,
		repeatEnabled: false,
		repeatDelay: 180,
		debounceMs: 200,
		minStableFrames: 2,
		directionDebounceMs: 80,
		center: { x: 0, y: 0 },
		yBias: 0,
		centerBuffer: 0.05,
	},
	cnn: {
		cnnMinConfidence: 0.45,
		stableFrames: 4,
		commandDelay: 120,
		selectionMethod: "DOWN",
		selectionDwell: 650,
		selectionReleaseMin: 80,
		repeatEnabled: false,
		repeatDelay: 180,
		centerSelectEnabled: false,
		centerSelectMinConfidence: 0.85,
		debounceMs: 200,
		minStableFrames: 2,
		directionDebounceMs: 80,
	},
	head: {
		selectionMethod: "RIGHT",
		selectionDwell: 650,
		selectionReleaseMin: 80,
		commandDelay: 120,
		repeatEnabled: false,
		repeatDelay: 180,
		debounceMs: 200,
		minStableFrames: 2,
		directionDebounceMs: 80,
		sensitivity: 0.35,
		smoothing: 0.5,
		deadzone: 0.1,
	},
};

const InputControlContext = createContext(null);

const isPlainObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);
const normalizeHeadSelectionMethod = (value, fallback = "RIGHT") => {
	const normalized = normalizeDirectionLabel(value);
	if (normalized) return normalized;
	return fallback;
};

const getSavedControlConfigDefaults = () => {
	try {
		const savedDefaults = localStorage.getItem(CONTROL_CONFIG_DEFAULTS_KEY);
		if (!savedDefaults) return null;
		const parsed = JSON.parse(savedDefaults);
		return isPlainObject(parsed) ? parsed : null;
	} catch {
		return null;
	}
};

const mergeControlConfig = (defaults, saved) => ({
	...defaults,
	eyes: {
		...defaults.eyes,
		...(isPlainObject(saved?.eyes) ? saved.eyes : {}),
	},
	cnn: {
		...defaults.cnn,
		...(isPlainObject(saved?.cnn) ? saved.cnn : {}),
	},
	head: {
		...defaults.head,
		...(isPlainObject(saved?.head) ? saved.head : {}),
		selectionMethod: normalizeHeadSelectionMethod(
			saved?.head?.selectionMethod,
			defaults.head.selectionMethod
		),
	},
});

export function InputControlProvider({ children }) {
	const [mode, setMode] = useState(() => {
		try {
			return localStorage.getItem("controlMode") || "off";
		} catch {
			return "off";
		}
	});

	const enabled = mode !== "off";

	const [sensorSettings, setSensorSettings] = useState({
		alpha: 0.5,
		threshold: 0.35,
		deadzone: 0.1,
	});

	const [eyeDebug, setEyeDebug] = useState(null);
	const [headDebug, setHeadDebug] = useState(null);
	const [showRecenterOverlay, setShowRecenterOverlay] = useState(false);
	const [showEyeCenterOverlay, setShowEyeCenterOverlay] = useState(false);

	const [cnnReady, setCnnReady] = useState(false);
	const [gazeLabel, setGazeLabel] = useState("—");
	const [cnnDebug, setCnnDebug] = useState(null);
	const [controlConfig, setControlConfig] = useState(() => {
		const savedDefaults = getSavedControlConfigDefaults();
		const defaults = mergeControlConfig(DEFAULT_CONTROL_CONFIG, savedDefaults);
		try {
			const saved = localStorage.getItem("controlConfig");
			if (!saved) return defaults;
			return mergeControlConfig(defaults, JSON.parse(saved));
		} catch {
			return defaults;
		}
	});

	const stableHeadConfig = useMemo(() => controlConfig.head, [controlConfig.head]);

	const modeRef = useRef(mode);
	const handlerRef = useRef(null);
	const autoCenterDoneRef = useRef(false);
	const recenterOverlayTimerRef = useRef(null);
	const eyeCenterOverlayHideTimerRef = useRef(null);

	const centerRef = useRef(controlConfig.eyes.center || { x: 0, y: 0 });
	const eyesConfigRef = useRef(controlConfig.eyes);
	const cnnConfigRef = useRef(controlConfig.cnn);
	const headConfigRef = useRef(stableHeadConfig);

	const dispatch = useCallback((cmd) => {
		if (modeRef.current === "off") return;
		if (!cmd || typeof handlerRef.current !== "function") return;
		handlerRef.current(cmd);
	}, []);

	const inputManagerRef = useRef(null);
	if (!inputManagerRef.current) {
		inputManagerRef.current = new InputManager(dispatch, modeRef.current);
	}

	const updateEyesConfig = useCallback((partial) => {
		setControlConfig((prev) => ({
			...prev,
			eyes: {
				...prev.eyes,
				...partial,
			},
		}));
	}, []);

	const updateCnnConfig = useCallback((partial) => {
		setControlConfig((prev) => ({
			...prev,
			cnn: {
				...prev.cnn,
				...partial,
			},
		}));
	}, []);

	const updateHeadConfig = useCallback((partial) => {
		setControlConfig((prev) => ({
			...prev,
			head: {
				...prev.head,
				...partial,
				selectionMethod: normalizeHeadSelectionMethod(
					partial?.selectionMethod ?? prev.head.selectionMethod
				),
			},
		}));
	}, []);

	const saveAsDefault = useCallback((section) => {
		if (!["eyes", "head", "cnn"].includes(section)) return;

		const current = controlConfig[section];

		try {
			const existing = JSON.parse(localStorage.getItem(CONTROL_CONFIG_DEFAULTS_KEY)) || {};
			const updated = {
				...existing,
				[section]: current,
			};

			localStorage.setItem(CONTROL_CONFIG_DEFAULTS_KEY, JSON.stringify(updated));
		} catch {
			// ignore storage errors
		}

		console.log("[DEFAULT SAVED]", section, current);

		setControlConfig((prev) => ({
			...prev,
			[section]: current,
		}));
	}, [controlConfig]);

	const resetToDefault = useCallback((section) => {
		if (!["eyes", "head", "cnn"].includes(section)) return;

		let saved = {};
		try {
			saved = JSON.parse(localStorage.getItem(CONTROL_CONFIG_DEFAULTS_KEY)) || {};
		} catch {
			saved = {};
		}

		const hasUserDefault = isPlainObject(saved?.[section]);
		const next = hasUserDefault
			? saved[section]
			: DEFAULT_CONTROL_CONFIG[section];

		setControlConfig((prev) => ({
			...prev,
			[section]: next,
		}));

		console.log("[RESET]", section, next);
	}, []);

	useEffect(() => {
		modeRef.current = mode;
		inputManagerRef.current?.setMode(mode);
		try {
			localStorage.setItem("controlMode", mode);
		} catch {
			// ignore storage errors
		}
	}, [mode]);

	useEffect(() => {
		const id = setTimeout(() => {
			try {
				localStorage.setItem("controlConfig", JSON.stringify(controlConfig));
			} catch {
				// ignore storage errors
			}
		}, 200);

		return () => clearTimeout(id);
	}, [controlConfig]);

	useEffect(() => {
		eyesConfigRef.current = controlConfig.eyes;
		centerRef.current = controlConfig.eyes.center || centerRef.current;
	}, [controlConfig.eyes]);

	useEffect(() => {
		cnnConfigRef.current = controlConfig.cnn;
	}, [controlConfig.cnn]);

	useEffect(() => {
		headConfigRef.current = stableHeadConfig;
	}, [stableHeadConfig]);

	const register = useCallback((fn) => {
		handlerRef.current = fn;
	}, []);

	const unregister = useCallback(() => {
		handlerRef.current = null;
	}, []);

	useEffect(() => {
		return () => {
			if (recenterOverlayTimerRef.current) {
				clearTimeout(recenterOverlayTimerRef.current);
				recenterOverlayTimerRef.current = null;
			}
			if (eyeCenterOverlayHideTimerRef.current) {
				clearTimeout(eyeCenterOverlayHideTimerRef.current);
				eyeCenterOverlayHideTimerRef.current = null;
			}
		};
	}, []);

	useEffect(() => {
		if (mode === "eyes") {
			setShowEyeCenterOverlay(true);
		} else {
			setShowEyeCenterOverlay(false);
			if (eyeCenterOverlayHideTimerRef.current) {
				clearTimeout(eyeCenterOverlayHideTimerRef.current);
				eyeCenterOverlayHideTimerRef.current = null;
			}
		}
	}, [mode]);

	const setControlMode = useCallback((newMode) => {
		setMode(newMode);
	}, []);

	const setYBias = useCallback((value) => {
		const next = Number(value) || 0;
		updateEyesConfig({ yBias: next });
		try {
			localStorage.setItem("eyeYBias", String(next));
		} catch {
			// ignore storage errors
		}
	}, [updateEyesConfig]);

	const setCenterBuffer = useCallback((value) => {
		const next = Number(value) || 0;
		updateEyesConfig({ centerBuffer: next });
		try {
			localStorage.setItem("centerBuffer", String(next));
		} catch {
			// ignore storage errors
		}
	}, [updateEyesConfig]);

	const setCommandDelay = useCallback((value) => {
		const next = Number(value) || 0;
		updateEyesConfig({ commandDelay: next });
		try {
			localStorage.setItem("eyeCommandDelay", String(next));
		} catch {
			// ignore storage errors
		}
	}, [updateEyesConfig]);

	const setEyeHoldRepeatEnabled = useCallback((enabledValue) => {
		const next = !!enabledValue;
		updateEyesConfig({ repeatEnabled: next });
		try {
			localStorage.setItem("eyeHoldRepeatEnabled", next ? "1" : "0");
		} catch {
			// ignore storage errors
		}
	}, [updateEyesConfig]);

	const setEyeHoldRepeatDelay = useCallback((value) => {
		const next = Number(value) || 180;
		updateEyesConfig({ repeatDelay: next });
		try {
			localStorage.setItem("eyeHoldRepeatDelay", String(next));
		} catch {
			// ignore storage errors
		}
	}, [updateEyesConfig]);

	const setCenterSelectMinConfidence = useCallback((value) => {
		const next = Math.max(0.55, Math.min(0.99, Number(value) || 0.85));
		updateCnnConfig({ centerSelectMinConfidence: next });
		try {
			localStorage.setItem("cnnCenterSelectMinConfidence", String(next));
		} catch {
			// ignore storage errors
		}
	}, [updateCnnConfig]);

		const handleAutoCenterCompleted = useCallback(() => {
			if (eyeCenterOverlayHideTimerRef.current) {
				clearTimeout(eyeCenterOverlayHideTimerRef.current);
			}
			eyeCenterOverlayHideTimerRef.current = setTimeout(() => {
				setShowEyeCenterOverlay(false);
				eyeCenterOverlayHideTimerRef.current = null;
			}, 300);
		}, []);

	const { eyeReady, eyeCentered, eyeTracking, recenterEyes: recenterEyesBase } = useEyeTracking({
		mode,
		inputManagerRef,
		eyesConfigRef,
		updateEyesConfig,
		setEyeDebug,
		centerRef,
		autoCenterDoneRef,
			onAutoCenterCompleted: handleAutoCenterCompleted,
	});

		useEffect(() => {
			if (mode === "eyes" && autoCenterDoneRef.current) {
				setShowEyeCenterOverlay(false);
			}
		}, [mode, eyeCentered]);

	const recenterEyes = useCallback(() => {
		recenterEyesBase();
		setShowRecenterOverlay(true);
		if (recenterOverlayTimerRef.current) {
			clearTimeout(recenterOverlayTimerRef.current);
		}
		recenterOverlayTimerRef.current = setTimeout(() => {
			setShowRecenterOverlay(false);
			recenterOverlayTimerRef.current = null;
		}, 1500);
	}, [recenterEyesBase]);

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
					const cnnConfig = cnnConfigRef.current;
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
						cnnConfig
					);
					const processorDebug = result?.debug || {};
					const fallbackSelectionMethod = String(cnnConfig?.selectionMethod || "RIGHT").toUpperCase();

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
						selectionDwell: Math.max(0, Number(processorDebug.selectionDwell || cnnConfig?.selectionDwell || 0)),
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

		fetch(`${HEAD_SERVER}/head/settings`)
			.then((response) => response.json())
			.then((settings) => {
				setSensorSettings({
					alpha: settings.alpha ?? 0.5,
					threshold: settings.threshold ?? 0.35,
					deadzone: settings.deadzone ?? 0.1,
				});
			})
			.catch(() => {
				// keep defaults
			});

		let ws;
		let reconnectTimer;

		const connect = () => {
			const wsUrl = `${BACKEND_SERVER.replace("http", "ws")}/ws/head`;

			ws = new WebSocket(wsUrl);

			ws.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					console.log("[HEAD FRONTEND]", data);

					// MODE CHECK
					console.log("MODE:", modeRef.current);
console.log("[HEAD RAW FULL]", data);
					const commandRaw = data?.command || data?.cmd;
					const command =
						typeof commandRaw === "string"
							? commandRaw.toUpperCase()
							: "CENTER";

					// RAW debug log before processor
					console.log("[HEAD RAW]", command);

					const result = inputManagerRef.current?.handleHead(
						{
							command,
							confidence: data?.confidence,
							timestamp: data?.timestamp,
							debug: data?.debug,
						},
						headConfigRef.current
					);

					// Processor debug log after processing
					console.log("[HEAD PROCESSED]", result?.command || "NONE");

					setHeadDebug({
						rawCommand: command,
						processedCommand: result?.command || "NONE",
						direction: result?.debug?.direction || command || "NONE",
						confidence: data?.confidence ?? 0,
						...(result?.debug || {}),
					});
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
		fetch(`${HEAD_SERVER}/head/settings`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(newSettings),
		}).catch(() => {
			// ignore update errors
		});
	}, []);

	return (
		<InputControlContext.Provider
			value={{
				mode,
				setControlMode,
				enabled,
				controlConfig,
				updateEyesConfig,
				updateCnnConfig,
				updateHeadConfig,
				saveAsDefault,
				resetToDefault,
				register,
				unregister,
				dispatch,
				sensorSettings,
				updateSensorSettings,
				eyeReady,
				eyeCentered,
				eyeTracking,
				eyeDebug,
				headDebug,
				recenterEyes,
				showRecenterOverlay,
				showEyeCenterOverlay,
				setYBias,
				setCenterBuffer,
				setCommandDelay,
				eyeHoldRepeatEnabled: !!controlConfig.eyes.repeatEnabled,
				setEyeHoldRepeatEnabled,
				eyeHoldRepeatDelay: Number(controlConfig.eyes.repeatDelay || 0),
				setEyeHoldRepeatDelay,
				cnnReady,
				gazeLabel,
				cnnDebug,
				centerSelectMinConfidence: Number(controlConfig.cnn.centerSelectMinConfidence || 0),
				setCenterSelectMinConfidence,
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
		sensorSettings: ctx.sensorSettings,
		updateSensorSettings: ctx.updateSensorSettings,
	};
};
