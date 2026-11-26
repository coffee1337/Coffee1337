#!/usr/bin/env node
/**
 * Deterministic asset builder for the GitHub profile repository.
 *
 *   assets/banner.png            2560×760 (logical 1280×380) — static, zero animation cost
 *   assets/footer-rule.svg       closing hairline
 *   assets/pills/*.png           2× link pills          (logical height 32)
 *   assets/buttons/*.png         2× card mini-buttons   (logical height 26)
 *   assets/stack/*.png           2× tech chips          (logical height 28)
 *   assets/about/*.png           2× narrative cards     (632×236)
 *   assets/projects/*.png        2× project cards       (632×204)
 *   assets/creds/*.png           2× credential cards    (1280×156 / 632×168)
 *
 * Rendering: @resvg/resvg-js, resolved from the local portfolio clone so this
 * repository stays dependency-free (no node_modules is committed).
 *
 *   node scripts/build-assets.mjs
 *   SITE_ROOT=/path/to/coffee1337.github.io node scripts/build-assets.mjs
 *
 * Geometry rules (do not regress):
 *   • every label is measured with resvg's own bbox — never estimated from length;
 *   • text is anchored with `x - bbox.left`, so the first painted pixel lands on the
 *     grid and the last one stops exactly `padR` before the edge;
 *   • every icon is scaled and centred by its real ink bbox (`placeIcon`);
 *   • vertical centring uses the cap-height of "H", never a descender-laden probe;
 *   • the emitted PNG is scanned pixel-by-pixel and the build fails unless the ink
 *     sits symmetrically inside the padding on all four sides.
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ICONS } from "./icons.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SITE = process.env.SITE_ROOT ?? join(homedir(), "coffee1337.github.io");

if (!existsSync(join(SITE, "node_modules/@resvg/resvg-js"))) {
  console.error(`@resvg/resvg-js not found under ${SITE}/node_modules — set SITE_ROOT`);
  process.exit(1);
}
const siteRequire = createRequire(join(SITE, "package.json"));
const { Resvg } = siteRequire("@resvg/resvg-js");

/* ------------------------------------------------------------------ tokens */

const T = {
  bg: "#0c0a09",
  surface: "#141110",
  slot: "#1c1816",
  line: "#2a2420",
  lineSoft: "#26201d",
  hair: "#221d1a",
  ink: "#f3efe8",
  ink2: "#a39d94",
  ink3: "#7c756d",
  ink4: "#6e6862",
  accent: "#c4562a",
  accentSoft: "rgba(196, 86, 42, 0.45)",
  caramel: "#d9a066",
  onAccent: "#f8f4ee",
};

const SANS = "Onest";
const MONO = "JetBrains Mono";

const PNG_FONTS = [
  join(SITE, "scripts/og/fonts/onest-400.ttf"),
  join(SITE, "scripts/og/fonts/onest-600.ttf"),
  join(SITE, "scripts/og/fonts/jetbrains-mono-500.ttf"),
  join(ROOT, "scripts/fonts/bricolage-600.ttf"),
  join(ROOT, "scripts/fonts/bricolage-800.ttf"),
];

const f = (n) => Number(n.toFixed(2));
const esc = (v) =>
  String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function svgDoc(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(w)}" height="${f(
    h,
  )}" viewBox="0 0 ${f(w)} ${f(h)}">${body}</svg>`;
}

const resvg = (svg, { zoom = 1, background = "rgba(0,0,0,0)" } = {}) =>
  new Resvg(svg, {
    ...(zoom !== 1 ? { fitTo: { mode: "zoom", value: zoom } } : {}),
    background,
    font: { fontFiles: PNG_FONTS, loadSystemFonts: false, defaultFontFamily: SANS },
  });

/* --------------------------------------------------------------- measuring */

const measureCache = new Map();
const WRAP_MAX = 6000;

/**
 * Real metrics of a text run drawn at baseline 200, anchored at x = 20.
 * `left` is the left side bearing (ink starts at anchor + left), `width` is the
 * ink width, `top`/`height` describe the ink band around the baseline.
 */
function measure(text, { family = SANS, size, weight = 400, spacing = 0 } = {}) {
  const key = `${family}|${size}|${weight}|${spacing}|${text}`;
  const hit = measureCache.get(key);
  if (hit) return hit;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WRAP_MAX}" height="600"><text x="20" y="200" font-family="${family}" font-size="${size}" font-weight="${weight}" letter-spacing="${spacing}" fill="#000">${esc(
    text,
  )}</text></svg>`;
  const bbox = resvg(svg).getBBox();
  const out = {
    left: bbox.x - 20,
    width: bbox.width,
    top: bbox.y - 200,
    height: bbox.height,
  };
  measureCache.set(key, out);
  return out;
}

/** Baseline that puts the cap-height band of "H" exactly on `center`. */
function baselineFor(center, opts) {
  const cap = measure("H", opts);
  return center - (cap.top + cap.height / 2);
}

const DESCENDERS = /[gjpqy]/;
const hasDescender = (text) => DESCENDERS.test(text);

/* ------------------------------------------------------------------- icons */

function iconMarkup(id, color) {
  const icon = ICONS[id];
  if (icon) {
    const [x, y, w, h] = icon.viewBox.split(/\s+/).map(Number);
    return {
      markup: `<g transform="translate(${f(-x)} ${f(-y)})">${icon.paths
        .map((d) => `<path d="${d}" fill="${color}"/>`)
        .join("")}</g>`,
      box: [x, y, w, h],
      stroke: 0,
    };
  }
  const glyph = CUSTOM_ICONS[id];
  if (!glyph) throw new Error(`no icon for "${id}"`);
  return {
    markup: `<g fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>`,
    box: [0, 0, 24, 24],
    stroke: 1.9,
  };
}

const iconInkCache = new Map();
const ICON_K = 12; // rasterisation scale for ink measurement (units → px)

/**
 * Exact ink bbox of an icon, measured by rasterising it and scanning alpha:
 * resvg's `getBBox()` is approximate for paths and ignores stroke width, which
 * is what used to push icons a couple of pixels off centre.
 */
function measureIcon(id) {
  const hit = iconInkCache.get(id);
  if (hit) return hit;
  const { markup, box } = iconMarkup(id, "#000");
  const [bx, by] = box;
  const pad = 4; // icon units of breathing room around the artwork
  const vbW = 24 + pad * 2;
  const vbH = 24 + pad * 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${vbW * ICON_K}" height="${
    vbH * ICON_K
  }" viewBox="${bx - pad} ${by - pad} ${vbW} ${vbH}">${markup}</svg>`;
  const img = resvg(svg).render();
  const { width, height, pixels } = img;
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      if (pixels[row + x * 4 + 3] > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const ink = {
    x: bx - pad + minX / ICON_K,
    y: by - pad + minY / ICON_K,
    width: (maxX - minX + 1) / ICON_K,
    height: (maxY - minY + 1) / ICON_K,
  };
  iconInkCache.set(id, ink);
  return ink;
}

/**
 * Places an icon with a *uniform* scale (24-unit design grid → `size` px), so
 * every vendor mark keeps the same optical weight, then shifts it so its real
 * ink centre sits exactly on (cx, cy).
 */
function placeIcon(id, color, cx, cy, size) {
  const ink = measureIcon(id);
  const scale = size / 24;
  const tx = cx - (ink.x + ink.width / 2) * scale;
  const ty = cy - (ink.y + ink.height / 2) * scale;
  return `<g transform="translate(${f(tx)} ${f(ty)}) scale(${f(scale)})">${iconMarkup(id, color).markup}</g>`;
}

/**
 * Places an icon scaled so its *ink* is exactly `inkW × inkH` px (fit mode).
 * Used for the arrow glyphs, where the visual size must not depend on how much
 * padding the artwork happens to carry inside its 24-unit box.
 */
function placeIconFit(id, color, cx, cy, inkW, inkH = inkW) {
  const ink = measureIcon(id);
  const scale = Math.min(inkW / ink.width, inkH / ink.height);
  const tx = cx - (ink.x + ink.width / 2) * scale;
  const ty = cy - (ink.y + ink.height / 2) * scale;
  return `<g transform="translate(${f(tx)} ${f(ty)}) scale(${f(scale)})">${iconMarkup(id, color).markup}</g>`;
}

/** Hand-drawn glyphs for concepts without a vendor mark (24×24, stroke based). */
const CUSTOM_ICONS = {
  spark: `<path d="M12 2.6 13.9 9.4 20.8 11.3 13.9 13.2 12 20 10.1 13.2 3.2 11.3 10.1 9.4Z"/>`,
  globe: `<circle cx="12" cy="12" r="8.4"/><path d="M3.6 12h16.8"/><path d="M12 3.6c3 3.1 3 13.7 0 16.8"/><path d="M12 3.6c-3 3.1-3 13.7 0 16.8"/>`,
  file: `<path d="M6.5 2.8h7.2L18 7.1V21H6.5Z"/><path d="M13.4 3v4.2h4.3"/><path d="M9.4 12.4h5.6"/><path d="M9.4 16.2h5.6"/>`,
  mail: `<rect x="2.8" y="5.4" width="18.4" height="13.2" rx="2.4"/><path d="m3.6 7 8.4 6 8.4-6"/>`,
  book: `<path d="M4 4.2c2.7-1 5.3-1 8 0v15.6c-2.7-1-5.3-1-8 0Z"/><path d="M20 4.2c-2.7-1-5.3-1-8 0v15.6c2.7-1 5.3-1 8 0Z"/><path d="M12 4.2v15.6"/>`,
  shield: `<path d="M12 2.6 20 5.4v6.1c0 5-3.4 8.5-8 9.9-4.6-1.4-8-4.9-8-9.9V5.4Z"/><path d="m8.6 11.9 2.6 2.7 4.4-4.6"/>`,
  arrow: `<path d="M6.5 17.5 17.5 6.5"/><path d="M9 6.5h8.5V15"/>`,
  neural: `<circle cx="6" cy="7" r="2.1"/><circle cx="6" cy="17" r="2.1"/><circle cx="18" cy="12" r="2.1"/><path d="m8 8 8 3"/><path d="m8 16 8-3"/>`,
  vector: `<ellipse cx="12" cy="6.4" rx="7" ry="2.8"/><path d="M5 6.4v11.2c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6.4"/>`,
  bbox: `<path d="M3.4 8V3.4H8"/><path d="M16 3.4h4.6V8"/><path d="M20.6 16v4.6H16"/><path d="M8 20.6H3.4V16"/><circle cx="12" cy="12" r="2"/>`,
  layers: `<path d="m12 3.2 8 4.1-8 4.1-8-4.1Z"/><path d="m4 12.2 8 4.1 8-4.1"/><path d="m4 16.6 8 4.1 8-4.1"/>`,
  cycle: `<path d="M5.4 9.6a7 7 0 0 1 11.9-2.4"/><path d="M18.6 14.4a7 7 0 0 1-11.9 2.4"/><path d="M16.4 3.6v3.8h-3.8"/><path d="M7.6 20.4v-3.8h3.8"/>`,
};

/* -------------------------------------------------------------- primitives */

/**
 * Rounded control: surface + icon + label + optional trailing arrow.
 * Width comes from measured ink, so padL/padR are literal, not eyeballed.
 */
function control({
  text,
  icon,
  h,
  rx,
  size,
  weight = 500,
  spacing = 0,
  family = SANS,
  bg = T.surface,
  border = T.line,
  textColor = T.ink,
  iconColor = T.caramel,
  iconSize = 15,
  padL,
  padR,
  gap,
  arrow = null, // { color, size }
}) {
  const m = measure(text, { family, size, weight, spacing });
  const arrowBlock = arrow ? 6 + arrow.ink : 0;
  const width = Math.ceil(padL + iconSize + gap + m.width + arrowBlock + padR + 0.6);
  const center = h / 2;

  const surface =
    `<rect x="0.5" y="0.5" width="${f(width - 1)}" height="${f(h - 1)}" rx="${f(
      rx - 0.5,
    )}" fill="${bg}" stroke="${border}" stroke-width="1"/>`;

  const iconEl = placeIcon(icon, iconColor, padL + iconSize / 2, center, iconSize);

  const textX = padL + iconSize + gap;
  const baseline = baselineFor(center, { family, size, weight, spacing });
  const textEl = `<text x="${f(textX - m.left)}" y="${f(baseline)}" font-family="${family}" font-size="${size}" font-weight="${weight}" letter-spacing="${spacing}" fill="${textColor}">${esc(
    text,
  )}</text>`;

  let arrowEl = "";
  if (arrow) {
    const ax = textX + m.width + 6 + arrow.ink / 2;
    arrowEl = placeIconFit("arrow", arrow.color, ax, center, arrow.ink);
  }

  return {
    width,
    svg: svgDoc(width, h, surface + iconEl + textEl + arrowEl),
    contentSvg: svgDoc(width, h, iconEl + textEl + arrowEl),
    padL,
    padR,
    hasDescender: hasDescender(text),
  };
}

/** Word wrap by measured width (never by character count). */
function wrapLines(text, opts, maxWidth, maxLines = 3) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (measure(next, opts).width <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

/* ------------------------------------------------------------- verification */

const report = [];

/** Ink bounds of a transparent 2× render. */
function inkBounds(contentSvg) {
  const img = resvg(contentSvg, { zoom: 2 }).render();
  const { width, height, pixels } = img;
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      if (pixels[row + x * 4 + 3] > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { width, height, minX, maxX, minY, maxY, ok: maxX >= 0 };
}

/** Writes the asset and proves its ink is centred inside the padding. */
function emitControl(file, res, h, expectedPadL, expectedPadR) {
  writeFileSync(join(ROOT, "assets", file), resvg(res.svg, { zoom: 2 }).render().asPng());

  const b = inkBounds(res.contentSvg);
  const problems = [];
  if (!b.ok) problems.push("no ink rendered");
  const padL = b.minX;
  const padR = b.width - 1 - b.maxX;
  const padT = b.minY;
  const padB = b.height - 1 - b.maxY;

  /* Left: ink must never enter the padding (a narrow mark centred in its slot
     legitimately starts later). Right: the label's last pixel defines padR. */
  if (padL < expectedPadL * 2 - 3) problems.push(`ink enters left padding (${padL} < ${expectedPadL * 2})`);
  if (Math.abs(padR - expectedPadR * 2) > 3) problems.push(`padR ${padR} ≠ ${expectedPadR * 2}`);
  /* Descenders (g j p q y) drop below the cap band by design; allow for them. */
  const vTol = res.hasDescender ? 7 : 3;
  if (Math.abs(padT - padB) > vTol) problems.push(`vertical ${padT}/${padB}`);
  report.push({ file, w: res.width, h, padL, padR, padT, padB, problems });
  if (problems.length) console.error(`✗ ${file}: ${problems.join("; ")}`);
}

function writeCard(file, w, h, parts) {
  writeFileSync(join(ROOT, "assets", file), resvg(svgDoc(w, h, parts.join("")), { zoom: 2 }).render().asPng());
  report.push({ file, w, h, padL: null, padR: null, padT: null, padB: null, problems: [] });
}

function cardShell(w, h, { accent = false } = {}) {
  const parts = [
    `<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="8" fill="${T.surface}" stroke="${T.line}" stroke-width="1"/>`,
  ];
  if (accent) {
    parts.push(
      `<clipPath id="accent"><rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="8"/></clipPath>`,
      `<g clip-path="url(#accent)"><rect x="0" y="0" width="4" height="${h}" fill="${T.accent}"/></g>`,
    );
  }
  return parts;
}

function kicker(text, x, y) {
  return `<text x="${x}" y="${y}" font-family="${MONO}" font-size="10.5" font-weight="500" letter-spacing="1.6" fill="${T.accent}">${esc(
    text,
  )}</text>`;
}

/* ==================================================================== build */

for (const dir of ["pills", "buttons", "stack", "about", "projects", "creds"]) {
  mkdirSync(join(ROOT, "assets", dir), { recursive: true });
}

/* ---- 1. hero pills (single row, ≤ 720 px) ------------------------------- */

const PILLS = [
  { file: "pills/portfolio.png", text: "Portfolio", icon: "spark", bg: T.accent, border: T.accent, textColor: T.onAccent, iconColor: T.onAccent, arrow: { color: T.onAccent, ink: 8.5 }, weight: 600 },
  { file: "pills/ru.png", text: "RU", icon: "globe", weight: 600 },
  { file: "pills/resume.png", text: "Resume PDF", icon: "file", iconColor: T.accent },
  { file: "pills/telegram.png", text: "Telegram", icon: "telegram" },
  { file: "pills/linkedin.png", text: "LinkedIn", icon: "linkedin" },
  { file: "pills/email.png", text: "Email", icon: "mail" },
];

const pillWidths = [];
for (const p of PILLS) {
  const res = control({
    text: p.text,
    icon: p.icon,
    h: 32,
    rx: 16,
    size: 12.5,
    weight: p.weight ?? 500,
    bg: p.bg ?? T.surface,
    border: p.border ?? T.line,
    textColor: p.textColor ?? T.ink,
    iconColor: p.iconColor ?? T.caramel,
    iconSize: 15,
    padL: 13,
    padR: 13,
    gap: 7,
    arrow: p.arrow ?? null,
  });
  pillWidths.push(res.width);
  emitControl(p.file, res, 32, 13, 13);
}
const pillsTotal = pillWidths.reduce((a, b) => a + b, 0) + (PILLS.length - 1) * 6;

/* ---- 2. card mini-buttons ---------------------------------------------- */

const BUTTONS = [
  { file: "buttons/case-study.png", text: "Case Study", icon: "book", iconColor: T.accent, border: T.accentSoft, textColor: T.ink, arrow: { color: T.accent, ink: 8.5 }, weight: 600 },
  { file: "buttons/github.png", text: "Source", icon: "github", textColor: T.ink2, arrow: { color: T.ink3, ink: 8.5 } },
];

const buttonWidths = {};
for (const b of BUTTONS) {
  const res = control({
    text: b.text,
    icon: b.icon,
    h: 26,
    rx: 13,
    size: 11.5,
    weight: b.weight ?? 500,
    border: b.border ?? T.line,
    textColor: b.textColor ?? T.ink2,
    iconColor: b.iconColor ?? T.caramel,
    iconSize: 13,
    padL: 12,
    padR: 12,
    gap: 6,
    arrow: b.arrow,
  });
  buttonWidths[b.file] = res.width;
  emitControl(b.file, res, 26, 12, 12);
}

/* ---- 3. tech chips ------------------------------------------------------ */

const STACK = [
  ["backend", [
    ["Python", "python"],
    ["FastAPI", "fastapi"],
    ["PostgreSQL", "postgresql"],
    ["SQLAlchemy", "sqlalchemy", { iconSize: 17 }],
    ["Alembic", "layers"],
    ["Redis", "redis"],
    ["AsyncIO", "cycle"],
  ]],
  ["ai", [
    ["LLM APIs", "neural"],
    ["RAG / pgvector", "vector"],
    ["PyTorch", "pytorch"],
    ["YOLO11s", "bbox"],
    ["OpenCV", "opencv"],
    ["Pandas", "pandas"],
    ["Snowflake", "snowflake"],
  ]],
  ["cloud", [
    ["Docker", "docker"],
    ["GitHub Actions", "githubactions"],
    ["Microsoft Azure", "microsoftazure"],
    ["AWS", "amazonwebservices", { iconSize: 18 }],
    ["Linux", "linux"],
    ["Git", "git"],
  ]],
  ["frontend", [
    ["React", "react"],
    ["Next.js", "nextdotjs"],
    ["TypeScript", "typescript"],
    ["Flutter", "flutter"],
    [".NET 8", "dotnet", { iconSize: 17 }],
    ["C++17", "cplusplus"],
  ]],
];

const chipWidths = {};
const chipRows = [];
for (const [group, items] of STACK) {
  let rowW = 0;
  for (const [label, icon, sizing] of items) {
    const res = control({
      text: label,
      icon,
      h: 28,
      rx: 6,
      size: 12.5,
      weight: 500,
      iconColor: group === "cloud" || group === "frontend" ? T.accent : T.caramel,
      iconSize: sizing?.iconSize ?? 15,
      padL: 14,
      padR: 14,
      gap: 7,
    });
    chipWidths[label] = res.width;
    const file = `stack/${label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}.png`;
    emitControl(file, res, 28, 14, 14);
    rowW += res.width + 6;
  }
  chipRows.push({ group, total: rowW - 6 });
}

/* ---- 4. about cards (632×236) ------------------------------------------ */

function whatIBuildCard() {
  const W = 632;
  const H = 236;
  const pad = 24;
  const parts = cardShell(W, H);
  parts.push(kicker("01 // WHAT I BUILD", pad, 30));

  const blocks = [
    ["Production Python Backends", "FastAPI services, PostgreSQL + Alembic migrations, auth sessions, background workers & Docker."],
    ["Grounded AI & RAG", "pgvector retrieval, streamed LLM pipelines, usage accounting & isolated Python sandboxes."],
    ["Applied CV & Automation", "PyTorch / YOLO11s R&D, physics-based synthetic datasets, Telegram bots & data pipelines."],
  ];
  const titleOpts = { family: SANS, size: 14.5, weight: 600 };
  const bodyOpts = { family: SANS, size: 12.5, weight: 400 };

  blocks.forEach(([title, body], i) => {
    const top = 58 + i * 61;
    if (i > 0) parts.push(`<line x1="${pad}" y1="${top - 15}" x2="${W - pad}" y2="${top - 15}" stroke="${T.line}" stroke-width="1"/>`);
    const tm = measure(title, titleOpts);
    parts.push(
      `<text x="${f(pad - tm.left)}" y="${f(top)}" font-family="${SANS}" font-size="14.5" font-weight="600" fill="${T.ink}">${esc(
        title,
      )}</text>`,
    );
    wrapLines(body, bodyOpts, W - pad * 2, 2).forEach((line, li) => {
      const m = measure(line, bodyOpts);
      parts.push(
        `<text x="${f(pad - m.left)}" y="${f(top + 20 + li * 15.5)}" font-family="${SANS}" font-size="12.5" fill="${
          T.ink2
        }">${esc(line)}</text>`,
      );
    });
  });

  return { W, H, parts };
}

function experienceCard() {
  const W = 632;
  const H = 236;
  const pad = 24;
  const parts = cardShell(W, H);
  parts.push(kicker("02 // EXPERIENCE & EDUCATION", pad, 30));

  const entries = [
    ["AUG 2025 — PRESENT", "Python Backend & AI Developer", "Independent / Freelance — APIs, RAG assistants, bots & Dockerized services"],
    ["2026", "ML / Computer Vision R&D Intern", "Radio-Engineering Research Institute — radar PPI pipeline & YOLO11s (Rospatent #2026624059)"],
    ["2024 — 2028", "B.Sc. in AI Systems (09.03.01)", "NGIEU — Nizhny Novgorod State Engineering & Economic University (3rd year)"],
  ];
  const periodOpts = { family: MONO, size: 10, weight: 500, spacing: 1.2 };
  const titleOpts = { family: SANS, size: 14.5, weight: 600 };
  const bodyOpts = { family: SANS, size: 11.5, weight: 400 };

  entries.forEach(([period, title, body], i) => {
    const top = 56 + i * 61;
    if (i > 0) parts.push(`<line x1="${pad}" y1="${top - 14}" x2="${W - pad}" y2="${top - 14}" stroke="${T.line}" stroke-width="1"/>`);
    const pm = measure(period, periodOpts);
    parts.push(
      `<text x="${f(pad - pm.left)}" y="${f(top)}" font-family="${MONO}" font-size="10" font-weight="500" letter-spacing="1.2" fill="${
        T.caramel
      }">${esc(period)}</text>`,
    );
    const tm = measure(title, titleOpts);
    parts.push(
      `<text x="${f(pad - tm.left)}" y="${f(top + 18)}" font-family="${SANS}" font-size="14.5" font-weight="600" fill="${
        T.ink
      }">${esc(title)}</text>`,
    );
    wrapLines(body, bodyOpts, W - pad * 2, 2).forEach((line, li) => {
      const m = measure(line, bodyOpts);
      parts.push(
        `<text x="${f(pad - m.left)}" y="${f(top + 34 + li * 14)}" font-family="${SANS}" font-size="11.5" fill="${
          T.ink2
        }">${esc(line)}</text>`,
      );
    });
  });

  return { W, H, parts };
}

for (const [file, builder] of [
  ["about/01-what-i-build.png", whatIBuildCard],
  ["about/02-experience.png", experienceCard],
]) {
  const { W, H, parts } = builder();
  writeCard(file, W, H, parts);
}

/* ---- 5. project cards (632×204) ---------------------------------------- */

const PROJECTS = [
  {
    file: "projects/01-ai-python-mentor.png",
    title: "AI Python Mentor",
    status: "ACTIVE DEV",
    statusColor: T.accent,
    body: "Full-stack AI learning platform: structured tracks, pgvector RAG tutor, isolated Python runner, background jobs & Telegram integration.",
    chips: ["Python", "FastAPI", "PostgreSQL", "SQLAlchemy", "Next.js"],
    tag: "PYTHON · MIT",
  },
  {
    file: "projects/02-radar-ppi-mtd.png",
    title: "RadarPPI-MTD",
    status: "ROSPATENT #2026624059",
    statusColor: T.caramel,
    body: "Physics-based synthetic radar PPI generator (10,000 scenes, 619,153 frames, 11.8 GB) & YOLO11s detector (mAP@0.5 = 0.924, Pd = 0.916).",
    chips: ["Python", "PyTorch", "YOLO11s", "OpenCV", "ByteTrack"],
    tag: "R&D · CLOSED SOURCE",
  },
  {
    file: "projects/03-portfolio-analytics.png",
    title: "portfolio-analytics",
    status: "LIVE ON SITE",
    statusColor: T.accent,
    body: "First-party privacy-friendly web analytics: sendBeacon retry queue, FastAPI collector, Core Web Vitals & React 19 SPA dashboard.",
    chips: ["FastAPI", "SQLAlchemy", "PostgreSQL", "React 19", "TypeScript"],
    tag: "PYTHON · MIT",
  },
  {
    file: "projects/04-ngie.png",
    title: "NGIE University App",
    status: "CROSS-PLATFORM",
    statusColor: T.caramel,
    body: "Offline-first university app with Drift/SQLite cache, schedule notifications & native WidgetKit / Android lock-screen widgets.",
    chips: ["Flutter", "Dart", "Riverpod", "Swift"],
    tag: "FLUTTER · MIT",
  },
];

function miniChip(label, x, centerY, h = 21) {
  const opts = { family: MONO, size: 10, weight: 500, spacing: 0.2 };
  const m = measure(label, opts);
  const padX = 10;
  const width = Math.ceil(padX * 2 + m.width + 0.5);
  const markup =
    `<rect x="${f(x)}" y="${f(centerY - h / 2)}" width="${width - 1}" height="${h - 1}" rx="${f(
      h / 2,
    )}" fill="${T.slot}" stroke="${T.line}" stroke-width="1"/>` +
    `<text x="${f(x + padX - m.left)}" y="${f(baselineFor(centerY, opts))}" font-family="${MONO}" font-size="10" font-weight="500" letter-spacing="0.2" fill="${
      T.ink2
    }">${esc(label)}</text>`;
  return { markup, width };
}

function projectCard(p) {
  const W = 632;
  const H = 204;
  const pad = 24;
  const parts = cardShell(W, H);

  const titleOpts = { family: SANS, size: 18.5, weight: 600 };
  const tm = measure(p.title, titleOpts);
  parts.push(
    `<text x="${f(pad - tm.left)}" y="36" font-family="${SANS}" font-size="18.5" font-weight="600" fill="${T.ink}">${esc(
      p.title,
    )}</text>`,
  );

  const statusOpts = { family: MONO, size: 9.5, weight: 500, spacing: 1.2 };
  const sm = measure(p.status, statusOpts);
  parts.push(
    `<text x="${f(W - pad - sm.width - sm.left)}" y="35" font-family="${MONO}" font-size="9.5" font-weight="500" letter-spacing="1.2" fill="${
      p.statusColor
    }">${esc(p.status)}</text>`,
  );

  const bodyOpts = { family: SANS, size: 13, weight: 400 };
  wrapLines(p.body, bodyOpts, W - pad * 2, 2).forEach((line, i) => {
    const m = measure(line, bodyOpts);
    parts.push(
      `<text x="${f(pad - m.left)}" y="${f(66 + i * 18)}" font-family="${SANS}" font-size="13" fill="${T.ink2}">${esc(
        line,
      )}</text>`,
    );
  });

  let x = pad;
  for (const label of p.chips) {
    const chip = miniChip(label, x, 124);
    parts.push(chip.markup);
    x += chip.width + 6;
  }

  parts.push(`<line x1="${pad}" y1="176" x2="${W - pad}" y2="176" stroke="${T.hair}" stroke-width="1"/>`);
  const tagOpts = { family: MONO, size: 9.5, weight: 500, spacing: 1.2 };
  const tagM = measure(p.tag, tagOpts);
  parts.push(
    `<text x="${f(pad - tagM.left)}" y="192" font-family="${MONO}" font-size="9.5" font-weight="500" letter-spacing="1.2" fill="${
      T.ink4
    }">${esc(p.tag)}</text>`,
  );

  const ctaText = "OPEN CASE STUDY";
  const ctaOpts = { family: MONO, size: 10.5, weight: 500, spacing: 1.2 };
  const ctaM = measure(ctaText, ctaOpts);
  const arrowInk = 9;
  const arrowCx = W - pad - arrowInk / 2;
  const ctaX = arrowCx - arrowInk / 2 - 6 - ctaM.width;
  parts.push(
    `<text x="${f(ctaX - ctaM.left)}" y="192" font-family="${MONO}" font-size="10.5" font-weight="500" letter-spacing="1.2" fill="${
      T.ink
    }">${esc(ctaText)}</text>`,
    placeIconFit("arrow", T.accent, arrowCx, 188, arrowInk),
  );

  return { W, H, parts };
}

for (const p of PROJECTS) {
  const { W, H, parts } = projectCard(p);
  writeCard(p.file, W, H, parts);
}

/* ---- 6. credential cards (632×168) ------------------------------------- */

const CREDS = [
  {
    file: "creds/01-snowflake-genai.png",
    icon: "snowflake",
    issuer: "SNOWFLAKE",
    badge: "PRO CERT",
    title: "Generative AI Professional Certificate",
    chips: ["Generative AI", "Snowflake", "Data AI"],
    issued: "ISSUED NOV 2026",
  },
  {
    file: "creds/02-docker.png",
    icon: "docker",
    issuer: "DOCKER, INC.",
    badge: "PRO CERT",
    title: "Docker Foundations Professional Certificate",
    chips: ["Docker", "Containerization"],
    issued: "ISSUED OCT 2026",
  },
  {
    file: "creds/03-azure.png",
    icon: "microsoftazure",
    issuer: "MICROSOFT",
    badge: "PRO CERT",
    title: "Microsoft Azure Essentials Professional Certificate",
    chips: ["Microsoft Azure", "Cloud Computing"],
    issued: "ISSUED OCT 2026",
  },
  {
    file: "creds/04-github.png",
    icon: "github",
    issuer: "GITHUB",
    badge: "PRO CERT",
    title: "Career Essentials in GitHub Professional Certificate",
    chips: ["GitHub", "GitHub Actions", "CI/CD"],
    issued: "ISSUED OCT 2026",
  },
  {
    file: "creds/05-snowflake-agents.png",
    icon: "snowflake",
    issuer: "LINKEDIN · SNOWFLAKE",
    badge: "COURSE",
    title: "Building AI Agents with Snowflake",
    chips: ["AI Agents", "Snowflake"],
    issued: "ISSUED NOV 2026",
  },
  {
    file: "creds/06-aws-prep.png",
    icon: "amazonwebservices",
    issuer: "LINKEDIN LEARNING",
    badge: "CERT PREP",
    title: "AWS Certified AI Practitioner (AIF-C01) Cert Prep",
    chips: ["AWS", "Generative AI"],
    issued: "ISSUED OCT 2026",
    wide: { iconSize: 24 },
  },
];

function credCard(c) {
  const W = 632;
  const H = 168;
  const pad = 22;
  const parts = cardShell(W, H);

  const slot = 28;
  const slotY = 26;
  parts.push(
    `<rect x="${pad}" y="${slotY}" width="${slot}" height="${slot}" rx="6" fill="${T.slot}" stroke="${T.line}" stroke-width="1"/>`,
    placeIcon(c.icon, T.caramel, pad + slot / 2, slotY + slot / 2, c.wide ? c.wide.iconSize : slot - 8),
  );

  const issuerOpts = { family: MONO, size: 10.5, weight: 500, spacing: 1.4 };
  const im = measure(c.issuer, issuerOpts);
  const issuerX = pad + slot + 12;
  parts.push(
    `<text x="${f(issuerX - im.left)}" y="${f(baselineFor(slotY + slot / 2, issuerOpts))}" font-family="${MONO}" font-size="10.5" font-weight="500" letter-spacing="1.4" fill="${
      T.ink3
    }">${esc(c.issuer)}</text>`,
  );

  const badgeOpts = { family: MONO, size: 10, weight: 500, spacing: 1.4 };
  const bm = measure(c.badge, badgeOpts);
  parts.push(
    `<text x="${f(W - pad - bm.width - bm.left)}" y="${f(baselineFor(slotY + slot / 2, badgeOpts))}" font-family="${MONO}" font-size="10" font-weight="500" letter-spacing="1.4" fill="${
      T.accent
    }">${esc(c.badge)}</text>`,
  );

  const titleOpts = { family: SANS, size: 17, weight: 600 };
  wrapLines(c.title, titleOpts, W - pad * 2, 2).forEach((line, i) => {
    const m = measure(line, titleOpts);
    parts.push(
      `<text x="${f(pad - m.left)}" y="${f(76 + i * 23)}" font-family="${SANS}" font-size="17" font-weight="600" fill="${
        T.ink
      }">${esc(line)}</text>`,
    );
  });

  let x = pad;
  for (const label of c.chips) {
    const chip = miniChip(label, x, 118, 20);
    parts.push(chip.markup);
    x += chip.width + 6;
  }

  parts.push(`<line x1="${pad}" y1="134" x2="${W - pad}" y2="134" stroke="${T.hair}" stroke-width="1"/>`);
  const issuedOpts = { family: MONO, size: 10, weight: 500, spacing: 1.2 };
  const gm = measure(c.issued, issuedOpts);
  parts.push(
    `<text x="${f(pad - gm.left)}" y="152" font-family="${MONO}" font-size="10" font-weight="500" letter-spacing="1.2" fill="${
      T.ink4
    }">${esc(c.issued)}</text>`,
  );

  const cta = "SHOW CREDENTIAL";
  const ctaOpts = { family: MONO, size: 10.5, weight: 500, spacing: 1.2 };
  const cm = measure(cta, ctaOpts);
  const arrowInk = 9;
  const arrowCx = W - pad - arrowInk / 2;
  const ctaX = arrowCx - arrowInk / 2 - 6 - cm.width;
  parts.push(
    `<text x="${f(ctaX - cm.left)}" y="152" font-family="${MONO}" font-size="10.5" font-weight="500" letter-spacing="1.2" fill="${
      T.caramel
    }">${esc(cta)}</text>`,
    placeIconFit("arrow", T.accent, arrowCx, 148, arrowInk),
  );

  return { W, H, parts };
}

for (const c of CREDS) {
  const { W, H, parts } = credCard(c);
  writeCard(c.file, W, H, parts);
}

/* ---- 7. registered IP panel row (1280×156) ----------------------------- */

function rospatentCard() {
  const W = 1280;
  const H = 156;
  const pad = 24;
  const splitX = 820;
  const parts = cardShell(W, H, { accent: true });

  const shieldSize = 16;
  parts.push(placeIconFit("shield", T.accent, pad + shieldSize / 2, 30, shieldSize - 2));

  const kickerOpts = { family: MONO, size: 10.5, weight: 500, spacing: 1.5 };
  const kText = "RU2026624059 · IP";
  const km = measure(kText, kickerOpts);
  const kx = pad + shieldSize + 8;
  parts.push(
    `<text x="${f(kx - km.left)}" y="${f(baselineFor(30, kickerOpts))}" font-family="${MONO}" font-size="10.5" font-weight="500" letter-spacing="1.5" fill="${
      T.accent
    }">${esc(kText)}</text>`,
  );

  const issuerOpts = { family: MONO, size: 10, weight: 500, spacing: 1.4 };
  const itext = "ISSUER: ROSPATENT (FIPS)";
  const im = measure(itext, issuerOpts);
  parts.push(
    `<text x="${f(kx + km.width + 14 - im.left)}" y="${f(baselineFor(30, issuerOpts))}" font-family="${MONO}" font-size="10" font-weight="500" letter-spacing="1.4" fill="${
      T.ink3
    }">${esc(itext)}</text>`,
  );

  const title = "State Registration Certificate of Database No. 2026624059";
  const titleOpts = { family: SANS, size: 20, weight: 600 };
  const tm = measure(title, titleOpts);
  parts.push(
    `<text x="${f(pad - tm.left)}" y="74" font-family="${SANS}" font-size="20" font-weight="600" fill="${T.ink}">${esc(
      title,
    )}</text>`,
  );

  const subOpts = { family: SANS, size: 13, weight: 400 };
  const sub = "Synthetic Radar PPI Moving-Target Detection Dataset (RadarPPI-MTD) · Bulletin No. 9";
  const sm = measure(sub, subOpts);
  parts.push(
    `<text x="${f(pad - sm.left)}" y="98" font-family="${SANS}" font-size="13" fill="${T.ink2}">${esc(sub)}</text>`,
  );

  let x = pad;
  for (const label of ["Python", "YOLO11s", "Synthetic Data", "Computer Vision"]) {
    const chip = miniChip(label, x, 128, 22);
    parts.push(chip.markup);
    x += chip.width + 6;
  }

  const pillText = "ROSPATENT REGISTRY";
  const pillOpts = { family: MONO, size: 10.5, weight: 500, spacing: 1.2 };
  const pm = measure(pillText, pillOpts);
  const arrowInk = 9;
  const pillPadX = 14;
  const pillW = Math.ceil(pillPadX * 2 + pm.width + 6 + arrowInk);
  const pillX = splitX - pad - pillW;
  const pillY = 128 - 13;
  parts.push(
    `<rect x="${f(pillX)}" y="${f(pillY)}" width="${f(pillW - 1)}" height="26" rx="13" fill="${T.accent}"/>`,
    `<text x="${f(pillX + pillPadX - pm.left)}" y="${f(baselineFor(128, pillOpts))}" font-family="${MONO}" font-size="10.5" font-weight="500" letter-spacing="1.2" fill="${
      T.onAccent
    }">${esc(pillText)}</text>`,
    placeIconFit("arrow", T.onAccent, pillX + pillW - pillPadX - arrowInk / 2, 128, arrowInk),
  );

  parts.push(`<line x1="${splitX}" y1="20" x2="${splitX}" y2="${H - 20}" stroke="${T.hair}" stroke-width="1"/>`);

  const meta = [
    ["CERTIFICATE", "No. 2026624059", "APPLICATION", "No. 2026623714"],
    ["REGISTERED", "25.08.2026 · NGIEU", "VOLUME", "11.8 GB · v1.0.0"],
  ];
  const labelOpts = { family: MONO, size: 9, weight: 500, spacing: 1.4 };
  const valueOpts = { family: SANS, size: 12.5, weight: 500 };

  meta.forEach((row, i) => {
    const y = 56 + i * 46;
    for (let c = 0; c < 2; c += 1) {
      const label = row[c * 2];
      const value = row[c * 2 + 1];
      const lx = splitX + 24 + c * 214;
      const lm = measure(label, labelOpts);
      parts.push(
        `<text x="${f(lx - lm.left)}" y="${y}" font-family="${MONO}" font-size="9" font-weight="500" letter-spacing="1.4" fill="${
          T.ink3
        }">${esc(label)}</text>`,
      );
      const vm = measure(value, valueOpts);
      parts.push(
        `<text x="${f(lx - vm.left)}" y="${y + 18}" font-family="${SANS}" font-size="12.5" font-weight="500" fill="${
          T.ink
        }">${esc(value)}</text>`,
      );
    }
  });

  return { W, H, parts };
}

{
  const { W, H, parts } = rospatentCard();
  writeCard("creds/00-rospatent.png", W, H, parts);
}

/* ---- 8. footer rule ----------------------------------------------------- */

writeFileSync(
  join(ROOT, "assets/footer-rule.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="20" viewBox="0 0 1280 20"><line x1="0" y1="10" x2="628" y2="10" stroke="${T.lineSoft}" stroke-width="1"/><circle cx="640" cy="10" r="3" fill="${T.accent}"/><line x1="652" y1="10" x2="1280" y2="10" stroke="${T.lineSoft}" stroke-width="1"/></svg>\n`,
);

/* ---- 9. banner: static 2560×760 PNG ------------------------------------ */

const { buildBanner } = await import("./lib/banner.mjs");
const banner = buildBanner({ T, placeIcon, placeIconFit, measure, baselineFor, esc, f });
const bannerImg = resvg(banner.svg, { zoom: 2 }).render();
writeFileSync(join(ROOT, "assets/banner.png"), bannerImg.asPng());

/* Pixel proof for the two regressions that started this pass: the caret gap after
   the "v" and the symmetric padding inside the query plate. Both scan for *bright*
   pixels (luminance sum), so the plate fill or the ambient glow never counts as ink. */
{
  const { width, pixels } = bannerImg;
  const lum = (x, y) => {
    const i = (y * width + x) * 4;
    return pixels[i] + pixels[i + 1] + pixels[i + 2];
  };
  const scanBright = (x0, y0, x1, y1, minLum) => {
    let minX = 1e9;
    let maxX = -1;
    for (let y = Math.round(y0 * 2); y < Math.round(y1 * 2); y += 1) {
      for (let x = Math.round(x0 * 2); x < Math.round(x1 * 2); x += 1) {
        if (lum(x, y) > minLum) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
    }
    return { minX: minX / 2, maxX: maxX / 2, ok: maxX >= 0 };
  };

  const { caretX } = banner.meta;
  const name = scanBright(66, 128, caretX - 3, 182, 200);
  const gap = caretX - name.maxX;
  if (Math.abs(gap - 10) > 1.5) banner.problems.push(`caret gap ${f(gap)} px (expected 10)`);

  /* The plate is sized from the measured label (ink + 2×10 px), so equal padding
     is a geometric invariant; the pixel pass only proves the label sits inside. */
  const plate = banner.meta.queryPlate;
  const padLeft = 10;
  const padRight = plate.w - padLeft - plate.textWidth;
  const visible = scanBright(plate.x + 3, plate.y + 3, plate.x + plate.w - 3, plate.y + plate.h - 3, 60);
  if (Math.abs(padLeft - padRight) > 1) banner.problems.push(`query plate padding ${f(padLeft)}/${f(padRight)}`);
  if (!visible.ok || visible.maxX > plate.x + plate.w - 2) banner.problems.push("query label leaves its plate");
  console.log(
    `banner QA: caret gap ${f(gap)}px · plate ${f(plate.x)}..${f(plate.x + plate.w)} (pad ${f(padLeft)}/${f(padRight)}, label ends ${f(visible.maxX)})`,
  );
}
report.push({ file: "banner.png", w: 1280, h: 380, problems: banner.problems });
if (banner.problems.length) console.error(`✗ banner.png: ${banner.problems.join("; ")}`);

const legacySvg = join(ROOT, "assets/banner.svg");
if (existsSync(legacySvg)) unlinkSync(legacySvg);

/* ---- summary ------------------------------------------------------------ */

const bad = report.filter((r) => r.problems.length);
console.log(`\n${report.length} assets → assets/`);
console.log(
  `pills:   ${pillWidths.map((w, i) => `${PILLS[i].text}=${w}`).join(" · ")}  |  total ${pillsTotal}px ${
    pillsTotal <= 720 ? "✓ ≤720" : "✗ >720"
  }`,
);
console.log(
  `buttons: ${Object.entries(buttonWidths)
    .map(([k, v]) => `${k.split("/")[1].replace(".png", "")}=${v}`)
    .join(" · ")}`,
);
console.log(`chips:   ${chipRows.map((r) => `${r.group} ${r.total}px`).join(" · ")}`);
console.log(`banner:  ${bannerImg.width}×${bannerImg.height} · ${(bannerImg.asPng().length / 1024).toFixed(0)} KB`);

if (pillsTotal > 720) bad.push({ file: "pills", problems: [`total ${pillsTotal}px > 720px`] });
if (bad.length) {
  console.error(`\n✗ ${bad.length} asset(s) failed geometry checks`);
  process.exit(1);
}
console.log("\n✓ symmetric padding on every control; no clipped labels; banner is static 2×");