import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import { sharedEmojis, type SharedInvocations } from '../../application/gacha/shared-invocations.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';
const tab = z.uuid();
export async function registerSharedInvocationRoutes(app: FastifyInstance, options: {
    authenticate: preHandlerHookHandler;
    shared: SharedInvocations;
}) {
    const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
        const r = schema.safeParse(value);
        if (!r.success)
            throw new AppError('Invalid shared invocation request.', 400, 'VALIDATION_ERROR');
        return r.data;
    };
    app.get('/api/v1/shared-invocations', { preHandler: options.authenticate }, r => options.shared.list(requireAuthenticatedIdentity(r)));
    app.get('/api/v1/shared-invocations/spectators', { preHandler: options.authenticate }, r => {
        const q=parse(z.object({page:z.coerce.number().int().min(1).max(1000).default(1)}).strict(),r.query);
        return options.shared.spectators(requireAuthenticatedIdentity(r),q.page);
    });
    app.post('/api/v1/shared-invocations/viewer-presence', { preHandler: options.authenticate }, r => {
        const b=parse(z.object({tabId:tab,sessionId:z.uuid(),token:z.uuid(),revision:z.number().int().safe().positive(),visible:z.boolean()}).strict(),r.body);
        return options.shared.viewerPresence(requireAuthenticatedIdentity(r),b.tabId,b.sessionId,b.token,b.revision,b.visible);
    });
    app.get('/api/v1/shared-invocations/state', { preHandler: options.authenticate }, r => {
        const q = parse(z.object({ tabId: tab, cursor: z.string().max(250).optional() }).strict(), r.query);
        return options.shared.state(requireAuthenticatedIdentity(r), q.tabId, q.cursor);
    });
    app.post('/api/v1/shared-invocations/start', { preHandler: options.authenticate }, r => options.shared.start(requireAuthenticatedIdentity(r), parse(z.object({ tabId: tab, consent: z.literal(true) }).strict(), r.body).tabId));
    app.post('/api/v1/shared-invocations/watch', { preHandler: options.authenticate }, r => {
        const b = parse(z.object({ tabId: tab, sessionId: z.uuid().nullable() }).strict(), r.body);
        return options.shared.watch(requireAuthenticatedIdentity(r), b.tabId, b.sessionId);
    });
    app.post('/api/v1/shared-invocations/control', { preHandler: options.authenticate }, r => {
        const b = parse(z.object({ tabId: tab, action: z.enum(['stop', 'presence', 'gesture', 'advance', 'skip', 'close']), screen: z.enum(['invocation', 'other']), seq: z.number().int().positive().optional(), presenceRevision: z.number().int().safe().positive().optional(), sessionId: z.uuid().optional() }).strict().refine(b => !['presence', 'gesture'].includes(b.action) || (b.presenceRevision !== undefined && b.sessionId !== undefined)), r.body);
        return options.shared.control(requireAuthenticatedIdentity(r), b.tabId, b.action, b.screen, b.seq, b.presenceRevision, b.sessionId);
    });
    app.post('/api/v1/shared-invocations/reaction', { preHandler: options.authenticate }, r => {
        const b = parse(z.object({ tabId: tab, emoji: z.enum(sharedEmojis) }).strict(), r.body);
        return options.shared.react(requireAuthenticatedIdentity(r), b.tabId, b.emoji);
    });
}
