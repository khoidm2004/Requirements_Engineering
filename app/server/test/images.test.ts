import { describe, it, expect } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  checkImageDataUrl, cloudinaryImageStore, cloudinarySignature, localImageStore, parseCloudinaryUrl, sniffImage, MAX_IMAGE_BYTES,
} from '../src/images.js';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]);
const dataUrl = (b: Buffer, mime = 'image/png') => `data:${mime};base64,${b.toString('base64')}`;

describe('FR-CNT-05 image validation', () => {
  it('detects JPEG, PNG and WebP by content, not by the declared type', () => {
    expect(sniffImage(png)).toBe('image/png');
    expect(sniffImage(jpg)).toBe('image/jpeg');
    expect(sniffImage(webp)).toBe('image/webp');
    expect(sniffImage(Buffer.from('GIF89a'))).toBeNull();
    expect(checkImageDataUrl(dataUrl(jpg, 'image/png'))).toMatchObject({ ok: true, mime: 'image/jpeg' });
  });

  it('rejects other types, malformed input and files over 2 MB', () => {
    expect(checkImageDataUrl(dataUrl(Buffer.from('GIF89a'), 'image/gif'))).toEqual({ ok: false, error: 'image_type' });
    expect(checkImageDataUrl('not a data url')).toEqual({ ok: false, error: 'image_type' });
    expect(checkImageDataUrl(42)).toEqual({ ok: false, error: 'image_type' });
    expect(checkImageDataUrl(dataUrl(Buffer.concat([png, Buffer.alloc(MAX_IMAGE_BYTES)])))).toEqual({ ok: false, error: 'image_too_large' });
    expect(checkImageDataUrl(dataUrl(Buffer.concat([png, Buffer.alloc(MAX_IMAGE_BYTES - png.length)])))).toMatchObject({ ok: true });
  });
});

describe('local image store', () => {
  it('writes a file, returns a /media URL and removes it again', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rb-media-'));
    try {
      const store = localImageStore(dir);
      const { ref, url } = await store.put(png, 'image/png');
      expect(ref).toMatch(/^[a-f0-9]{32}\.png$/);
      expect(url).toBe(`/media/${ref}`);
      expect(existsSync(join(dir, ref))).toBe(true);
      await store.remove('../escape.png'); // ignored
      await store.remove(ref);
      expect(existsSync(join(dir, ref))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('Cloudinary image store (A-6)', () => {
  it('parses CLOUDINARY_URL', () => {
    expect(parseCloudinaryUrl('cloudinary://123:abc@demo')).toEqual({ apiKey: '123', apiSecret: 'abc', cloudName: 'demo', folder: 'readbuddy-e4' });
    expect(parseCloudinaryUrl('https://demo')).toBeNull();
  });

  it('signs sorted parameters with the API secret (Cloudinary documentation example)', () => {
    expect(cloudinarySignature({ timestamp: 1315060510, public_id: 'sample_image', eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop' }, 'abcd'))
      .toBe('bfd09f95f331f558cbd1320e67aa8d488770583e');
  });

  it('uploads signed and stores the public id and secure URL; deletes by public id', async () => {
    const calls: Array<{ url: string; body: Record<string, string> }> = [];
    const fakeFetch = (async (url: string, init: { body: FormData }) => {
      const body = Object.fromEntries([...init.body.entries()].map(([k, v]) => [k, String(v)]));
      calls.push({ url, body });
      return new Response(JSON.stringify({ public_id: 'readbuddy-e4/x1', secure_url: 'https://res.cloudinary.com/demo/image/upload/x1.png' }));
    }) as unknown as typeof fetch;
    const store = cloudinaryImageStore({ cloudName: 'demo', apiKey: 'k', apiSecret: 's', folder: 'readbuddy-e4' }, fakeFetch);
    expect(store.origin).toBe('https://res.cloudinary.com');
    expect(await store.put(png, 'image/png')).toEqual({ ref: 'readbuddy-e4/x1', url: 'https://res.cloudinary.com/demo/image/upload/x1.png' });
    expect(calls[0].url).toBe('https://api.cloudinary.com/v1_1/demo/image/upload');
    expect(calls[0].body).toMatchObject({ api_key: 'k', folder: 'readbuddy-e4' });
    expect(calls[0].body.file).toMatch(/^data:image\/png;base64,/);
    expect(calls[0].body.signature).toBe(cloudinarySignature({ folder: 'readbuddy-e4', timestamp: Number(calls[0].body.timestamp) }, 's'));
    await store.remove('readbuddy-e4/x1');
    expect(calls[1]).toMatchObject({ url: 'https://api.cloudinary.com/v1_1/demo/image/destroy', body: { public_id: 'readbuddy-e4/x1' } });
  });
});
