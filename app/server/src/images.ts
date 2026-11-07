import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * FR-CNT-05 / A-6 — storage for teacher-uploaded E4 pictures. The database keeps only the returned
 * reference and URL; the binary lives with the image host.
 *  - `cloudinaryImageStore` is the external host chosen in the architecture document.
 *  - `localImageStore` writes files to a directory served at /media (development and tests).
 */
export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const EXT: Record<ImageMime, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export interface StoredImage {
  ref: string;
  url: string;
}

export interface ImageStore {
  /** Origin the browser loads pictures from (added to the CSP), or null when served by this app. */
  origin: string | null;
  put(data: Buffer, mime: ImageMime): Promise<StoredImage>;
  remove(ref: string): Promise<void>;
}

/** Detects JPEG / PNG / WebP from the file's magic bytes; the declared type is not trusted. */
export function sniffImage(b: Buffer): ImageMime | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export type ImageCheck = { ok: true; data: Buffer; mime: ImageMime } | { ok: false; error: 'image_type' | 'image_too_large' };

/** Validates a `data:` URL upload: JPEG/PNG/WebP only, at most 2 MB (FR-CNT-05 constraints). */
export function checkImageDataUrl(v: unknown): ImageCheck {
  if (typeof v !== 'string') return { ok: false, error: 'image_type' };
  const m = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(v);
  if (!m) return { ok: false, error: 'image_type' };
  // Reject on the encoded length first so an oversized upload is never fully decoded.
  if (Math.floor((m[2].replace(/\s/g, '').length * 3) / 4) > MAX_IMAGE_BYTES + 3) return { ok: false, error: 'image_too_large' };
  const data = Buffer.from(m[2], 'base64');
  if (data.length > MAX_IMAGE_BYTES) return { ok: false, error: 'image_too_large' };
  const mime = sniffImage(data);
  if (!mime) return { ok: false, error: 'image_type' };
  return { ok: true, data, mime };
}

export function localImageStore(dir: string, urlPrefix = '/media'): ImageStore {
  mkdirSync(dir, { recursive: true });
  return {
    origin: null,
    async put(data, mime) {
      const ref = `${randomBytes(16).toString('hex')}.${EXT[mime]}`;
      await writeFile(join(dir, ref), data);
      return { ref, url: `${urlPrefix}/${ref}` };
    },
    async remove(ref) {
      if (!/^[a-f0-9]{32}\.(jpg|png|webp)$/.test(ref)) return;
      await unlink(join(dir, ref)).catch(() => {});
    },
  };
}

/** Cloudinary signed-upload signature: SHA-1 of the sorted parameters followed by the API secret. */
export function cloudinarySignature(params: Record<string, string | number>, apiSecret: string): string {
  const s = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return createHash('sha1').update(s + apiSecret).digest('hex');
}

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
}

/** Parses CLOUDINARY_URL (cloudinary://<key>:<secret>@<cloud>). */
export function parseCloudinaryUrl(url: string, folder = 'readbuddy-e4'): CloudinaryConfig | null {
  const m = /^cloudinary:\/\/([^:]+):([^@]+)@([\w-]+)$/.exec(url.trim());
  return m ? { apiKey: m[1], apiSecret: m[2], cloudName: m[3], folder } : null;
}

export function cloudinaryImageStore(cfg: CloudinaryConfig, fetchImpl: typeof fetch = fetch): ImageStore {
  const api = `https://api.cloudinary.com/v1_1/${cfg.cloudName}/image`;
  const call = async (action: 'upload' | 'destroy', params: Record<string, string | number>, extra: Record<string, string> = {}) => {
    const form = new FormData();
    for (const [k, v] of Object.entries({ ...params, ...extra })) form.append(k, String(v));
    form.append('api_key', cfg.apiKey);
    form.append('signature', cloudinarySignature(params, cfg.apiSecret));
    const res = await fetchImpl(`${api}/${action}`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Cloudinary ${action} failed with HTTP ${res.status}`);
    return (await res.json()) as Record<string, unknown>;
  };
  return {
    origin: 'https://res.cloudinary.com',
    async put(data, mime) {
      const timestamp = Math.floor(Date.now() / 1000);
      const out = await call('upload', { folder: cfg.folder, timestamp }, { file: `data:${mime};base64,${data.toString('base64')}` });
      return { ref: String(out.public_id), url: String(out.secure_url) };
    },
    async remove(ref) {
      await call('destroy', { public_id: ref, timestamp: Math.floor(Date.now() / 1000) }).catch(() => {});
    },
  };
}
