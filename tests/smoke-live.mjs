// Live smoke test of a real Bean deployment (real-user flow, no browser).
// Usage: BEAN_URL=https://bean.signaturesi.com BEAN_USER=harktest01 BEAN_PASS=... BEAN_PEER=leo2233 node tests/smoke-live.mjs
const URL_ = (process.env.BEAN_URL || "https://bean.signaturesi.com").replace(/\/$/, "");
const USER = process.env.BEAN_USER, PASS = process.env.BEAN_PASS, PEER = process.env.BEAN_PEER;
if (!USER || !PASS) { console.error("Set BEAN_USER and BEAN_PASS"); process.exit(2); }
let cookie = "", pass = 0, fail = 0;
const ok = (c, l, extra = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"} ${l}${extra ? "  " + extra : ""}`); };
async function api(path, { method = "GET", body, origin = URL_ } = {}) {
  const t0 = Date.now();
  const r = await fetch(URL_ + path, {
    method,
    headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const sc = r.headers.get("set-cookie");
  if (sc && /bean_session=([^;]*)/.test(sc)) cookie = `bean_session=${sc.match(/bean_session=([^;]*)/)[1]}`;
  let json = null;
  try { json = await r.json(); } catch {}
  return { status: r.status, json, ms: Date.now() - t0, headers: r.headers };
}

const page = await fetch(URL_ + "/");
ok(page.status === 200, "login page loads");
ok(/default-src 'self'/.test(page.headers.get("content-security-policy") || ""), "CSP header");
ok(/max-age/.test(page.headers.get("strict-transport-security") || ""), "HSTS header");

let r = await api("/api/me?health=1");
ok(r.status === 200 && r.json?.database === "ok", "health: database", `${r.json?.dbMs ?? "?"}ms, version ${r.json?.version ?? "old build"}, neyo ${r.json?.neyo ?? "?"}`);

r = await api("/api/auth", { method: "POST", body: { action: "login", username: USER, password: PASS }, origin: "https://evil.example" });
ok(r.status === 403, "login from another website blocked");
r = await api("/api/auth", { method: "POST", body: { action: "login", username: USER, password: PASS } });
ok(r.status === 200 && cookie, "login", `${r.ms}ms`);
r = await api("/api/me");
ok(r.json?.authenticated, "session works", `build ${r.json?.build?.version} ${r.json?.build?.commit || ""}`);

r = await api("/api/users?q=" + encodeURIComponent((PEER || "leo").slice(0, 3)));
ok(r.status === 200, "search users", `${r.ms}ms`);

if (PEER) {
  r = await api("/api/conversations", { method: "POST", body: { action: "open_dm", username: PEER } });
  const cid = r.json?.conversation?.id;
  ok(r.status === 200 && cid, "open DM with " + PEER, `${r.ms}ms`);
  if (cid) {
    const text = `smoke test ${new Date().toISOString()}`;
    r = await api("/api/messages", { method: "POST", body: { action: "send", conversationId: cid, text } });
    const mid = r.json?.message?.id;
    ok(r.status === 200 && mid, "send message", `${r.ms}ms`);
    r = await api(`/api/sync?active=${cid}&lists=1`);
    ok(r.status === 200 && (r.json?.active?.messages || []).some((m) => m.id === mid), "sync sees it", `${r.ms}ms`);
    r = await api("/api/messages", { method: "POST", body: { action: "react", messageId: mid, emoji: "👍" } });
    ok(r.status === 200, "react");
    r = await api("/api/messages", { method: "POST", body: { action: "edit", messageId: mid, text: text + " (edited)" } });
    ok(r.status === 200, "edit");
    r = await api("/api/upload", { method: "POST", body: { conversationId: cid, name: "smoke.txt", size: 5, mime: "text/plain" } });
    ok(r.status === 200 && r.json?.signedUrl, "upload URL");
    r = await api("/api/messages", { method: "POST", body: { action: "delete", messageId: mid } });
    ok(r.status === 200, "delete (cleanup)");
  }
}
r = await api("/api/me", { method: "POST", body: { action: "sessions" } });
ok(r.status === 200 && Array.isArray(r.json?.sessions), "device list");
r = await api("/api/me", { method: "POST", body: { action: "logout" } });
ok(r.status === 200, "logout");
r = await api("/api/me");
ok(r.json?.authenticated === false, "signed out after logout");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
