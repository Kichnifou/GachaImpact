import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { ActivatePlayerTeam, ClearPlayerTeam, CreateNextPlayerTeam, DeleteExtraPlayerTeam, GetCurrentPlayerTeams, RemovePlayerTeamSlot, RenamePlayerTeam, ReorderPlayerTeams, ReorderPlayerTeamSlots, SetPlayerTeamSlot } from '../../application/team/team-services.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';

type Options = Readonly<{
  authenticate: preHandlerHookHandler;
  getCurrentPlayerTeams: GetCurrentPlayerTeams;
  activatePlayerTeam: ActivatePlayerTeam;
  renamePlayerTeam: RenamePlayerTeam;
  createNextPlayerTeam: CreateNextPlayerTeam;
  deleteExtraPlayerTeam: DeleteExtraPlayerTeam;
  reorderPlayerTeams: ReorderPlayerTeams;
  setPlayerTeamSlot: SetPlayerTeamSlot;
  reorderPlayerTeamSlots: ReorderPlayerTeamSlots;
  removePlayerTeamSlot: RemovePlayerTeamSlot;
  clearPlayerTeam: ClearPlayerTeam;
}>;

const teamParamsSchema = z.object({ teamId: z.uuid() }).strict();
const slotParamsSchema = z.object({ teamId: z.uuid(), position: z.coerce.number().int() }).strict();
const characterSchema = z.object({ characterId: z.uuid() }).strict();
const nameSchema = z.object({ name: z.string().nullable() }).strict();
const createSchema = z.object({ expectedPosition: z.number().int().min(11) }).strict();
const teamOrderSchema = z.object({ teamIds: z.array(z.uuid()).min(10) }).strict();
const slotOrderSchema = z.object({ characterIds: z.array(z.uuid().nullable()).length(4) }).strict();

export async function registerTeamRoutes(app: FastifyInstance, options: Options): Promise<void> {
  app.get('/api/v1/me/teams', { preHandler: options.authenticate }, (request) =>
    options.getCurrentPlayerTeams.execute(requireAuthenticatedIdentity(request)));

  app.patch('/api/v1/me/teams/:teamId/active', { preHandler: options.authenticate }, async (request) => {
    const params = teamParamsSchema.safeParse(request.params);
    if (!params.success) throw validationError();
    return options.activatePlayerTeam.execute(requireAuthenticatedIdentity(request), params.data.teamId);
  });

  app.patch('/api/v1/me/teams/:teamId/name', { preHandler: options.authenticate }, async (request) => {
    const params = teamParamsSchema.safeParse(request.params);
    const body = nameSchema.safeParse(request.body);
    if (!params.success || !body.success) throw validationError();
    return options.renamePlayerTeam.execute(requireAuthenticatedIdentity(request), params.data.teamId, body.data.name);
  });

  app.post('/api/v1/me/teams', { preHandler: options.authenticate }, async (request) => {
    const body = createSchema.safeParse(request.body);
    if (!body.success) throw validationError();
    return options.createNextPlayerTeam.execute(requireAuthenticatedIdentity(request), body.data.expectedPosition);
  });

  app.put('/api/v1/me/teams/order', { preHandler: options.authenticate }, async (request) => {
    const body = teamOrderSchema.safeParse(request.body);
    if (!body.success) throw validationError();
    return options.reorderPlayerTeams.execute(requireAuthenticatedIdentity(request), body.data.teamIds);
  });

  app.delete('/api/v1/me/teams/:teamId', { preHandler: options.authenticate }, async (request) => {
    const params = teamParamsSchema.safeParse(request.params);
    if (!params.success) throw validationError();
    return options.deleteExtraPlayerTeam.execute(requireAuthenticatedIdentity(request), params.data.teamId);
  });

  app.put('/api/v1/me/teams/:teamId/slots/:position', { preHandler: options.authenticate }, async (request) => {
    const params = slotParamsSchema.safeParse(request.params);
    const body = characterSchema.safeParse(request.body);
    if (!params.success || !body.success) throw validationError();
    return options.setPlayerTeamSlot.execute(
      requireAuthenticatedIdentity(request), params.data.teamId, params.data.position, body.data.characterId,
    );
  });

  app.put('/api/v1/me/teams/:teamId/slots/order', { preHandler: options.authenticate }, async (request) => {
    const params = teamParamsSchema.safeParse(request.params);
    const body = slotOrderSchema.safeParse(request.body);
    if (!params.success || !body.success) throw validationError();
    return options.reorderPlayerTeamSlots.execute(requireAuthenticatedIdentity(request), params.data.teamId, body.data.characterIds);
  });

  app.delete('/api/v1/me/teams/:teamId/slots/:position', { preHandler: options.authenticate }, async (request) => {
    const params = slotParamsSchema.safeParse(request.params);
    if (!params.success) throw validationError();
    return options.removePlayerTeamSlot.execute(requireAuthenticatedIdentity(request), params.data.teamId, params.data.position);
  });

  app.delete('/api/v1/me/teams/:teamId/slots', { preHandler: options.authenticate }, async (request) => {
    const params = teamParamsSchema.safeParse(request.params);
    if (!params.success) throw validationError();
    return options.clearPlayerTeam.execute(requireAuthenticatedIdentity(request), params.data.teamId);
  });
}

function validationError() {
  return new AppError('Un identifiant d’équipe, un emplacement 1..4 et un personnage canonique valides sont requis.', 400, 'VALIDATION_ERROR');
}
