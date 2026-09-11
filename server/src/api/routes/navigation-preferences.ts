import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import { navigationMenuDestinationIds, type NavigationPreferencesService } from '../../application/navigation/navigation-preferences.js'
import { requireAuthenticatedIdentity } from '../auth/authentication.js'
import { AppError } from '../errors.js'

const bodySchema = z.object({ version: z.literal(1), order: z.array(z.string()).max(100), hidden: z.array(z.string()).max(100) }).strict()
const knownIds = new Set<string>(navigationMenuDestinationIds)

export async function registerNavigationPreferenceRoutes(app: FastifyInstance, options: Readonly<{ authenticate: preHandlerHookHandler; service: NavigationPreferencesService }>) {
  app.get('/api/v1/me/navigation-preferences', { preHandler: options.authenticate }, (request) => options.service.get(requireAuthenticatedIdentity(request)))
  app.put('/api/v1/me/navigation-preferences', { preHandler: options.authenticate }, async (request) => {
    const parsed = bodySchema.safeParse(request.body)
    if (!parsed.success) throw new AppError('Les préférences de navigation sont invalides.', 400, 'VALIDATION_ERROR')
    return options.service.put(requireAuthenticatedIdentity(request), { version: 1, order: parsed.data.order.filter((id) => knownIds.has(id)), hidden: parsed.data.hidden.filter((id) => knownIds.has(id)) })
  })
}
