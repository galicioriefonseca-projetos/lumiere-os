import fs from 'fs';
import path from 'path';

const srcIconPath = path.resolve('src/assets/images/lumiere_pwa_icon_1779886969075.png');

const destinations = [
  path.resolve('public/apple-touch-icon.png'),
  path.resolve('public/icons/icon-192x192.png'),
  path.resolve('public/icons/icon-512x512.png'),
  path.resolve('public/icons/icon-maskable-192x192.png'),
  path.resolve('public/icons/icon-maskable-512x512.png'),
  path.resolve('public/pwa-192x192.png'),
  path.resolve('public/pwa-512x512.png'),
  path.resolve('public/maskable-icon-512x512.png')
];

console.log('Copying PWA icons from', srcIconPath);

destinations.forEach(dest => {
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (fs.existsSync(srcIconPath)) {
    fs.copyFileSync(srcIconPath, dest);
    console.log(`Successfully copied to: ${dest}`);
  } else {
    console.error(`ERROR: Source icon not found at ${srcIconPath}`);
  }
});
