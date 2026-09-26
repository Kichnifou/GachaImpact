import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { AppConfig } from '../../config/environment.js';
import type { TwitchPilotService } from '../../application/twitch/twitch-pilot-service.js';
import type { SnapshotPilotService } from '../../application/migration/snapshot-pilot-service.js';
import { SnapshotParseError } from '../../application/migration/streamerbot-snapshot.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';

const filesSchema = z.object({ files: z.record(z.string(), z.string().max(4_000_000)) }).strict();
const applySchema = filesSchema.extend({ previewId: z.string().length(94) });
const callbackSchema = z.object({ state: z.string().optional(), code: z.string().optional(), error: z.string().optional() });
function parseFiles(body: unknown) {
  const result = filesSchema.safeParse(body);
  if (!result.success) throw new AppError('Bundle snapshot invalide.', 400, 'SNAPSHOT_INVALID');
  return result.data.files;
}

export async function registerTwitchPilotRoutes(app: FastifyInstance, options: {
  authenticate: preHandlerHookHandler; twitch: TwitchPilotService; snapshot: SnapshotPilotService; config: AppConfig;
}) {
  const authenticated = { preHandler: options.authenticate };
  app.get('/api/v1/me/twitch', authenticated, request => options.twitch.status(requireAuthenticatedIdentity(request)));
  app.post('/api/v1/me/twitch/start', authenticated, request => options.twitch.start(requireAuthenticatedIdentity(request)));
  app.delete('/api/v1/me/twitch', authenticated, request => options.twitch.unlink(requireAuthenticatedIdentity(request)));
  app.get('/api/v1/me/twitch/callback', { logLevel: 'silent' }, async (request, reply) => {
    const query = callbackSchema.safeParse(request.query);
    let outcome = 'error';
    try { if (query.success) { await options.twitch.callback(query.data); outcome = 'connected'; } }
    catch (error) { if (error instanceof AppError) outcome = error.code; }
    const target = new URL(options.config.frontendOrigin ?? 'http://localhost:5173');
    target.searchParams.set('twitch', outcome);
    target.hash = 'configuration';
    reply.header('cache-control', 'no-store');
    return reply.redirect(target.toString());
  });
  app.post('/api/v1/me/twitch/snapshot/preview', { ...authenticated, bodyLimit: 8_500_000 }, async request => {
    try { return await options.snapshot.preview(requireAuthenticatedIdentity(request), parseFiles(request.body)); }
    catch (error) { if (error instanceof SnapshotParseError) throw new AppError(error.message, 422, 'SNAPSHOT_INVALID'); throw error; }
  });
  app.post('/api/v1/me/twitch/snapshot/apply', { ...authenticated, bodyLimit: 8_500_000 }, async request => {
    const parsed = applySchema.safeParse(request.body);
    if (!parsed.success) throw new AppError('Confirmation snapshot invalide.', 400, 'SNAPSHOT_INVALID');
    try { return await options.snapshot.apply(requireAuthenticatedIdentity(request), parsed.data.files, parsed.data.previewId); }
    catch (error) { if (error instanceof SnapshotParseError) throw new AppError(error.message, 422, 'SNAPSHOT_INVALID'); throw error; }
  });
}
