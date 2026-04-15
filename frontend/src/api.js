const API = "http://localhost:8000";

function mapNetworkError(err) {
  if (err instanceof TypeError) {
    return new Error("Cannot reach backend at http://localhost:8000. Start the API server and try again.");
  }
  return err;
}

export async function apiGet(path) {
  let res;
  try {
    res = await fetch(`${API}${path}`);
  } catch (err) {
    throw mapNetworkError(err);
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Request failed");
  return data;
}

export async function apiPost(path, body) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
  } catch (err) {
    throw mapNetworkError(err);
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Request failed");
  return data;
}

export function createSuggestSocket() {
  return new WebSocket(`ws://localhost:8000/ws/suggest`);
}
