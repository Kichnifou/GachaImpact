import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import type { TutorialPreferencesService } from '../../application/tutorial/tutorial-preferences.js'
import { requireAuthenticatedIdentity } from '../auth/authentication.js'
import { legacyTutorialPreference } from '../../application/tutorial/tutorial-preferences.js'
import { AppError } from '../errors.js'

export async function registerTutorialRoutes(app: FastifyInstance, options: Readonly<{ authenticate: preHandlerHookHandler; service: TutorialPreferencesService }>) {
  const capable = (query: unknown) => Boolean(query && typeof query === 'object' && 'catalog' in query && query.catalog === 'r1093')
  app.post('/api/v1/me/tutorial/autostart', { preHandler: options.authenticate }, async request => {
    if (request.body !== undefined && request.body !== null && (typeof request.body !== 'object' || Array.isArray(request.body) || Object.keys(request.body).length)) throw new AppError('Le lancement automatique ne reçoit aucun paramètre.', 400, 'VALIDATION_ERROR')
    const result = await options.service.claimAutostart(requireAuthenticatedIdentity(request))
    return capable(request.query) ? { ...result, catalog: 'r1093' } : result.shouldLaunch ? { ...result, preference: legacyTutorialPreference(result.preference) } : result
  })
  app.get('/api/v1/me/tutorial', { preHandler: options.authenticate }, async request => {
    const preference = await options.service.get(requireAuthenticatedIdentity(request))
    return capable(request.query) ? { catalog: 'r1093', preference } : legacyTutorialPreference(preference)
  })
  app.put('/api/v1/me/tutorial', { preHandler: options.authenticate }, async request => {
    const preference = await options.service.put(requireAuthenticatedIdentity(request), request.body)
    return capable(request.query) ? preference : legacyTutorialPreference(preference)
  })
}
