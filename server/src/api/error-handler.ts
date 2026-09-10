import type { FastifyError, FastifyInstance } from 'fastify';

import { BusinessError, type BusinessErrorCode } from '../application/errors.js';
import { AppError } from './errors.js';

const businessStatusCodes: Readonly<Record<BusinessErrorCode, number>> = {
  ELEMENT_ALREADY_CHOSEN: 409,
  ELEMENT_NOT_AVAILABLE: 422,
  ONBOARDING_DISPLAY_NAME_REQUIRED: 422,
  PLAYER_ELEMENT_REQUIRED: 409,
  PLAYER_NOT_FOUND: 404,
  PLAYER_PROGRESSION_STATE_MISSING: 500,
  RESOURCE_STATE_INCOMPLETE: 500,
  GACHA_BANNER_UNAVAILABLE: 503,
  GACHA_BANNER_INVALID: 409,
  GACHA_TARGET_REQUIRED: 409,
  GACHA_TARGET_INVALID: 422,
  GACHA_PULL_COUNT_INVALID: 422,
  GACHA_IDEMPOTENCY_CONFLICT: 409,
  GACHA_HISTORY_PAGE_INVALID: 400,
  BOX_CHARACTER_NOT_OWNED: 404,
  STELLA_UNAVAILABLE: 409,
  STELLA_CHARACTER_INACTIVE: 422,
  STELLA_CHARACTER_RARITY_INVALID: 422,
  STELLA_C6_MAXED: 409,
  STELLA_IDEMPOTENCY_CONFLICT: 409,
  TEAM_NOT_FOUND: 404,
  TEAM_NAME_INVALID: 422,
  TEAM_CREATE_POSITION_INVALID: 409,
  TEAM_DELETE_PROTECTED: 409,
  TEAM_DELETE_ACTIVE: 409,
  TEAM_ORDER_INVALID: 422,
  TEAM_SLOT_ORDER_INVALID: 422,
  TEAM_SLOT_INVALID: 422,
  TEAM_CHARACTER_NOT_AVAILABLE: 422,
  TEAM_CHARACTER_DUPLICATE: 409,
  TEAM_COMPOSITION_DUPLICATE: 409,
  BANK_AMOUNT_INVALID: 422,
  BANK_WALLET_INSUFFICIENT: 409,
  BANK_BALANCE_INSUFFICIENT: 409,
  BANK_IDEMPOTENCY_CONFLICT: 409,
  BANK_HISTORY_PAGE_INVALID: 400,
  MODERATION_FORBIDDEN: 403,
  MODERATION_INVALID_AMOUNT: 422,
  MODERATION_INSUFFICIENT_RESOURCE: 409,
  MODERATION_INVALID_XP: 422,
  MODERATION_INVALID_PITY: 422,
  MODERATION_INVALID_CAPTURE: 422,
  MODERATION_IDEMPOTENCY_CONFLICT: 409,
  INSUFFICIENT_PRIMOGEMS: 409,
};

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const appError = error instanceof AppError ? error : undefined;
    const businessError = error instanceof BusinessError ? error : undefined;
    const statusCode = businessError
      ? businessStatusCodes[businessError.code]
      : (appError?.statusCode ?? 500);
    const code = businessError?.code ?? appError?.code ?? 'INTERNAL_ERROR';
    const message = businessError || appError ? error.message : 'An unexpected server error occurred.';

    request.log.error({ err: error, code }, 'Request failed');

    return reply.status(statusCode).send({
      error: {
        code,
        message,
        requestId: request.id,
      },
    });
  });
}
