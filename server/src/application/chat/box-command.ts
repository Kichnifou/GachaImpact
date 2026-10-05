import type { PlayerExecutionActor } from '../player/player-execution-actor.js';
import { isElementKey } from '../../domain/economy/resources.js';
import type { BoxCharacter, BoxSortKey, BoxSortPreference } from '../box/box-store.js';
import { normalizePlayerSearch } from '../social/social-service.js';
import type { ChatCommandServices } from './chat-command-dispatcher.js';
import type { PlayerCommandContext } from './player-command-context.js';
import { chatElementEmojis, chatElementNames, logicalChatParts } from './chat-list-result.js';

const sortKeys: Readonly<Record<string, BoxSortKey>> = { a: 'alphabetical', d: 'obtainedAt', c: 'constellation', e: 'element' };
const sortLabels: Readonly<Record<BoxSortKey, string>> = { alphabetical: 'alphabétique', obtainedAt: 'date d’obtention', constellation: 'constellation', element: 'élément' };
const compareName = (a: BoxCharacter, b: BoxCharacter) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }) || a.id.localeCompare(b.id);
const characterText = (character: BoxCharacter) => `${chatElementEmojis[character.elementKey]} ${character.name} (C${character.constellation})`;
function sorted(characters: readonly BoxCharacter[], preference: BoxSortPreference) {
  return [...characters].sort((a, b) => {
    const key = preference.sortKey;
    const delta = key === 'obtainedAt' ? a.firstObtainedAt.getTime() - b.firstObtainedAt.getTime()
      : key === 'constellation' ? a.constellation - b.constellation
      : key === 'element' ? a.elementKey.localeCompare(b.elementKey, 'fr') : 0;
    return (delta || compareName(a, b)) * (preference.direction === 'desc' ? -1 : 1);
  });
}
function grouped(characters: readonly BoxCharacter[]) {
  return ([5, 4] as const).flatMap(rarity => {
    const group = characters.filter(c => c.rarity === rarity), stars = '⭐'.repeat(rarity);
    return group.length ? group.map((c, index) => ({ text: `${index === 0 ? stars + ' ' : ''}${characterText(c)}`, separator: index === 0 ? ' | ' : ', ' }))
      : [{ text: `${stars} aucun`, separator: ' | ' }];
  });
}

export async function boxCommand(identity: PlayerExecutionActor, args: readonly string[], commandId: string,
  services: ChatCommandServices, chat: PlayerCommandContext, syntax: string): Promise<string | readonly string[]> {
  const option = normalizePlayerSearch(args[0] ?? '');
  if (args.length > 1 && option !== 'favoris') return syntax;
  if (option && !Object.hasOwn(sortKeys, option) && !['5', '4', '6', 'favoris'].includes(option) && !isElementKey(option) && !/^p[1-9]\d*$/u.test(option)) return syntax;
  const page = /^p\d/u.test(option) ? Number(option.slice(1)) : null;
  if (page !== null && !Number.isSafeInteger(page)) return syntax;
  const [actor, box] = await Promise.all([services.socialService.actor(identity), services.getCurrentPlayerBox.execute(identity)]);
  const name = actor.displayName;
  if (Object.hasOwn(sortKeys, option)) {
    const sortKey = sortKeys[option]!;
    const direction = sortKey === box.preference.sortKey && box.preference.direction === 'asc' ? 'desc' : 'asc';
    const intent = await chat.rememberCommandText(commandId, 'action', `${sortKey}:${direction}`);
    const [rememberedKey, rememberedDirection] = intent.split(':') as [BoxSortKey, 'asc' | 'desc'];
    const saved = await services.setBoxSortPreference.execute(identity, { sortKey: rememberedKey, direction: rememberedDirection });
    await chat.rememberCommandRefreshScopes(commandId, ['box']);
    return `✅ ${name}, tri de Box enregistré : ${sortLabels[saved.sortKey]} (${saved.direction === 'asc' ? 'ascendant' : 'descendant'}).`;
  }
  if (option === 'favoris' && args.length > 1) {
    const query = normalizePlayerSearch(args.slice(1).join(' '));
    const character = box.characters.find(c => normalizePlayerSearch(c.name) === query);
    const id = await chat.rememberCommandText(commandId, 'targetId', character?.id ?? '');
    if (!id || !character) return `⚠️ ${name}, personnage introuvable dans ta Box.`;
    const favorite = await chat.rememberCommandText(commandId, 'action', character.favorite ? 'remove' : 'add');
    const saved = await services.setBoxCharacterFavorite.execute(identity, id, favorite === 'add');
    await chat.rememberCommandRefreshScopes(commandId, ['box']);
    return `✅ ${name}, ${saved.name} ${favorite === 'add' ? 'ajouté aux' : 'retiré des'} favoris.`;
  }
  if (option === 'favoris') {
    const favorites = box.characters.filter(c => c.favorite).sort(compareName);
    return favorites.length ? logicalChatParts(`⭐ Favoris de ${name} :`, favorites.map(c => ({ text: characterText(c), separator: ', ' })), '⭐ Favoris suite :')
      : `⚠️ ${name}, tu n’as aucun favori. Utilise : !box favoris NomPerso`;
  }
  const preference = box.preference;
  const label = `[${sortLabels[preference.sortKey]} ${preference.direction === 'desc' ? '↓' : '↑'}]`;
  const characters = sorted(box.characters, preference);
  if (page !== null) {
    if (page > Math.ceil(characters.length / 10)) return `⚠️ ${name}, cette page est vide.`;
    const five = characters.filter(c => c.rarity === 5), four = characters.filter(c => c.rarity === 4);
    let fiveIndex = 0, fourIndex = 0, entries: BoxCharacter[] = [];
    for (let index = 1; index <= page; index++) {
      entries = [...five.slice(fiveIndex, fiveIndex + 5), ...four.slice(fourIndex, fourIndex + 5)];
      fiveIndex += Math.min(5, five.length - fiveIndex); fourIndex += Math.min(5, four.length - fourIndex);
      while (entries.length < 10 && fiveIndex < five.length) entries.push(five[fiveIndex++]!);
      while (entries.length < 10 && fourIndex < four.length) entries.push(four[fourIndex++]!);
    }
    return logicalChatParts(`✅ ${name}, Box p${page} ${label} :`, entries.map(c => ({ text: characterText(c), separator: ', ' })), '✅ Box suite :');
  }
  if (option === '5' || option === '4') {
    const entries = characters.filter(c => c.rarity === Number(option));
    return entries.length ? logicalChatParts(`✅ ${name}, Box ${'⭐'.repeat(Number(option))} :`, entries.map(c => ({ text: characterText(c), separator: ', ' })), '✅ Box suite :')
      : `⚠️ ${name}, tu n’as aucun personnage ${option}★.`;
  }
  const filtered = option === '6' ? characters.filter(c => c.constellation === 6) : isElementKey(option) ? characters.filter(c => c.elementKey === option) : characters;
  if (!filtered.length) return option === '6' ? `⚠️ ${name}, tu n’as aucun personnage C6.` : isElementKey(option) ? `⚠️ ${name}, tu n’as aucun personnage ${chatElementNames[option]}.` : `⚠️ ${name}, ta Box est vide pour le moment.`;
  const header = option === '6' ? `Box C6` : isElementKey(option) ? `Box ${chatElementEmojis[option]} ${chatElementNames[option]}` : 'ta Box';
  return logicalChatParts(`✅ ${name}, ${header} ${label} :`, grouped(filtered), '✅ Box suite :');
}
