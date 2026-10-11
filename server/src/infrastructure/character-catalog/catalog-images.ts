import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type { AssetRole } from '../../application/character-catalog/catalog-policy.js';
import { CatalogFetchError, type CatalogHttp, catalogHttp } from './catalog-http.js';

export const catalogBucket = 'character-catalog';
export const maxImageBytes = 5 * 1024 * 1024;
export type ValidImage = Readonly<{ body: Buffer; hash: string; sourceHash: string; mime: 'image/png'; width: number; height: number; bytes: number }>;

export async function validateImage(body: Buffer, claimedMime: string, role: AssetRole): Promise<ValidImage> {
  if (!body.length || body.length > maxImageBytes) throw new CatalogFetchError('SIZE_LIMIT');
  try {
    const image = sharp(body, { failOn: 'warning', limitInputPixels: 16_777_216, animated: false });
    const metadata = await image.metadata();
    const realMime = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' }[metadata.format as 'png'];
    if (!realMime || realMime !== claimedMime) throw new CatalogFetchError('MIME_MISMATCH');
    const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height } = info;
    if (width < 64 || height < 64 || width > 4096 || height > 4096) throw new CatalogFetchError('DIMENSIONS_INVALID');
    let visible = 0, transparent = 0;
    for (let i = 3; i < data.length; i += 4) { if (data[i]! > 16) visible++; if (data[i]! < 240) transparent++; }
    if (visible < width * height / 100) throw new CatalogFetchError('IMAGE_EMPTY');
    const ratio = width / height;
    if (role === 'icon' && (ratio < .9 || ratio > 1.1 || width > 1024) ||
      role === 'splash' && (ratio < 1.4 || ratio > 2.5 || width < 512) ||
      role === 'wish' && (ratio > .65 || height < 256) ||
      role === 'fullbody' && (ratio > 1.25 || height < 512) ||
      role !== 'promotion' && role !== 'icon' && transparent < width * height / 1000) throw new CatalogFetchError('ROLE_INVALID');
    const png = await sharp(data, { raw: info }).png().toBuffer();
    if (png.length > maxImageBytes) throw new CatalogFetchError('SIZE_LIMIT');
    return { body: png, hash: createHash('sha256').update(png).digest('hex'), sourceHash: createHash('sha256').update(body).digest('hex'),
      mime: 'image/png', width, height, bytes: png.length };
  } catch (error) { if (error instanceof CatalogFetchError) throw error; throw new CatalogFetchError('IMAGE_CORRUPT'); }
}

export class CatalogImageStorage {
  constructor(private readonly url?: string, private readonly secretKey?: string, private readonly http: CatalogHttp = catalogHttp,
    private readonly checkCapacity: (bytes: number) => Promise<void> = async () => undefined) { this.url = url?.replace(/\/$/, ''); }
  get configured() { return Boolean(this.url && this.secretKey); }
  owns(url: string, candidateId: string, role: string, hash: string) {
    return Boolean(this.url && url === `${this.url}/storage/v1/object/public/${catalogBucket}/characters/${candidateId}/${role}/${hash}.png`);
  }
  async store(candidateId: string, role: AssetRole, image: ValidImage): Promise<string> {
    if (!this.url || !this.secretKey) throw new CatalogFetchError('STORAGE_NOT_CONFIGURED');
    await this.checkCapacity(image.bytes);
    if (!/^[a-f0-9-]{36}$/.test(candidateId)) throw new CatalogFetchError('IDENTITY_INVALID');
    const key = `characters/${candidateId}/${role}/${image.hash}.png`;
    const endpoint = `${this.url}/storage/v1/object/${catalogBucket}/${key}`;
    const response = await this.http(endpoint, { method: 'POST', noRedirect: true, body: image.body,
      headers: { apikey: this.secretKey, ...(this.secretKey.startsWith('eyJ') ? { authorization: `Bearer ${this.secretKey}` } : {}),
        'content-type': 'image/png', 'cache-control': '31536000', 'x-upsert': 'false' }, maxBytes: 65536 });
    if (![200, 201, 409].includes(response.status)) throw new CatalogFetchError('BUCKET_UNAVAILABLE', response.status);
    const publicUrl = `${this.url}/storage/v1/object/public/${catalogBucket}/${key}`;
    const probe = await this.http(publicUrl, { noRedirect: true, maxBytes: maxImageBytes });
    if (probe.status !== 200 || probe.mime !== 'image/png' || createHash('sha256').update(probe.body).digest('hex') !== image.hash)
      throw new CatalogFetchError('STORAGE_VERIFICATION_FAILED', probe.status);
    return publicUrl;
  }
}
