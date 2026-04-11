export const KEY_DWELL_MS  = "voxen_dwell_ms";
export const KEY_NEUTRAL_MS = "voxen_neutral_ms";
const LEGACY_KEY_CLOSED_MS = "voxen_closed_ms";

export const DEFAULTS = {
  dwellMs:  1500,
  neutralMs: 1500,
};

export function getDwellMs() {
  const v = parseInt(localStorage.getItem(KEY_DWELL_MS));
  return isNaN(v) ? DEFAULTS.dwellMs : v;
}

export function getNeutralMs() {
  const raw = localStorage.getItem(KEY_NEUTRAL_MS) ?? localStorage.getItem(LEGACY_KEY_CLOSED_MS);
  const v = parseInt(raw);
  return isNaN(v) ? DEFAULTS.neutralMs : v;
}

export function saveSettings({ dwellMs, neutralMs }) {
  if (dwellMs  !== undefined) localStorage.setItem(KEY_DWELL_MS,  String(dwellMs));
  if (neutralMs !== undefined) localStorage.setItem(KEY_NEUTRAL_MS, String(neutralMs));
}
