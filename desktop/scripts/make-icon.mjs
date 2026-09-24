// Rasterize the Notaion 16x16 pixel mark into a 1024px PNG (ink on a paper
// rounded square) for `tauri icon`. Dependency-free PNG encoder.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

// Rects [x, y, w, h] — same geometry as src/components/Mark.jsx.
const RECTS = [
  [3,0,10,1],[2,1,1,14],[13,1,1,11],[12,12,1,1],[11,13,1,1],[10,14,1,1],[3,15,7,1],
  [4,2,8,1],[4,3,1,4],[11,3,1,4],[4,7,8,1],
  [5,10,1,3],[4,11,3,1],
  [11,10,1,1],[9,11,1,1],[5,13,2,1],[8,13,2,1],
];
const SIZE = 1024, CELL = 48, OFF = (SIZE - 16 * CELL) / 2, R = 200;
const PAPER = [0xfd, 0xfc, 0xf8, 255], INK = [0x11, 0x18, 0x27, 255];

const ink = new Uint8Array(256);
for (const [x, y, w, h] of RECTS) for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) ink[j * 16 + i] = 1;

const inRounded = (x, y) => {
  const cx = Math.min(Math.max(x, R), SIZE - 1 - R), cy = Math.min(Math.max(y, R), SIZE - 1 - R);
  return (x - cx) ** 2 + (y - cy) ** 2 <= R * R;
};

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0;
  for (let x = 0; x < SIZE; x++) {
    const gx = Math.floor((x - OFF) / CELL), gy = Math.floor((y - OFF) / CELL);
    const onMark = gx >= 0 && gx < 16 && gy >= 0 && gy < 16 && ink[gy * 16 + gx];
    const px = !inRounded(x, y) ? [0, 0, 0, 0] : onMark ? INK : PAPER;
    raw.set(px, y * (SIZE * 4 + 1) + 1 + x * 4);
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);
writeFileSync(process.argv[2] || "app-icon.png", png);
