import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import { AppError } from '../../api/errors.js';
import { splitGameResult, type GlobalChatService, type ChatMentionInput } from './global-chat-service.js';
import { PlayerCommandResolver, type ChatCommandServices } from './player-command-resolver.js';
import { appendCommandFeedback } from './command-mission-feedback.js';
import { graphicalCommands, isStructuredChatResult, type StructuredChatResult } from '../../domain/chat/structured-result.js';
import { parseChatCommand } from './chat-command-registry.js';
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
    const graphical = graphicalCommands.some(name => name === parseChatCommand(sent.message.content!).definition?.handler);
    const frozen = graphical ? await this.chat.readCommandResult(sent.message.id) : null;
    if (frozen) {
      const published = frozen.presentation ? await this.chat.publishGameResult(sent.message.id, frozen.content, frozen.presentation) : await this.chat.publishGameResult(sent.message.id, frozen.content);
      return { ...sent, refreshScopes: await this.chat.commandRefreshScopes(sent.message.id), result: published.message, results: published.messages };
    }
    let presentation: StructuredChatResult | null = null;
    const response = await new PlayerCommandResolver(this.chat, this.services, 'INTERNAL_CHAT', (value, operationId) => {
      const candidate = { ...value, version: 1 as const, source: { channel: 'INTERNAL_CHAT' as const, commandMessageId: sent.message.id, ...(operationId ? { operationId } : {}) } };
      if (isStructuredChatResult(candidate)) presentation = candidate;
    }).resolve(identity, sent.message.content!, sent.message.id);
    const missions = await this.chat.commandMissionCompletions(sent.message.id);
    // Legacy free text keeps its established splitting before feedback becomes bounded parts.
    const parts = appendCommandFeedback(typeof response === 'string' ? splitGameResult(oneLine(response)) : response.map(oneLine), missions.map(oneLine), 500);
    const resultContent = typeof response === 'string' && parts.length === 1 ? parts[0]! : parts;
    const snapshot = graphical ? await this.chat.freezeCommandResult(sent.message.id, { content: resultContent, presentation }) : { content: resultContent, presentation: null };
    const published = snapshot.presentation ? await this.chat.publishGameResult(sent.message.id, snapshot.content, snapshot.presentation) : await this.chat.publishGameResult(sent.message.id, snapshot.content);
    return { ...sent, refreshScopes: await this.chat.commandRefreshScopes(sent.message.id), result: published.message, results: published.messages };
  }

  async clear(identity: AuthenticatedIdentity, content: string, idempotencyKey: string, replyToMessageId?: string | null) {
    if (replyToMessageId) throw new AppError('La commande !clear ne répond pas à un message.', 400, 'CHAT_INVALID');
    return this.chat.clear(identity, content, idempotencyKey);
  }

}
