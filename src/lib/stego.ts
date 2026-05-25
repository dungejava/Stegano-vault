// ─────────────────────────────────────────────────────────────────────────────
// StegoVault Core Library
// AES-256-CBC encryption + LSB steganography + Shamir Secret Sharing
// ─────────────────────────────────────────────────────────────────────────────

// ── AES-256 Encryption (via SubtleCrypto) ────────────────────────────────────

export async function encryptAES256(plaintext: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Derive key from password using PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );

  // Combine: salt(16) + iv(12) + ciphertext
  const combined = new Uint8Array(16 + 12 + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, 16);
  combined.set(new Uint8Array(ciphertext), 28);

  return uint8ToBase64(combined);
}

export async function decryptAES256(base64Data: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const combined = base64ToUint8(base64Data);

  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const ciphertext = combined.slice(28);

  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return dec.decode(plaintext);
}

// ── Shamir Secret Sharing ────────────────────────────────────────────────────
// Pure-JS implementation over GF(256)

const GF256 = {
  exp: new Uint8Array(512),
  log: new Uint8Array(256),
};

(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF256.exp[i] = x;
    GF256.log[x] = i;
    x = x ^ (x << 1) ^ (x & 0x80 ? 0x1b : 0);
    x &= 0xff;
  }
  for (let i = 255; i < 512; i++) GF256.exp[i] = GF256.exp[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF256.exp[(GF256.log[a] + GF256.log[b]) % 255];
}

function gfDiv(a: number, b: number): number {
  if (b === 0) throw new Error('Division by zero in GF256');
  if (a === 0) return 0;
  return GF256.exp[(GF256.log[a] - GF256.log[b] + 255) % 255];
}

function evaluatePoly(coeffs: Uint8Array, x: number): number {
  let result = 0;
  for (let i = coeffs.length - 1; i >= 0; i--) {
    result = gfMul(result, x) ^ coeffs[i];
  }
  return result;
}

export function shamirSplit(secret: Uint8Array, n: number, k: number): Array<{ x: number; y: Uint8Array }> {
  if (k > n) throw new Error('k must be <= n');
  if (k < 2) throw new Error('k must be >= 2');

  const shares: Array<{ x: number; y: Uint8Array }> = [];
  const ys = Array.from({ length: n }, () => new Uint8Array(secret.length));

  for (let byteIdx = 0; byteIdx < secret.length; byteIdx++) {
    // Random polynomial of degree k-1
    const coeffs = new Uint8Array(k);
    coeffs[0] = secret[byteIdx];
    crypto.getRandomValues(coeffs.subarray(1));

    for (let i = 0; i < n; i++) {
      ys[i][byteIdx] = evaluatePoly(coeffs, i + 1);
    }
  }

  for (let i = 0; i < n; i++) {
    shares.push({ x: i + 1, y: ys[i] });
  }
  return shares;
}

export function shamirReconstruct(shares: Array<{ x: number; y: Uint8Array }>, k: number): Uint8Array {
  if (shares.length < k) throw new Error(`Need at least ${k} shares`);
  const used = shares.slice(0, k);
  const secret = new Uint8Array(used[0].y.length);

  for (let byteIdx = 0; byteIdx < secret.length; byteIdx++) {
    let val = 0;
    for (let i = 0; i < used.length; i++) {
      let num = 1, den = 1;
      for (let j = 0; j < used.length; j++) {
        if (i === j) continue;
        num = gfMul(num, used[j].x);
        den = gfMul(den, used[i].x ^ used[j].x);
      }
      val ^= gfMul(gfDiv(num, den), used[i].y[byteIdx]);
    }
    secret[byteIdx] = val;
  }
  return secret;
}

export function shamirSplitPassword(password: string, n: number, k: number): string[] {
  const enc = new TextEncoder();
  const secretBytes = enc.encode(password);
  const shares = shamirSplit(secretBytes, n, k);
  return shares.map(s => {
    const buf = new Uint8Array(1 + s.y.length);
    buf[0] = s.x;
    buf.set(s.y, 1);
    return uint8ToBase64(buf);
  });
}

export function shamirReconstructPassword(shareStrings: string[], k: number): string {
  const shares = shareStrings.map(s => {
    const buf = base64ToUint8(s);
    return { x: buf[0], y: buf.slice(1) };
  });
  const dec = new TextDecoder();
  return dec.decode(shamirReconstruct(shares, k));
}

// ── LSB Image Steganography ───────────────────────────────────────────────────

const MAGIC = 'STGV'; // 4-byte magic header

export async function embedInImage(
  imageFile: File,
  payload: string, // base64 encrypted data
  bitsPerChannel: 1 | 2 = 1
): Promise<Blob> {
  const imageBitmap = await createImageBitmap(imageFile);
  const canvas = document.createElement('canvas');
  canvas.width = imageBitmap.width;
  canvas.height = imageBitmap.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(imageBitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data; // RGBA

  // Build message: MAGIC + length(4 bytes) + payload bytes
  const enc = new TextEncoder();
  const payloadBytes = enc.encode(payload);
  const magicBytes = enc.encode(MAGIC);
  const lengthBytes = new Uint8Array(4);
  new DataView(lengthBytes.buffer).setUint32(0, payloadBytes.length, false);

  const message = new Uint8Array(magicBytes.length + 4 + payloadBytes.length);
  message.set(magicBytes, 0);
  message.set(lengthBytes, 4);
  message.set(payloadBytes, 8);

  const totalBits = message.length * 8;
  const availableBits = Math.floor(pixels.length * 0.75) * bitsPerChannel; // skip alpha

  if (totalBits > availableBits) {
    throw new Error(`Image too small. Need ${Math.ceil(totalBits / bitsPerChannel)} RGB values, have ${Math.floor(pixels.length * 0.75)}`);
  }

  const mask = (1 << bitsPerChannel) - 1;
  let bitIdx = 0;

  for (let i = 0; i < pixels.length && bitIdx < totalBits; i++) {
    if ((i + 1) % 4 === 0) continue; // skip alpha channel
    const bytePos = Math.floor(bitIdx / 8);
    const bitPos = 7 - (bitIdx % 8);
    const bit = (message[bytePos] >> bitPos) & 1;
    pixels[i] = (pixels[i] & ~mask) | (bitsPerChannel === 1 ? bit : (bit << (bitsPerChannel - 1)));
    bitIdx++;
  }

  ctx.putImageData(imageData, 0, 0);

  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob!), 'image/png');
  });
}

export async function extractFromImage(imageFile: File, bitsPerChannel: 1 | 2 = 1): Promise<string> {
  const imageBitmap = await createImageBitmap(imageFile);
  const canvas = document.createElement('canvas');
  canvas.width = imageBitmap.width;
  canvas.height = imageBitmap.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(imageBitmap, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  const mask = (1 << bitsPerChannel) - 1;
  const dec = new TextDecoder();

  function readBytes(count: number, startBit: number): { bytes: Uint8Array; nextBit: number } {
    const bytes = new Uint8Array(count);
    let bitIdx = startBit;
    let pixelIdx = Math.floor(bitIdx * (4 / 3)); // account for skipped alpha

    for (let b = 0; b < count; b++) {
      let byte = 0;
      for (let bit = 7; bit >= 0; bit--) {
        // find next non-alpha pixel
        while ((pixelIdx + 1) % 4 === 0) pixelIdx++;
        const extracted = pixels[pixelIdx] & mask;
        byte |= (extracted & 1) << bit;
        pixelIdx++;
        bitIdx++;
      }
      bytes[b] = byte;
    }
    return { bytes, nextBit: bitIdx };
  }

  // Re-extract sequentially
  let pIdx = 0;
  const allBits: number[] = [];

  for (let i = 0; i < pixels.length; i++) {
    if ((i + 1) % 4 === 0) continue;
    const extracted = pixels[i] & mask;
    if (bitsPerChannel === 1) {
      allBits.push(extracted & 1);
    } else {
      allBits.push((extracted >> 1) & 1);
      allBits.push(extracted & 1);
    }
  }

  function bitsToBytes(start: number, count: number): Uint8Array {
    const result = new Uint8Array(count);
    for (let b = 0; b < count; b++) {
      let byte = 0;
      for (let bit = 7; bit >= 0; bit--) {
        byte |= (allBits[start + (b * 8) + (7 - bit)] || 0) << bit;
      }
      result[b] = byte;
    }
    return result;
  }

  // Read magic
  const magicBytes = bitsToBytes(0, 4);
  const magic = dec.decode(magicBytes);
  if (magic !== MAGIC) throw new Error('No hidden message found in this image');

  // Read length
  const lenBytes = bitsToBytes(32, 4);
  const payloadLength = new DataView(lenBytes.buffer).getUint32(0, false);

  if (payloadLength > 10_000_000) throw new Error('Invalid payload length — wrong image or corrupted');

  // Read payload
  const payloadBytes = bitsToBytes(64, payloadLength);
  return dec.decode(payloadBytes);
}

// ── File Steganography (append hidden file) ───────────────────────────────────

export async function embedInFile(
  carrierFile: File,
  payload: string,
  hiddenExt: string
): Promise<Blob> {
  const enc = new TextEncoder();
  const carrierBytes = new Uint8Array(await carrierFile.arrayBuffer());
  const payloadBytes = enc.encode(payload);
  const extBytes = enc.encode(hiddenExt.padEnd(8, '\0').slice(0, 8));

  // Trailer: MAGIC(4) + ext(8) + length(4) + payload
  const trailer = new Uint8Array(4 + 8 + 4 + payloadBytes.length);
  const magicBytes = enc.encode(MAGIC);
  const lenBytes = new Uint8Array(4);
  new DataView(lenBytes.buffer).setUint32(0, payloadBytes.length, false);

  trailer.set(magicBytes, 0);
  trailer.set(extBytes, 4);
  trailer.set(lenBytes, 12);
  trailer.set(payloadBytes, 16);

  const combined = new Uint8Array(carrierBytes.length + trailer.length);
  combined.set(carrierBytes, 0);
  combined.set(trailer, carrierBytes.length);

  return new Blob([combined], { type: carrierFile.type });
}

export async function extractFromFile(file: File): Promise<{ payload: string; hiddenExt: string }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const dec = new TextDecoder();

  // Search for STGV from end
  const minOffset = 4 + 8 + 4;
  for (let i = bytes.length - minOffset - 1; i >= 0; i--) {
    if (
      bytes[i] === 0x53 && bytes[i+1] === 0x54 &&
      bytes[i+2] === 0x47 && bytes[i+3] === 0x56
    ) {
      const extBytes = bytes.slice(i + 4, i + 12);
      const hiddenExt = dec.decode(extBytes).replace(/\0/g, '').trim();
      const lenBytes = bytes.slice(i + 12, i + 16);
      const payloadLen = new DataView(lenBytes.buffer).getUint32(0, false);
      const payloadBytes = bytes.slice(i + 16, i + 16 + payloadLen);
      return { payload: dec.decode(payloadBytes), hiddenExt };
    }
  }
  throw new Error('No hidden data found in this file');
}

// ── Utilities ─────────────────────────────────────────────────────────────────

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function estimateImageCapacity(width: number, height: number, bitsPerChannel: 1 | 2): number {
  const pixelCount = width * height;
  const usableChannels = pixelCount * 3; // RGB only
  const totalBits = usableChannels * bitsPerChannel;
  return Math.floor((totalBits / 8) - 8); // minus header
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
