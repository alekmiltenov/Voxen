const API = "http://localhost:8000";

export const getToken    = ()  => localStorage.getItem("voxen_token");
export const setToken    = (t) => localStorage.setItem("voxen_token", t);
export const removeToken = ()  => localStorage.removeItem("voxen_token");
export const isLoggedIn  = ()  => !!getToken();

export async function apiPost(path, body) {
  const res  = await fetch(`${API}${path}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Request failed");
  return data;
}

export async function apiGet(path) {
  const res  = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Request failed");
  return data;
}

export async function apiPatch(path, body) {
  const res  = await fetch(`${API}${path}`, {
    method:  "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Request failed");
  return data;
}

export async function authPost(path, body) {
  const res  = await fetch(`${API}${path}`, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Request failed");
  return data;
}

// Returns a WebSocket already connected with auth token in query param
export function createSuggestSocket() {
  return new WebSocket(`ws://localhost:8000/ws/suggest?token=${getToken()}`);
}
