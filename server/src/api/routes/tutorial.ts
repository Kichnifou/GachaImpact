import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import type { TutorialPreferencesService } from '../../application/tutorial/tutorial-preferences.js'
import { requireAuthenticatedIdentity } from '../auth/authentication.js'

export async function registerTutorialRoutes(app: FastifyInstance, options: Readonly<{ authenticate: preHandlerHookHandler; service: TutorialPreferencesService }>) {
  app.get('/api/v1/me/tutorial', { preHandler: options.authenticate }, request => options.service.get(requireAuthenticatedIdentity(request)))
  app.put('/api/v1/me/tutorial', { preHandler: options.authenticate }, request => options.service.put(requireAuthenticatedIdentity(request), request.body))
}
