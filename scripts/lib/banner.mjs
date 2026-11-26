/**
 * Animated 1280×380 banner for the GitHub profile.
 *
 * The SVG stays a *live* document (CSS animations run inside `<img>`), and both
 * typefaces are embedded as base64 WOFF2 so the browser never falls back to a
 * system font — GitHub strips external font URLs inside `<img>`, but data: URIs
 * are allowed.
 */
import { readFileSync } from "node:fs";

const W = 1280;
const H = 380;

const PRNG = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export async function buildBanner({ SITE, ROOT, T, iconBody, measure, baselineFor, esc, f, svgDoc }) {
  const problems = [];

  /* ---- embedded fonts (latin subsets only, base64) ---------------------- */
  const face = (path, family, weight) => {
    const b64 = readFileSync(path).toString("base64");
    return `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${b64}) format("woff2");}`;
  };
  const faces = [
    face(`${SITE}/public/fonts/bricolage-grotesque-latin-wght-normal.woff2`, "Bricolage Grotesque", "200 800"),
    face(`${SITE}/public/fonts/jetbrains-mono-latin-wght-normal.woff2`, "JetBrains Mono", "100 800"),
  ].join("\n");

  const DISPLAY = `'Bricolage Grotesque', 'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif`;
  const MONOF = `'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace`;

  /* ---- measured typography --------------------------------------------- */
  const nameText = "Egor Trefilov";
  const nameStyle = { family: "Bricolage Grotesque", size: 68, weight: 800, spacing: -1.8 };
  const nameW = measure(nameText, nameStyle).width;

  const roleText = "Python Backend & AI Automation Developer";
  const roleStyle = { family: "Bricolage Grotesque", size: 24, weight: 500, spacing: -0.2 };
  const roleW = measure(roleText, roleStyle).width;

  const taglineText = "Backends that think — FastAPI, RAG & production AI.";
  const tagStyle = { family: "Bricolage Grotesque", size: 17, weight: 400 };
  const tagW = measure(taglineText, tagStyle).width;

  const kickerStyle = { family: "JetBrains Mono", size: 13, weight: 500, spacing: 2.4 };
  const kickerL = measure("COFFEE1337", kickerStyle).width;
  const kickerSlash = measure("  //  ", kickerStyle).width;
  const kickerR = measure("MSK · UTC+3", kickerStyle).width;

  const signStyle = { family: "JetBrains Mono", size: 13, weight: 500, spacing: 0.6 };
  const signW = measure("coffee1337.github.io", signStyle).width;

  const leftX = 68;
  const leftEdge = Math.max(leftX + nameW + 18, leftX + roleW, leftX + tagW, kickerL + kickerSlash + kickerR);
  if (leftEdge > 660) problems.push(`left typography runs into the constellation (${f(leftEdge)})`);

  /* ---- constellation ---------------------------------------------------- */
  const REGION = { x: 676, y: 26, w: 554, h: 328 };
  const rand = PRNG(20261126);
  const QUERY = { x: 930, y: 194 };

  /* Clusters give the cloud structure instead of uniform noise. */
  const clusters = [
    { x: 830, y: 120, sx: 74, sy: 54 },
    { x: 1058, y: 118, sx: 66, sy: 48 },
    { x: 1130, y: 246, sx: 58, sy: 46 },
    { x: 828, y: 268, sx: 62, sy: 44 },
    { x: 972, y: 300, sx: 52, sy: 32 },
  ];

  const nodes = [];
  const gauss = () => {
    const u = Math.max(rand(), 1e-6);
    const v = Math.max(rand(), 1e-6);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  for (let i = 0; i < 52; i += 1) {
    const c = clusters[i % clusters.length];
    const x = Math.min(REGION.x + REGION.w - 12, Math.max(REGION.x + 12, c.x + gauss() * c.sx));
    const y = Math.min(REGION.y + REGION.h - 12, Math.max(REGION.y + 12, c.y + gauss() * c.sy));
    const depth = rand();
    const layer = depth < 0.52 ? 0 : depth < 0.85 ? 1 : 2;
    nodes.push({
      x,
      y,
      layer,
      r: layer === 0 ? 1.8 : layer === 1 ? 2.6 : 3.8,
      fill: layer === 0 ? T.ink4 : layer === 1 ? T.ink2 : rand() > 0.55 ? T.caramel : T.ink,
      opacity: layer === 0 ? 0.35 : layer === 1 ? 0.6 : 0.92,
    });
  }

  /* Five neighbours spread around the query, each with a cosine label. */
  const neighbourSpec = [
    { angle: -104, dist: 132, label: "0.94 · pgvector" },
    { angle: -26, dist: 150, label: "0.91 · fastapi" },
    { angle: 48, dist: 138, label: "0.89 · torch" },
    { angle: 122, dist: 152, label: "0.87 · async" },
    { angle: 196, dist: 140, label: "0.85 · docker" },
  ];

  const neighbours = neighbourSpec.map((spec, i) => {
    const rad = (spec.angle * Math.PI) / 180;
    const x = Math.min(REGION.x + REGION.w - 26, Math.max(REGION.x + 26, QUERY.x + Math.cos(rad) * spec.dist));
    const y = Math.min(REGION.y + REGION.h - 26, Math.max(REGION.y + 26, QUERY.y + Math.sin(rad) * spec.dist));
    return { ...spec, x, y, r: 5.2, fill: i % 2 === 0 ? T.caramel : T.ink };
  });

  const labelStyle = { family: "JetBrains Mono", size: 10.5, weight: 500, spacing: 0.2 };
  /* Labels sit outside the constellation so they never cover a node. */
  for (const n of neighbours) {
    const m = measure(n.label, labelStyle);
    const below = n.y >= QUERY.y;
    const right = n.x >= QUERY.x;
    n.labelW = m.width;
    n.labelX = Math.min(
      REGION.x + REGION.w - m.width - 4,
      Math.max(REGION.x, n.x + (right ? 16 : -16 - m.width)),
    );
    n.labelY = Math.min(REGION.y + REGION.h - 6, Math.max(REGION.y + 12, n.y + (below ? 21 : -16)));
  }
  /* De-overlap the five captions vertically. */
  const sortedLabels = [...neighbours].sort((a, b) => a.labelY - b.labelY);
  for (let i = 1; i < sortedLabels.length; i += 1) {
    const prev = sortedLabels[i - 1];
    const cur = sortedLabels[i];
    const overlapX = Math.abs(cur.labelX - prev.labelX) < Math.max(cur.labelW, prev.labelW) + 8;
    if (overlapX && cur.labelY - prev.labelY < 13) cur.labelY = prev.labelY + 13;
  }

  /* Quadratic curves with a perpendicular bow, plus animated light pulses. */
  const curves = neighbours.map((n, i) => {
    const mx = (QUERY.x + n.x) / 2;
    const my = (QUERY.y + n.y) / 2;
    const dx = n.x - QUERY.x;
    const dy = n.y - QUERY.y;
    const len = Math.hypot(dx, dy) || 1;
    const bow = 26 + (i % 3) * 9;
    const cx = mx - (dy / len) * bow;
    const cy = my + (dx / len) * bow;
    return `M${f(QUERY.x)} ${f(QUERY.y)} Q${f(cx)} ${f(cy)} ${f(n.x)} ${f(n.y)}`;
  });

  /* ---- SVG -------------------------------------------------------------- */
  const parts = [];
  parts.push(`<defs>
    <clipPath id="card"><rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10"/></clipPath>
    <linearGradient id="nameGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f3efe8"/><stop offset="1" stop-color="#b8b0a4"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#c4562a" stop-opacity="0.18"/>
      <stop offset="0.55" stop-color="#d9a066" stop-opacity="0.06"/>
      <stop offset="1" stop-color="#d9a066" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="gridFade" cx="0.5" cy="0.5" r="0.62">
      <stop offset="0.35" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="1.2" cy="1.2" r="1.2" fill="#211c19"/>
    </pattern>
    <mask id="gridMask"><rect x="0" y="0" width="${W}" height="${H}" fill="url(#gridFade)"/></mask>
    <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#c4562a" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#c4562a" stop-opacity="0"/>
    </radialGradient>
  </defs>`);

  parts.push(`<g clip-path="url(#card)">
    <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="${T.bg}"/>
    <rect x="0" y="0" width="${W}" height="${H}" fill="url(#dots)" mask="url(#gridMask)"/>
    <ellipse cx="960" cy="190" rx="360" ry="250" fill="url(#glow)"/>
    <rect x="0" y="0" width="5" height="${H}" fill="${T.accent}"/>
  </g>`);
  parts.push(
    `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="none" stroke="${T.lineSoft}" stroke-width="1"/>`,
  );

  /* left column */
  const kickerY = 78;
  parts.push(
    `<text x="${leftX}" y="${kickerY}" font-family="${MONOF}" font-size="13" font-weight="500" letter-spacing="2.4" fill="${T.ink3}">COFFEE1337<tspan fill="${T.accent}">  //  </tspan><tspan fill="${T.ink3}">MSK · UTC+3</tspan></text>`,
  );

  const nameBaseline = 178;
  parts.push(
    `<text x="${leftX}" y="${nameBaseline}" font-family="${DISPLAY}" font-size="68" font-weight="800" letter-spacing="-1.8" fill="url(#nameGrad)">${esc(
      nameText,
    )}</text>`,
  );
  parts.push(
    `<rect class="caret" x="${f(leftX + nameW + 17)}" y="${nameBaseline - 46}" width="3.4" height="46" rx="1.7" fill="${T.accent}"/>`,
  );

  const roleBase = baselineFor(226, roleStyle);
  parts.push(
    `<text x="${leftX}" y="${f(roleBase)}" font-family="${DISPLAY}" font-size="24" font-weight="500" letter-spacing="-0.2" fill="${T.caramel}">${esc(
      roleText,
    )}</text>`,
  );

  const tagBase = baselineFor(272, tagStyle);
  parts.push(
    `<text x="${leftX}" y="${f(tagBase)}" font-family="${DISPLAY}" font-size="17" font-weight="400" fill="#8a847c">${esc(
      taglineText,
    )}</text>`,
  );

  parts.push(`<line x1="${leftX}" y1="312" x2="${leftX + 64}" y2="312" stroke="${T.accent}" stroke-width="1.4"/>`);
  parts.push(`<line x1="${leftX + 72}" y1="312" x2="${leftX + 72 + 300}" y2="312" stroke="${T.lineSoft}" stroke-width="1"/>`);
  parts.push(
    `<text x="${leftX}" y="340" font-family="${MONOF}" font-size="13" font-weight="500" letter-spacing="0.6" fill="${T.ink4}">coffee1337.github.io</text>`,
  );
  parts.push(`<g transform="translate(${f(leftX + signW + 14)} 330)">${iconBody("arrow", "#4a423c", 12)}</g>`);

  /* constellation */
  const farNodes = nodes.filter((n) => n.layer === 0);
  const midNodes = nodes.filter((n) => n.layer === 1);
  const nearNodes = nodes.filter((n) => n.layer >= 2);

  const nodeSvg = (list) =>
    list
      .map(
        (n) => `<circle cx="${f(n.x)}" cy="${f(n.y)}" r="${n.r}" fill="${n.fill}" opacity="${n.opacity}"/>`,
      )
      .join("");

  parts.push(`<g class="drift drift-a">${nodeSvg(farNodes)}</g>`);
  parts.push(`<g class="drift drift-b">${nodeSvg(midNodes)}</g>`);
  parts.push(`<g class="drift drift-c">${nodeSvg(nearNodes)}</g>`);

  /* soft halo behind the query node */
  parts.push(`<circle class="halo" cx="${QUERY.x}" cy="${QUERY.y}" r="34" fill="url(#halo)"/>`);

  curves.forEach((d, i) => {
    parts.push(`<path d="${d}" fill="none" stroke="${T.accent}" stroke-opacity="0.28" stroke-width="1.2"/>`);
    parts.push(
      `<path class="pulse" style="animation-delay:${(i * 1.15).toFixed(2)}s" d="${d}" fill="none" stroke="${T.caramel}" stroke-width="2" stroke-linecap="round" stroke-dasharray="18 220"/>`,
    );
  });

  for (const n of neighbours) {
    parts.push(
      `<circle cx="${f(n.x)}" cy="${f(n.y)}" r="${n.r}" fill="${n.fill}"/>`,
      `<circle cx="${f(n.x)}" cy="${f(n.y)}" r="9.5" fill="none" stroke="${T.caramel}" stroke-opacity="0.35" stroke-width="1"/>`,
    );
  }

  /* query node */
  parts.push(
    `<circle cx="${QUERY.x}" cy="${QUERY.y}" r="13.5" fill="none" stroke="${T.accent}" stroke-opacity="0.45" stroke-width="1"/>`,
    `<circle class="query-ring" cx="${QUERY.x}" cy="${QUERY.y}" r="13.5" fill="none" stroke="${T.accent}" stroke-width="1.2"/>`,
    `<circle cx="${QUERY.x}" cy="${QUERY.y}" r="5" fill="${T.accent}"/>`,
  );

  const queryLabel = 'query: "fastapi + rag"';
  const queryStyle = { family: "JetBrains Mono", size: 11, weight: 500, spacing: 0.2 };
  const queryW = measure(queryLabel, queryStyle).width;
  const queryPlateX = QUERY.x + 22;
  const queryPlateY = QUERY.y - 15;
  parts.push(
    `<rect x="${f(queryPlateX - 7)}" y="${f(queryPlateY - 12)}" width="${f(queryW + 14)}" height="22" rx="6" fill="${T.bg}" fill-opacity="0.94" stroke="${T.line}" stroke-width="1"/>`,
    `<text x="${f(queryPlateX)}" y="${f(queryPlateY + 4)}" font-family="${MONOF}" font-size="11" font-weight="500" fill="${T.accent}">${esc(
      queryLabel,
    )}</text>`,
  );

  for (const n of neighbours) {
    /* A hairline leader keeps each caption tied to its node without touching it. */
    const lx = n.labelX <= n.x ? n.labelX + n.labelW : n.labelX;
    parts.push(
      `<line x1="${f(n.x)}" y1="${f(n.y)}" x2="${f(lx)}" y2="${f(n.labelY - 3.4)}" stroke="${T.caramel}" stroke-opacity="0.22" stroke-width="1"/>`,
    );
    parts.push(
      `<text x="${f(n.labelX)}" y="${f(n.labelY)}" font-family="${MONOF}" font-size="10.5" fill="${T.caramel}" opacity="0.92">${esc(
        n.label,
      )}</text>`,
    );
  }

  /* motion ---------------------------------------------------------------- */
  parts.push(`<style>
${faces}
.caret{animation:caret 2.6s ease-in-out infinite}
@keyframes caret{0%,100%{opacity:.95}50%{opacity:.12}}
.pulse{animation:pulse 3.4s linear infinite}
@keyframes pulse{from{stroke-dashoffset:200}to{stroke-dashoffset:-60}}
.query-ring{animation:ring 3.2s ease-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes ring{0%{opacity:.55;transform:scale(1)}70%{opacity:0;transform:scale(1.9)}100%{opacity:0;transform:scale(1.9)}}
.drift{animation:drift 7s ease-in-out infinite}
.drift-b{animation-delay:-2.3s}
.drift-c{animation-delay:-4.6s}
@keyframes drift{0%,100%{transform:translateY(-4px)}50%{transform:translateY(4px)}}
@media (prefers-reduced-motion: reduce){*{animation:none !important}}
</style>`);

  const svg = svgDoc(W, H, parts.join("\n"));

  /* label bounds sanity check */
  for (const n of neighbours) {
    if (n.labelX < REGION.x - 2 || n.labelX + n.labelW > REGION.x + REGION.w + 2) {
      problems.push(`caption "${n.label}" leaves the constellation region`);
    }
  }

  return { svg, problems };
}