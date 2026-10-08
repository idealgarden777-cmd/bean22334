/* Light / dark toggle, remembered per device. Default: follow the system. */
const KEY = "bean_theme";

export function applySavedTheme() {
  const saved = localStorage.getItem(KEY);
  if (saved === "light" || saved === "dark") document.documentElement.dataset.theme = saved;
}

export function isDark() {
  const forced = document.documentElement.dataset.theme;
  if (forced) return forced === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function toggleTheme() {
  const next = isDark() ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem(KEY, next);
  return next;
}

applySavedTheme();
