const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const srcPath = path.resolve(__dirname, '../public/assets/aistudio/file_000000008690820e9c6f986f81627b63_2f9c728c.png');
const publicDir = path.resolve(__dirname, '../public');
const iconsDir = path.resolve(publicDir, 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

async function processLogo() {
  console.log('Processing user uploaded logo from:', srcPath);
  if (!fs.existsSync(srcPath)) {
    throw new Error('Arquivo de logo não encontrado: ' + srcPath);
  }

  // 1. Standard full 512x512
  const std512 = await sharp(srcPath)
    .resize(512, 512, { fit: 'cover' })
    .png()
    .toBuffer();

  // 2. Standard 192x192
  const std192 = await sharp(srcPath)
    .resize(192, 192, { fit: 'cover' })
    .png()
    .toBuffer();

  // 3. Apple Touch Icon 180x180 (iOS Safari)
  const apple180 = await sharp(srcPath)
    .resize(180, 180, { fit: 'cover' })
    .png()
    .toBuffer();

  // 4. Favicon 48x48
  const fav48 = await sharp(srcPath)
    .resize(48, 48, { fit: 'cover' })
    .png()
    .toBuffer();

  // 5. Maskable Icon 512x512 (Safe-zone padded for Android circles/squircles)
  // Android safe-zone circle has diameter of ~408px (80% of 512).
  // We scale the logo to ~416x416 and composite onto a 512x512 solid black background (#000000).
  const innerSize = 416;
  const scaledLogo = await sharp(srcPath)
    .resize(innerSize, innerSize, { fit: 'cover' })
    .toBuffer();

  const mask512 = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: '#000000'
    }
  })
    .composite([{ input: scaledLogo, gravity: 'center' }])
    .png()
    .toBuffer();

  const mask192 = await sharp(mask512).resize(192, 192).png().toBuffer();

  // Write files to /public
  fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), std512);
  fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), std192);
  fs.writeFileSync(path.join(publicDir, 'maskable-icon-512x512.png'), mask512);
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), apple180);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), fav48);
  fs.writeFileSync(path.join(publicDir, 'logo-symbol.png'), std512);

  // Write files to /public/icons
  fs.writeFileSync(path.join(iconsDir, 'icon-512x512.png'), std512);
  fs.writeFileSync(path.join(iconsDir, 'icon-192x192.png'), std192);
  fs.writeFileSync(path.join(iconsDir, 'icon-maskable-512x512.png'), mask512);
  fs.writeFileSync(path.join(iconsDir, 'icon-maskable-192x192.png'), mask192);
  fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.png'), apple180);

  // Also convert to JPEG for logo-symbol.jpg
  const jpg512 = await sharp(std512).jpeg({ quality: 95 }).toBuffer();
  fs.writeFileSync(path.join(publicDir, 'logo-symbol.jpg'), jpg512);

  console.log('Successfully generated all PWA icons with user logo!');
}

processLogo().catch(err => {
  console.error('Error applying logo:', err);
  process.exit(1);
});
