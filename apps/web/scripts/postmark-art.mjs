// Draws the Postmark background art into public/postmark: `node scripts/postmark-art.mjs`.
// SVG backgrounds cannot read CSS variables, so each file is drawn once per colour scheme.
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = new URL("../public/postmark/", import.meta.url);
mkdirSync(OUT, { recursive: true });

const SCHEMES = {
  light: { ink: "#1f2a44", paper: "#f6f1e7", card: "#fffdf8", red: "#b63a24", bun: "#f1d29b", inkOpacity: 0.2, textOpacity: 0.4 },
  dark: { ink: "#efe8d8", paper: "#141925", card: "#1b2130", red: "#c2452d", bun: "#e9c98e", inkOpacity: 0.16, textOpacity: 0.32 },
};

const svg = (viewBox, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" preserveAspectRatio="xMidYMid slice">${body}</svg>`;

function art(c) {
  const waves = (x0, y0, rows, length) => {
    let s = "";
    for (let i = 0; i < rows; i++) {
      let d = `M${x0} ${y0 + i * 16}`;
      for (let x = 0; x < length; x += 40) d += " q10 -7 20 0 t20 0";
      s += `<path d="${d}" fill="none" stroke="${c.ink}" stroke-opacity="${c.inkOpacity * 0.8}" stroke-width="2"/>`;
    }
    return s;
  };

  // Town over the top arc, a word under the bottom arc (both upright), the date in the middle.
  // Text paths sit in <defs> so they are never stroked; radii keep every glyph inside the inner ring.
  const postmark = (cx, cy, r, top, bottom, rot) => {
    const inner = r - 12;
    const topR = inner - 15;
    const botR = inner - 5;
    const id = `pm${cx}x${cy}`;
    const label = (href, text) =>
      `<text font-family="Georgia,serif" font-size="13" letter-spacing="1.5" fill="${c.ink}" fill-opacity="${c.textOpacity}"><textPath href="#${href}" startOffset="50%" text-anchor="middle">${text}</textPath></text>`;
    return (
      `<defs><path id="${id}t" d="M${cx - topR} ${cy} A${topR} ${topR} 0 0 1 ${cx + topR} ${cy}"/>` +
      `<path id="${id}b" d="M${cx - botR} ${cy} A${botR} ${botR} 0 0 0 ${cx + botR} ${cy}"/></defs>` +
      `<g transform="rotate(${rot} ${cx} ${cy})">` +
      `<g fill="none" stroke="${c.ink}" stroke-opacity="${c.inkOpacity}" stroke-width="2"><circle cx="${cx}" cy="${cy}" r="${r}"/><circle cx="${cx}" cy="${cy}" r="${inner}"/></g>` +
      label(`${id}t`, top) +
      label(`${id}b`, bottom) +
      `<text x="${cx}" y="${cy + 5}" text-anchor="middle" font-family="Georgia,serif" font-size="14" letter-spacing="1" fill="${c.ink}" fill-opacity="${c.textOpacity}">NOV 2026</text></g>`
    );
  };

  // A perforated stamp with a loaf on it: the corner bakery.
  const stamp = (x, y, rot) => {
    let perforation = "";
    for (let i = 0; i <= 8; i++) perforation += `<circle cx="${x + i * 15}" cy="${y}" r="4" fill="${c.paper}"/><circle cx="${x + i * 15}" cy="${y + 150}" r="4" fill="${c.paper}"/>`;
    for (let i = 0; i <= 10; i++) perforation += `<circle cx="${x}" cy="${y + i * 15}" r="4" fill="${c.paper}"/><circle cx="${x + 120}" cy="${y + i * 15}" r="4" fill="${c.paper}"/>`;
    return (
      `<g transform="rotate(${rot} ${x + 60} ${y + 75})"><rect x="${x}" y="${y}" width="120" height="150" fill="${c.card}"/>` +
      `<rect x="${x + 12}" y="${y + 12}" width="96" height="126" fill="${c.red}"/>` +
      `<path d="M${x + 26} ${y + 100} C${x + 26} ${y + 58} ${x + 94} ${y + 58} ${x + 94} ${y + 100} Z" fill="${c.bun}"/>` +
      `<path d="M${x + 44} ${y + 74} l8 12 M${x + 58} ${y + 70} l8 12 M${x + 72} ${y + 74} l8 12" stroke="${c.red}" stroke-width="3" stroke-linecap="round"/>` +
      `<text x="${x + 60}" y="${y + 128}" text-anchor="middle" font-family="Georgia,serif" font-size="12" fill="#fffdf8">LOCAL MAIL</text>${perforation}</g>`
    );
  };

  return {
    // Desktop hero: everything right of the headline or below the buttons.
    hero: svg(
      "0 0 1440 900",
      waves(820, 120, 5, 520) +
        postmark(1250, 170, 95, "DIRECONNECT", "DELIVERED", -12) +
        postmark(150, 790, 80, "FIRST CLASS", "LOCAL", 8) +
        waves(-40, 850, 3, 480) +
        stamp(1330, 700, 9),
    ),
    auth: svg(
      "0 0 1440 900",
      waves(60, 140, 5, 420) +
        waves(980, 640, 5, 420) +
        postmark(1180, 250, 90, "DIRECONNECT", "DELIVERED", -10) +
        postmark(250, 690, 76, "FIRST CLASS", "LOCAL", 12) +
        stamp(170, 170, -8),
    ),
    // Phones and tablets: one postmark tucked into the top-right corner, clear of the headline.
    phone: svg("0 0 400 260", postmark(330, 92, 70, "DIRECONNECT", "DELIVERED", -12) + waves(150, 24, 3, 180)),
  };
}

for (const [scheme, colours] of Object.entries(SCHEMES)) {
  const files = art(colours);
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(new URL(`${name}${scheme === "dark" ? "-dark" : ""}.svg`, OUT), body);
  }
}
console.log("Postmark art written to public/postmark");
