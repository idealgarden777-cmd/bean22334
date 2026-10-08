/* Thin client for Bean's own /api routes (same origin, cookie auth). */
async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const type = res.headers.get("content-type") || "";
  if (!type.includes("application/json")) {
    const err = new Error("API not available");
    err.code = "NO_API";
    throw err;
  }

  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || "Request failed");
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  me: () => request("/api/me"),
  logout: () => request("/api/logout", { method: "POST" }),
  searchUsers: (q) => request(`/api/users?q=${encodeURIComponent(q)}`),
  conversations: () => request("/api/conversations"),
  openConversation: (username) =>
    request("/api/conversations", { method: "POST", body: { username } }),
  messages: (conversationId, after) =>
    request(
      `/api/messages?conversationId=${encodeURIComponent(conversationId)}` +
        (after ? `&after=${encodeURIComponent(after)}` : "")
    ),
  sendMessage: (conversationId, text) =>
    request("/api/messages", { method: "POST", body: { conversationId, text } }),
};

export const ACCOUNTS_URL = "https://accounts.signaturesi.com";
