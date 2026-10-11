import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export const sourceHosts = new Set(['bbs-api-os.hoyolab.com', 'raw.githubusercontent.com', 'api.github.com',
  'upload-os-bbs.hoyolab.com', 'hyl-static-res-prod.hoyolab.com', 'sdk.hoyoverse.com',
  'act-webstatic.hoyoverse.com', 'enka.network', 'genshin.jmp.blue', 'www.icy-veins.com', 'static.icy-veins.com', 'game8.co', 'sephijin.fr']);
export class CatalogFetchError extends Error {
  constructor(public readonly code: string, public readonly httpStatus?: number) { super(code); }
}
export function isPublicIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a = 0, b = 0] = ip.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 ||
      a === 192 && [0, 168].includes(b) || a === 100 && b >= 64 && b <= 127 || a === 198 && [18, 19].includes(b));
  }
  // Accept global unicast only; mapped, loopback, ULA, link-local and multicast fail closed.
  return isIP(ip) === 6 && /^[23]/i.test(ip) && !/^2001:(?:db8|0):/i.test(ip);
}
export function checkSourceUrl(input: string, hosts = sourceHosts): URL {
  const url = new URL(input);
  if (url.protocol !== 'https:' || !hosts.has(url.hostname) || url.username || url.password || url.hash || url.port && url.port !== '443')
    throw new CatalogFetchError('SOURCE_NOT_ALLOWED');
  return url;
}
export type HttpResult = Readonly<{ body: Buffer; mime: string; status: number; url: string }>;
export type CatalogHttp = (url: string, options?: { maxBytes?: number; method?: 'GET' | 'POST'; headers?: Record<string, string>; body?: Buffer; noRedirect?: boolean; signal?: AbortSignal }) => Promise<HttpResult>;

/** DNS is resolved once, checked, then pinned to the socket (no rebind race). */
export const catalogHttp: CatalogHttp = async (input, options = {}) => {
  let current = input;
  const hosts = new Set(sourceHosts);
  if (process.env['SUPABASE_URL']) hosts.add(new URL(process.env['SUPABASE_URL']).hostname);
  for (let redirects = 0; redirects <= 3; redirects++) {
    if (options.signal?.aborted) throw new CatalogFetchError('CANCELLED');
    const url = checkSourceUrl(current, hosts);
    let dnsTimer: ReturnType<typeof setTimeout> | undefined;
    const addresses = await Promise.race([lookup(url.hostname, { all: true }), new Promise<never>((_resolve, reject) => {
      dnsTimer = setTimeout(() => reject(new CatalogFetchError('TIMEOUT')), 20_000);
    })]).catch(error => { throw error instanceof CatalogFetchError ? error : new CatalogFetchError('UNAVAILABLE'); }).finally(() => { if (dnsTimer) clearTimeout(dnsTimer); });
    if (!addresses.length || addresses.some(row => !isPublicIp(row.address))) throw new CatalogFetchError('SSRF_BLOCKED');
    const pinned = addresses.find(row => row.family === 4) ?? addresses[0]!;
    const result = await new Promise<{ result?: HttpResult; location?: string }>((resolve, reject) => {
      const request = https.request(url, { signal:options.signal, method: options.method ?? 'GET', headers: { 'user-agent': 'GachaImpact-Character-Catalog/2', ...options.headers },
        lookup: (_host, _options, callback) => callback(null, [{ address: pinned.address, family: pinned.family }]) }, response => {
        const status = response.statusCode ?? 0;
        if ([301, 302, 303, 307, 308].includes(status)) {
          response.resume();
          if (options.noRedirect || !response.headers.location) { reject(new CatalogFetchError('REDIRECT_BLOCKED', status)); return; }
          resolve({ location: new URL(response.headers.location, url).toString() }); return;
        }
        const limit = options.maxBytes ?? 5 * 1024 * 1024;
        if (Number(response.headers['content-length']) > limit) { response.destroy(); reject(new CatalogFetchError('SIZE_LIMIT', status)); return; }
        let size = 0; const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => { size += chunk.length; if (size > limit) response.destroy(new CatalogFetchError('SIZE_LIMIT', status)); else chunks.push(chunk); });
        response.on('error', reject);
        response.on('end', () => resolve({ result: { body: Buffer.concat(chunks), mime: String(response.headers['content-type'] ?? '').split(';')[0]!, status, url: url.toString() } }));
      });
      const timer = setTimeout(() => request.destroy(new CatalogFetchError('TIMEOUT')), 20_000);
      request.on('close', () => clearTimeout(timer));
      request.on('error', error => reject(options.signal?.aborted ? new CatalogFetchError('CANCELLED') : error instanceof CatalogFetchError ? error : new CatalogFetchError('UNAVAILABLE')));
      request.end(options.body);
    });
    if (result.result) return result.result;
    current = result.location!;
  }
  throw new CatalogFetchError('REDIRECT_LIMIT');
};

export class RequestBudget {
  private remaining: number;
  private remainingBytes = 32 * 1024 * 1024;
  private readonly deadline: number;
  constructor(private readonly http: CatalogHttp = catalogHttp, limit = 180, durationMs = 600_000) {
    this.remaining = limit; this.deadline = Date.now() + durationMs;
  }
  readonly request: CatalogHttp = async (url, options) => {
    if (this.remaining-- <= 0 || Date.now() >= this.deadline) throw new CatalogFetchError('BUDGET_EXHAUSTED');
    if (this.remainingBytes <= 0) throw new CatalogFetchError('BUDGET_EXHAUSTED');
    const result = await this.http(url, { ...options, maxBytes: Math.min(options?.maxBytes ?? 5 * 1024 * 1024, this.remainingBytes) });
    this.remainingBytes -= result.body.length;
    return result;
  };
}
