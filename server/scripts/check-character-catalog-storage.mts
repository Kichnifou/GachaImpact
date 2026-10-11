import 'dotenv/config';
import { catalogHttp } from '../src/infrastructure/character-catalog/catalog-http.js';
import { catalogBucket, maxImageBytes } from '../src/infrastructure/character-catalog/catalog-images.js';

// Environment-only credentials. Never output response bodies or headers: bucket
// administration is privileged. This command neither uploads nor creates a bucket.
const url = process.env['SUPABASE_URL']?.replace(/\/$/, '');
const key = process.env['SUPABASE_STORAGE_SECRET_KEY'];
if (!url || !key) {
  console.log(JSON.stringify({ ready: false, reason: 'BACKEND_STORAGE_NOT_CONFIGURED', bucket: catalogBucket }));
  process.exitCode = 2;
} else {
  try {
    const response = await catalogHttp(`${url}/storage/v1/bucket/${catalogBucket}`, {
      noRedirect: true, maxBytes: 65536, headers: { apikey: key },
    });
    if (response.status !== 200) throw new Error('BUCKET_UNAVAILABLE');
    const value = JSON.parse(response.body.toString('utf8')) as { public?: boolean; file_size_limit?: number; allowed_mime_types?: string[] };
    const ready = value.public === true && value.file_size_limit === maxImageBytes &&
      value.allowed_mime_types?.length === 1 && value.allowed_mime_types[0] === 'image/png';
    console.log(JSON.stringify({ ready, bucket: catalogBucket, configurationOnly: true,
      reason: ready ? 'CHECK_POLICIES_QUOTA_AND_REAL_UPLOAD_BEFORE_PUBLICATION' : 'BUCKET_CONFIGURATION_INVALID' }));
    if (!ready) process.exitCode = 2;
  } catch {
    console.log(JSON.stringify({ ready: false, reason: 'STORAGE_CHECK_FAILED', bucket: catalogBucket }));
    process.exitCode = 2;
  }
}
