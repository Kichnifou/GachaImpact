import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import type { TutorialPreferencesService } from '../../application/tutorial/tutorial-preferences.js'
import { requireAuthenticatedIdentity } from '../auth/authentication.js'
import { currentTutorialPreference, legacyTutorialPreference } from '../../application/tutorial/tutorial-preferences.js'
import { AppError } from '../errors.js'

export async function registerTutorialRoutes(app: FastifyInstance, options: Readonly<{ authenticate: preHandlerHookHandler; service: TutorialPreferencesService }>) {
  const catalog = (query: unknown) => query && typeof query === 'object' && 'catalog' in query && (query.catalog === 'r1093' || query.catalog === 'r1094') ? query.catalog : null
  const project = (value: Parameters<typeof legacyTutorialPreference>[0], query: unknown) => catalog(query) === 'r1094' ? currentTutorialPreference(value) : catalog(query) === 'r1093' ? value : legacyTutorialPreference(value)
  app.post('/api/v1/me/tutorial/autostart', { preHandler: options.authenticate }, async request => {
    if (request.body !== undefined && request.body !== null && (typeof request.body !== 'object' || Array.isArray(request.body) || Object.keys(request.body).length)) throw new AppError('Le lancement automatique ne reçoit aucun paramètre.', 400, 'VALIDATION_ERROR')
    const result = await options.service.claimAutostart(requireAuthenticatedIdentity(request))
    const projected = result.shouldLaunch ? { ...result, preference: project(result.preference, request.query) } : result
    return catalog(request.query) ? { ...projected, catalog: catalog(request.query) } : projected
  })
  app.get('/api/v1/me/tutorial', { preHandler: options.authenticate }, async request => {
    const preference = await options.service.get(requireAuthenticatedIdentity(request))
    return catalog(request.query) ? { catalog: catalog(request.query), preference: project(preference, request.query) } : project(preference, request.query)
  })
  app.put('/api/v1/me/tutorial', { preHandler: options.authenticate }, async request => {
    const preference = await options.service.put(requireAuthenticatedIdentity(request), request.body)
    return project(preference, request.query)
  })
}
