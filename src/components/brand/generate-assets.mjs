// Rebuild with: node src/components/brand/generate-assets.mjs
// Asset tooling only; this file is never imported by the application.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const createFont = require("next/dist/compiled/@next/font/dist/fontkit").default;
const font = createFont(await readFile(
  "node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2",
));
const forest = "#204c3c";
const lime = "#d5f477";

// Reconstructed from the owner's public/images/symbol.svg: mortarboard and notebook.
// Flat two-colour geometry; no embedded raster, filters, fonts or external resources.
function symbol({ dark = false, small = false } = {}) {
  return `<rect width="100" height="100" rx="22" fill="${forest}"/>
${dark ? `<rect x="1.5" y="1.5" width="97" height="97" rx="20.5" fill="none" stroke="${lime}" stroke-width="3"/>` : ""}
<g fill="${lime}">
  <path d="M37 25v7c0 5 5.8 8.5 13 8.5S63 37 63 32v-7Z"/>
  <path d="m50 9 29 11.5L50 32 21 20.5Z"/>
  <path d="M21 36h4l2 8h-8Z"/>
  <rect x="14" y="51" width="34" height="35" rx="3.5"/>
  <rect x="52" y="51" width="34" height="35" rx="3.5"/>
</g>
<path d="M50 20.5q-23 0-27 4" fill="none" stroke="${forest}" stroke-width="3" stroke-linecap="round"/>
<path d="M23 25v12" fill="none" stroke="${lime}" stroke-width="3" stroke-linecap="round"/>
<circle cx="50" cy="20.5" r="2.2" fill="${forest}"/>
${small ? `<path d="M21 62h19m-19 12h14m25-12h17m-17 12h17" fill="none" stroke="${forest}" stroke-width="4" stroke-linecap="round"/>` : `<g fill="none" stroke="${forest}" stroke-width="2.5" stroke-linecap="round">
  <path d="M20 60h22m-22 9h22m-22 9h15M64 60h15m-15 9h15m-15 9h10"/>
  <ellipse cx="50" cy="56" rx="3.8" ry="2"/>
  <ellipse cx="50" cy="68" rx="3.8" ry="2"/>
  <ellipse cx="50" cy="80" rx="3.8" ry="2"/>
</g><g fill="${forest}"><circle cx="58" cy="60" r="1.8"/><circle cx="58" cy="69" r="1.8"/><circle cx="58" cy="78" r="1.8"/></g>`}`;
}

function lettering(text, size, x, baseline, color, tracking = -0.025) {
  const run = font.layout(text);
  const scale = size / font.unitsPerEm;
  let cursor = 0;
  const paths = run.glyphs.map((glyph, i) => {
    const position = run.positions[i];
    const path = `<path transform="translate(${(x + cursor + position.xOffset * scale).toFixed(3)} ${(baseline - position.yOffset * scale).toFixed(3)}) scale(${scale} ${-scale})" d="${glyph.path.toSVG()}"/>`;
    cursor += position.xAdvance * scale + size * tracking;
    return path;
  });
  return { markup: `<g fill="${color}">${paths.join("")}</g>`, width: cursor };
}

function svg(width, height, body, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>\n`;
}

await mkdir("public/brand", { recursive: true });
const wordmark = lettering("prácticascol.", 60, 124, 68, forest);
const width = Math.ceil(124 + wordmark.width + 4);
const lightLogo = svg(width, 100, symbol() + wordmark.markup, "prácticascol.");
const darkLogo = svg(width, 100, symbol({ dark: true }) + lettering("prácticascol.", 60, 124, 68, lime).markup, "prácticascol.");
const icon = svg(100, 100, symbol({ small: true }), "PrácticasCol");
await writeFile("public/brand/symbol.svg", svg(100, 100, symbol(), "PrácticasCol"));
await writeFile("public/brand/logo.svg", lightLogo);
await writeFile("public/brand/logo-dark.svg", darkLogo);
await writeFile("src/app/icon.svg", icon);

const apple = svg(120, 120, `<path fill="${forest}" d="M0 0h120v120H0Z"/><g transform="translate(10 10)">${symbol()}</g>`, "PrácticasCol");
await sharp(Buffer.from(apple)).resize(180, 180).png().toFile("src/app/apple-icon.png");

// Replace the scaffold favicon too, so browsers cannot choose the old mark.
const sizes = [16, 32, 48];
const pngs = await Promise.all(sizes.map(size => sharp(Buffer.from(icon)).resize(size, size).png().toBuffer()));
const ico = Buffer.alloc(6 + 16 * sizes.length);
ico.writeUInt16LE(1, 2);
ico.writeUInt16LE(sizes.length, 4);
let offset = ico.length;
pngs.forEach((png, i) => {
  const entry = 6 + 16 * i;
  ico[entry] = sizes[i]; ico[entry + 1] = sizes[i];
  ico.writeUInt16LE(1, entry + 4); ico.writeUInt16LE(32, entry + 6);
  ico.writeUInt32LE(png.length, entry + 8); ico.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
await writeFile("src/app/favicon.ico", Buffer.concat([ico, ...pngs]));

const logoScale = 1000 / width;
const og = svg(1200, 630,
  `<path fill="${forest}" d="M0 0h1200v630H0Z"/>
  <g transform="translate(100 140) scale(${logoScale})">${symbol({ dark: true })}${lettering("prácticascol.", 60, 124, 68, lime).markup}</g>
  ${lettering("Tu formación tiene un próximo paso.", 40, 100, 445, lime, -0.02).markup}
  ${lettering("Prácticas y pasantías en el Valle de Aburrá", 28, 100, 505, lime, 0).markup}`,
  "PrácticasCol — Tu formación tiene un próximo paso.");
await sharp(Buffer.from(og)).png().toFile("src/app/opengraph-image.png");
await writeFile("src/app/opengraph-image.alt.txt", "PrácticasCol: birrete y cuaderno abierto. Prácticas y pasantías en el Valle de Aburrá.\n");
console.log(`Brand assets generated. Lockup: ${width} × 100; Apple: 180 × 180; OG: 1200 × 630.`);
