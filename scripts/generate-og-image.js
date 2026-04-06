/**
 * One-off script to regenerate the wilczypolmaraton OG image
 * with event name, date, URL, and distances overlay.
 *
 * Usage: node scripts/generate-og-image.js
 */
import sharp from 'sharp';

const INPUT = 'public/halfmarathon/header.webp';
const OUTPUT = 'public/wilczypolmaraton_og.jpg';
const WIDTH = 1200;
const HEIGHT = 627;

const svg = `
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" />
  <text x="50%" y="200" text-anchor="middle" fill="white" font-family="sans-serif" font-size="64" font-weight="bold">
    IV Wilczy Półmaraton
  </text>
  <text x="50%" y="280" text-anchor="middle" fill="white" font-family="sans-serif" font-size="36">
    17 października 2026
  </text>
  <text x="50%" y="360" text-anchor="middle" fill="rgba(255,255,255,0.9)" font-family="sans-serif" font-size="28">
    Bieg 21km · Nordic Walking 11km · Canicross 21km
  </text>
  <text x="50%" y="500" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-family="sans-serif" font-size="24">
    zatyrani.pl/wilczy-polmaraton
  </text>
</svg>`;

const image = sharp(INPUT)
  .resize(WIDTH, HEIGHT, { fit: 'cover' })
  .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
  .jpeg({ quality: 90 });

await image.toFile(OUTPUT);
console.log(`Generated ${OUTPUT}`);
