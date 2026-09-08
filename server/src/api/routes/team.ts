import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { ActivatePlayerTeam, ClearPlayerTeam, GetCurrentPlayerTeams, RemovePlayerTeamSlot, SetPlayerTeamSlot } from '../../application/team/team-services.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';

type Options = Readonly<{
  authenticate: preHandlerHookHandler;
  getCurrentPlayerTeams: GetCurrentPlayerTeams;
  activatePlayerTeam: ActivatePlayerTeam;
  setPlayerTeamSlot: SetPlayerTeamSlot;
  removePlayerTeamSlot: RemovePlayerTeamSlot;
  clearPlayerTeam: ClearPlayerTeam;
}>;

const teamParamsSchema = z.object({ teamId: z.uuid() }).strict();
const slotParamsSchema = z.object({ teamId: z.uuid(), position: z.coerce.number().int() }).strict();
const characterSchema = z.object({ characterId: z.uuid() }).strict();

export async function registerTeamRoutes(app: FastifyInstance, options: Options): Promise<void> {
  app.get('/api/v1/me/teams', { preHandler: options.authenticate }, (request) =>
    options.getCurrentPlayerTeams.execute(requireAuthenticatedIdentity(request)));

  app.patch('/api/v1/me/teams/:teamId/active', { preHandler: options.authenticate }, async (request) => {
    const params = teamParamsSchema.safeParse(request.params);
    if (!params.success) throw validationError();
    return options.activatePlayerTeam.execute(requireAuthenticatedIdentity(request), params.data.teamId);
  });

  app.put('/api/v1/me/teams/:teamId/slots/:position', { preHandler: options.authenticate }, async (request) => {
    const params = slotParamsSchema.safeParse(request.params);
    const body = characterSchema.safeParse(request.body);
    if (!params.success || !body.success) throw validationError();
    return options.setPlayerTeamSlot.execute(
      requireAuthenticatedIdentity(request), params.data.teamId, params.data.position, body.data.characterId,
    );
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
