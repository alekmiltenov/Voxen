/**
 * Shared "selected / focused" visual style for eye/head-controlled elements.
 * Apply focusRing as a sibling overlay inside position:relative containers,
 * or merge focusBorder into the element's own border/shadow.
 */

export const focusRing = {
  position:      "absolute",
  inset:         -2,
  borderRadius:  "inherit",
  border:        "2px solid rgba(255,255,255,0.70)",
  boxShadow:     "0 0 0 3px rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.06)",
  pointerEvents: "none",
  zIndex:        1,
};

/** Merge into an element's inline style when it is selected. */
export const focusedStyle = {
  borderColor: "rgba(255,255,255,0.65)",
  background:  "rgba(255,255,255,0.07)",
  color:       "rgba(255,255,255,0.95)",
};

/** Neutral (unselected) border colour to pair with focusedStyle. */
export const unfocusedBorderColor = "rgba(255,255,255,0.10)";
