import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/sora/500.css";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
/* =========================================================
 * Bean — login screen (bean.signaturesi.com)
 * Same layout as the original Bean: Username or @bean ID,
 * Password, "Enter Workspace", Sign Up toggle.
 * Signed in already? Straight to the Messenger.
 * ========================================================= */
import { api } from "../core/api.js";
import { debounce } from "../core/utils.js";
import "../core/theme.js";
import { INK_PATH } from "../components/logo.js";
import { initViewport } from "../core/mobile-viewport.js";
import { initBrandInk } from "../core/brand-ink.js";

const APP_URL = "/chat";
let mode = "login"; // login | register

function nextUrl() {
  const next = new URLSearchParams(location.search).get("next") || "";
  return next.startsWith("/chat") || /^\/meet\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(next) ? next : APP_URL;
}

function render(root) {
  const register = mode === "register";
  root.innerHTML = `
    <main class="auth-screen">
      <div class="auth-card">
        <div class="auth-head">
          <span class="auth-icon" aria-hidden="true"><svg data-ink viewBox="30 50 710 710" fill="currentColor" focusable="false"><path d="${INK_PATH}"/></svg></span>
          <h1>Bean</h1>
          <p class="auth-brand">Signaturesi</p>
        </div>

        <form class="auth-form" autocomplete="on" novalidate>
          <label class="field">
            <input id="regUser" name="username" type="text" placeholder="Username or @bean ID"
              autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="25" required>
          </label>
          <p class="field-hint" data-hint hidden></p>
          <label class="field field-pass">
            <input id="regPass" name="password" type="password" placeholder="Password"
              autocomplete="${register ? "new-password" : "current-password"}" maxlength="100" required>
            <button type="button" class="pass-toggle" data-action="peek" aria-label="Show password">Show</button>
          </label>
          ${register ? `<p class="field-note">At least 10 characters. Your Bean ID works on Neyo too.</p>` : ""}
          <p class="auth-error" role="alert" hidden></p>
          <button type="submit" class="auth-submit">${register ? "Create Bean ID" : "Enter Workspace"}</button>
        </form>

        <p class="auth-toggle">
          ${register ? `Already have an account? <button type="button" data-action="toggle">Sign In</button>` : `Don't have an account? <button type="button" data-action="toggle">Sign Up</button>`}
        </p>
      </div>
      <p class="auth-foot">Bean Messenger · Signaturesi</p>
    </main>`;

  const form = root.querySelector("form");
  const user = root.querySelector("#regUser");
  const pass = root.querySelector("#regPass");
  const submit = root.querySelector(".auth-submit");
  const error = root.querySelector(".auth-error");
  const hint = root.querySelector("[data-hint]");

  const showError = (msg) => {
    error.textContent = msg || "";
    error.hidden = !msg;
  };

  root.querySelector("[data-action=toggle]").onclick = () => {
    mode = register ? "login" : "register";
    const keep = user.value;
    render(root);
    root.querySelector("#regUser").value = keep;
    root.querySelector(keep ? "#regPass" : "#regUser").focus();
  };

  root.querySelector("[data-action=peek]").onclick = (e) => {
    const show = pass.type === "password";
    pass.type = show ? "text" : "password";
    e.currentTarget.textContent = show ? "Hide" : "Show";
  };

  if (register) {
    const check = debounce(async () => {
      const name = user.value.trim().toLowerCase().replace(/^@/, "").replace(/@bean$/, "");
      if (!name) return (hint.hidden = true);
      if (!/^[a-z0-9_]{3,20}$/.test(name)) {
        hint.hidden = false;
        hint.className = "field-hint bad";
        hint.textContent = "3–20 letters, numbers or _";
        return;
      }
      try {
        const res = await api.checkUsername(name);
        hint.hidden = false;
        hint.className = `field-hint ${res.available ? "good" : "bad"}`;
        hint.textContent = res.available ? `${name}@bean is available` : res.reason || "This Bean ID is taken";
      } catch {
        hint.hidden = true;
      }
    }, 350);
    user.addEventListener("input", check);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError("");
    const username = user.value.trim();
    const password = pass.value;
    if (!username) return showError("Enter your username or @bean ID"), user.focus();
    if (!password) return showError("Enter your password"), pass.focus();
    if (register && password.length < 10) return showError("Password must be at least 10 characters"), pass.focus();

    submit.disabled = true;
    submit.innerHTML = `<span class="btn-spinner"></span>`;
    try {
      await (register ? api.register(username, password) : api.login(username, password));
      location.replace(nextUrl());
    } catch (err) {
      showError(!err.status ? "Can't reach Bean right now. Check your internet and try again." : err.message);
      submit.disabled = false;
      submit.textContent = register ? "Create Bean ID" : "Enter Workspace";
      pass.select();
    }
  });

  if (window.innerWidth > 767) (user.value ? pass : user).focus();
}

async function boot() {
  const root = document.getElementById("portal");
  root.innerHTML = `<div class="auth-screen"><div class="spinner"></div></div>`;
  if (new URLSearchParams(location.search).get("mode") === "register") mode = "register";
  try {
    const res = await api.me();
    if (res.authenticated) return location.replace(nextUrl());
  } catch (err) {
    if (err.code === "NO_API") {
      api.enableDemo(); // local preview without a backend
      const res = await api.me();
      if (res.authenticated) return location.replace(nextUrl());
    }
  }
  render(root);
}

document.addEventListener("DOMContentLoaded", boot);
document.addEventListener("DOMContentLoaded", () => {
  initBrandInk();
  initViewport();
});
