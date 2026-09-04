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
  | 'RESOURCE_STATE_INCOMPLETE';
