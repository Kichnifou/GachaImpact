import 'dotenv/config';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { build, preview } from 'vite';
import react from '@vitejs/plugin-react';
import { isolatedBatchDatabase } from '../tests-db/isolated-batch-database.js';
import { registerAuthenticationContext, createAuthenticationHook, requireAuthenticatedIdentity } from '../src/api/auth/authentication.js';
import { registerErrorHandler } from '../src/api/error-handler.js';
import { registerExplorationRoutes } from '../src/api/routes/exploration.js';
import { ExplorationService } from '../src/application/exploration/exploration-service.js';
import { activeExplorationRegions } from '../src/application/exploration/regions.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { PermanentMissionService } from '../src/application/missions/permanent-mission-service.js';
import { resourceKeys, elementKeys, type ElementKey } from '../src/domain/economy/resources.js';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
if (process.cwd() !== path.join(repository, 'server')) throw Error('Run exploration:rehearse from server/.');
const frontendOrigin = 'http://127.0.0.1:5187', apiOrigin = 'http://127.0.0.1:3187';
const fixture = isolatedBatchDatabase(), db = fixture.database;
const directory = path.join(repository, 'local-data/exploration-rehearsal');
const app = Fastify({ logger: false });
let vite: Awaited<ReturnType<typeof preview>> | undefined, closing = false;
const profiles = new Map<string, { playerId: string; subject: string; token: string }>();
const tokenSubjects = new Map<string, string>();
async function cleanup() {
  if (closing) return; closing = true;
  try { if(vite)await new Promise<void>((resolve,reject)=>vite!.httpServer.close(error=>error?reject(error):resolve())); await app.close(); } finally { await fixture.cleanup(); }
}
process.once('SIGINT', () => { void cleanup().finally(() => { process.exitCode = 0; }); });
process.once('SIGTERM', () => { void cleanup().finally(() => { process.exitCode = 0; }); });
try {
  console.log('Préparation du PostgreSQL privé : migrations et références publiées, aucun compte public copié.');
  await fixture.setup({ seedPublicCatalog: true, prismaMigrations: true });
  const getPlayer = new GetCurrentPlayer(new PrismaCurrentPlayerStore(db)), service = new ExplorationService(db, getPlayer, { now: () => new Date() });
  const regions = await activeExplorationRegions(db);
  for (const [key, elementKey, amount] of [['normal', 'cryo', 0], ['999', 'cryo', 999], ['1000', 'electro', 1000], ['hydro', 'hydro', 500]] as const) {
    const subject = randomUUID(), token = randomBytes(32).toString('hex');
    const player = await db.player.create({ data: { displayName: `Recette ${key}`, elementKey,
      webIdentity: { create: { provider: 'supabase', providerSubject: subject } }, progression: { create: { xp: 0n } }, economyStats: { create: {} },
      resourceBalances: { create: resourceKeys.map(resourceKey => ({ resourceKey, amount: 0n })) },
    } });
    await db.$transaction(tx => new PermanentMissionService().initializePlayer(tx, player.id, new Date(), true));
    for (const region of regions) {
      const remaining = amount;
      await db.explorationRegionProgress.create({ data: { playerId: player.id, regionKey: region.key,
        primogemsUsed: Math.min(100, remaining), morasUsed: Math.min(200, Math.max(0, remaining - 100)),
        ownUsed: Math.min(300, Math.max(0, remaining - 300)), otherUsed: Math.min(400, Math.max(0, remaining - 600)),
      } });
    }
    profiles.set(key, { playerId: player.id, subject, token }); tokenSubjects.set(token, subject);
  }
  registerAuthenticationContext(app); registerErrorHandler(app);
  await app.register(cors, { origin: frontendOrigin });
  const authenticate = createAuthenticationHook({ verify: async token => { const subject = tokenSubjects.get(token); return subject ? { subject } : null; } });
  await app.register(registerExplorationRoutes, { authenticate, service });
  const resources = async (playerId: string) => {
    const rows = await db.playerResourceBalance.findMany({ where: { playerId } }), amounts = new Map(rows.map(row => [row.resourceKey, row.amount.toString()]));
    return { primogems: amounts.get('primogems') ?? '0', moras: amounts.get('moras') ?? '0', particles: Object.fromEntries(elementKeys.map(key => [key, amounts.get(`particles_${key}`) ?? '0'])) };
  };
  app.get('/__rehearsal/bootstrap', async (request, reply) => {
    const profile = profiles.get(String((request.query as { profile?: string }).profile ?? 'normal'));
    if (!profile) return reply.code(400).send({ error: 'Unknown local profile' });
    const player = await db.player.findUniqueOrThrow({ where: { id: profile.playerId }, select: { id: true, displayName: true, elementKey: true, status: true } });
    reply.header('Cache-Control', 'no-store');
    return { player: { ...player, elementKey: player.elementKey as ElementKey }, subject: profile.subject, token: profile.token, apiBaseUrl: apiOrigin, resources: await resources(player.id) };
  });
  app.get('/__rehearsal/resources', { preHandler: authenticate }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store'); const player = await getPlayer.execute(requireAuthenticatedIdentity(request)); return resources(player.id);
  });
  app.get('/__rehearsal/health', () => ({ localOnly: true, privateSchema: true, profiles: [...profiles.keys()], publishedRegions: regions.map(row => row.name) }));
  await app.listen({ host: '127.0.0.1', port: 3187 });
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'index.html'), '<!doctype html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/src/exploration/rehearsal-entry.tsx"></script></body></html>');
  // Both the injected Exploration client and every fallback API remain local.
  const config = { root: repository, configFile: false as const, plugins: [react()],
    define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiOrigin), 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-rehearsal-only') },
    build: { outDir: path.join(directory,'dist'), emptyOutDir: false, rollupOptions: {input: path.join(directory,'index.html')} },
    preview: { host: '127.0.0.1', port: 5187, strictPort: true, proxy: { '/__rehearsal': apiOrigin } },
  };
  await build(config);
  vite = await preview(config);
  const url = `${frontendOrigin}/local-data/exploration-rehearsal/index.html`;
  await writeFile(path.join(directory, 'runtime.json'), JSON.stringify({ schema: fixture.schema, pid: process.pid, url, apiOrigin, profiles: [...profiles.keys()], startedAt: new Date().toISOString() }, null, 2));
  console.log('Recette Exploration prête : vrais services et gains PostgreSQL privés ; les autres écrans utilisent des fixtures locales.');
  for (const key of profiles.keys()) console.log(`${key}: ${url}?profile=${key}#exploration`);
  console.log('Arrêt et nettoyage du seul schéma UUID privé : Ctrl+C. Aucun déploiement ni migration publics.');
} catch (error) {
  await cleanup(); console.error(error instanceof Error ? error.message : 'Local rehearsal failed'); process.exitCode = 1;
}
