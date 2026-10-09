/* ---------- keyed DOM patching ----------
 * Only rows whose HTML really changed are replaced; everything else stays the same
 * DOM node. No more full re-render on every sync = no blinking photos/animations. */
function toNode(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  if (t.content.childElementCount === 1) return t.content.firstElementChild;
  const wrap = document.createElement("div");
  wrap.style.display = "contents";
  wrap.append(t.content);
  return wrap;
}

export function patchList(list, nodes, parts, animateNew) {
  const next = new Map();
  let prev = null;
  for (const { key, html, msg } of parts) {
    let rec = nodes.get(key);
    if (!rec || rec.html !== html) {
      const el = toNode(html);
      if (rec?.el.isConnected) rec.el.replaceWith(el);
      else if (animateNew && msg) el.classList.add("enter");
      rec = { html, el };
    }
    const want = prev ? prev.nextSibling : list.firstChild;
    if (want !== rec.el) list.insertBefore(rec.el, want);
    next.set(key, rec);
    prev = rec.el;
  }
  // anything after the last wanted node is stale
  while (prev ? prev.nextSibling : list.firstChild) (prev ? prev.nextSibling : list.firstChild).remove();
  return next;
}

