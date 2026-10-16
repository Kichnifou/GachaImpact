import type { Prisma } from '../../../generated/prisma/client.js';
import { expandDetail } from '../retention/lossless-detail-storage.js';
import { decodeIntentReads } from '../twitch/twitch-intent-storage.js';

export type ErasureContext = { playerId: string; externalIds: ReadonlySet<string>; names: ReadonlySet<string>; legacyNames?:ReadonlySet<string>; proofs?:ReadonlySet<string>; authoredMessageIds: ReadonlySet<string> };
const identityKey = /(?:display.?name|presentation.?name|player.?name|author.?name|actor.?name|sender.?name|recipient.?name|winner.?name|organizer.?name|participant.?name|owner.?name|login|username|email|legacy.?key|twitch.?user.?ids?|provider.?subject|auth.?subject)/i;
const externalIdentityKey=/^(?:sender_?id|chatter_?id|recipient_?id|twitch_?user_?ids?|provider_?subject|auth_?subject)$/i;
const contentKey = /^(?:content|text|message|command|rawInput|rawMessage|input|resultPresentation|messageText|responseText)$/i;
const actorKey = /^(?:(?:author|sender|actor)_?(?:player_?)?id|player_?id)$/i;
const legacyIdentityKey=/^(?:highestHitPlayer|finalBlowBy|openedByLegacy|closedByLegacy|previousWinnerLegacy|winner|previousWinner|openedBy|closedBy|lastParticipant|sender|legacyUsername)$/i;

/** Decode every supported envelope before inspection, including nested frozen Twitch reads.
 * Keep peer economic numbers/structures; redact authored free text independently of names.
 */
export function scrubAccountDetail(value: Prisma.JsonValue | null, context: ErasureContext, own = false, property = '',legacyKind=''): Prisma.JsonValue | null {
  const legacyNames=context.legacyNames??context.names;
  if (value === null) return null;
  if (Array.isArray(value)) return value.filter(item=>!(typeof item==='string'&&(/hash|fingerprint|factId/i.test(property)&&context.proofs?.has(item)
    ||property==='participants'&&legacyNames.has(item.toLowerCase()))))
    .map(item => scrubAccountDetail(item, context, own, property,legacyKind));
  if (typeof value === 'object') {
    if ('retentionEncoding' in value) return scrubAccountDetail(expandDetail(value), context, own,property,legacyKind);
    if (value.encoding === 'brotli-base64') return scrubAccountDetail(decodeIntentReads(value) as Prisma.JsonValue, context, own,property,legacyKind);
    if(typeof value.kind==='string'&&['BOSS_HISTORY','GIVEAWAY_HISTORY','EVENT_MESSAGES'].includes(value.kind))legacyKind=value.kind;
    const owners = Object.entries(value).filter(([key, item]) => typeof item === 'string'
      && (actorKey.test(key) || key === 'id' && ('displayName' in value || 'presentationName' in value)));
    const legacySenders=Object.entries(value).filter(([key,item])=>key==='sender'&&typeof item==='string'&&('text' in value||'message' in value));
    const target = owners.length ? owners.some(([, item]) => item === context.playerId) : legacySenders.length
      ?legacySenders.some(([,item])=>typeof item==='string'&&legacyNames.has(item.toLowerCase())):own
      || Object.entries(value).some(([key, item]) => typeof item === 'string' && /^(id|messageId|message_id)$/i.test(key) && context.authoredMessageIds.has(item));
    const result: Record<string, Prisma.JsonValue | null> = {};
    for (const [key, item] of Object.entries(value)) {
      if((['participants','messageCounts'].includes(property)||property==='source'&&legacyKind==='EVENT_MESSAGES')&&legacyNames.has(key.toLowerCase()))continue;
      if(typeof item==='string'&&legacyIdentityKey.test(key)&&legacyNames.has(item.toLowerCase())){result[key]='Compte supprimé';continue;}
      if(typeof item==='string'&&externalIdentityKey.test(key)&&context.externalIds.has(item)){result[key]=null;continue;}
      if (/replyPreview/i.test(key) && Object.entries(value).some(([name,id])=>/replyToMessageId|reply_to_message_id/i.test(name)
        && typeof id==='string' && context.authoredMessageIds.has(id))) { result[key]=null;continue; }
      if (target && contentKey.test(key)) { result[key] = null; continue; }
      if(!target&&(owners.length||legacySenders.length)&&contentKey.test(key)&&typeof item==='string'){result[key]=item;continue;}
      if (key === 'name' && owners.length && target) { result[key]='Compte supprimé';continue; }
      // An explicitly identified peer can share the deleted player's display name.
      // Its identity must not be rewritten merely because the aliases collide.
      if (typeof item === 'string' && identityKey.test(key) && (context.externalIds.has(item)
        || (!owners.length || target || /recipient/i.test(key)) && context.names.has(item.toLowerCase()))) {
        result[key] = identityKey.test(key) ? 'Compte supprimé' : null; continue;
      }
      if (target && typeof item==='string' && identityKey.test(key)) { result[key] = 'Compte supprimé'; continue; }
      result[key] = typeof item==='string' && identityKey.test(key) && owners.length && !target && !/recipient/i.test(key)
        ? item : scrubAccountDetail(item ?? null, context, target, key,legacyKind);
    }
    return result;
  }
  if (typeof value==='string') {
    if(/hash|fingerprint|factId/i.test(property)&&context.proofs?.has(value))return null;
    if(externalIdentityKey.test(property)&&context.externalIds.has(value))return null;
    // Free-text renderings may contain identity aliases; numerical/economic fields never use this path.
    if (/text|message|content|description|body|title|parts|lines|preview/i.test(property)) {
      let text=value;
      for(const alias of [...context.names,...context.externalIds]) {
        if(alias.length<2)continue;
        const escaped=alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        text=text.replace(new RegExp(`(?<![\\p{L}\\p{N}_])@?${escaped}(?![\\p{L}\\p{N}_])`,'giu'),'Compte supprimé');
      }
      return text;
    }
    if(identityKey.test(property)&&(context.externalIds.has(value)||context.names.has(value.toLowerCase())))return 'Compte supprimé';
  }
  return value;
}
