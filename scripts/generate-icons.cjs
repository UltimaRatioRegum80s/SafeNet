const sharp = require('sharp');
const fs = require('fs');

const createIcon = async (size) => {
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#0ea5e9;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#0369a1;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#bg)" rx="${Math.round(size * 0.15)}"/>
      <text x="50%" y="55%" font-size="${Math.round(size * 0.5)}" font-family="Arial, sans-serif" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">N</text>
    </svg>
  `;
  
  return sharp(Buffer.from(svg))
    .png()
    .toBuffer();
};

(async () => {
  const icon192 = await createIcon(192);
  const icon512 = await createIcon(512);
  
  fs.writeFileSync('client/public/icon-192.png', icon192);
  fs.writeFileSync('client/public/icon-512.png', icon512);
  
  console.log('Created icon-192.png and icon-512.png');
})();
