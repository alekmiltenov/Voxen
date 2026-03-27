// Keys
export const KEY_DWELL_MS       = "voxen_dwell_ms";
export const KEY_GAZE_STABILITY = "voxen_gaze_stability"; // frames before mouseleave fires

export const DEFAULTS = {
  dwellMs:       1500,
  gazeStability: 4,   // frames gaze can wander off a button before dwell resets
};

export function getDwellMs() {
  const v = parseInt(localStorage.getItem(KEY_DWELL_MS));
  return isNaN(v) ? DEFAULTS.dwellMs : v;
}

export function getGazeStability() {
  const v = parseInt(localStorage.getItem(KEY_GAZE_STABILITY));
  return isNaN(v) ? DEFAULTS.gazeStability : v;
}

export function saveSettings({ dwellMs, gazeStability }) {
  localStorage.setItem(KEY_DWELL_MS,       String(dwellMs));
  localStorage.setItem(KEY_GAZE_STABILITY, String(gazeStability));
}
