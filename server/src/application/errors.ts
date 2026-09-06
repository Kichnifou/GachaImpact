export class BusinessError extends Error {
  public constructor(
    public readonly code: BusinessErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BusinessError';
  }
}

export type BusinessErrorCode =
  | 'ELEMENT_ALREADY_CHOSEN'
  | 'ELEMENT_NOT_AVAILABLE'
  | 'ONBOARDING_DISPLAY_NAME_REQUIRED'
  | 'PLAYER_ELEMENT_REQUIRED'
  | 'PLAYER_NOT_FOUND'
  | 'PLAYER_PROGRESSION_STATE_MISSING'
  | 'RESOURCE_STATE_INCOMPLETE'
  | 'GACHA_BANNER_UNAVAILABLE'
  | 'GACHA_BANNER_INVALID'
  | 'GACHA_TARGET_REQUIRED'
  | 'GACHA_TARGET_INVALID'
  | 'GACHA_PULL_COUNT_INVALID'
  | 'GACHA_IDEMPOTENCY_CONFLICT'
  | 'GACHA_HISTORY_PAGE_INVALID'
  | 'INSUFFICIENT_PRIMOGEMS';
