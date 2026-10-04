// Illustrated stand-ins for photos in the demo: construction stages, rooms, and material swatches,
// drawn as SVG so no real or stock photos are needed. Every picture is stamped "SAMPLE IMAGE".

export type Stage = "lot" | "foundation" | "framing" | "dried-in" | "siding" | "complete";
export type Room = "kitchen" | "bath" | "living";

const W = 1200;
const H = 800;
const GROUND = 560;

// Blob links rather than data: URLs, because browsers refuse to open data: URLs in a new tab ("View").
const cache = new Map<string, string>();
const blobUrl = (content: string, type: string) => {
  let u = cache.get(content);
  if (!u) cache.set(content, (u = URL.createObjectURL(new Blob([content], { type }))));
  return u;
};
const url = (svg: string) => blobUrl(svg, "image/svg+xml");

/** Small deterministic random numbers so each picture looks the same every time. */
function rng(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const stamp = (label: string) => `
  <g font-family="Arial, sans-serif" font-weight="700">
    <rect x="${W - 330}" y="24" width="306" height="54" rx="27" fill="#000" fill-opacity=".55"/>
    <text x="${W - 177}" y="60" font-size="26" fill="#fff" text-anchor="middle" letter-spacing="3">SAMPLE IMAGE</text>
    ${label ? `<rect x="24" y="${H - 78}" width="${label.length * 15 + 44}" height="54" rx="8" fill="#000" fill-opacity=".45"/>
    <text x="46" y="${H - 42}" font-size="26" fill="#fff">${label}</text>` : ""}
  </g>`;

const svg = (body: string, label: string) =>
  url(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${body}${stamp(label)}</svg>`);

function sky(r: () => number, dusk = false) {
  const clouds = Array.from({ length: 4 }, () => {
    const x = r() * W, y = 60 + r() * 200, s = 0.6 + r() * 0.8;
    return `<g fill="#fff" fill-opacity=".85" transform="translate(${x} ${y}) scale(${s})">
      <ellipse cx="0" cy="0" rx="70" ry="26"/><ellipse cx="50" cy="-14" rx="50" ry="30"/><ellipse cx="100" cy="2" rx="60" ry="22"/></g>`;
  }).join("");
  return `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${dusk ? "#f6b26b" : "#7fb2e5"}"/><stop offset="1" stop-color="${dusk ? "#fde3c4" : "#d9ecf8"}"/>
    </linearGradient></defs>
    <rect width="${W}" height="${GROUND}" fill="url(#sky)"/>${clouds}
    <path d="M0 ${GROUND - 70} Q 200 ${GROUND - 150} 420 ${GROUND - 80} T 820 ${GROUND - 90} T ${W} ${GROUND - 60} V ${GROUND} H 0 Z" fill="#6f8f7a" opacity=".55"/>`;
}

function trees(r: () => number, xs: number[]) {
  return xs
    .map((x) => {
      const h = 160 + r() * 90;
      return `<rect x="${x - 7}" y="${GROUND - 40}" width="14" height="44" fill="#6b4a2f"/>
        <path d="M${x} ${GROUND - h} L${x - 55} ${GROUND - 30} H${x + 55} Z" fill="#2f5d3a"/>
        <path d="M${x} ${GROUND - h - 40} L${x - 40} ${GROUND - 90} H${x + 40} Z" fill="#3a7048"/>`;
    })
    .join("");
}

const ground = (fill: string) => `<rect y="${GROUND}" width="${W}" height="${H - GROUND}" fill="${fill}"/>`;

// The house outline every stage builds on.
const BODY = { x: 330, y: 330, w: 540, h: GROUND - 330 };
const APEX = { x: 600, y: 180 };
const roofPath = `M${BODY.x - 40} ${BODY.y + 6} L${APEX.x} ${APEX.y} L${BODY.x + BODY.w + 40} ${BODY.y + 6} Z`;
const windows = [
  { x: 380, y: 380, w: 110, h: 100 },
  { x: 710, y: 380, w: 110, h: 100 },
];
const door = { x: 560, y: 410, w: 80, h: 150 };

function studs(x: number, y: number, w: number, h: number, gap = 26) {
  let out = "";
  for (let sx = x; sx <= x + w; sx += gap) out += `<rect x="${sx}" y="${y}" width="7" height="${h}" fill="#d9b27c" stroke="#b88a52" stroke-width="1"/>`;
  return out + `<rect x="${x}" y="${y}" width="${w + 7}" height="9" fill="#c99a5f"/><rect x="${x}" y="${y + h - 9}" width="${w + 7}" height="9" fill="#c99a5f"/>`;
}

function trusses() {
  let out = "";
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const lx = BODY.x - 40 + t * 0; // all trusses share the same outline, drawn slightly offset for depth
    out += `<path d="M${lx + i * 3} ${BODY.y + 6 - i * 2} L${APEX.x + i * 3} ${APEX.y - i * 2} L${BODY.x + BODY.w + 40 + i * 3} ${BODY.y + 6 - i * 2}" fill="none" stroke="#c99a5f" stroke-width="5" opacity="${0.35 + t * 0.65}"/>`;
  }
  return out + `<path d="M${BODY.x - 10} ${BODY.y - 6} L${APEX.x} ${APEX.y + 20} L${BODY.x + BODY.w + 10} ${BODY.y - 6} M${APEX.x} ${APEX.y + 20} V${BODY.y}" stroke="#b88a52" stroke-width="4" fill="none"/>`;
}

function sidingLines(color: string) {
  let out = `<rect x="${BODY.x}" y="${BODY.y}" width="${BODY.w}" height="${BODY.h}" fill="${color}"/>`;
  for (let y = BODY.y + 14; y < GROUND; y += 16) out += `<line x1="${BODY.x}" y1="${y}" x2="${BODY.x + BODY.w}" y2="${y}" stroke="#000" stroke-opacity=".12" stroke-width="2"/>`;
  return out;
}

function shingles(color: string) {
  let out = `<path d="${roofPath}" fill="${color}"/>`;
  for (let y = APEX.y + 22; y < BODY.y; y += 18) {
    const t = (y - APEX.y) / (BODY.y + 6 - APEX.y);
    const half = t * (BODY.w / 2 + 40);
    out += `<line x1="${APEX.x - half}" y1="${y}" x2="${APEX.x + half}" y2="${y}" stroke="#000" stroke-opacity=".18" stroke-width="2"/>`;
  }
  return out;
}

function glass(lit: boolean) {
  return windows
    .map(
      (w) => `<rect x="${w.x - 8}" y="${w.y - 8}" width="${w.w + 16}" height="${w.h + 16}" fill="#f4f1ea"/>
      <rect x="${w.x}" y="${w.y}" width="${w.w}" height="${w.h}" fill="${lit ? "#ffd98a" : "#2c4a66"}"/>
      <path d="M${w.x + w.w / 2} ${w.y} V${w.y + w.h} M${w.x} ${w.y + w.h / 2} H${w.x + w.w}" stroke="#f4f1ea" stroke-width="6"/>`,
    )
    .join("");
}

/** A house at a stage of construction. `seed` varies clouds, trees, and colors. */
export function house(stage: Stage, seed: number, label = "") {
  const r = rng(seed);
  const sidingColors = ["#8a9a8f", "#b7a68a", "#6f7f94", "#c8c2b4", "#9b6b55"];
  const roofColors = ["#3b3f45", "#5a4a42", "#2f3a46"];
  const siding = sidingColors[seed % sidingColors.length];
  const roof = roofColors[seed % roofColors.length];
  let body = sky(r, stage === "complete" && seed % 3 === 0);
  body += trees(r, [90 + r() * 60, W - 120 - r() * 60]);

  if (stage === "lot" || stage === "foundation" || stage === "framing") body += ground("#8b6b4a");
  else body += ground(stage === "complete" ? "#6fa05a" : "#9a7b57");

  if (stage === "lot") {
    body += `<path d="M260 ${GROUND + 20} Q 420 ${GROUND - 60} 600 ${GROUND + 10} T 940 ${GROUND + 25}" fill="#a07e57"/>`;
    for (const [x, y] of [[330, 600], [870, 600], [330, 690], [870, 690]]) {
      body += `<rect x="${x}" y="${y - 50}" width="8" height="58" fill="#d9b27c"/><path d="M${x + 8} ${y - 50} l34 9 l-34 9 z" fill="#ff7a1a"/>`;
    }
    body += `<path d="M334 600 H874 M334 690 H874 M334 600 V690 M874 600 V690" stroke="#ff7a1a" stroke-width="2" stroke-dasharray="8 6"/>`;
    body += `<g transform="translate(980 ${GROUND - 20})"><rect x="0" y="40" width="150" height="40" rx="10" fill="#333"/><rect x="20" y="-10" width="80" height="55" fill="#f2b705"/><rect x="34" y="0" width="40" height="28" fill="#9cc3dd"/><path d="M95 5 L170 -60 L190 -40 L120 20 Z" fill="#f2b705"/><path d="M180 -55 l30 50 h-40 z" fill="#555"/></g>`;
  }
  if (stage === "foundation") {
    body += `<rect x="${BODY.x - 10}" y="${GROUND - 40}" width="${BODY.w + 20}" height="60" fill="#b9b9b5"/><rect x="${BODY.x - 10}" y="${GROUND - 40}" width="${BODY.w + 20}" height="10" fill="#d4d4d0"/>`;
    for (let x = BODY.x + 10; x < BODY.x + BODY.w; x += 45) body += `<rect x="${x}" y="${GROUND - 78}" width="4" height="40" fill="#8a4b2a"/>`;
    body += `<rect x="${BODY.x - 30}" y="${GROUND - 46}" width="12" height="70" fill="#d9b27c"/><rect x="${BODY.x + BODY.w + 18}" y="${GROUND - 46}" width="12" height="70" fill="#d9b27c"/>`;
    body += `<g transform="translate(940 ${GROUND - 120})"><rect width="170" height="90" rx="8" fill="#e9e9e9"/><circle cx="35" cy="98" r="18" fill="#333"/><circle cx="135" cy="98" r="18" fill="#333"/><ellipse cx="110" cy="10" rx="55" ry="40" fill="#cfcfcf"/></g>`;
  }
  if (stage === "framing") {
    body += `<rect x="${BODY.x - 10}" y="${GROUND - 12}" width="${BODY.w + 20}" height="22" fill="#b9b9b5"/>`;
    body += studs(BODY.x, BODY.y, BODY.w, BODY.h - 10) + trusses();
    for (const w of windows) body += `<rect x="${w.x}" y="${w.y}" width="${w.w}" height="${w.h}" fill="#8b6b4a" fill-opacity=".0" stroke="#c99a5f" stroke-width="9"/>`;
    body += `<rect x="${door.x}" y="${door.y}" width="${door.w}" height="${door.h - 10}" fill="none" stroke="#c99a5f" stroke-width="9"/>`;
  }
  if (stage === "dried-in") {
    body += `<rect x="${BODY.x}" y="${BODY.y}" width="${BODY.w}" height="${BODY.h}" fill="#f4f6f8"/>`;
    for (let y = BODY.y + 30; y < GROUND; y += 60) body += `<text x="${BODY.x + 30}" y="${y}" font-family="Arial" font-size="22" fill="#2b6cb0" opacity=".45" letter-spacing="6">HOUSEWRAP · HOUSEWRAP · HOUSEWRAP</text>`;
    body += `<path d="${roofPath}" fill="#c9a46b"/>` + shingles(roof).replace(roofPath, `M${BODY.x - 40} ${BODY.y + 6} L${APEX.x - 120} ${APEX.y + 60} L${APEX.x + 140} ${APEX.y + 60} L${BODY.x + BODY.w + 40} ${BODY.y + 6} Z`);
    body += glass(false) + `<rect x="${door.x}" y="${door.y}" width="${door.w}" height="${door.h}" fill="#5b4636"/>`;
  }
  if (stage === "siding") {
    body += sidingLines(siding) + `<rect x="${BODY.x + BODY.w * 0.6}" y="${BODY.y}" width="${BODY.w * 0.4}" height="${BODY.h}" fill="#f4f6f8"/>`;
    body += shingles(roof) + glass(false) + `<rect x="${door.x}" y="${door.y}" width="${door.w}" height="${door.h}" fill="#5b4636"/>`;
    for (let x = BODY.x + BODY.w * 0.6; x <= BODY.x + BODY.w + 20; x += 80) body += `<rect x="${x}" y="${BODY.y - 20}" width="8" height="${BODY.h + 20}" fill="#9aa3ad"/>`;
    for (const y of [420, 500]) body += `<rect x="${BODY.x + BODY.w * 0.6 - 10}" y="${y}" width="${BODY.w * 0.4 + 40}" height="12" fill="#c99a5f"/>`;
  }
  if (stage === "complete") {
    body += sidingLines(siding) + shingles(roof) + glass(seed % 3 === 0);
    body += `<rect x="${door.x}" y="${door.y}" width="${door.w}" height="${door.h}" fill="#7a3b2e"/><circle cx="${door.x + 64}" cy="${door.y + 80}" r="5" fill="#e0c068"/>`;
    body += `<path d="M${door.x + 10} ${GROUND} L${door.x - 60} ${H} H${door.x + door.w + 60} L${door.x + door.w - 10} ${GROUND} Z" fill="#c8bfae"/>`;
    for (const x of [360, 450, 760, 840]) body += `<ellipse cx="${x}" cy="${GROUND + 4}" rx="44" ry="26" fill="#3f7a3a"/>`;
  }
  return svg(body, label);
}

/** A metal shop building with a roll-up door. */
export function shop(seed: number, label = "") {
  const r = rng(seed);
  let body = sky(r) + trees(r, [120, W - 140]) + ground("#a39a86");
  body += `<path d="M300 300 L600 210 L900 300 V${GROUND} H300 Z" fill="#c4ccd3"/>`;
  for (let x = 310; x < 900; x += 22) body += `<line x1="${x}" y1="${x < 600 ? 300 - ((x - 300) / 300) * 90 : 210 + ((x - 600) / 300) * 90}" x2="${x}" y2="${GROUND}" stroke="#9aa5ae" stroke-width="3"/>`;
  body += `<path d="M285 304 L600 200 L915 304" stroke="#4a5560" stroke-width="18" fill="none"/>`;
  body += `<rect x="420" y="340" width="240" height="220" fill="#e9edf0" stroke="#7b8790" stroke-width="6"/>`;
  for (let y = 360; y < GROUND; y += 20) body += `<line x1="420" y1="${y}" x2="660" y2="${y}" stroke="#7b8790" stroke-width="2"/>`;
  body += `<rect x="720" y="420" width="70" height="140" fill="#5a6670"/>`;
  return svg(body, label);
}

/** An interior room. */
export function room(kind: Room, seed: number, label = "") {
  const cabinet = ["#f3f1ec", "#2f3e4e", "#7b8d78", "#d8cbb5"][seed % 4];
  let body = `<rect width="${W}" height="${H}" fill="#efe9df"/>`;
  if (kind === "kitchen") {
    body += `<rect y="600" width="${W}" height="200" fill="#b98d5f"/>`;
    for (let x = 0; x < W; x += 120) body += `<line x1="${x}" y1="600" x2="${x - 60}" y2="${H}" stroke="#000" stroke-opacity=".1" stroke-width="3"/>`;
    body += `<rect x="80" y="90" width="1040" height="200" fill="${cabinet}" stroke="#0002"/>`;
    for (let x = 80; x < 1120; x += 130) body += `<rect x="${x + 10}" y="100" width="110" height="180" fill="none" stroke="#0003" stroke-width="3"/>`;
    body += `<rect x="80" y="290" width="1040" height="130" fill="#ffffff"/>`;
    for (let y = 290; y < 420; y += 26) for (let x = 80 + ((y / 26) % 2) * 26; x < 1120; x += 52) body += `<rect x="${x}" y="${y}" width="50" height="24" fill="#e8eef2" stroke="#d0d8de"/>`;
    body += `<rect x="70" y="420" width="1060" height="24" fill="#e5e2dc"/><rect x="80" y="444" width="1040" height="156" fill="${cabinet}" stroke="#0002"/>`;
    for (let x = 80; x < 1120; x += 130) body += `<rect x="${x + 10}" y="456" width="110" height="132" fill="none" stroke="#0003" stroke-width="3"/>`;
    body += `<rect x="330" y="560" width="540" height="180" fill="${cabinet}" stroke="#0003"/><rect x="310" y="540" width="580" height="26" fill="#e5e2dc"/>`;
    for (const x of [430, 600, 770]) body += `<line x1="${x}" y1="0" x2="${x}" y2="300" stroke="#333" stroke-width="3"/><path d="M${x - 40} 340 Q ${x} 270 ${x + 40} 340 Z" fill="#2b2b2b"/><ellipse cx="${x}" cy="342" rx="40" ry="8" fill="#ffe7a8"/>`;
  }
  if (kind === "bath") {
    for (let y = 0; y < 600; y += 60) for (let x = 0; x < W; x += 60) body += `<rect x="${x}" y="${y}" width="58" height="58" fill="${seed % 2 ? "#dfe7ea" : "#ece7df"}"/>`;
    body += `<rect y="600" width="${W}" height="200" fill="#8f9aa1"/>`;
    for (let x = 0; x < W; x += 100) body += `<line x1="${x}" y1="600" x2="${x}" y2="${H}" stroke="#7d878e" stroke-width="3"/>`;
    body += `<rect x="120" y="170" width="360" height="250" rx="12" fill="#cfe3ea" stroke="#9aa" stroke-width="10"/>`;
    body += `<rect x="90" y="440" width="420" height="200" fill="${cabinet}" stroke="#0003"/><rect x="80" y="430" width="440" height="22" fill="#f4f2ee"/><ellipse cx="300" cy="440" rx="80" ry="12" fill="#e2e8ea"/>`;
    body += `<rect x="640" y="80" width="460" height="560" fill="#bfd9e2" fill-opacity=".35" stroke="#9fb4bc" stroke-width="8"/><circle cx="870" cy="160" r="34" fill="#9aa5ab"/>`;
  }
  if (kind === "living") {
    body += `<rect y="580" width="${W}" height="220" fill="#a8774c"/>`;
    for (let y = 600; y < H; y += 36) body += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#000" stroke-opacity=".12" stroke-width="2"/>`;
    body += `<rect x="380" y="120" width="440" height="330" fill="#cfe6f5" stroke="#f8f8f8" stroke-width="18"/><path d="M600 120 V450 M380 285 H820" stroke="#f8f8f8" stroke-width="10"/>`;
    body += `<rect x="300" y="480" width="600" height="140" rx="30" fill="${cabinet === "#f3f1ec" ? "#56677a" : cabinet}"/><rect x="280" y="450" width="70" height="170" rx="20" fill="#4a5a6c"/><rect x="850" y="450" width="70" height="170" rx="20" fill="#4a5a6c"/>`;
  }
  return svg(body, label);
}

export type Pattern = "grid" | "subway" | "herringbone" | "hex";

/** A tile sample. */
export function tile(color: string, grout: string, pattern: Pattern, label = "") {
  let body = `<rect width="${W}" height="${H}" fill="${grout}"/>`;
  if (pattern === "grid") for (let y = 0; y < H; y += 100) for (let x = 0; x < W; x += 100) body += `<rect x="${x + 3}" y="${y + 3}" width="94" height="94" fill="${color}"/>`;
  if (pattern === "subway") for (let y = 0; y < H; y += 60) for (let x = (y / 60) % 2 ? -60 : 0; x < W; x += 120) body += `<rect x="${x + 3}" y="${y + 3}" width="114" height="54" rx="3" fill="${color}"/>`;
  if (pattern === "herringbone")
    for (let y = -200; y < H + 200; y += 60)
      for (let x = -200; x < W + 200; x += 120)
        body += `<rect x="${x + 3}" y="${y + 3}" width="114" height="54" fill="${color}" transform="rotate(45 ${x} ${y})"/><rect x="${x + 3}" y="${y + 3}" width="114" height="54" fill="${color}" opacity=".88" transform="rotate(-45 ${x + 120} ${y})"/>`;
  if (pattern === "hex")
    for (let row = 0, y = 0; y < H + 60; row++, y += 52)
      for (let x = row % 2 ? 45 : 0; x < W + 60; x += 90)
        body += `<path transform="translate(${x} ${y})" d="M0 -40 L35 -20 V20 L0 40 L-35 20 V-20 Z" fill="${color}"/>`;
  return svg(body, label);
}

/** A paint chip with its color name. */
export function paint(color: string, name: string, label = "") {
  return svg(
    `<rect width="${W}" height="${H}" fill="#f4f1ea"/><rect x="200" y="120" width="800" height="460" rx="12" fill="${color}"/>
     <text x="600" y="660" font-family="Arial" font-size="44" text-anchor="middle" fill="#333">${name}</text>`,
    label,
  );
}

/** Wood flooring planks. */
export function planks(color: string, label = "") {
  const r = rng(color.length * 97 + color.charCodeAt(1));
  let body = `<rect width="${W}" height="${H}" fill="${color}"/>`;
  for (let y = 0; y < H; y += 80) {
    let x = -r() * 300;
    while (x < W) {
      const len = 260 + r() * 340;
      body += `<rect x="${x}" y="${y}" width="${len - 3}" height="77" fill="${color}" stroke="#000" stroke-opacity=".18" stroke-width="2"/>`;
      body += `<path d="M${x + 20} ${y + 25 + r() * 30} q ${len / 3} ${-10 + r() * 20} ${len - 60} 0" stroke="#000" stroke-opacity=".08" stroke-width="3" fill="none"/>`;
      x += len;
    }
  }
  return svg(body, label);
}

/** A stone countertop sample. */
export function counter(base: string, fleck: string, label = "") {
  const r = rng(base.charCodeAt(2) * 31 + fleck.charCodeAt(3));
  let body = `<rect width="${W}" height="${H}" fill="${base}"/>`;
  for (let i = 0; i < 700; i++) body += `<circle cx="${r() * W}" cy="${r() * H}" r="${1 + r() * 4}" fill="${fleck}" opacity="${0.3 + r() * 0.6}"/>`;
  for (let i = 0; i < 5; i++) body += `<path d="M${r() * W} 0 Q ${r() * W} ${H / 2} ${r() * W} ${H}" stroke="${fleck}" stroke-opacity=".25" stroke-width="${2 + r() * 4}" fill="none"/>`;
  return svg(body, label);
}

/** What opens when someone views a non-photo file (a plan, permit, contract…) in the demo. */
export function sampleDocument(name: string) {
  const html = `<!doctype html><meta charset="utf-8"><title>${name}</title>
    <body style="font-family:Arial,sans-serif;max-width:640px;margin:60px auto;padding:0 20px;color:#333">
    <p style="display:inline-block;background:#fdf3dc;color:#8a6100;padding:6px 12px;border-radius:99px;font-weight:700">SAMPLE FILE</p>
    <h1>${name}</h1><p>This is a demo. In the real portal, this would open the actual file (a PDF of the plans, a permit, a signed contract…).</p></body>`;
  return blobUrl(html, "text/html");
}
