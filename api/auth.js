/* =========================================================
 * Bean login — same Bean ID as accounts.signaturesi.com
 * Tables: bean_users, bean_credentials (argon2), bean_sessions
 *
 * POST /api/auth {action:"login",    username, password}
 * POST /api/auth {action:"register", username, password}
 * POST /api/auth {action:"check",    username}           -> { available }
 * ========================================================= */
import crypto from "node:crypto";
import argon2 from "argon2";
import { supabase, send, readBody, hashToken, sessionCookie, cleanUsername, publicUser, getAvatars, HttpError, rateLimit, clientIp, sameOrigin } from "./_lib/session.js";

const SESSION_DAYS = 7;
const USERNAME_OK = /^[a-z0-9_]{3,20}$/;
const MIN_PASSWORD = 10; // same rule as accounts.signaturesi.com
const BAD_LOGIN = "Invalid Bean ID or password";

async function startSession(req, res, user) {
  const raw = crypto.randomBytes(32).toString("base64url");
  const { error } = await supabase.from("bean_sessions").insert({
    user_id: user.id,
    token_hash: hashToken(raw),
    expires_at: new Date(Date.now() + SESSION_DAYS * 864e5).toISOString(),
    user_agent: String(req.headers["user-agent"] || "").slice(0, 500),
  });
  if (error) throw error;
  res.setHeader("Set-Cookie", sessionCookie(req, raw, SESSION_DAYS * 86400));
}

let dummyHash = null;
async function fakeVerify(password) {
  try {
    dummyHash ||= await argon2.hash("bean-dummy-password-for-timing", { type: argon2.argon2id });
    await argon2.verify(dummyHash, password || "x");
  } catch {}
}

async function findUser(username) {
  const { data, error } = await supabase
    .from("bean_users")
    .select("id, username, display_name, status")
    .eq("username", username)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Method not allowed" });
  }

  const body = readBody(req);
  const username = cleanUsername(body.username);
  const password = String(body.password || "");
  const ip = clientIp(req);

  try {
    if (!sameOrigin(req)) return send(res, 403, { error: "Blocked: request did not come from Bean" });
    switch (body.action) {
      case "check": {
        await rateLimit(`check:${ip}`, 120, 600);
        if (!USERNAME_OK.test(username)) return send(res, 200, { available: false, reason: "3–20 letters, numbers or _" });
        const user = await findUser(username);
        return send(res, 200, { available: !user, reason: user ? "This Bean ID is taken" : null });
      }

      case "login": {
        // brute-force guard: per IP and per Bean ID
        await rateLimit(`login-ip:${ip}`, 40, 900);
        if (!USERNAME_OK.test(username) || !password || password.length > 200) return send(res, 401, { error: BAD_LOGIN });
        await rateLimit(`login-user:${username}`, 10, 900);
        const user = await findUser(username);
        if (!user || user.status !== "active") {
          await fakeVerify(password); // same timing as a real check: no Bean ID guessing by speed
          return send(res, 401, { error: BAD_LOGIN });
        }

        const { data: cred, error } = await supabase
          .from("bean_credentials")
          .select("password_hash")
          .eq("user_id", user.id)
          .maybeSingle();
        if (error) throw error;
        let ok = false;
        try {
          ok = !!cred?.password_hash && (await argon2.verify(cred.password_hash, password));
        } catch (e) {
          console.error("Bean auth: password hash not verifiable (non-argon2?)", user.id, e.message);
        }
        if (!ok) return send(res, 401, { error: BAD_LOGIN });

        await startSession(req, res, user);
        const avatars = await getAvatars([user.id]);
        return send(res, 200, { success: true, user: publicUser(user, null, avatars.get(user.id)) });
      }

      case "register": {
        await rateLimit(`register:${ip}`, 6, 3600);
        if (!USERNAME_OK.test(username)) return send(res, 400, { error: "Bean ID must be 3–20 letters, numbers or _" });
        if (username === "neyo" || /^(admin|support|security|bean|signaturesi)$/.test(username)) return send(res, 409, { error: "This Bean ID is taken" });
        if (password.length < MIN_PASSWORD || password.length > 100) return send(res, 400, { error: `Password must be at least ${MIN_PASSWORD} characters` });
        if (await findUser(username)) return send(res, 409, { error: "This Bean ID is taken" });

        const { data: user, error } = await supabase
          .from("bean_users")
          .insert({ id: crypto.randomUUID(), username, display_name: username, email: null, status: "active" })
          .select("id, username, display_name, status")
          .single();
        if (error) throw error;

        const password_hash = await argon2.hash(password, { type: argon2.argon2id });
        const { error: credError } = await supabase.from("bean_credentials").insert({ user_id: user.id, password_hash });
        if (credError) {
          await supabase.from("bean_users").delete().eq("id", user.id);
          throw credError;
        }

        await startSession(req, res, user);
        return send(res, 201, { success: true, user: publicUser(user) });
      }

      default:
        return send(res, 400, { error: "Unknown action" });
    }
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.message });
    console.error("Bean auth error:", err);
    return send(res, 500, { error: "Something went wrong. Please try again.", detail: [err?.message, err?.details, err?.hint].filter(Boolean).join(" | ") || undefined, code: err?.code });
  }
}
