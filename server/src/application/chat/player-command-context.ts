import type { SourceChannel } from '../../../generated/prisma/client.js';
import type { GlobalChatService } from './global-chat-service.js';

/** The resolver needs command persistence, never the standalone message transport. */
export type PlayerCommandContext = Pick<GlobalChatService,
  'rememberCommandText' | 'rememberCommandQuantity' | 'rememberCommandRefreshScopes' | 'hasConfirmedCommandMutation'>
  & { readonly sourceChannel?: Extract<SourceChannel, 'INTERNAL_CHAT' | 'TWITCH'> };
