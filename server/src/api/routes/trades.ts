import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { TradeService } from '../../application/trades/trade-service.js';
import type { GetCurrentPlayer } from '../../application/player/get-current-player.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';
const key = z.uuid();
const quantity = z.string().refine(value => /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n);
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError('Paramètres d’échange invalides.', 400, 'VALIDATION_ERROR');
  return result.data;
}
export async function registerTradeRoutes(app: FastifyInstance, options: { authenticate: preHandlerHookHandler; service: TradeService; getPlayer: GetCurrentPlayer }) {
  const { service, getPlayer } = options, config = { preHandler: options.authenticate };
  app.addHook('onSend', (_request, reply, _payload, done) => { reply.header('Cache-Control', 'no-store'); done(); });
  app.get('/api/v1/me/trades', config, async request => service.snapshot((await getPlayer.execute(requireAuthenticatedIdentity(request))).id));
  app.get('/api/v1/me/trades/partners', config, async request => {
    const query = parse(z.object({ q: z.string().max(100).default(''), page: z.coerce.number().int().min(1).max(1_000_000).default(1) }).strict(), request.query);
    return service.partners((await getPlayer.execute(requireAuthenticatedIdentity(request))).id, query.q, query.page);
  });
  app.post('/api/v1/me/trades', config, async request => {
    const body = parse(z.object({ recipientPlayerId: key, amount: quantity, idempotencyKey: key }).strict(), request.body);
    return service.create((await getPlayer.execute(requireAuthenticatedIdentity(request))).id, body.recipientPlayerId, BigInt(body.amount), body.idempotencyKey);
  });
  for (const action of ['accept', 'refuse', 'cancel'] as const) app.post(`/api/v1/me/trades/:requestId/${action}`, config, async request => {
    const params = parse(z.object({ requestId: key }).strict(), request.params);
    const body = parse(z.object({ idempotencyKey: key }).strict(), request.body);
    return service.mutate((await getPlayer.execute(requireAuthenticatedIdentity(request))).id, params.requestId, action, body.idempotencyKey);
  });
  for (const action of ['accept', 'refuse'] as const) app.post(`/api/v1/me/trades/${action}-all`, config, async request => {
    const body = parse(z.object({ idempotencyKey: key }).strict(), request.body);
    return service.all((await getPlayer.execute(requireAuthenticatedIdentity(request))).id, action, body.idempotencyKey);
  });
}
