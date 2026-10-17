import type {FastifyPluginAsync,preHandlerHookHandler} from 'fastify';
import {z} from 'zod';
import {requireAuthenticatedIdentity} from '../auth/authentication.js';
import {AppError} from '../errors.js';
import type {ExplorationService} from '../../application/exploration/exploration-service.js';
const key={idempotencyKey:z.uuid()};
const action=z.discriminatedUnion('kind',[
  z.object({...key,kind:z.literal('START'),sessionId:z.null(),regionKey:z.string().min(1).max(100)}).strict(),
  z.object({...key,kind:z.literal('NEXT'),sessionId:z.uuid()}).strict(),
  z.object({...key,kind:z.literal('STOP'),sessionId:z.uuid()}).strict(),
  z.object({...key,kind:z.literal('ABANDON'),sessionId:z.uuid()}).strict(),
  z.object({...key,kind:z.literal('OPEN'),sessionId:z.uuid(),chestIndex:z.number().int().min(0).max(2),path:z.string().max(2048).regex(/^[URDL]*$/)}).strict(),
]);
const presence=z.object({tabKey:z.uuid(),sequence:z.number().int().positive().max(1000000000),visible:z.boolean()}).strict();
const params=z.object({sessionId:z.uuid()}).strict();
function parse<T>(schema:z.ZodType<T>,input:unknown):T{const result=schema.safeParse(input);if(!result.success)throw new AppError('Demande Exploration invalide.',400,'VALIDATION_ERROR');return result.data;}
export const registerExplorationRoutes:FastifyPluginAsync<{authenticate:preHandlerHookHandler;service:ExplorationService}>=async(app,{authenticate,service})=>{
  app.get('/api/v1/exploration',{preHandler:authenticate},request=>service.overview(requireAuthenticatedIdentity(request)));
  app.post('/api/v1/exploration/actions',{preHandler:authenticate},request=>service.act(requireAuthenticatedIdentity(request),parse(action,request.body)));
  app.post('/api/v1/exploration/sessions/:sessionId/presence',{preHandler:authenticate},request=>service.presence(requireAuthenticatedIdentity(request),parse(params,request.params).sessionId,parse(presence,request.body)));
};
