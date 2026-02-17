/**
 * Generate PWA icons as PNG from inline SVG using Node canvas-free approach.
 * Uses sharp if available, otherwise creates minimal valid PNGs via a
 * temporary HTML file rendered with sips (macOS).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');

const svgIcon = (size, maskable = false) => {
  const pad = maskable ? size * 0.1 : 0;
  const inner = size - pad * 2;
  const cx = size / 2;
  const cy = size / 2;
  const shieldScale = inner / 100;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${maskable ? 0 : size * 0.18}" fill="#0A0B0F"/>
  <g transform="translate(${cx}, ${cy}) scale(${shieldScale})">
    <!-- Shield body -->
    <path d="M0,-42 C18,-42 36,-36 36,-24 L36,0 C36,20 18,36 0,44 C-18,36 -36,20 -36,0 L-36,-24 C-36,-36 -18,-42 0,-42Z"
          fill="url(#grad)" stroke="#818CF8" stroke-width="1.5"/>
    <!-- Checkmark -->
    <path d="M-14,4 L-4,14 L16,-8" fill="none" stroke="#F0F1F8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <defs>
      <linearGradient id="grad" x1="0" y1="-42" x2="0" y2="44" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#6366F1"/>
        <stop offset="100%" stop-color="#4F46E5"/>
      </linearGradient>
    </defs>
  </g>
</svg>`;
};

const sizes = [
  { name: 'icon-192.png', size: 192, maskable: false },
  { name: 'icon-512.png', size: 512, maskable: false },
  { name: 'icon-maskable-192.png', size: 192, maskable: true },
  { name: 'icon-maskable-512.png', size: 512, maskable: true },
  { name: 'apple-touch-icon.png', size: 180, maskable: false },
];

(async () => {
  let useSharp = false;
  let sharp;
  try {
    sharp = require('sharp');
    useSharp = true;
  } catch {
    console.log('sharp not found, falling back to sips (macOS)');
  }

  for (const { name, size, maskable } of sizes) {
    const svg = svgIcon(size, maskable);
    const outPath = path.join(ICONS_DIR, name);

    if (useSharp) {
      await sharp(Buffer.from(svg)).png().toFile(outPath);
    } else {
      const tmpSvg = path.join(ICONS_DIR, `_tmp_${name}.svg`);
      fs.writeFileSync(tmpSvg, svg);
      try {
        execSync(`sips -s format png "${tmpSvg}" --out "${outPath}" 2>/dev/null`);
      } catch {
        execSync(
          `qlmanage -t -s ${size} -o "${ICONS_DIR}" "${tmpSvg}" 2>/dev/null && mv "${ICONS_DIR}/_tmp_${name}.svg.png" "${outPath}" 2>/dev/null || true`
        );
      }
      fs.unlinkSync(tmpSvg);
    }

    console.log(`✓ ${name} (${size}x${size})`);
  }

  // Copy apple-touch-icon to public root
  const appleSrc = path.join(ICONS_DIR, 'apple-touch-icon.png');
  const appleDst = path.join(ICONS_DIR, '..', 'apple-touch-icon.png');
  if (fs.existsSync(appleSrc)) {
    fs.copyFileSync(appleSrc, appleDst);
    console.log('✓ apple-touch-icon.png → public/');
  }

  console.log('\nDone! Icons generated in public/icons/');
})();
