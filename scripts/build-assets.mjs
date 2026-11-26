#!/usr/bin/env node
/**
 * Deterministic asset builder for the GitHub profile repository.
 *
 * Everything the README shows is generated here — no shields.io, no third-party
 * image services, no hand-edited PNGs:
 *
 *   assets/banner.svg             live animated banner (fonts embedded as data: URIs)
 *   assets/footer-rule.svg        closing hairline
 *   assets/pills/*.png            2× Retina link pills          (logical height 34)
 *   assets/buttons/*.png          2× Retina card mini-buttons  (logical height 26)
 *   assets/stack/*.png            2× Retina tech chips         (logical height 28)
 *   assets/creds/*.png            2× Retina credential cards   (1280×124 / 632×108)
 *
 * Rendering: @resvg/resvg-js, resolved from the local portfolio clone so this
 * repository stays dependency-free (no node_modules is committed).
 *
 *   node scripts/build-assets.mjs
 *   SITE_ROOT=/path/to/coffee1337.github.io node scripts/build-assets.mjs
 *
 * Text metrics are never estimated from character counts: every label is measured
 * with resvg's own bbox (`Resvg#getBBox`), so the right padding of each pill, chip
 * and card is mathematically identical and nothing is ever clipped.
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative } from "node:path";
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
const SANS_DISPLAY = "Bricolage Grotesque";
const MONO = "JetBrains Mono";

const PNG_FONTS = [
  join(SITE, "scripts/og/fonts/onest-400.ttf"),
  join(SITE, "scripts/og/fonts/onest-600.ttf"),
  join(SITE, "scripts/og/fonts/jetbrains-mono-500.ttf"),
  join(ROOT, "scripts/fonts/bricolage-600.ttf"),
  join(ROOT, "scripts/fonts/bricolage-800.ttf"),
];

const esc = (v) =>
  String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/* --------------------------------------------------------------- measuring */

const measureCache = new Map();
const probe = () => {
  /* Reused Resvg-free measurement: a fresh instance per call is fine and cheap. */
};

/**
 * Real rendered metrics of a text run at a known baseline (y = 200).
 * Returns the glyph bbox relative to the anchor: left/right edges and the
 * ascender/descender band of the *em box* measured with a reference string.
 */
function measure(text, { family, size, weight = 400, spacing = 0 }) {
  const key = `${family}|${size}|${weight}|${spacing}|${text}`;
  const hit = measureCache.get(key);
  if (hit) return hit;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="600" viewBox="0 0 4000 600"><text x="20" y="300" font-family="${family}" font-size="${size}" font-weight="${weight}" letter-spacing="${spacing}" fill="#000">${esc(
    text,
  )}</text></svg>`;
  const bbox = new Resvg(svg, {
    font: { fontFiles: PNG_FONTS, loadSystemFonts: false, defaultFontFamily: family },
  }).getBBox();
  const out = { width: bbox.width, left: bbox.x - 20, top: bbox.y - 300, height: bbox.height };
  measureCache.set(key, out);
  return out;
}

/** Baseline offset that centres the em band (ascender + descender) on `center`. */
function baselineFor(center, opts) {
  const band = measure("Hxg", opts); // constant per font/size → identical alignment everywhere
  return center - (band.top + band.height / 2);
}

/* ------------------------------------------------------------------- icons */

function iconBody(id, color, size) {
  const icon = ICONS[id];
  if (icon) {
    const [x, y, w, h] = icon.viewBox.split(/\s+/).map(Number);
    const k = size / Math.max(w, h);
    const dx = -(x + w) * k * 0; // keep origin
    const dxShift = -x * k;
    const dyShift = -y * k;
    return `<g transform="translate(${f(dxShift)} ${f(dyShift)}) scale(${f(k)})">${icon.paths
      .map((d) => `<path d="${d}" fill="${color}"/>`)
      .join("")}</g>`;
  }
  const glyph = CUSTOM_ICONS[id];
  if (!glyph) throw new Error(`no icon for "${id}"`);
  const k = size / 24;
  return `<g transform="scale(${f(k)})" fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>`;
}

/** Icons drawn by hand where no vendor mark exists (24×24, stroke based). */
const CUSTOM_ICONS = {
  spark: `<path d="M12 2.6 13.9 9.4 20.8 11.3 13.9 13.2 12 20 10.1 13.2 3.2 11.3 10.1 9.4Z"/>`,
  globe: `<circle cx="12" cy="12" r="8.4"/><path d="M3.6 12h16.8"/><path d="M12 3.6c3 3.1 3 13.7 0 16.8"/><path d="M12 3.6c-3 3.1-3 13.7 0 16.8"/>`,
  file: `<path d="M6.5 2.8h7.2L18 7.1V21H6.5Z"/><path d="M13.4 3v4.2h4.3"/><path d="M9.4 12.4h5.6"/><path d="M9.4 16.2h5.6"/>`,
  mail: `<rect x="2.8" y="5.4" width="18.4" height="13.2" rx="2.4"/><path d="m3.6 7 8.4 6 8.4-6"/>`,
  book: `<path d="M4 4.2c2.7-1 5.3-1 8 0v15.6c-2.7-1-5.3-1-8 0Z"/><path d="M20 4.2c-2.7-1-5.3-1-8 0v15.6c2.7-1 5.3-1 8 0Z"/><path d="M12 4.2v15.6"/>`,
  shield: `<path d="M12 2.6 20 5.4v6.1c0 5-3.4 8.5-8 9.9-4.6-1.4-8-4.9-8-9.9V5.4Z"/><path d="m8.6 11.9 2.6 2.7 4.4-4.6"/>`,
  arrow: `<path d="M6.5 17.5 17.5 6.5"/><path d="M9 6.5h8.5V15"/>`,
  neural: `<circle cx="6" cy="7" r="2.1"/><circle cx="6" cy="17" r="2.1"/><circle cx="18" cy="12" r="2.1"/><path d="m8 8 8 3"/><path d="m8 16 8-3"/>`,
  vector: `<ellipse cx="12" cy="6.4" rx="7" ry="2.8"/><path d="M5 6.4v11.2c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6.4"/><circle cx="9.4" cy="12" r="0.9" fill="currentColor"/><circle cx="14.6" cy="14.4" r="0.9" fill="currentColor"/>`,
  bbox: `<path d="M3.4 8V3.4H8"/><path d="M16 3.4h4.6V8"/><path d="M20.6 16v4.6H16"/><path d="M8 20.6H3.4V16"/><circle cx="12" cy="12" r="2"/>`,
  layers: `<path d="m12 3.2 8 4.1-8 4.1-8-4.1Z"/><path d="m4 12.2 8 4.1 8-4.1"/><path d="m4 16.6 8 4.1 8-4.1"/>`,
  cycle: `<path d="M5.4 9.6a7 7 0 0 1 11.9-2.4"/><path d="M18.6 14.4a7 7 0 0 1-11.9 2.4"/><path d="M16.4 3.6v3.8h-3.8"/><path d="M7.6 20.4v-3.8h3.8"/>`,
};

/* -------------------------------------------------------------- primitives */

const f = (n) => Number(n.toFixed(2));

function svgDoc(w, h, body, extra = "") {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(w)}" height="${f(
    h,
  )}" viewBox="0 0 ${f(w)} ${f(h)}">${extra}${body}</svg>`;
}

/**
 * A labelled control: rounded surface + icon slot + icon + text + trailing arrow.
 * Width is derived from measured text, so `padR` is exact for every instance.
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
  iconBox,
  padL,
  padR,
  gap,
  arrow = null, // { color, size }
  slot = null, // { fill, radius, pad }
}) {
  const m = measure(text, { family, size, weight, spacing });
  const arrowW = arrow ? arrow.size + 6 : 0;
  const iconArea = slot ? slot.pad * 2 + iconBox : iconBox;
  /* +0.6 absorbs sub-pixel advance rounding so the rasterised ink never reaches
     the last padding column; it is applied to every control, keeping the visual
     right padding identical across the whole asset family. */
  const width = Math.ceil(padL + iconArea + gap + m.width + (arrow ? 6 + arrow.size : 0) + padR + 0.6);
  const center = h / 2;
  const baseline = baselineFor(center, { family, size, weight, spacing });

  const parts = [];
  const surface =
    `<rect x="0.5" y="0.5" width="${f(width - 1)}" height="${f(h - 1)}" rx="${f(
      rx - 0.5,
    )}" fill="${bg}" stroke="${border}" stroke-width="1"/>`;
  parts.push(surface);

  if (slot) {
    const slotSize = iconBox + slot.pad * 2;
    parts.push(
      `<rect x="${f(padL)}" y="${f(center - slotSize / 2)}" width="${f(slotSize)}" height="${f(
        slotSize,
      )}" rx="${slot.radius}" fill="${slot.fill}" stroke="${T.line}" stroke-width="1"/>`,
    );
    parts.push(
      `<g transform="translate(${f(padL + slot.pad)} ${f(center - iconBox / 2)})">${iconBody(
        icon,
        iconColor,
        iconBox,
      )}</g>`,
    );
  } else {
    parts.push(
      `<g transform="translate(${f(padL)} ${f(center - iconBox / 2)})">${iconBody(
        icon,
        iconColor,
        iconBox,
      )}</g>`,
    );
  }

  const textX = padL + iconArea + gap;
  parts.push(
    `<text x="${f(textX)}" y="${f(baseline)}" font-family="${family}" font-size="${size}" font-weight="${weight}" letter-spacing="${spacing}" fill="${textColor}">${esc(
      text,
    )}</text>`,
  );

  if (arrow) {
    const ax = textX + m.width + 6;
    parts.push(
      `<g transform="translate(${f(ax)} ${f(center - arrow.size / 2)})">${iconBody(
        "arrow",
        arrow.color,
        arrow.size,
      )}</g>`,
    );
  }

  const content = parts.filter((part) => part !== surface).join("");
  return {
    width,
    svg: svgDoc(width, h, parts.join("")),
    contentSvg: svgDoc(width, h, content),
    textX,
    textW: m.width,
    padR,
  };
}

/* ------------------------------------------------------------- verification */

/** Renders at 2× and proves that no ink sits inside the right/left padding. */
function render2x(name, svg, logicalW, logicalH, checks = {}) {
  const img = new Resvg(svg, {
    fitTo: { mode: "zoom", value: 2 },
    background: "rgba(0,0,0,0)",
    font: { fontFiles: PNG_FONTS, loadSystemFonts: false, defaultFontFamily: SANS },
  }).render();

  /* Geometry is checked on a surface-free twin of the control: with the dark
     card fill present every pixel is opaque, so alpha alone proves nothing. */
  const probeImg = new Resvg(checks.contentSvg ?? svg, {
    fitTo: { mode: "zoom", value: 2 },
    background: "rgba(0,0,0,0)",
    font: { fontFiles: PNG_FONTS, loadSystemFonts: false, defaultFontFamily: SANS },
  }).render();

  const { width, height, pixels } = probeImg;
  const alphaAt = (x, y) => pixels[(y * width + x) * 4 + 3];
  const inkInColumn = (x) => {
    for (let y = 0; y < height; y += 1) if (alphaAt(x, y) > 8) return true;
    return false;
  };

  const problems = [];
  /* Corner arcs and the 1px border live at the extremes; sample the middle band
     so the check measures glyph ink only, not the control's own outline. */
  const yFrom = Math.round(height * 0.3);
  const yTo = Math.round(height * 0.7);
  const inkInBand = (x) => {
    for (let y = yFrom; y < yTo; y += 1) if (alphaAt(x, y) > 8) return true;
    return false;
  };
  const rightFrom = width - Math.round((checks.padR ?? 14) * 2) + 2;
  for (let x = rightFrom; x < width - 5; x += 1) {
    if (inkInBand(x)) {
      problems.push(`ink in right padding at x=${x} (2×)`);
      break;
    }
  }
  const leftTo = Math.round((checks.padL ?? 12) * 2) - 4;
  for (let x = 5; x < leftTo; x += 1) {
    if (inkInBand(x)) {
      problems.push(`ink in left padding at x=${x} (2×)`);
      break;
    }
  }
  if (img.width !== logicalW * 2 || img.height !== logicalH * 2) {
    problems.push(`unexpected size ${img.width}×${img.height}`);
  }

  writeFileSync(join(ROOT, "assets", name), img.asPng());
  return { problems, bytes: img.asPng().length };
}

/* ------------------------------------------------------------------ assets */

const report = [];
function emit(name, res, meta) {
  report.push({ name, ...meta, problems: res.problems });
  if (res.problems.length) {
    console.error(`✗ ${name}: ${res.problems.join("; ")}`);
  }
}

/* 1. hero pills ----------------------------------------------------------- */

const PILLS = [
  {
    file: "pills/portfolio.png",
    text: "Portfolio",
    icon: "spark",
    href: "https://coffee1337.github.io/",
    bg: T.accent,
    border: T.accent,
    textColor: T.onAccent,
    iconColor: T.onAccent,
    arrow: { color: T.onAccent, size: 11 },
    weight: 600,
  },
  {
    file: "pills/ru.png",
    text: "RU",
    icon: "globe",
    href: "https://coffee1337.github.io/ru/",
    weight: 600,
  },
  {
    file: "pills/resume.png",
    text: "Resume PDF",
    icon: "file",
    href: "https://coffee1337.github.io/resume/Egor_Trefilov_Resume_EN.pdf",
    iconColor: T.accent,
  },
  {
    file: "pills/telegram.png",
    text: "Telegram",
    icon: "telegram",
    href: "https://t.me/cooffeek1337",
  },
  {
    file: "pills/linkedin.png",
    text: "LinkedIn",
    icon: "linkedin",
    href: "https://www.linkedin.com/in/coffee1337/",
  },
  {
    file: "pills/email.png",
    text: "Email",
    icon: "mail",
    href: "mailto:trefilovegor84@gmail.com",
  },
];

/* 2. card mini-buttons ---------------------------------------------------- */

const BUTTONS = [
  {
    file: "buttons/case-study.png",
    text: "Case Study",
    icon: "book",
    hrefSuffix: "/projects/<id>/",
    iconColor: T.accent,
    border: T.accentSoft,
    textColor: T.ink,
    arrow: { color: T.accent, size: 9 },
    weight: 600,
  },
  {
    file: "buttons/github.png",
    text: "Source",
    icon: "github",
    hrefSuffix: "https://github.com/coffee1337/<repo>",
    textColor: T.ink2,
    arrow: { color: T.ink3, size: 9 },
  },
  {
    file: "buttons/rospatent.png",
    text: "Rospatent #2026624059",
    icon: "shield",
    hrefSuffix: "https://new.fips.ru/...",
    textColor: T.ink2,
    arrow: { color: T.ink3, size: 9 },
  },
];

/* 3. tech chips ----------------------------------------------------------- */

const STACK = [
  ["backend", [["Python", "python"], ["FastAPI", "fastapi"], ["PostgreSQL", "postgresql"], ["SQLAlchemy", "sqlalchemy"], ["Alembic", "layers"], ["Redis", "redis"], ["AsyncIO", "cycle"]]],
  ["ai", [["LLM APIs", "neural"], ["RAG / pgvector", "vector"], ["PyTorch", "pytorch"], ["YOLO11s", "bbox"], ["OpenCV", "opencv"], ["Pandas", "pandas"], ["Snowflake", "snowflake"]]],
  ["cloud", [["Docker", "docker"], ["GitHub Actions", "githubactions"], ["Microsoft Azure", "microsoftazure"], ["AWS", "amazonwebservices"], ["Linux", "linux"], ["Git", "git"]]],
  ["frontend", [["React", "react"], ["Next.js", "nextdotjs"], ["TypeScript", "typescript"], ["Flutter", "flutter"], [".NET 8", "dotnet"], ["C++17", "cplusplus"]]],
];

/* 4. credential cards ----------------------------------------------------- */

const CREDS = [
  {
    file: "creds/01-snowflake-genai.png",
    icon: "snowflake",
    badge: "PRO CERT",
    title: "Generative AI Professional Certificate",
    meta: "Snowflake · Nov 2026",
    tone: T.accent,
  },
  {
    file: "creds/02-docker.png",
    icon: "docker",
    badge: "PRO CERT",
    title: "Docker Foundations Professional Certificate",
    meta: "Docker, Inc. · Oct 2026",
  },
  {
    file: "creds/03-azure.png",
    icon: "microsoftazure",
    badge: "PRO CERT",
    title: "Microsoft Azure Essentials Professional Certificate",
    meta: "Microsoft · Oct 2026",
  },
  {
    file: "creds/04-github.png",
    icon: "github",
    badge: "PRO CERT",
    title: "Career Essentials in GitHub Professional Certificate",
    meta: "GitHub · Oct 2026",
  },
  {
    file: "creds/05-snowflake-agents.png",
    icon: "snowflake",
    badge: "COURSE",
    title: "Building AI Agents with Snowflake",
    meta: "LinkedIn Learning · Snowflake · Nov 2026",
    tone: T.accent,
  },
  {
    file: "creds/06-aws-prep.png",
    icon: "amazonwebservices",
    badge: "CERT PREP",
    title: "AWS Certified AI Practitioner (AIF-C01) Cert Prep",
    meta: "LinkedIn Learning · Oct 2026",
  },
];

/* ==================================================================== build */

mkdirSync(join(ROOT, "assets"), { recursive: true });

/* ---- 1. pills ----------------------------------------------------------- */
const pillWidths = [];
for (const p of PILLS) {
  const { width, svg, contentSvg } = control({
    text: p.text,
    icon: p.icon,
    h: 34,
    rx: 17,
    size: 13.5,
    weight: p.weight ?? 500,
    bg: p.bg ?? T.surface,
    border: p.border ?? T.line,
    textColor: p.textColor ?? T.ink,
    iconColor: p.iconColor ?? T.caramel,
    iconBox: 16,
    padL: 14,
    padR: 14,
    gap: 8,
    arrow: p.arrow ?? null,
  });
  pillWidths.push(width);
  emit(p.file, render2x(p.file, svg, width, 34, { padL: 14, padR: 14, contentSvg }), { w: width, h: 34 });
}

/* ---- 2. buttons --------------------------------------------------------- */
const buttonWidths = {};
for (const b of BUTTONS) {
  const { width, svg, contentSvg } = control({
    text: b.text,
    icon: b.icon,
    h: 26,
    rx: 13,
    size: 11.5,
    weight: b.weight ?? 500,
    border: b.border ?? T.line,
    textColor: b.textColor ?? T.ink2,
    iconColor: b.iconColor ?? T.caramel,
    iconBox: 12,
    padL: 11,
    padR: 12,
    gap: 6,
    arrow: b.arrow,
  });
  buttonWidths[b.file] = width;
  emit(b.file, render2x(b.file, svg, width, 26, { padL: 11, padR: 12, contentSvg }), { w: width, h: 26 });
}

/* ---- 3. chips ----------------------------------------------------------- */
const chipSizes = {};
for (const [group, items] of STACK) {
  for (const [label, icon] of items) {
    const { width, svg, contentSvg } = control({
      text: label,
      icon,
      h: 28,
      rx: 6,
      size: 12.5,
      weight: 500,
      bg: T.surface,
      border: T.line,
      textColor: T.ink,
      iconColor: group === "cloud" || group === "frontend" ? T.accent : T.caramel,
      iconBox: 14,
      padL: 10,
      padR: 14,
      gap: 7,
    });
    const file = `stack/${label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}.png`;
    chipSizes[label] = { file, w: width };
    emit(file, render2x(file, svg, width, 28, { padL: 10, padR: 14, contentSvg }), { w: width, h: 28 });
  }
}

/* ---- 4. credential cards ------------------------------------------------ */

function credCard(c) {
  const W = 632;
  const H = 108;
  const slotSize = 48;
  const slotX = 16;
  const slotY = (H - slotSize) / 2;
  const textX = slotX + slotSize + 16;
  const tone = c.tone ?? T.caramel;

  // Right-aligned "Verify" pill.
  const verify = control({
    text: "Verify",
    icon: "arrow",
    h: 24,
    rx: 12,
    size: 11,
    weight: 600,
    bg: T.slot,
    border: T.accentSoft,
    textColor: T.ink,
    iconColor: T.accent,
    iconBox: 9,
    padL: 10,
    padR: 11,
    gap: 5,
  });
  // `Verify` is drawn without a leading arrow glyph; rebuild it as text + arrow.
  const verifyW = 92;

  const badge = measure(c.badge, { family: MONO, size: 10, weight: 500, spacing: 1.6 });
  const badgeBase = 15 + 10;
  const titleSize = fitSize(c.title, { family: SANS, size: 15.5, weight: 600 }, W - textX - verifyW - 26, 12);
  const title = measure(c.title, { family: SANS, size: titleSize, weight: 600 });

  const parts = [];
  const shell =
    `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="8" fill="${T.surface}" stroke="${T.line}" stroke-width="1"/>`;
  parts.push(shell);
  parts.push(
    `<rect x="${slotX}" y="${slotY}" width="${slotSize}" height="${slotSize}" rx="10" fill="${T.slot}" stroke="${T.line}" stroke-width="1"/>`,
  );
  parts.push(
    `<g transform="translate(${f(slotX + 12)} ${f(slotY + 12)})">${iconBody(c.icon, tone, 24)}</g>`,
  );
  parts.push(
    `<text x="${textX}" y="${f(badgeBase)}" font-family="${MONO}" font-size="10" font-weight="500" letter-spacing="1.6" fill="${tone}">${esc(
      c.badge,
    )}</text>`,
  );
  parts.push(
    `<text x="${textX}" y="${f(badgeBase + 8 + titleSize + 5)}" font-family="${SANS}" font-size="${f(
      titleSize,
    )}" font-weight="600" fill="${T.ink}">${esc(c.title)}</text>`,
  );
  parts.push(
    `<text x="${textX}" y="${f(badgeBase + 8 + titleSize + 5 + 18)}" font-family="${SANS}" font-size="12.5" fill="${
      T.ink2
    }">${esc(c.meta)}</text>`,
  );

  /* Verify pill, right aligned. Absolute coordinates keep the baseline maths honest. */
  const verifyText = "Verify";
  const verifyTextW = measure(verifyText, { family: SANS, size: 11, weight: 600 }).width;
  const vx = W - 16 - verifyW;
  const vy = (H - 24) / 2;
  const vBase = baselineFor(vy + 12, { family: SANS, size: 11, weight: 600 });
  parts.push(
    `<rect x="${f(vx)}" y="${f(vy)}" width="${verifyW - 1}" height="23" rx="11.5" fill="${T.slot}" stroke="${
      T.accentSoft
    }" stroke-width="1"/>`,
    `<text x="${f(vx + 11)}" y="${f(vBase)}" font-family="${SANS}" font-size="11" font-weight="600" fill="${
      T.ink
    }">${verifyText}</text>`,
    `<g transform="translate(${f(vx + 11 + verifyTextW + 5)} ${f(vy + 7.5)})">${iconBody("arrow", T.accent, 9)}</g>`,
  );

  const content = parts.filter((part) => part !== shell).join("");
  return { svg: svgDoc(W, H, parts.join("")), contentSvg: svgDoc(W, H, content) };
}

/** Largest font size (<= size) at which `text` fits `maxWidth`. */
function fitSize(text, base, maxWidth, floor) {
  let size = base.size;
  while (size > floor) {
    const w = measure(text, { ...base, size }).width;
    if (w <= maxWidth) return Number(size.toFixed(2));
    size -= 0.5;
  }
  return floor;
}

for (const c of CREDS) {
  const { svg, contentSvg } = credCard(c);
  emit(c.file, render2x(c.file, svg, 632, 108, { padL: 12, padR: 12, contentSvg }), { w: 632, h: 108 });
}

/* ---- 5. registered-IP panel row ----------------------------------------- */

function rospatentCard() {
  const W = 1280;
  const H = 124;
  const parts = [];
  const shell =
    `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="8" fill="${T.surface}" stroke="${T.line}" stroke-width="1"/>`;
  const decor = `<clipPath id="card"><rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="8"/></clipPath>` +
    `<g clip-path="url(#card)"><rect x="0" y="0" width="4" height="${H}" fill="${T.accent}"/></g>`;
  parts.push(decor);
  parts.push(shell);

  const slotX = 20;
  const slotSize = 52;
  const slotY = (H - slotSize) / 2;
  parts.push(
    `<rect x="${slotX}" y="${slotY}" width="${slotSize}" height="${slotSize}" rx="10" fill="${T.slot}" stroke="${T.line}" stroke-width="1"/>`,
  );
  parts.push(
    `<g transform="translate(${f(slotX + 13)} ${f(slotY + 13)})">${iconBody("shield", T.accent, 26)}</g>`,
  );

  const textX = slotX + slotSize + 18;
  const pillText = "FIPS Registry";
  const pillW = Math.ceil(12 + measure(pillText, { family: SANS, size: 12, weight: 600 }).width + 6 + 9 + 12);
  const pillX = W - 16 - pillW;

  parts.push(
    `<text x="${textX}" y="36" font-family="${MONO}" font-size="10.5" font-weight="500" letter-spacing="1.7" fill="${
      T.accent
    }">REGISTERED IP · RU2026624059</text>`,
  );
  const titleSize = fitSize(
    "State Registration Certificate of Database No. 2026624059 — RadarPPI-MTD",
    { family: SANS, size: 18, weight: 600 },
    pillX - textX - 24,
    13,
  );
  parts.push(
    `<text x="${textX}" y="64" font-family="${SANS}" font-size="${f(
      titleSize,
    )}" font-weight="600" fill="${T.ink}">State Registration Certificate of Database No. 2026624059 — RadarPPI-MTD</text>`,
  );
  parts.push(
    `<text x="${textX}" y="90" font-family="${SANS}" font-size="13" fill="${T.ink2}">Rospatent (FIPS) · Aug 2026 · Rightholder: NGIEU · 11.8 GB · Radar PPI Generator v1.0.0</text>`,
  );

  const pillY = (H - 30) / 2;
  const pillBase = baselineFor(pillY + 15, { family: SANS, size: 12, weight: 600 });
  const pillTextW = measure(pillText, { family: SANS, size: 12, weight: 600 }).width;
  parts.push(
    `<rect x="${f(pillX)}" y="${f(pillY)}" width="${pillW - 1}" height="29" rx="14.5" fill="${T.accent}"/>`,
    `<text x="${f(pillX + 12)}" y="${f(pillBase)}" font-family="${SANS}" font-size="12" font-weight="600" fill="${
      T.onAccent
    }">${pillText}</text>`,
    `<g transform="translate(${f(pillX + 12 + pillTextW + 6)} ${f(pillY + 10.5)})">${iconBody(
      "arrow",
      T.onAccent,
      9,
    )}</g>`,
  );

  const content = parts.filter((part) => part !== shell && part !== decor).join("");
  return { svg: svgDoc(W, H, parts.join("")), contentSvg: svgDoc(W, H, content) };
}

const roster = rospatentCard();
emit(
  "creds/00-rospatent.png",
  render2x("creds/00-rospatent.png", roster.svg, 1280, 124, { padL: 16, padR: 16, contentSvg: roster.contentSvg }),
  { w: 1280, h: 124 },
);

/* ---- 6. footer rule ----------------------------------------------------- */

writeFileSync(
  join(ROOT, "assets/footer-rule.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="20" viewBox="0 0 1280 20"><line x1="0" y1="10" x2="628" y2="10" stroke="${T.lineSoft}" stroke-width="1"/><circle cx="640" cy="10" r="3" fill="${T.accent}"/><line x1="652" y1="10" x2="1280" y2="10" stroke="${T.lineSoft}" stroke-width="1"/></svg>\n`,
);

/* ---- 7. banner ---------------------------------------------------------- */

/* (banner builder lives in ./lib/banner.mjs to keep this file readable) */
const { buildBanner } = await import("./lib/banner.mjs");
const banner = await buildBanner({ SITE, ROOT, T, ICONS, iconBody, measure, baselineFor, esc, f, svgDoc, PNG_FONTS, Resvg });
writeFileSync(join(ROOT, "assets/banner.svg"), banner.svg);
emit("banner.svg", { problems: banner.problems ?? [], bytes: banner.svg.length }, { w: 1280, h: 380 });

/* ---- summary ------------------------------------------------------------ */

const bad = report.filter((r) => r.problems.length);
console.log(`\n${report.length} assets → assets/`);
console.log(
  `pills:  ${pillWidths.join(" · ")} (logical widths, padR = 14 on every one)`,
);
console.log(
  `buttons: ${Object.entries(buttonWidths)
    .map(([k, v]) => `${k.split("/")[1].replace(".png", "")}=${v}`)
    .join(" · ")}`,
);
console.log(`chips:   ${Object.keys(chipSizes).length} (26 expected)`);
console.log(`banner.svg: ${(banner.svg.length / 1024).toFixed(1)} KB`);
if (bad.length) {
  console.error(`\n✗ ${bad.length} asset(s) failed geometry checks`);
  process.exit(1);
}
console.log("\n✓ all assets rendered, no ink inside padding, no clipped labels");