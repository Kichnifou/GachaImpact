import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import { AppError } from '../../api/errors.js';
import { splitGameResult, type GlobalChatService, type ChatMentionInput } from './global-chat-service.js';
import { PlayerCommandResolver, type ChatCommandServices } from './player-command-resolver.js';
import { appendCommandFeedback } from './command-mission-feedback.js';
import { graphicalCommands, isStructuredChatResult, type StructuredChatResult } from '../../domain/chat/structured-result.js';
import { parseChatCommand } from './chat-command-registry.js';
import { chatLength } from './chat-list-result.js';
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
      if (!isStructuredChatResult(candidate)) return false;
      presentation = candidate;
      return true;
    }).resolve(identity, sent.message.content!, sent.message.id);
    const missions = await this.chat.commandMissionCompletions(sent.message.id);
    // Legacy free text keeps its established splitting before feedback becomes bounded parts.
    const parts = appendCommandFeedback(typeof response === 'string' ? splitGameResult(oneLine(response)) : response.map(oneLine), missions.map(oneLine), 500);
    // A consolidated Pull has exactly one durable GAME_RESULT. Overflow feedback
    // is preserved in bounded structured facts, never published as extra pulls.
    let resultContent: string | readonly string[] = typeof response === 'string' && parts.length === 1 ? parts[0]! : parts;
    const rendered = presentation as StructuredChatResult | null;
    if (rendered?.command === 'pull' && rendered.compact && typeof response === 'string') {
      if (parts.length === 1) resultContent = parts[0]!;
      else {
        const feedback = missions.flatMap(message => {
          const points = Array.from(oneLine(message));
          return Array.from({ length: Math.ceil(points.length / 300) }, (_, i) => points.slice(i * 300, (i + 1) * 300).join(''));
        });
        const complete = { ...rendered, facts: [...rendered.facts, ...feedback] };
        if (chatLength(response) > 500 || !isStructuredChatResult(complete)) throw new AppError('Résultat d’invocation trop volumineux.', 500, 'CHAT_RESULT_INVALID');
        presentation = complete;
        resultContent = response;
      }
    }
    const snapshot = graphical ? await this.chat.freezeCommandResult(sent.message.id, { content: resultContent, presentation }) : { content: resultContent, presentation: null };
    const published = snapshot.presentation ? await this.chat.publishGameResult(sent.message.id, snapshot.content, snapshot.presentation) : await this.chat.publishGameResult(sent.message.id, snapshot.content);
    return { ...sent, refreshScopes: await this.chat.commandRefreshScopes(sent.message.id), result: published.message, results: published.messages };
  }

  async clear(identity: AuthenticatedIdentity, content: string, idempotencyKey: string, replyToMessageId?: string | null) {
    if (replyToMessageId) throw new AppError('La commande !clear ne répond pas à un message.', 400, 'CHAT_INVALID');
    return this.chat.clear(identity, content, idempotencyKey);
  }

}
