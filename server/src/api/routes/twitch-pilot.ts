import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { AppConfig } from '../../config/environment.js';
import type { TwitchPilotService } from '../../application/twitch/twitch-pilot-service.js';
import { twitchOAuthPurpose } from '../../application/twitch/twitch-pilot-service.js';
import type { SnapshotPilotService } from '../../application/migration/snapshot-pilot-service.js';
import { SnapshotParseError } from '../../application/migration/streamerbot-snapshot.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';
import type { TwitchCommandPilot } from '../../application/twitch/twitch-command-pilot.js';

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
  commandPilot?: TwitchCommandPilot;
}) {
  const authenticated = { preHandler: options.authenticate };
  app.get('/api/v1/me/twitch', authenticated, async (request, reply) => {
    reply.header('cache-control', 'no-store');
    const identity = requireAuthenticatedIdentity(request);
    const status = await options.twitch.status(identity);
    if (!options.commandPilot || !status.eligible) return status;
    const player = await options.twitch.requirePilot(identity);
    return { ...status, ...await options.commandPilot.status(), commandPilotResponse: await options.commandPilot.responseStatus(player.id) };
  });
  const commandControlParameters = (request: { body: unknown; query: unknown }) => {
    if (!z.object({}).strict().safeParse(request.body === undefined ? {} : request.body).success || Object.keys(request.query as object).length)
      throw new AppError('Paramètres du pilote de commandes invalides.', 400, 'VALIDATION_ERROR');
  };
  if (options.commandPilot) {
    app.post('/api/v1/me/twitch/commands/pilot', authenticated, async (request, reply) => {
      reply.header('cache-control', 'no-store');
      const parameters = z.object({ acknowledgement: z.literal('STREAMERBOT_PATH_DISABLED'),
        twitchUserIds: z.array(z.string().regex(/^[1-9][0-9]{0,127}$/)).min(1).max(100).optional() }).strict().safeParse(request.body);
      if (!parameters.success || Object.keys(request.query as object).length)
        throw new AppError('Confirmation Streamer.bot et paramètres canary requis.', 400, 'VALIDATION_ERROR');
      const player = await options.twitch.requirePilot(requireAuthenticatedIdentity(request));
      return options.commandPilot!.arm(player.id, parameters.data.acknowledgement, parameters.data.twitchUserIds);
    });
    app.delete('/api/v1/me/twitch/commands/pilot', authenticated, async (request, reply) => {
      reply.header('cache-control', 'no-store'); commandControlParameters(request);
      const player = await options.twitch.requirePilot(requireAuthenticatedIdentity(request));
      return options.commandPilot!.disarm(player.id);
    });
  }
  if (options.commandPilot) app.post('/api/v1/me/twitch/commands/:receiptId/response/retry', authenticated, async (request, reply) => {
    reply.header('cache-control', 'no-store');
    const params = z.object({ receiptId: z.uuid() }).strict().safeParse(request.params);
    if (!params.success || !z.object({}).strict().safeParse(request.body === undefined ? {} : request.body).success || Object.keys(request.query as object).length)
      throw new AppError('Paramètres de reprise Twitch invalides.', 400, 'VALIDATION_ERROR');
    const player = await options.twitch.requirePilot(requireAuthenticatedIdentity(request));
    return options.commandPilot!.retryResponses(player.id, params.data.receiptId);
  });
  app.get('/api/v1/me/twitch/resolution', authenticated, async (request, reply) => {
    reply.header('cache-control', 'no-store');
    return options.twitch.linkResolution(requireAuthenticatedIdentity(request));
  });
  app.post('/api/v1/me/twitch/resolution', authenticated, async (request, reply) => {
    reply.header('cache-control', 'no-store');
    const input = z.object({ resolutionId: z.uuid(), choice: z.enum(['WEB','TWITCH']), confirmation: z.literal('ONE_PROGRESSION_NO_MERGE') }).strict().safeParse(request.body);
    if (!input.success || Object.keys(request.query as object).length) throw new AppError('Confirmation de progression requise.', 400, 'VALIDATION_ERROR');
    return options.twitch.resolveLink(requireAuthenticatedIdentity(request), input.data.resolutionId, input.data.choice);
  });
  app.post('/api/v1/me/twitch/start', authenticated, request => options.twitch.start(requireAuthenticatedIdentity(request)));
  app.post('/api/v1/me/twitch/recover/start', authenticated, request => {
    commandControlParameters(request);
    return options.twitch.startClaim(requireAuthenticatedIdentity(request));
  });
  app.post('/api/v1/me/twitch/runtime/start', authenticated, request => {
    if (!z.object({}).strict().safeParse(request.body ?? {}).success) throw new AppError('Paramètres runtime Twitch invalides.', 400, 'VALIDATION_ERROR');
    return options.twitch.startRuntime(requireAuthenticatedIdentity(request));
  });
  app.post('/api/v1/me/twitch/favor/start', authenticated, request => {
    if (!z.object({}).strict().safeParse(request.body === undefined ? {} : request.body).success || Object.keys(request.query as object).length)
      throw new AppError('Paramètres Faveur Twitch invalides.', 400, 'VALIDATION_ERROR');
    return options.twitch.startFavor(requireAuthenticatedIdentity(request));
  });
  app.delete('/api/v1/me/twitch/favor/subscription', authenticated, request => {
    if (!z.object({}).strict().safeParse(request.body === undefined ? {} : request.body).success || Object.keys(request.query as object).length)
      throw new AppError('Paramètres Faveur Twitch invalides.', 400, 'VALIDATION_ERROR');
    return options.twitch.disableFavor(requireAuthenticatedIdentity(request));
  });
  const giftParameters = (request: { body: unknown; query: unknown }) => {
    if (!z.object({}).strict().safeParse(request.body === undefined ? {} : request.body).success || Object.keys(request.query as object).length)
      throw new AppError('Paramètres Gift Suprême invalides.', 400, 'VALIDATION_ERROR');
  };
  app.post('/api/v1/me/twitch/gift-supreme/start', authenticated, request => { giftParameters(request); return options.twitch.startGiftSupreme(requireAuthenticatedIdentity(request)); });
  app.post('/api/v1/me/twitch/gift-supreme/ensure', authenticated, request => { giftParameters(request); return options.twitch.ensureGiftSupreme(requireAuthenticatedIdentity(request)); });
  app.delete('/api/v1/me/twitch/gift-supreme', authenticated, request => { giftParameters(request); return options.twitch.disableGiftSupreme(requireAuthenticatedIdentity(request)); });
  app.post('/api/v1/me/twitch/giveaway/start', authenticated, request => { giftParameters(request); return options.twitch.startGiveaway(requireAuthenticatedIdentity(request)); });
  app.post('/api/v1/me/twitch/giveaway/enable', authenticated, request => { giftParameters(request); return options.twitch.enableGiveaway(requireAuthenticatedIdentity(request)); });
  app.delete('/api/v1/me/twitch/giveaway', authenticated, request => { giftParameters(request); return options.twitch.disableGiveaway(requireAuthenticatedIdentity(request)); });
  app.delete('/api/v1/me/twitch', authenticated, request => options.twitch.unlink(requireAuthenticatedIdentity(request)));
  app.delete('/api/v1/me/twitch/runtime/subscription', authenticated, request => {
    if (!z.object({}).strict().safeParse(request.body ?? {}).success || Object.keys(request.query as object).length)
      throw new AppError('Paramètres de réception du chat invalides.', 400, 'VALIDATION_ERROR');
    return options.twitch.disableRuntime(requireAuthenticatedIdentity(request));
  });
  app.get('/api/v1/me/twitch/callback', { logLevel: 'silent' }, async (request, reply) => {
    const query = callbackSchema.safeParse(request.query);
    let outcome = 'error';
    let runtime = false;
    let favor = false;
    let gift = false;
    let giveaway = false;
    let claim = false;
    try { if (query.success) {
      const purpose = twitchOAuthPurpose(query.data.state);
      runtime = purpose === 'AUTHORIZE_RUNTIME';
      favor = purpose === 'AUTHORIZE_FAVOR_SUBSCRIPTIONS';
      gift = purpose === 'AUTHORIZE_GIFT_SUPREME';
      giveaway = purpose === 'AUTHORIZE_GIVEAWAY';
      claim = purpose === 'CLAIM_TWITCH_PROFILE';
      const result = await options.twitch.callback(query.data);
      outcome = 'resolutionRequired' in result && result.resolutionRequired ? 'progression-choice' : claim ? 'profile-recovered' : giveaway ? 'giveaway-activated' : gift ? 'gift-supreme-activated' : favor ? 'favor-runtime-activated' : runtime ? 'runtime-activated' : 'connected';
    } }
    catch (error) { outcome = giveaway ? 'giveaway-error' : gift ? 'gift-supreme-error' : favor ? 'favor-runtime-error' : runtime ? 'runtime-error' : error instanceof AppError ? error.code : 'error'; }
    const target = new URL(options.config.frontendOrigin ?? 'http://localhost:5173');
    target.searchParams.set('twitch', outcome);
    target.hash = giveaway ? 'moderation' : 'configuration';
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
