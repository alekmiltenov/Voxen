const API = "http://localhost:8000";

export async function apiGet(path) {
  const res  = await fetch(`${API}${path}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Request failed");
  return data;
}

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

export function createSuggestSocket() {
  return new WebSocket(`ws://localhost:8000/ws/suggest`);
}
