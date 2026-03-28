export const KEY_DWELL_MS  = "voxen_dwell_ms";
export const KEY_CLOSED_MS = "voxen_closed_ms";

export const DEFAULTS = {
  dwellMs:  1500,
  closedMs: 1500,
};

export function getDwellMs() {
  const v = parseInt(localStorage.getItem(KEY_DWELL_MS));
  return isNaN(v) ? DEFAULTS.dwellMs : v;
}

export function getClosedMs() {
  const v = parseInt(localStorage.getItem(KEY_CLOSED_MS));
  return isNaN(v) ? DEFAULTS.closedMs : v;
}

export function saveSettings({ dwellMs, closedMs }) {
  if (dwellMs  !== undefined) localStorage.setItem(KEY_DWELL_MS,  String(dwellMs));
  if (closedMs !== undefined) localStorage.setItem(KEY_CLOSED_MS, String(closedMs));
}
