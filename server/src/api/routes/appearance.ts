import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import { CosmeticType } from '../../../generated/prisma/client.js';
import type { AppearanceService } from '../../application/appearance/appearance-service.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';

const body = z.object({ type: z.enum(['AVATAR', 'TITLE', 'BADGE']), cosmeticId: z.uuid().nullable() }).strict();
const consultation=z.object({type:z.enum(['AVATAR','TITLE']),cosmeticIds:z.array(z.uuid()).min(1).max(200)}).strict();
export async function registerAppearanceRoutes(app: FastifyInstance, options: { authenticate: preHandlerHookHandler; service: AppearanceService }) {
  app.addHook('onSend', (_request, reply, _payload, done) => { reply.header('Cache-Control', 'no-store'); done(); });
  app.get('/api/v1/me/appearance', { preHandler: options.authenticate }, request => options.service.get(requireAuthenticatedIdentity(request)));
  app.post('/api/v1/me/appearance/consulted',{preHandler:options.authenticate},request=>{
    const parsed=consultation.safeParse(request.body);
    if(!parsed.success)throw new AppError('Consultation cosmétique invalide.',400,'APPEARANCE_INVALID');
    return options.service.consult(requireAuthenticatedIdentity(request),parsed.data.type,parsed.data.cosmeticIds);
  });
  app.patch('/api/v1/me/appearance', { preHandler: options.authenticate }, request => {
    const parsed = body.safeParse(request.body);
    if (!parsed.success) throw new AppError('Équipement cosmétique invalide.', 400, 'APPEARANCE_INVALID');
    return options.service.equip(requireAuthenticatedIdentity(request), parsed.data.type as CosmeticType, parsed.data.cosmeticId);
  });
}
