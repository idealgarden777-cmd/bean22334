/* Bean tooltips: small dark pills in the Neyo style instead of the browser's yellow/grey boxes.
 * Any element with data-tip="…" gets one. Old title="…" attributes are adopted automatically,
 * so the browser never shows its own tooltip. Mouse hover and keyboard focus only (not touch). */
let tip = null;
let timer = null;
let current = null;

function ensure() {
  if (tip) return tip;
  tip = document.createElement("div");
  tip.className = "bean-tip";
  tip.setAttribute("role", "tooltip");
  tip.id = "bean-tip";
  document.body.appendChild(tip);
  return tip;
}

function adopt(el) {
  if (!(el instanceof Element) || el.tagName === "svg" || el.closest("svg")) return;
  const t = el.getAttribute("title");
  if (t == null) return;
  if (t && !el.hasAttribute("data-tip")) el.setAttribute("data-tip", t);
  el.removeAttribute("title");
}

function adoptAll(root) {
  if (root.nodeType !== 1) return;
  adopt(root);
  root.querySelectorAll?.("[title]").forEach(adopt);
}

function place(target) {
  const t = ensure();
  const r = target.getBoundingClientRect();
  if (!r.width && !r.height) return hide();
  t.style.left = "0px";
  t.style.top = "0px";
  const w = t.offsetWidth;
  const h = t.offsetHeight;
  let left = r.left + r.width / 2 - w / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
  let top = r.top - h - 8;
  let below = false;
  if (top < 8) {
    top = r.bottom + 8;
    below = true;
  }
  t.style.left = `${Math.round(left)}px`;
  t.style.top = `${Math.round(top)}px`;
  t.classList.toggle("below", below);
}

function show(target) {
  const text = target.getAttribute("data-tip");
  if (!text || !target.isConnected) return;
  const t = ensure();
  t.textContent = text;
  current = target;
  target.setAttribute("aria-describedby", "bean-tip");
  place(target);
  t.classList.add("show");
}

export function hideTip() {
  clearTimeout(timer);
  if (current) current.removeAttribute("aria-describedby");
  current = null;
  tip?.classList.remove("show");
}
const hide = hideTip;

export function mountTooltips() {
  adoptAll(document.body);
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === "attributes") adopt(m.target);
      else m.addedNodes.forEach(adoptAll);
    }
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["title"] });

  document.addEventListener("pointerover", (e) => {
    if (e.pointerType && e.pointerType !== "mouse") return;
    const target = e.target.closest?.("[data-tip]");
    if (target === current) return;
    hide();
    if (!target || target.disabled) return;
    timer = setTimeout(() => show(target), current ? 0 : 380);
  });
  document.addEventListener("pointerout", (e) => {
    const target = e.target.closest?.("[data-tip]");
    if (target && !target.contains(e.relatedTarget)) hide();
  });
  document.addEventListener("focusin", (e) => {
    const target = e.target.closest?.("[data-tip]");
    if (target && target.matches(":focus-visible")) {
      clearTimeout(timer);
      timer = setTimeout(() => show(target), 120);
    }
  });
  document.addEventListener("focusout", hide);
  ["pointerdown", "scroll", "wheel", "resize"].forEach((ev) => window.addEventListener(ev, hide, { passive: true, capture: true }));
  document.addEventListener("keydown", (e) => e.key === "Escape" && hide());
}
