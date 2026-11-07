import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/**
 * File storage for uploaded pictures and recordings. The architecture names Cloudinary
 * (pictures) and Firebase Storage (recordings); this interface is where those plug in.
 * The default implementation keeps files on the server's disk.
 */
export interface Storage {
  put(folder: 'images' | 'recordings', ext: string, data: Buffer): string;
  get(key: string): Buffer | null;
  remove(key: string): void;
}

const KEY_RE = /^(images|recordings)\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/;

export function diskStorage(root: string): Storage {
  return {
    put(folder, ext, data) {
      const dir = join(root, folder);
      mkdirSync(dir, { recursive: true });
      const key = `${folder}/${randomUUID()}.${ext}`;
      writeFileSync(join(root, key), data);
      return key;
    },
    get(key) {
      if (!KEY_RE.test(key)) return null;
      const p = join(root, key);
      return existsSync(p) ? readFileSync(p) : null;
    },
    remove(key) {
      if (KEY_RE.test(key)) rmSync(join(root, key), { force: true });
    },
  };
}

export function memoryStorage(): Storage {
  const files = new Map<string, Buffer>();
  return {
    put(folder, ext, data) {
      const key = `${folder}/${randomUUID()}.${ext}`;
      files.set(key, data);
      return key;
    },
    get: (key) => files.get(key) ?? null,
    remove: (key) => void files.delete(key),
  };
}

/** Detects the picture type from its first bytes; the client-sent Content-Type is not trusted. */
export function sniffImage(b: Buffer): { mime: string; ext: string } | null {
  if (b.length > 8 && b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG') return { mime: 'image/png', ext: 'png' };
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (b.length > 6 && b.toString('ascii', 0, 4) === 'GIF8') return { mime: 'image/gif', ext: 'gif' };
  if (b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP')
    return { mime: 'image/webp', ext: 'webp' };
  return null;
}

/** Recordings come from the browser's MediaRecorder: WebM/Opus (Chrome, Firefox) or MP4/AAC (Safari). */
export function sniffAudio(b: Buffer): { mime: string; ext: string } | null {
  if (b.length > 4 && b.readUInt32BE(0) === 0x1a45dfa3) return { mime: 'audio/webm', ext: 'webm' };
  if (b.length > 8 && b.toString('ascii', 4, 8) === 'ftyp') return { mime: 'audio/mp4', ext: 'm4a' };
  if (b.length > 4 && b.toString('ascii', 0, 4) === 'OggS') return { mime: 'audio/ogg', ext: 'ogg' };
  return null;
}
