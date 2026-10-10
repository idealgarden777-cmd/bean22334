/* =========================================================
 * NEYO characters in Bean: the same 15 characters as the NEYO
 * app (signaturesi1 public/js/characters/roster.js), with the
 * same names, taglines, colours, 3D bodies, live faces and
 * temperaments. Used by Neyo Ghost (settings + message tag).
 * ========================================================= */

// eyes: [x%, y%, w%, h%] centre-based; mouth same. shape: round|square
export const CHARACTERS = [
  { id: "neyo", name: "Neyo", tag: "Calm, smart and reliable", hi: "Hi, I'm Neyo. Let's think it through.", color: "#f7849a", kind: "image", gender: "female",
    face: { eyes: [[35.61, 57.74, 6.89, 10.04], [63.66, 57.68, 6.89, 10.16]], mouth: [49.64, 67.59, 14.87, 1.93] },
    temper: { pace: 1.2, tilt: 4, hop: 5, hopChance: 0.14, squish: 0.05 } },
  { id: "zadi", name: "Zadi", tag: "Bold, energetic motivator", hi: "Hey! I'm Zadi. Let's go!", color: "#1b1b1b", kind: "css", gender: "male",
    temper: { pace: 0.7, tilt: 8, hop: 9, hopChance: 0.36, squish: 0.1 } },
  { id: "wizi", name: "Wizi", tag: "Curious idea explorer", hi: "Wizi here. What are we exploring?", color: "#1b1b1b", kind: "css", gender: "male",
    temper: { pace: 1.05, tilt: 9, hop: 5, hopChance: 0.14, squish: 0.05 } },
  { id: "crony", name: "Crony", tag: "Playful, upbeat buddy", hi: "Yo! Crony's ready. Hit me.", color: "#4fa3f7", kind: "css", gender: "male",
    temper: { pace: 0.85, tilt: 6, hop: 7, hopChance: 0.24, squish: 0.16 } },
  { id: "starry", name: "Starry", tag: "Bookish, patient tutor", hi: "Hi! I'm Starry. What are we learning?", color: "#f2785c", kind: "image", gender: "female",
    face: { eyes: [[38.84, 47.9, 6.91, 6.78], [61.65, 47.84, 6.66, 6.91]], mouth: [50.25, 62.95, 16.4, 1.6] },
    temper: { pace: 1.1, tilt: 6, hop: 4, hopChance: 0.12, squish: 0.05 } },
  { id: "bobo", name: "Bobo", tag: "Chill music lover", hi: "Bobo here. Good vibes only.", color: "#7cc0f5", kind: "image", gender: "male", eyeShape: "square",
    face: { eyes: [[40.54, 43.0, 5.16, 5.9], [58.97, 43.0, 5.16, 5.9]], mouth: [49.82, 61.55, 14.37, 1.47] },
    temper: { pace: 1.3, tilt: 7, hop: 3, hopChance: 0.1, squish: 0.06 } },
  { id: "mochi", name: "Mochi", tag: "Artsy and creative", hi: "Hi, I'm Mochi. Let's make something pretty.", color: "#6fdcae", kind: "image", gender: "female",
    face: { eyes: [[41.46, 38.35, 5.44, 5.57], [64.87, 38.35, 5.44, 5.57]], mouth: [50.89, 75.0, 17.22, 1.65] },
    temper: { pace: 1.0, tilt: 8, hop: 5, hopChance: 0.18, squish: 0.08 } },
  { id: "yumi", name: "Yumi", tag: "Dreamy and gentle", hi: "Hi, I'm Yumi. Take a deep breath.", color: "#b9a7f5", kind: "image", gender: "female",
    face: { eyes: [[40.01, 66.87, 6.08, 9.43], [63.96, 66.87, 6.33, 9.43]], mouth: [51.92, 76.43, 13.52, 1.74] },
    temper: { pace: 1.45, tilt: 5, hop: 3, hopChance: 0.08, squish: 0.07 } },
  { id: "yuzu", name: "Yuzu", tag: "Zesty and cheerful", hi: "Yuzu here! Fresh ideas coming up.", color: "#f5cc4f", kind: "image", gender: "female",
    face: { eyes: [[36.51, 62.84, 6.87, 10.77], [64.79, 62.84, 6.87, 10.77]], mouth: [50.52, 73.67, 15.69, 2.08] },
    temper: { pace: 0.8, tilt: 7, hop: 8, hopChance: 0.3, squish: 0.1 } },
  { id: "mimi", name: "Mimi", tag: "Loving and caring", hi: "Hi, I'm Mimi. How are you feeling?", color: "#f7808f", kind: "image", gender: "female",
    face: { eyes: [[35.79, 55.03, 7.73, 11.22], [66.62, 55.03, 7.58, 11.22]], mouth: [51.17, 66.33, 15.45, 2.04] },
    temper: { pace: 1.15, tilt: 6, hop: 5, hopChance: 0.16, squish: 0.08 } },
  { id: "coco", name: "Coco", tag: "Calm, wise thinker", hi: "Coco here. Let's plan it calmly.", color: "#8cc8f7", kind: "image", gender: "male",
    face: { eyes: [[36.31, 53.27, 7.04, 9.3], [61.56, 53.27, 7.04, 9.3]], mouth: [48.93, 65.7, 13.44, 1.76] },
    temper: { pace: 1.35, tilt: 4, hop: 3, hopChance: 0.08, squish: 0.05 } },
  { id: "pogo", name: "Pogo", tag: "Sporty and energetic", hi: "Pogo here! Ready to win?", color: "#f59a52", kind: "image", gender: "male",
    face: { eyes: [[32.08, 68.97, 6.06, 8.9], [56.61, 68.97, 5.93, 8.9]], mouth: [44.25, 76.02, 11.87, 1.73] },
    temper: { pace: 0.7, tilt: 7, hop: 10, hopChance: 0.38, squish: 0.12 } },
  { id: "nini", name: "Nini", tag: "Magical storyteller", hi: "Hi, I'm Nini. Want a little magic?", color: "#ad94f2", kind: "image", gender: "female", eyeShape: "square",
    face: { eyes: [[35.4, 53.06, 9.32, 8.76], [66.69, 53.06, 9.32, 8.76]], mouth: [50.97, 66.48, 21.84, 2.23] },
    temper: { pace: 1.1, tilt: 9, hop: 5, hopChance: 0.16, squish: 0.05 } },
  { id: "minto", name: "Minto", tag: "Adventurous explorer", hi: "Minto here. Where are we off to?", color: "#63d7a3", kind: "image", gender: "male",
    face: { eyes: [[38.12, 55.17, 8.05, 11.81], [67.11, 55.17, 8.05, 11.81]], mouth: [52.48, 67.58, 15.3, 2.28] },
    temper: { pace: 0.95, tilt: 7, hop: 6, hopChance: 0.22, squish: 0.08 } },
  { id: "koko", name: "Koko", tag: "Cool and witty", hi: "Koko. Keep it cool.", color: "#e9e6e0", kind: "image", gender: "male",
    face: { eyes: [], mouth: [51.0, 72.51, 14.07, 1.99] },
    temper: { pace: 1.4, tilt: 3, hop: 3, hopChance: 0.06, squish: 0.06 } }
];

const BY_ID = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));
export const CHARACTER_IDS = CHARACTERS.map((c) => c.id);
export const characterOf = (id) => BY_ID[String(id || "").toLowerCase()] || BY_ID.neyo;

const pct = (v) => `${v}%`;
const imageUrl = (id) => `/characters/${id}.webp?v=1`;

/* Avatar markup, same structure as NEYO's roster avatar():
 * image characters = faceless body + live face; Zadi/Wizi/Crony = CSS body. */
export function mascotHtml(id, size = 40, className = "") {
  const ch = characterOf(id);
  const cls = `nr-avatar ${className}`.trim();
  const open = `<span class="${cls}" data-character="${ch.id}" data-kind="${ch.kind}" aria-hidden="true" style="--nr-size:${size}px;--nr-color:${ch.color}">`;
  if (ch.kind !== "image") {
    return `${open}<span class="nr-css-body"><span class="nr-css-eyes"><i class="nr-eye"></i><i class="nr-eye"></i></span><i class="nr-mouth"></i></span></span>`;
  }
  const eyes = ch.face.eyes
    .map(([x, y, w, h]) => `<i class="nr-eye${ch.eyeShape === "square" ? " is-square" : ""}" style="left:${pct(x)};top:${pct(y)};width:${pct(w)};height:${pct(h)}"></i>`)
    .join("");
  const [mx, my, mw, mh] = ch.face.mouth;
  return `${open}<span class="nr-art"><img src="${imageUrl(ch.id)}" alt="" draggable="false" decoding="async"></span><span class="nr-face">${eyes}<i class="nr-mouth" style="left:${pct(mx)};top:${pct(my)};width:${pct(mw)};--mt:${mh}cqw"></i></span></span>`;
}

/* The character you use is fetched first, the rest quietly after
 * (NEYO roster preload()). */
let preloaded = false;
export function preloadCharacters(first = "neyo") {
  if (preloaded) return;
  preloaded = true;
  const load = (id) => { const im = new Image(); im.decoding = "async"; im.src = imageUrl(id); };
  if (characterOf(first).kind === "image") load(characterOf(first).id);
  const rest = () => CHARACTERS.filter((c) => c.kind === "image" && c.id !== first).forEach((c) => load(c.id));
  if (window.requestIdleCallback) requestIdleCallback(rest, { timeout: 2500 });
  else setTimeout(rest, 1200);
}

/* Image appears only when ready: no half-drawn characters (NEYO is-ready).
 * One capture listener covers every avatar Bean renders as markup. */
if (typeof document !== "undefined") {
  const ready = (e) => {
    const img = e.target;
    if (img?.tagName === "IMG" && img.parentElement?.classList.contains("nr-art")) img.closest(".nr-avatar")?.classList.add("is-ready");
  };
  document.addEventListener("load", ready, true);
  document.addEventListener("error", ready, true);
}
