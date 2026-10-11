/** Preserve historical local paths; admit only immutable public catalogue PNGs
 * from our configured project. Never expose signed/tokenised or arbitrary URLs. */
export function officialCharacterAsset(path: string | null, projectUrl = process.env['SUPABASE_URL']): string | null {
  if (!path || /[\\\u0000-\u001f]/.test(path)) return null;
  if (/^\/assets\/[A-Za-z0-9/_-]+\.(?:png|webp|svg)$/.test(path)) return path;
  try {
    if (!projectUrl) return null;
    const url = new URL(path), project = new URL(projectUrl);
    return url.protocol === 'https:' && url.origin === project.origin && !url.username && !url.password && !url.search && !url.hash &&
      /^\/storage\/v1\/object\/public\/character-catalog\/characters\/[a-f0-9-]{36}\/icon\/[a-f0-9]{64}\.png$/.test(url.pathname) ? path : null;
  } catch { return null; }
}
