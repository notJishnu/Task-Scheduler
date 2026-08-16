import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const outputDirectory = new URL('../public/icons/', import.meta.url);
mkdirSync(outputDirectory, { recursive: true });

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, checksum]);
}

function png(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const setPixel = (x, y, red, green, blue, alpha = 255) => {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const index = (y * size + x) * 4;
    pixels[index] = red; pixels[index + 1] = green; pixels[index + 2] = blue; pixels[index + 3] = alpha;
  };
  const scale = size / 128;
  const radius = 28 * scale;
  const inset = 4 * scale;
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const dx = Math.max(inset - x, 0, x - (size - 1 - inset));
    const dy = Math.max(inset - y, 0, y - (size - 1 - inset));
    if (Math.hypot(dx, dy) <= radius) setPixel(x, y, 79, 70, 229);
  }
  const line = (x1, y1, x2, y2, width) => {
    for (let y = Math.floor(Math.min(y1, y2) - width); y <= Math.ceil(Math.max(y1, y2) + width); y += 1) for (let x = Math.floor(Math.min(x1, x2) - width); x <= Math.ceil(Math.max(x1, x2) + width); x += 1) {
      const progress = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / ((x2 - x1) ** 2 + (y2 - y1) ** 2);
      const nearestX = x1 + Math.max(0, Math.min(1, progress)) * (x2 - x1);
      const nearestY = y1 + Math.max(0, Math.min(1, progress)) * (y2 - y1);
      if (Math.hypot(x - nearestX, y - nearestY) <= width / 2) setPixel(x, y, 255, 255, 255);
    }
  };
  line(36 * scale, 65 * scale, 55 * scale, 83 * scale, 11 * scale);
  line(55 * scale, 83 * scale, 93 * scale, 43 * scale, 11 * scale);
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const start = y * (size * 4 + 1);
    rows[start] = 0;
    pixels.copy(rows, start + 1, y * size * 4, (y + 1) * size * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4);
  header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from('\x89PNG\r\n\x1a\n', 'binary'), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

for (const size of [16, 48, 128]) writeFileSync(new URL(`icon-${size}.png`, outputDirectory), png(size));
