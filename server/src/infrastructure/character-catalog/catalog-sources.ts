import { z } from 'zod';
import { normalizedIdentity, type CatalogFields, type Evidence, type AssetRole } from '../../application/character-catalog/catalog-policy.js';
import { CatalogFetchError, type CatalogHttp } from './catalog-http.js';
import { CatalogSecondarySources, reviewedSecondaryImages } from './catalog-secondary.js';

export const catalogSourceRegistry = {
  version: 3,
  officialAuthor: '1015537',
  // Source bookmarks, not character-specific publication rules. Revalidated every cycle.
  announcementBookmarks: ['46884007'],
  metadata: ['genshin-db', 'genshin.dev'],
  images: ['catalog', 'technical-manifest', 'hoyoverse', 'enka'],
  fallbackSnapshot: '49a6544a6c6ae36089cb42fa591fc46f01de8bcf',
} as const;
// Reviewed configuration, stable across outages. A provider cannot supply a field
// outside this policy; changing an order requires a normal code review.
export const catalogFieldSources: Record<keyof CatalogFields, readonly string[]> = {
  name: ['genshin-db', 'genshin.dev'], originalName: ['hoyoverse', 'genshin-db', 'genshin.dev'],
  rarity: ['genshin-db', 'genshin.dev', 'icy-veins', 'game8', 'sephijin'], element: ['hoyoverse', 'genshin-db', 'genshin.dev', 'icy-veins', 'game8', 'sephijin'],
  weapon: ['genshin-db', 'genshin.dev', 'icy-veins', 'game8', 'sephijin'], region: ['genshin-db', 'genshin.dev'],
  numericId: ['genshin-db'], technicalName: ['genshin-db'], releaseDate: ['hoyoverse'],
  title: ['hoyoverse'], constellation: ['hoyoverse', 'genshin-db'], classKey: [], displayOrder: [],
};
const providerName = (name: string) => normalizedIdentity(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_-]/g, '');
const authorSchema = z.object({ uid: z.string(), certification: z.object({ type: z.number(), desc: z.string() }) });
const postSchema = z.object({ post: z.object({ post_id: z.string().regex(/^\d+$/), uid: z.string(), game_id: z.literal(2), created_at: z.number().int().positive(),
  subject: z.string(), structured_content: z.string(), is_deleted: z.literal(0) }), user: authorSchema });
export type OfficialPost = Readonly<{ id: string; url: string; date: string; text: string; name: string | null; fields: CatalogFields; promotion: readonly string[] }>;
export type SourceAttempt = { provider: string; field: string; outcome: string; errorCode?: string; sourceUrl?: string; httpStatus?: number };
export type AttemptSink = (attempt: SourceAttempt) => Promise<void>;

export function parseOfficialPost(input: unknown, now: Date): OfficialPost {
  const parsed = postSchema.safeParse(input);
  if (!parsed.success) throw new CatalogFetchError('SCHEMA_CHANGED');
  const { post, user } = parsed.data;
  if (post.uid !== catalogSourceRegistry.officialAuthor || user.uid !== post.uid || user.certification.type !== 1 || user.certification.desc !== 'Official Big Boss')
    throw new CatalogFetchError('AUTHOR_NOT_OFFICIAL');
  if (post.created_at * 1000 > now.getTime() + 300_000) throw new CatalogFetchError('UNCONFIRMED');
  let ops: unknown;
  try { ops = JSON.parse(post.structured_content); } catch { throw new CatalogFetchError('SCHEMA_CHANGED'); }
  const content = z.array(z.object({ insert: z.union([z.string(), z.object({ image: z.string() }).passthrough(), z.record(z.string(), z.unknown())]) })).safeParse(ops);
  if (!content.success) throw new CatalogFetchError('SCHEMA_CHANGED');
  const text = content.data.map(row => typeof row.insert === 'string' ? row.insert : '\n').join('');
  const name = /(?:^|\n)\s*◆\s*Name:\s*([^\n◆]{1,100})/u.exec(text)?.[1]?.trim() ?? null;
  const url = `https://www.hoyolab.com/article/${post.post_id}`;
  const fields: CatalogFields = {};
  const add = (key: keyof CatalogFields, value: string | undefined) => { if (value) fields[key] = { value: value.trim(), provider: 'hoyoverse', url, fetchedAt: now.toISOString(), reliability: 'OFFICIAL' }; };
  add('originalName', name ?? undefined);
  add('title', /◆\s*Title:\s*([^\n◆]+)/u.exec(text)?.[1]);
  add('constellation', /◆\s*Constellation:\s*([^\n◆]+)/u.exec(text)?.[1]);
  const element = /◆\s*(?:Vision|Stellar Linchpin):\s*(Pyro|Hydro|Cryo|Electro|Anemo|Geo|Dendro)\b/iu.exec(text)?.[1];
  add('element', element?.toLowerCase());
  return { id: post.post_id, url, date: new Date(post.created_at * 1000).toISOString(), text, name, fields,
    promotion: content.data.flatMap(row => typeof row.insert === 'object' && typeof row.insert.image === 'string' ? [row.insert.image] : []) };
}

/** Only an explicit dated availability/duration statement, never the announcement timestamp. */
export function officialReleaseEvidence(post: OfficialPost, names: readonly string[], now: Date): Evidence | null {
  if (!names.some(name => name.length >= 3 && post.text.includes(name)) || !/(Event Wish|available from|be available|Duration)/i.test(post.text)) return null;
  // A mixed banner article can contain several phases. Accept only a supported
  // availability sentence which identifies this character on the same line.
  const line = post.text.split('\n').find(value => names.some(name => value.includes(name)) && /(?:available from|be available (?:from|on))/i.test(value));
  const explicit = line && /new\s+(?:\d[-★ ]?star\s+)?character/i.test(line) ? /(?:available from|be available (?:from|on))\s*[:：]?\s*(20\d{2})[/-](\d{2})[/-](\d{2})\b/i.exec(line) : null;
  const durations = [...post.text.matchAll(/Duration\s*[:：]?\s*(20\d{2})[/-](\d{2})[/-](\d{2})\b/gi)];
  // A single explicitly dated Event Wish applies to its named featured characters.
  // Mixed phases, "after the update", and inferred version calendars stay unconfirmed.
  // A rerun proves banner availability, not the character's original release.
  // Only the named new character can receive this first-release evidence.
  const newCharacter = post.text.split('\n').some(value => /new\s+(?:\d[-★ ]?star\s+)?character/i.test(value) && names.some(name => value.includes(name)));
  const wish = newCharacter && /Event Wish/i.test(post.text) && /(?:boosted|increased) drop[- ]rate/i.test(post.text) && durations.length === 1 ? durations[0] : null;
  const match = explicit ?? wish;
  if (!match) return null;
  const value = `${match[1]}-${match[2]}-${match[3]}`;
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return { value, provider: 'hoyoverse', url: post.url, fetchedAt: now.toISOString(), reliability: 'OFFICIAL' };
}

const structuredSchema = z.object({ id: z.number().int().min(10000000).max(19999999), name: z.string().min(1).max(100),
  rarity: z.union([z.literal(4), z.literal(5)]), elementType: z.string(), weaponText: z.string().optional(), region: z.string().optional(), constellation: z.string().optional() });
const filesSchema = z.array(z.object({ name: z.string(), download_url: z.url().nullable() }));
export type StructuredMatch = Readonly<{ fields: CatalogFields; images: Partial<Record<AssetRole, readonly { provider: string; url: string; editorialStatus?: 'PROVISIONAL' | 'VALIDATED'; sourceHash?: string }[]>> }>;

export class CatalogSources {
  private snapshot?: string;
  private files = new Map<string, z.infer<typeof filesSchema>>();
  private manifest?: Record<string, Record<string, string>>;
  private readonly secondarySources: CatalogSecondarySources;
  constructor(private readonly http: CatalogHttp, private readonly attempt: AttemptSink, private readonly now: Date) { this.secondarySources = new CatalogSecondarySources(http,attempt,now); }
  async json(url: string, provider: string, field: string): Promise<unknown | null> {
    try {
      const response = await this.http(url, { maxBytes: 5 * 1024 * 1024 });
      if (response.status !== 200) throw new CatalogFetchError(response.status === 404 ? 'HTTP_404' : 'UNAVAILABLE', response.status);
      let value: unknown;
      try { value = JSON.parse(response.body.toString('utf8')); } catch { throw new CatalogFetchError('SCHEMA_CHANGED', 200); }
      await this.attempt({ provider, field, outcome: 'FOUND', sourceUrl: url, httpStatus: 200 });
      return value;
    } catch (error) {
      const code = error instanceof CatalogFetchError ? error.code : 'UNAVAILABLE';
      if (code === 'BUDGET_EXHAUSTED') throw error;
      await this.attempt({ provider, field, outcome: ['HTTP_404', 'UNCONFIRMED'].includes(code) ? 'MISSING' : 'ERROR', errorCode: code, sourceUrl: url,
        ...(error instanceof CatalogFetchError && error.httpStatus ? { httpStatus: error.httpStatus } : {}) });
      return null;
    }
  }
  async discover(): Promise<OfficialPost[]> {
    const posts = new Map<string, OfficialPost>();
    const seen = new Set<string>();
    const consume = async (value: unknown) => {
      const preview = postSchema.safeParse(value);
      if (preview.success && preview.data.post.uid === catalogSourceRegistry.officialAuthor && preview.data.user.uid === catalogSourceRegistry.officialAuthor &&
        preview.data.user.certification.type === 1 && preview.data.user.certification.desc === 'Official Big Boss') {
        const id = preview.data.post.post_id;
        if (seen.has(id)) return;
        seen.add(id);
        // getNewsList supplies excerpts, often an empty structured_content.
        // Hydrate from the official API before qualifying names/calendar.
        if (!preview.data.post.structured_content) {
          const full = await this.json(`https://bbs-api-os.hoyolab.com/community/post/wapi/getPostFull?gids=2&post_id=${id}`, 'hoyoverse', 'article');
          const parsed = z.object({ retcode: z.literal(0), data: z.object({ post: z.unknown() }) }).safeParse(full);
          if (!parsed.success) return;
          value = parsed.data.data.post;
        }
      }
      try { const post = parseOfficialPost(value, this.now); posts.set(post.id, post); }
      catch (error) { await this.attempt({ provider: 'hoyoverse', field: 'announcement', outcome: 'REJECTED', errorCode: error instanceof CatalogFetchError ? error.code : 'SCHEMA_CHANGED' }); }
    };
    for (const type of [1, 2, 3]) {
      let lastId = '';
      for (let page = 0; page < 2; page++) {
        const url = `https://bbs-api-os.hoyolab.com/community/post/wapi/getNewsList?gids=2&type=${type}&page_size=20${lastId ? `&last_id=${lastId}` : ''}`;
        const value = await this.json(url, 'hoyoverse', 'discovery');
        const feed = z.object({ retcode: z.literal(0), data: z.object({ list: z.array(z.unknown()), last_id: z.union([z.string(), z.number().int()]).transform(String), is_last: z.boolean() }) }).safeParse(value);
        if (!feed.success) { await this.attempt({ provider: 'hoyoverse', field: 'discovery', outcome: 'ERROR', errorCode: 'SCHEMA_CHANGED' }); break; }
        for (const post of feed.data.data.list) await consume(post);
        if (feed.data.data.is_last || !/^\d+$/.test(feed.data.data.last_id)) break;
        lastId = feed.data.data.last_id;
      }
    }
    for (const id of catalogSourceRegistry.announcementBookmarks) {
      if (posts.has(id)) continue;
      const value = await this.json(`https://bbs-api-os.hoyolab.com/community/post/wapi/getPostFull?gids=2&post_id=${id}`, 'hoyoverse', 'announcement');
      const response = z.object({ retcode: z.literal(0), data: z.object({ post: z.unknown() }) }).safeParse(value);
      if (response.success) await consume(response.data.data.post);
    }
    return [...posts.values()];
  }
  private async ref(): Promise<string> {
    if (this.snapshot) return this.snapshot;
    const value = await this.json('https://api.github.com/repos/theBowja/genshin-db/commits/main', 'genshin-db', 'snapshot');
    const parsed = z.object({ sha: z.string().regex(/^[a-f0-9]{40}$/) }).safeParse(value);
    this.snapshot = parsed.success ? parsed.data.sha : catalogSourceRegistry.fallbackSnapshot;
    return this.snapshot;
  }
  async structured(names: readonly string[], requested: readonly string[] = Object.keys(catalogFieldSources).concat(['icon','splash','wish','fullbody'])): Promise<StructuredMatch | null> {
    const fields: CatalogFields = {}, images: StructuredMatch['images'] = {};
    if (!requested.some(field => field !== 'releaseDate' && field !== 'promotion')) return null;
    for (const provider of catalogSourceRegistry.metadata) {
      const needsProvider = Object.entries(catalogFieldSources).some(([key, order]) => order.includes(provider) &&
        (!fields[key as keyof CatalogFields] || order.indexOf(provider) < order.indexOf(fields[key as keyof CatalogFields]!.provider)));
      if (!needsProvider) continue;
      const result = provider === 'genshin-db' ? await this.primary(names, requested) : await this.secondary(names);
      for (const [key, value] of Object.entries(result?.fields ?? {})) {
        const field = key as keyof CatalogFields, order = catalogFieldSources[field], previous = fields[field];
        if (!value || !order.includes(value.provider)) continue;
        if (previous && ['rarity', 'element'].includes(field) && previous.value !== value.value) {
          fields[field] = { ...previous, conflict: true };
          await this.attempt({ provider, field, outcome: 'CONFLICT', errorCode: 'CONTRADICTORY', sourceUrl: value.url });
        } else if (!previous || order.indexOf(value.provider) < order.indexOf(previous.provider)) fields[field] = value;
      }
      for (const [role, alternatives] of Object.entries(result?.images ?? {})) if (alternatives) images[role as AssetRole] = alternatives;
    }
    const secondaryRequested = requested.filter(field => !fields[field as keyof CatalogFields]);
    const secondary = await this.secondarySources.collect(names,secondaryRequested);
    for (const [field,value] of Object.entries(secondary)) if(value && !fields[field as keyof CatalogFields]) fields[field as keyof CatalogFields]=value;
    // Reviewed binary, not an inferred filename. Its bytes must still match the review.
    for (const image of reviewedSecondaryImages) if (requested.includes(image.role) && names.some(name => normalizedIdentity(name) === normalizedIdentity(image.name)))
      images[image.role] = [...(images[image.role] ?? []), image];
    return Object.keys(fields).length || Object.keys(images).length ? { fields, images } : null;
  }
  private async primary(names: readonly string[], requested: readonly string[]): Promise<StructuredMatch | null> {
    const ref = await this.ref();
    for (const language of ['English', 'French']) {
      let files = this.files.get(language);
      if (!files) {
        const data = await this.json(`https://api.github.com/repos/theBowja/genshin-db/contents/src/data/${language}/characters?ref=${ref}`, 'genshin-db', 'coverage');
        const parsed = filesSchema.safeParse(data);
        if (!parsed.success || parsed.data.length < 100 || parsed.data.length > 500) {
          await this.attempt({ provider: 'genshin-db', field: 'coverage', outcome: 'ERROR', errorCode: 'SCHEMA_CHANGED' }); continue;
        }
        files = parsed.data; this.files.set(language, files);
      }
      const matches = files.filter(file => names.some(name => providerName(name) === providerName(file.name.replace(/\.json$/, ''))));
      if (matches.length !== 1) continue;
      const file = matches[0]!;
      const url = `https://raw.githubusercontent.com/theBowja/genshin-db/${ref}/src/data/${language}/characters/${encodeURIComponent(file.name)}`;
      const parsed = structuredSchema.safeParse(await this.json(url, 'genshin-db', 'metadata'));
      if (!parsed.success) { await this.attempt({ provider: 'genshin-db', field: 'metadata', outcome: 'ERROR', errorCode: 'SCHEMA_CHANGED', sourceUrl: url }); continue; }
      if (!names.some(name => providerName(name) === providerName(parsed.data.name))) {
        await this.attempt({ provider: 'genshin-db', field: 'identity', outcome: 'CONFLICT', sourceUrl: url }); continue;
      }
      const record = parsed.data;
      const element = record.elementType.replace(/^ELEMENT_/, '').toLowerCase();
      if (!['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro'].includes(element)) continue;
      const fields: CatalogFields = {};
      const add = (key: keyof CatalogFields, value: string | number | undefined, sourceUrl = url) => { if (value !== undefined) fields[key] = { value, provider: 'genshin-db', url: sourceUrl, fetchedAt: this.now.toISOString(), reliability: 'STRUCTURED' }; };
      add('numericId', record.id); add(language === 'French' ? 'name' : 'originalName', record.name);
      add('rarity', record.rarity); add('element', element); add('weapon', record.weaponText); add('region', record.region); add('constellation', record.constellation);
      const translationUrl = url.replace(`/${language}/`, `/${language === 'French' ? 'English' : 'French'}/`);
      const translation = structuredSchema.safeParse(await this.json(translationUrl, 'genshin-db', 'translation'));
      if (translation.success && translation.data.id === record.id) {
        add(language === 'French' ? 'originalName' : 'name', translation.data.name, translationUrl);
        if (language === 'English') { add('weapon', translation.data.weaponText, translationUrl); add('region', translation.data.region, translationUrl); }
      }
      if (!this.manifest && requested.some(role=>['icon','splash','wish','fullbody'].includes(role))) {
        const manifestData = await this.json(`https://raw.githubusercontent.com/theBowja/genshin-db/${ref}/src/data/image/characters.json`, 'technical-manifest', 'images');
        const manifest = z.record(z.string(), z.record(z.string(), z.string())).safeParse(manifestData);
        if (manifest.success) this.manifest = manifest.data;
      }
      const entry = this.manifest?.[file.name.replace(/\.json$/, '')];
      const images: StructuredMatch['images'] = {};
      for (const [role, key] of [['icon', 'filename_icon'], ['splash', 'filename_gachaSplash'], ['wish', 'filename_gachaSlice'], ['fullbody', 'filename_fullbody']] as const) {
        if (!requested.includes(role)) continue;
        const technical = entry?.[key];
        if (!technical || !/^UI_[A-Za-z0-9_]{1,100}$/.test(technical)) continue;
        images[role] = [ ...(role === 'icon' && entry?.hoyowiki_icon ? [{ provider: 'hoyoverse', url: entry.hoyowiki_icon }] : []),
          { provider: 'enka', url: `https://enka.network/ui/${technical}.png` } ].sort((a, b) =>
            (catalogSourceRegistry.images as readonly string[]).indexOf(a.provider) - (catalogSourceRegistry.images as readonly string[]).indexOf(b.provider));
        if (role === 'icon') add('technicalName', technical, `https://raw.githubusercontent.com/theBowja/genshin-db/${ref}/src/data/image/characters.json`);
      }
      return { fields, images };
    }
    await this.attempt({ provider: 'genshin-db', field: 'metadata', outcome: 'MISSING', errorCode: 'ABSENT' });
    return null;
  }
  private async secondary(names: readonly string[]): Promise<StructuredMatch | null> {
    const list = await this.json('https://genshin.jmp.blue/characters', 'genshin.dev', 'coverage');
    const coverage = z.array(z.string()).safeParse(list);
    if (!coverage.success || coverage.data.length < 100) {
      await this.attempt({ provider: 'genshin.dev', field: 'coverage', outcome: 'REJECTED', errorCode: 'COVERAGE_UNQUALIFIED' }); return null;
    }
    const keys = coverage.data.filter(key => names.some(name => normalizedIdentity(name) === normalizedIdentity(key.replaceAll('-', ' '))));
    if (keys.length !== 1) { await this.attempt({ provider: 'genshin.dev', field: 'metadata', outcome: 'MISSING', errorCode: 'ABSENT' }); return null; }
    const url = `https://genshin.jmp.blue/characters/${encodeURIComponent(keys[0]!)}`;
    const parsed = z.object({ name: z.string(), rarity: z.union([z.literal(4), z.literal(5)]), vision: z.string(), weapon: z.string().optional(), nation: z.string().optional() }).safeParse(await this.json(url, 'genshin.dev', 'metadata'));
    if (!parsed.success || !names.some(name => normalizedIdentity(name) === normalizedIdentity(parsed.data.name))) return null;
    const fields: CatalogFields = {};
    for (const [key, value] of [['originalName', parsed.data.name], ['rarity', parsed.data.rarity], ['element', parsed.data.vision.toLowerCase()], ['weapon', parsed.data.weapon], ['region', parsed.data.nation]] as const) {
      if (value !== undefined) fields[key] = { value, provider: 'genshin.dev', url, fetchedAt: this.now.toISOString(), reliability: 'STRUCTURED' };
    }
    return { fields, images: {} };
  }
}
