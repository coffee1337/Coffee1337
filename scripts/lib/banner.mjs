/**
 * Static 1280×380 banner for the GitHub profile — rendered to a 2× Retina PNG
 * by scripts/build-assets.mjs.
 *
 * Rendered to PNG on purpose: GitHub serves raw assets with a CSP that blocks
 * `data:` font URLs inside `<img>` (so Bricolage fell back to a wide system face
 * and the caret clipped the "v"), and an animated SVG of this size forces the
 * compositor to repaint a 1280×380 bitmap every frame while scrolling.
 */

const W = 1280;
const H = 380;

const PRNG = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** Quadratic Bézier from Q(t0) to Q(t1) with the exact control point. */
function quadSegment([a, b, c], t0, t1) {
  const q = (t) => {
    const p = lerp(a, b, t);
    const r = lerp(b, c, t);
    return lerp(p, r, t);
  };
  const ctrl = lerp(lerp(a, b, t0), lerp(b, c, t0), t1);
  const p0 = q(t0);
  const p1 = q(t1);
  return { d: `M${p0[0].toFixed(2)} ${p0[1].toFixed(2)} Q${ctrl[0].toFixed(2)} ${ctrl[1].toFixed(2)} ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}`, p0, p1 };
}

export function buildBanner({ T, placeIcon, placeIconFit, measure, baselineFor, esc, f }) {
  const problems = [];

  const DISPLAY = `'Bricolage Grotesque', 'Onest', sans-serif`;
  const MONOF = `'JetBrains Mono', monospace`;

  /* ---- measured typography --------------------------------------------- */
  const leftX = 68;

  const nameText = "Egor Trefilov";
  const nameOpts = { family: DISPLAY, size: 68, weight: 800, spacing: -1.8 };
  const nameM = measure(nameText, nameOpts);

  const roleText = "Python Backend & AI Automation Developer";
  const roleOpts = { family: DISPLAY, size: 24, weight: 500, spacing: -0.2 };
  const roleM = measure(roleText, roleOpts);

  const tagText = "Backends that think — FastAPI, RAG & production AI.";
  const tagOpts = { family: DISPLAY, size: 17, weight: 400 };
  const tagM = measure(tagText, tagOpts);

  const kickerOpts = { family: MONOF, size: 13, weight: 500, spacing: 2.4 };
  const kickL = measure("COFFEE1337", kickerOpts).width;
  const kickSlash = measure("  //  ", kickerOpts).width;
  const kickR = measure("MSK · UTC+3", kickerOpts).width;

  const signOpts = { family: MONOF, size: 13, weight: 500, spacing: 0.6 };
  const signM = measure("coffee1337.github.io", signOpts);

  /* The text is anchored at leftX - left, so its ink starts exactly at leftX. */
  const nameInkRight = leftX + nameM.width;
  const caretX = nameInkRight + 10;
  if (Math.abs(caretX - nameInkRight - 10) > 0.01) problems.push("caret gap is not 10 px");

  const leftEdge = Math.max(caretX + 4, leftX + roleM.width + 6, leftX + tagM.width + 6, leftX + kickL + kickSlash + kickR);
  if (leftEdge > 668) problems.push(`left typography reaches ${f(leftEdge)} px`);

  /* ---- constellation ---------------------------------------------------- */
  const REGION = { x: 676, y: 26, w: 554, h: 328 };
  const rand = PRNG(20261126);
  const QUERY = { x: 930, y: 194 };

  const clusters = [
    { x: 830, y: 120, sx: 74, sy: 54 },
    { x: 1058, y: 118, sx: 66, sy: 48 },
    { x: 1130, y: 246, sx: 58, sy: 46 },
    { x: 828, y: 268, sx: 62, sy: 44 },
    { x: 972, y: 300, sx: 52, sy: 32 },
  ];

  const gauss = () => {
    const u = Math.max(rand(), 1e-6);
    const v = Math.max(rand(), 1e-6);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const nodes = [];
  for (let i = 0; i < 52; i += 1) {
    const c = clusters[i % clusters.length];
    const x = Math.min(REGION.x + REGION.w - 12, Math.max(REGION.x + 12, c.x + gauss() * c.sx));
    const y = Math.min(REGION.y + REGION.h - 12, Math.max(REGION.y + 12, c.y + gauss() * c.sy));
    const depth = rand();
    const layer = depth < 0.52 ? 0 : depth < 0.85 ? 1 : 2;
    nodes.push({
      x,
      y,
      r: layer === 0 ? 1.8 : layer === 1 ? 2.6 : 3.8,
      fill: layer === 0 ? T.ink4 : layer === 1 ? T.ink2 : rand() > 0.55 ? T.caramel : T.ink,
      opacity: layer === 0 ? 0.35 : layer === 1 ? 0.6 : 0.92,
      layer,
    });
  }

  const neighbourSpec = [
    { angle: -104, dist: 132, label: "0.94 · pgvector" },
    { angle: -26, dist: 150, label: "0.91 · fastapi" },
    { angle: 48, dist: 138, label: "0.89 · torch" },
    { angle: 122, dist: 152, label: "0.87 · async" },
    { angle: 196, dist: 140, label: "0.85 · docker" },
  ];

  const labelOpts = { family: MONOF, size: 10.5, weight: 500, spacing: 0.2 };

  const neighbours = neighbourSpec.map((spec, i) => {
    const rad = (spec.angle * Math.PI) / 180;
    const x = Math.min(REGION.x + REGION.w - 26, Math.max(REGION.x + 26, QUERY.x + Math.cos(rad) * spec.dist));
    const y = Math.min(REGION.y + REGION.h - 26, Math.max(REGION.y + 26, QUERY.y + Math.sin(rad) * spec.dist));
    const m = measure(spec.label, labelOpts);
    const below = y >= QUERY.y;
    const right = x >= QUERY.x;
    const labelX = Math.min(REGION.x + REGION.w - m.width - 4, Math.max(REGION.x, x + (right ? 16 : -16 - m.width)));
    const labelY = Math.min(REGION.y + REGION.h - 6, Math.max(REGION.y + 12, y + (below ? 21 : -16)));
    return { ...spec, x, y, r: 5.2, fill: i % 2 === 0 ? T.caramel : T.ink, m, labelX, labelY };
  });

  const sorted = [...neighbours].sort((a, b) => a.labelY - b.labelY);
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const overlapX = Math.abs(cur.labelX - prev.labelX) < Math.max(cur.m.width, prev.m.width) + 8;
    if (overlapX && cur.labelY - prev.labelY < 13) cur.labelY = prev.labelY + 13;
  }

  const curves = neighbours.map((n, i) => {
    const a = [QUERY.x, QUERY.y];
    const c1 = [n.x, n.y];
    const mx = (QUERY.x + n.x) / 2;
    const my = (QUERY.y + n.y) / 2;
    const dx = n.x - QUERY.x;
    const dy = n.y - QUERY.y;
    const len = Math.hypot(dx, dy) || 1;
    const bow = 26 + (i % 3) * 9;
    const ctrl = [mx - (dy / len) * bow, my + (dx / len) * bow];
    return {
      base: `M${f(QUERY.x)} ${f(QUERY.y)} Q${f(ctrl[0])} ${f(ctrl[1])} ${f(n.x)} ${f(n.y)}`,
      accent: quadSegment([a, ctrl, c1], 0.08, 0.6).d,
    };
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
    <radialGradient id="queryGlow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#c4562a" stop-opacity="0.4"/>
      <stop offset="0.45" stop-color="#c4562a" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#c4562a" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="gridFade" cx="0.5" cy="0.5" r="0.62">
      <stop offset="0.35" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="1.2" cy="1.2" r="1.2" fill="#211c19"/>
    </pattern>
    <mask id="gridMask"><rect x="0" y="0" width="${W}" height="${H}" fill="url(#gridFade)"/></mask>
  </defs>`);

  parts.push(`<g clip-path="url(#card)">
    <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="${T.bg}"/>
    <rect x="0" y="0" width="${W}" height="${H}" fill="url(#dots)" mask="url(#gridMask)"/>
    <ellipse cx="960" cy="190" rx="360" ry="250" fill="url(#glow)"/>
    <rect x="0" y="0" width="5" height="${H}" fill="${T.accent}"/>
  </g>`);
  parts.push(`<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="none" stroke="${T.lineSoft}" stroke-width="1"/>`);

  parts.push(
    `<text x="${leftX}" y="78" font-family="${MONOF}" font-size="13" font-weight="500" letter-spacing="2.4" fill="${T.ink3}">COFFEE1337<tspan fill="${T.accent}">  //  </tspan><tspan fill="${T.ink3}">MSK · UTC+3</tspan></text>`,
  );

  const nameBaseline = 178;
  parts.push(
    `<text x="${f(leftX - nameM.left)}" y="${nameBaseline}" font-family="${DISPLAY}" font-size="68" font-weight="800" letter-spacing="-1.8" fill="url(#nameGrad)">${esc(
      nameText,
    )}</text>`,
  );
  parts.push(`<rect x="${f(caretX)}" y="${nameBaseline - 46}" width="4" height="46" rx="1" fill="${T.accent}" opacity="0.9"/>`);

  parts.push(
    `<text x="${f(leftX - roleM.left)}" y="${f(baselineFor(226, roleOpts))}" font-family="${DISPLAY}" font-size="24" font-weight="500" letter-spacing="-0.2" fill="${T.caramel}">${esc(
      roleText,
    )}</text>`,
  );
  parts.push(
    `<text x="${f(leftX - tagM.left)}" y="${f(baselineFor(272, tagOpts))}" font-family="${DISPLAY}" font-size="17" font-weight="400" fill="#8a847c">${esc(
      tagText,
    )}</text>`,
  );

  parts.push(`<line x1="${leftX}" y1="312" x2="${leftX + 64}" y2="312" stroke="${T.accent}" stroke-width="1.4"/>`);
  parts.push(`<line x1="${leftX + 72}" y1="312" x2="${leftX + 372}" y2="312" stroke="${T.lineSoft}" stroke-width="1"/>`);
  parts.push(
    `<text x="${f(leftX - signM.left)}" y="340" font-family="${MONOF}" font-size="13" font-weight="500" letter-spacing="0.6" fill="${T.ink4}">coffee1337.github.io</text>`,
  );
  parts.push(placeIconFit("arrow", "#4a423c", leftX + signM.width + 16, 336, 9));

  const byLayer = (l) => nodes.filter((n) => n.layer === l);
  const nodeSvg = (list) =>
    list.map((n) => `<circle cx="${f(n.x)}" cy="${f(n.y)}" r="${n.r}" fill="${n.fill}" opacity="${n.opacity}"/>`).join("");
  parts.push(nodeSvg(byLayer(0)));
  parts.push(nodeSvg(byLayer(1)));
  parts.push(nodeSvg(byLayer(2)));

  parts.push(`<circle cx="${QUERY.x}" cy="${QUERY.y}" r="86" fill="url(#queryGlow)"/>`);

  for (const c of curves) {
    parts.push(`<path d="${c.base}" fill="none" stroke="${T.accent}" stroke-opacity="0.3" stroke-width="1.2"/>`);
    parts.push(`<path d="${c.accent}" fill="none" stroke="${T.caramel}" stroke-opacity="0.85" stroke-width="1.8" stroke-linecap="round"/>`);
  }

  for (const n of neighbours) {
    parts.push(
      `<circle cx="${f(n.x)}" cy="${f(n.y)}" r="${n.r}" fill="${n.fill}"/>`,
      `<circle cx="${f(n.x)}" cy="${f(n.y)}" r="9.5" fill="none" stroke="${T.caramel}" stroke-opacity="0.35" stroke-width="1"/>`,
    );
  }

  parts.push(
    `<circle cx="${QUERY.x}" cy="${QUERY.y}" r="13.5" fill="none" stroke="${T.accent}" stroke-opacity="0.5" stroke-width="1.2"/>`,
    `<circle cx="${QUERY.x}" cy="${QUERY.y}" r="5" fill="${T.accent}"/>`,
  );

  const queryText = 'query: "fastapi + rag"';
  const queryOpts = { family: MONOF, size: 11, weight: 500, spacing: 0.2 };
  const qm = measure(queryText, queryOpts);
  const plateW = Math.ceil(qm.width + 20);
  const plateX = QUERY.x + 22;
  const plateCenterY = QUERY.y - 2;
  parts.push(
    `<rect x="${f(plateX)}" y="${f(plateCenterY - 13)}" width="${f(plateW)}" height="26" rx="6" fill="${T.bg}" fill-opacity="0.94" stroke="${T.line}" stroke-width="1"/>`,
    `<text x="${f(plateX + 10 - qm.left)}" y="${f(baselineFor(plateCenterY, queryOpts))}" font-family="${MONOF}" font-size="11" font-weight="500" fill="${T.accent}">${esc(
      queryText,
    )}</text>`,
  );

  for (const n of neighbours) {
    const lx = n.labelX <= n.x ? n.labelX + n.m.width : n.labelX;
    parts.push(
      `<line x1="${f(n.x)}" y1="${f(n.y)}" x2="${f(lx)}" y2="${f(n.labelY - 3.4)}" stroke="${T.caramel}" stroke-opacity="0.22" stroke-width="1"/>`,
      `<text x="${f(n.labelX - n.m.left)}" y="${f(n.labelY)}" font-family="${MONOF}" font-size="10.5" fill="${T.caramel}" opacity="0.92">${esc(
        n.label,
      )}</text>`,
    );
    if (n.labelX < REGION.x - 2 || n.labelX + n.m.width > REGION.x + REGION.w + 2) {
      problems.push(`caption "${n.label}" leaves the constellation region`);
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("\n")}</svg>`;
  return {
    svg,
    problems,
    meta: {
      caretX,
      nameInkRight,
      queryPlate: { x: plateX, y: plateCenterY - 13, w: plateW, h: 26, textWidth: qm.width },
    },
  };
}
