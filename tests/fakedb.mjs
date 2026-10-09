// In-memory stand-in for the Supabase client (enough of PostgREST for Bean's handlers).
import crypto from "node:crypto";

export const db = {};
const UNIQUE = {
  bean_users: [["id"], ["username"]],
  bean_settings: [["user_id"]],
  bean_presence: [["user_id"]],
  bean_keys: [["user_id"]],
  bean_chat_keys: [["conversation_id", "epoch", "user_id"]],
  bean_conversations: [["id"], ["dm_key"]],
  bean_conversation_members: [["conversation_id", "user_id"]],
  bean_reactions: [["message_id", "user_id"]],
  bean_neyo_jobs: [["message_id"]],
  bean_ghost_log: [["message_id"]],
  bean_rate_limits: [["key"]],
};
const DEFAULTS = {
  bean_messages: () => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null, edited_at: null, expires_at: null, enc: null, ghost: false }),
  bean_conversations: () => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  bean_conversation_members: () => ({ joined_at: new Date().toISOString(), last_read_at: new Date(0).toISOString(), muted: false }),
  bean_sessions: () => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), revoked_at: null }),
  bean_chat_keys: () => ({ id: Math.floor(Math.random() * 1e9), created_at: new Date().toISOString() }),
  bean_ghost_tasks: () => ({ id: crypto.randomUUID(), status: "active", created_at: new Date().toISOString() }),
  bean_calls: () => ({ id: crypto.randomUUID(), status: "ringing", created_at: new Date().toISOString() }),
  bean_call_signals: () => ({ id: Math.floor(Math.random() * 1e9) }),
};
let sigId = 1;

const table = (t) => (db[t] ||= []);
const cmp = (a, b) => (a === b ? 0 : a === null || a === undefined ? -1 : b === null || b === undefined ? 1 : a < b ? -1 : 1);

function builder(t) {
  let op = "select";
  let payload = null;
  let opts = {};
  let returning = false;
  const filters = [];
  let order = null;
  let lim = null;
  const api = {
    select() { if (op !== "select") returning = true; return api; },
    insert(p) { op = "insert"; payload = p; return api; },
    update(p) { op = "update"; payload = p; return api; },
    upsert(p, o = {}) { op = "upsert"; payload = p; opts = o; return api; },
    delete() { op = "delete"; return api; },
    eq(k, v) { filters.push((r) => r[k] === v); return api; },
    neq(k, v) { filters.push((r) => r[k] !== v); return api; },
    in(k, v) { filters.push((r) => v.includes(r[k])); return api; },
    is(k, v) { filters.push((r) => (v === null ? r[k] === null || r[k] === undefined : r[k] === v)); return api; },
    not(k, o, v) { if (o === "is" && v === null) filters.push((r) => r[k] !== null && r[k] !== undefined); return api; },
    lt(k, v) { filters.push((r) => r[k] !== null && r[k] !== undefined && r[k] < v); return api; },
    lte(k, v) { filters.push((r) => r[k] !== null && r[k] !== undefined && r[k] <= v); return api; },
    gt(k, v) { filters.push((r) => r[k] !== null && r[k] !== undefined && r[k] > v); return api; },
    gte(k, v) { filters.push((r) => r[k] !== null && r[k] !== undefined && r[k] >= v); return api; },
    or(expr) {
      const m = String(expr).match(/^expires_at\.is\.null,expires_at\.gt\.(.+)$/);
      if (m) filters.push((r) => !r.expires_at || r.expires_at > m[1]);
      return api;
    },
    order(k, o = {}) { order = [k, o.ascending !== false]; return api; },
    limit(n) { lim = n; return api; },
    run() {
      const rows = table(t);
      const match = rows.filter((r) => filters.every((f) => f(r)));
      const uniqueHit = (r) => (UNIQUE[t] || []).some((keys) => rows.some((x) => x !== r && keys.every((k) => x[k] !== undefined && x[k] === r[k])));
      if (op === "insert") {
        const list = (Array.isArray(payload) ? payload : [payload]).map((p) => ({ ...(DEFAULTS[t]?.() || {}), ...p }));
        if (t === "bean_call_signals") list.forEach((r) => (r.id = sigId++));
        for (const r of list) if (uniqueHit(r) || list.some((x) => x !== r && (UNIQUE[t] || []).some((keys) => keys.every((k) => x[k] === r[k])))) return { data: null, error: { code: "23505", message: "duplicate" } };
        rows.push(...list);
        return { data: Array.isArray(payload) ? list : list[0], error: null };
      }
      if (op === "update") {
        match.forEach((r) => Object.assign(r, payload));
        return { data: returning ? match : null, error: null };
      }
      if (op === "upsert") {
        const keys = (opts.onConflict || "id").split(",");
        const list = Array.isArray(payload) ? payload : [payload];
        const out = [];
        for (const p of list) {
          const ex = rows.find((r) => keys.every((k) => r[k] === p[k]));
          if (ex) { if (!opts.ignoreDuplicates) Object.assign(ex, p); out.push(ex); }
          else { const r = { ...(DEFAULTS[t]?.() || {}), ...p }; rows.push(r); out.push(r); }
        }
        return { data: Array.isArray(payload) ? out : out[0], error: null };
      }
      if (op === "delete") {
        db[t] = rows.filter((r) => !match.includes(r));
        return { data: null, error: null };
      }
      let out = [...match];
      if (order) out.sort((a, b) => cmp(a[order[0]], b[order[0]]) * (order[1] ? 1 : -1));
      if (lim !== null) out = out.slice(0, lim);
      return { data: out, error: null };
    },
    maybeSingle() {
      const r = api.run();
      if (r.error) return Promise.resolve(r);
      return Promise.resolve({ data: Array.isArray(r.data) ? r.data[0] || null : r.data, error: null });
    },
    single() {
      return api.maybeSingle().then((r) => (r.error || r.data ? r : { data: null, error: { code: "PGRST116", message: "no rows" } }));
    },
    then(res, rej) { return Promise.resolve(api.run()).then(res, rej); },
  };
  return api;
}

export const limits = { off: false };
async function rpc(name, args) {
  if (name === "bean_rate_hit") {
    if (limits.off) return { data: true, error: null };
    const rows = table("bean_rate_limits");
    let r = rows.find((x) => x.key === args.p_key);
    const now = Date.now();
    if (!r) rows.push((r = { key: args.p_key, start: now, hits: 0 }));
    if (now - r.start > args.p_window * 1000) Object.assign(r, { start: now, hits: 0 });
    r.hits++;
    return { data: r.hits <= args.p_max, error: null };
  }
  if (name === "bean_unread_counts") return { data: [], error: null };
  return { data: null, error: { message: "no rpc" } };
}

export function install(supabase) {
  supabase.from = builder;
  supabase.rpc = rpc;
  supabase.storage = {
    from: () => ({
      createSignedUrls: async (paths) => ({ data: paths.map((p) => ({ path: p, signedUrl: `https://files.test/${p}` })) }),
      createSignedUploadUrl: async (p) => ({ data: { signedUrl: `https://files.test/up/${p}`, token: "t" } }),
      remove: async () => ({}),
    }),
  };
}

export function call(handler, { method = "POST", body = {}, cookie = "", host = "bean.signaturesi.com", query = {}, origin, ip = "1.2.3.4" } = {}) {
  return new Promise((resolve) => {
    const headers = {};
    const res = {
      setHeader: (k, v) => (headers[k.toLowerCase()] = v),
      status(code) { this.code = code; return this; },
      json(b) { resolve({ code: this.code, body: b, headers }); },
    };
    const reqHeaders = { host, cookie, "user-agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/130", "x-real-ip": ip };
    if (origin) reqHeaders.origin = origin;
    handler({ method, body, headers: reqHeaders, query }, res);
  });
}
