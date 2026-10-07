const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table for PNG chunks
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(8 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  const crc = crc32(typeAndData);
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function createPng(width, height, pixelFn) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth 8
  ihdrData.writeUInt8(6, 9); // RGBA color type
  ihdrData.writeUInt8(0, 10); // compression method
  ihdrData.writeUInt8(0, 11); // filter method
  ihdrData.writeUInt8(0, 12); // interlace method
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Raw image scanlines
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData.writeUInt8(0, rowOffset); // filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = pixelFn(x, y, width, height);
      rawData.writeUInt8(r, pxOffset);
      rawData.writeUInt8(g, pxOffset + 1);
      rawData.writeUInt8(b, pxOffset + 2);
      rawData.writeUInt8(a, pxOffset + 3);
    }
  }

  const compressedData = zlib.deflateSync(rawData, { level: 9 });
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Pixel drawing function for duda.uz fitness app
function renderAppIcon(isMaskable) {
  return (x, y, w, h) => {
    // Normalized coords (-1 to 1)
    const nx = (x / w) * 2 - 1;
    const ny = (y / h) * 2 - 1;

    // Dark background #09090b
    let r = 9;
    let g = 9;
    let b = 11;
    let a = 255;

    // Subtle dark gradient from top-left to bottom-right
    const distFromTopLeft = Math.hypot(nx + 0.6, ny + 0.6);
    if (distFromTopLeft < 1.4) {
      r = Math.min(255, 9 + Math.floor((1.4 - distFromTopLeft) * 16));
      g = Math.min(255, 9 + Math.floor((1.4 - distFromTopLeft) * 22));
      b = Math.min(255, 11 + Math.floor((1.4 - distFromTopLeft) * 26));
    }

    // Outer rounded container if not maskable
    const radius = isMaskable ? 1.0 : 0.85;
    const cornerR = 0.28;
    // SDF for rounded box
    const qx = Math.abs(nx) - (radius - cornerR);
    const qy = Math.abs(ny) - (radius - cornerR);
    const dBox = Math.hypot(Math.max(0, qx), Math.max(0, qy)) + Math.min(0, Math.max(qx, qy)) - cornerR;

    if (!isMaskable && dBox > 0.02) {
      return [0, 0, 0, 0]; // Transparent outside icon bounds
    }

    // Border glow for non-maskable
    if (!isMaskable && dBox > -0.04 && dBox <= 0.02) {
      const alpha = Math.max(0, Math.min(1, (0.02 - dBox) / 0.06));
      return [249, 115, 22, Math.floor(alpha * 220)]; // Brand orange glow border
    }

    // Draw stylized Dumbbell + Pulse in center
    // Scale factor for content
    const scale = isMaskable ? 0.65 : 0.8;
    const cx = nx / scale;
    const cy = ny / scale;

    // Dumbbell bar: horizontal bar cy between -0.06 and 0.06, cx between -0.45 and 0.45
    const isBar = Math.abs(cy) <= 0.07 && Math.abs(cx) <= 0.45;

    // Dumbbell plates:
    // Outer plates: |cx| between 0.36 and 0.46, |cy| <= 0.38
    const isOuterPlate = Math.abs(cx) >= 0.36 && Math.abs(cx) <= 0.46 && Math.abs(cy) <= 0.38;
    // Inner plates: |cx| between 0.24 and 0.34, |cy| <= 0.28
    const isInnerPlate = Math.abs(cx) >= 0.24 && Math.abs(cx) <= 0.34 && Math.abs(cy) <= 0.28;
    // Left outer plate:
    const isLeftOuter = Math.abs(cx + 0.41) <= 0.05 && Math.abs(cy) <= 0.38;
    const isLeftInner = Math.abs(cx + 0.29) <= 0.05 && Math.abs(cy) <= 0.28;
    // Right outer plate:
    const isRightOuter = Math.abs(cx - 0.41) <= 0.05 && Math.abs(cy) <= 0.38;
    const isRightInner = Math.abs(cx - 0.29) <= 0.05 && Math.abs(cy) <= 0.28;

    // Center Lightning / Pulse bolt overlay
    // Point 1: (-0.08, -0.4), Point 2: (0.1, -0.02), Point 3: (-0.02, 0.05), Point 4: (0.12, 0.42)
    const isBolt = (
      (cy >= -0.38 && cy <= 0.02 && Math.abs(cx - (cy * 0.45 + 0.02)) <= 0.08) ||
      (cy >= -0.02 && cy <= 0.38 && Math.abs(cx - ((cy - 0.02) * 0.4 + 0.02)) <= 0.08)
    );

    if (isBolt) {
      // Vivid Emerald / Lime neon glow (#10b981 / #34d399)
      return [16, 185, 129, 255];
    }

    if (isBar || isLeftOuter || isLeftInner || isRightOuter || isRightInner) {
      // Brand Orange / Amber gradient (#f97316 -> #fb923c)
      const gradY = (cy + 0.38) / 0.76;
      const pr = Math.floor(249 + gradY * 6);
      const pg = Math.floor(115 + gradY * 35);
      const pb = 22;
      return [pr, pg, pb, 255];
    }

    // Background circle glow behind dumbbell
    const dCenter = Math.hypot(cx, cy);
    if (dCenter < 0.6) {
      const glow = (0.6 - dCenter) / 0.6;
      r = Math.min(255, r + Math.floor(glow * 40));
      g = Math.min(255, g + Math.floor(glow * 25));
      b = Math.min(255, b + Math.floor(glow * 15));
    }

    return [r, g, b, a];
  };
}

const outDir = path.join(__dirname, 'frontend', 'public', 'icons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Generate PNG icons
console.log('Generating PNG icons...');
fs.writeFileSync(path.join(outDir, 'icon-192.png'), createPng(192, 192, renderAppIcon(false)));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), createPng(512, 512, renderAppIcon(false)));
fs.writeFileSync(path.join(outDir, 'icon-maskable-192.png'), createPng(192, 192, renderAppIcon(true)));
fs.writeFileSync(path.join(outDir, 'icon-maskable-512.png'), createPng(512, 512, renderAppIcon(true)));
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), createPng(180, 180, renderAppIcon(true)));

console.log('PNG icons created successfully.');
