export const KEY_DWELL_MS = "voxen_dwell_ms";

export const DEFAULTS = {
  dwellMs: 1500,
};

export function getDwellMs() {
  const v = parseInt(localStorage.getItem(KEY_DWELL_MS));
  return isNaN(v) ? DEFAULTS.dwellMs : v;
}

export function saveSettings({ dwellMs }) {
  localStorage.setItem(KEY_DWELL_MS, String(dwellMs));
}
