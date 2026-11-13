const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Ensure directories exist
const publicDir = path.resolve(__dirname, '../public');
const iconsDir = path.resolve(publicDir, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 1. Standard Logo SVG (with luxury rounded square background & gold glowing crown)
const standardSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#081712"/>
      <stop offset="50%" stop-color="#040A08"/>
      <stop offset="100%" stop-color="#020403"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FCE59F"/>
      <stop offset="35%" stop-color="#D4AF37"/>
      <stop offset="70%" stop-color="#AA820A"/>
      <stop offset="100%" stop-color="#E5C158"/>
    </linearGradient>
    <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Background container -->
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)"/>
  <rect width="504" height="504" x="4" y="4" rx="108" fill="none" stroke="url(#goldGrad)" stroke-width="3" stroke-opacity="0.4"/>

  <!-- Radial ambiance -->
  <circle cx="256" cy="270" r="160" fill="#D4AF37" opacity="0.09" filter="url(#goldGlow)"/>

  <!-- Lumière Royal Crown -->
  <g id="crown-emblem" transform="translate(0, 10)">
    <!-- Base arch -->
    <path d="M136 364 h240 v18 a12 12 0 0 1 -12 12 h-216 a12 12 0 0 1 -12 -12 z" fill="url(#goldGrad)"/>
    <path d="M144 344 h224 v12 h-224 z" fill="url(#goldGrad)" opacity="0.85"/>
    
    <!-- Five crown peaks -->
    <!-- Middle peak -->
    <path d="M256 142 L290 334 H222 Z" fill="url(#goldGrad)"/>
    <!-- Left-center peak -->
    <path d="M196 186 L236 334 H180 Z" fill="url(#goldGrad)"/>
    <!-- Right-center peak -->
    <path d="M316 186 L332 334 H276 Z" fill="url(#goldGrad)"/>
    <!-- Left outer peak -->
    <path d="M142 240 L182 334 H134 Z" fill="url(#goldGrad)"/>
    <!-- Right outer peak -->
    <path d="M370 240 L378 334 H330 Z" fill="url(#goldGrad)"/>

    <!-- Peak jewels / orbs -->
    <circle cx="142" cy="230" r="12" fill="url(#goldGrad)"/>
    <circle cx="196" cy="174" r="14" fill="url(#goldGrad)"/>
    <circle cx="256" cy="128" r="18" fill="url(#goldGrad)"/>
    <circle cx="316" cy="174" r="14" fill="url(#goldGrad)"/>
    <circle cx="370" cy="230" r="12" fill="url(#goldGrad)"/>
  </g>
</svg>
`;

// 2. Maskable SVG (Full bleed rectangular background, with crown scaled to 75% inside safe zone 80% circle)
const maskableSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGradMask" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#081712"/>
      <stop offset="50%" stop-color="#040A08"/>
      <stop offset="100%" stop-color="#020403"/>
    </linearGradient>
    <linearGradient id="goldGradMask" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FCE59F"/>
      <stop offset="35%" stop-color="#D4AF37"/>
      <stop offset="70%" stop-color="#AA820A"/>
      <stop offset="100%" stop-color="#E5C158"/>
    </linearGradient>
    <filter id="goldGlowMask" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Full-bleed background for Android maskable cropping -->
  <rect width="512" height="512" fill="url(#bgGradMask)"/>
  <circle cx="256" cy="256" r="236" fill="none" stroke="url(#goldGradMask)" stroke-width="2" stroke-opacity="0.25"/>

  <!-- Radial ambiance -->
  <circle cx="256" cy="265" r="140" fill="#D4AF37" opacity="0.08" filter="url(#goldGlowMask)"/>

  <!-- Lumière Royal Crown scaled down to ~76% and perfectly centered in safe zone -->
  <g id="crown-emblem" transform="translate(62, 60) scale(0.76)">
    <!-- Base arch -->
    <path d="M136 364 h240 v18 a12 12 0 0 1 -12 12 h-216 a12 12 0 0 1 -12 -12 z" fill="url(#goldGradMask)"/>
    <path d="M144 344 h224 v12 h-224 z" fill="url(#goldGradMask)" opacity="0.85"/>
    
    <!-- Five crown peaks -->
    <!-- Middle peak -->
    <path d="M256 142 L290 334 H222 Z" fill="url(#goldGradMask)"/>
    <!-- Left-center peak -->
    <path d="M196 186 L236 334 H180 Z" fill="url(#goldGradMask)"/>
    <!-- Right-center peak -->
    <path d="M316 186 L332 334 H276 Z" fill="url(#goldGradMask)"/>
    <!-- Left outer peak -->
    <path d="M142 240 L182 334 H134 Z" fill="url(#goldGradMask)"/>
    <!-- Right outer peak -->
    <path d="M370 240 L378 334 H330 Z" fill="url(#goldGradMask)"/>

    <!-- Peak jewels / orbs -->
    <circle cx="142" cy="230" r="12" fill="url(#goldGradMask)"/>
    <circle cx="196" cy="174" r="14" fill="url(#goldGradMask)"/>
    <circle cx="256" cy="128" r="18" fill="url(#goldGradMask)"/>
    <circle cx="316" cy="174" r="14" fill="url(#goldGradMask)"/>
    <circle cx="370" cy="230" r="12" fill="url(#goldGradMask)"/>
  </g>
</svg>
`;

async function generate() {
  console.log('Generating crisp, valid PWA icons...');
  const stdBuf = Buffer.from(standardSvg);
  const maskBuf = Buffer.from(maskableSvg);

  // 1. pwa-512x512.png
  await sharp(stdBuf).resize(512, 512).png().toFile(path.join(publicDir, 'pwa-512x512.png'));
  await sharp(stdBuf).resize(512, 512).png().toFile(path.join(iconsDir, 'icon-512x512.png'));

  // 2. pwa-192x192.png
  await sharp(stdBuf).resize(192, 192).png().toFile(path.join(publicDir, 'pwa-192x192.png'));
  await sharp(stdBuf).resize(192, 192).png().toFile(path.join(iconsDir, 'icon-192x192.png'));

  // 3. maskable-icon-512x512.png
  await sharp(maskBuf).resize(512, 512).png().toFile(path.join(publicDir, 'maskable-icon-512x512.png'));
  await sharp(maskBuf).resize(512, 512).png().toFile(path.join(iconsDir, 'icon-maskable-512x512.png'));

  // 4. maskable-icon-192x192.png
  await sharp(maskBuf).resize(192, 192).png().toFile(path.join(iconsDir, 'icon-maskable-192x192.png'));

  // 5. apple-touch-icon.png (180x180 px for iOS Safari)
  await sharp(stdBuf).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'));
  await sharp(stdBuf).resize(180, 180).png().toFile(path.join(iconsDir, 'apple-touch-icon.png'));

  // 6. favicon.ico / favicon.png (48x48)
  await sharp(stdBuf).resize(48, 48).png().toFile(path.join(publicDir, 'favicon.ico'));

  // Also update public/favicon.svg
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), standardSvg.trim(), 'utf8');

  console.log('All PWA icon assets generated successfully and verified!');
}

generate().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
