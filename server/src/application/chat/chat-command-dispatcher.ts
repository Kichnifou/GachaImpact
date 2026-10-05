import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import { AppError } from '../../api/errors.js';
import type { GlobalChatService, ChatMentionInput } from './global-chat-service.js';
import { PlayerCommandResolver, type ChatCommandServices } from './player-command-resolver.js';
export type { ChatCommandServices } from './player-command-resolver.js';
const oneLine = (value: string) => value.replace(/[\r\n\u2028\u2029]/gu, ' ').trim();

/** Standalone transport: persist the message and publish results. */
export class ChatCommandDispatcher {
  constructor(private readonly chat: GlobalChatService, private readonly services: ChatCommandServices) {}

  async send(identity: AuthenticatedIdentity, content: string, idempotencyKey: string, replyToMessageId?: string | null, mentions: readonly ChatMentionInput[] = []) {
    const sent = await this.chat.send(identity, content, idempotencyKey, replyToMessageId, mentions);
    if (sent.message.messageType !== 'COMMAND') return { ...sent, result: null, results: [] };
    const existing = await this.chat.findGameResult(sent.message.id);
    if (existing) return { ...sent, refreshScopes: await this.chat.commandRefreshScopes(sent.message.id), result: existing, results: await this.chat.findGameResults(sent.message.id) };
    const response = await new PlayerCommandResolver(this.chat, this.services).resolve(identity, sent.message.content!, sent.message.id);
    const missions = await this.chat.commandMissionCompletions(sent.message.id);
    let resultContent: string | string[];
    if (typeof response === 'string') resultContent = oneLine([response, ...missions].join(' '));
    else {
      resultContent = response.map(oneLine);
      for (const mission of missions.map(oneLine)) {
        const last = resultContent.at(-1)!;
        if (Array.from(`${last} ${mission}`).length <= 500) resultContent[resultContent.length - 1] = `${last} ${mission}`;
        else resultContent.push(mission);
      }
    }
    const published = await this.chat.publishGameResult(sent.message.id, resultContent);
    return { ...sent, refreshScopes: await this.chat.commandRefreshScopes(sent.message.id), result: published.message, results: published.messages };
  }

  async clear(identity: AuthenticatedIdentity, content: string, idempotencyKey: string, replyToMessageId?: string | null) {
    if (replyToMessageId) throw new AppError('La commande !clear ne répond pas à un message.', 400, 'CHAT_INVALID');
    return this.chat.clear(identity, content, idempotencyKey);
  }

}
