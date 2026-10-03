import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import type { TutorialPreferencesService } from '../../application/tutorial/tutorial-preferences.js'
import { requireAuthenticatedIdentity } from '../auth/authentication.js'
import { AppError } from '../errors.js'

export async function registerTutorialRoutes(app: FastifyInstance, options: Readonly<{ authenticate: preHandlerHookHandler; service: TutorialPreferencesService }>) {
  app.post('/api/v1/me/tutorial/autostart', { preHandler: options.authenticate }, request => {
    if (request.body !== undefined && request.body !== null && (typeof request.body !== 'object' || Array.isArray(request.body) || Object.keys(request.body).length)) throw new AppError('Le lancement automatique ne reçoit aucun paramètre.', 400, 'VALIDATION_ERROR')
    return options.service.claimAutostart(requireAuthenticatedIdentity(request))
  })
  app.get('/api/v1/me/tutorial', { preHandler: options.authenticate }, request => options.service.get(requireAuthenticatedIdentity(request)))
  app.put('/api/v1/me/tutorial', { preHandler: options.authenticate }, request => options.service.put(requireAuthenticatedIdentity(request), request.body))
}
