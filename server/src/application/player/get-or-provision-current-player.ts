import { z } from 'zod';

import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { CurrentPlayerResult, CurrentPlayerStore } from './current-player-store.js';

const SUPABASE_PROVIDER = 'supabase';
const displayNameSchema = z.string().trim().min(1).max(40);

export class OnboardingDisplayNameRequiredError extends Error {
  public constructor() {
    super('A display name between 1 and 40 characters is required to complete onboarding.');
    this.name = 'OnboardingDisplayNameRequiredError';
  }
}

export class GetOrProvisionCurrentPlayer {
  public constructor(private readonly store: CurrentPlayerStore) {}

  public async execute(
    identity: AuthenticatedIdentity,
    displayName?: string,
  ): Promise<CurrentPlayerResult> {
    const existingPlayer = await this.store.findByIdentity(SUPABASE_PROVIDER, identity.subject);

    if (existingPlayer) {
      return { player: existingPlayer, created: false };
    }

    const parsedDisplayName = displayNameSchema.safeParse(displayName);

    if (!parsedDisplayName.success) {
      throw new OnboardingDisplayNameRequiredError();
    }

    return this.store.provision({
      provider: SUPABASE_PROVIDER,
      providerSubject: identity.subject,
      displayName: parsedDisplayName.data,
    });
  }
}
