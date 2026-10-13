import { isStructuredChatResult } from '../../server/src/domain/chat/structured-result'
import CharacterPortraitFrame from './CharacterPortraitFrame'

export default function ChatResult({ value }: { value: unknown }) {
  if (!isStructuredChatResult(value)) return null
  return <section className={`chat-result chat-result-${value.command}`} aria-label={`Résultat de !${value.command} : ${value.title}`}>
    {!value.compact && <strong className="chat-result-title">{value.title}</strong>}
    {!!value.characters.length && <ul className="chat-result-characters">{value.characters.map((character, index) => <li className={`chat-result-character rarity-${character.rarity ?? 0}`} key={`${character.id}:${index}`}>
      <span className="chat-result-portrait"><CharacterPortraitFrame characterName={character.name} element={character.elementKey ?? ''} assetPaths={[character.portrait]} order={['iconPath']} frameClassName="chat-result-frame" imageClassName="chat-result-image" badgeClassName={character.elementKey ? 'chat-result-element' : undefined} /></span>
      {character.isNew && <mark>Nouveau</mark>}
      <strong>{character.name}</strong>
      {character.rarity && <span className="chat-result-rarity" aria-label={`${character.rarity} étoiles`}>{'★'.repeat(character.rarity)}</span>}
      {character.voteCount !== undefined && <small>{character.voteCount.toLocaleString('fr-FR')} vote{character.voteCount > 1 ? 's' : ''}</small>}
      {character.constellation !== null && <span>{character.previousConstellation != null ? `C${character.previousConstellation} → ` : ''}C{character.constellation}</span>}
      {character.label && <small>{character.label}</small>}
      {character.pity !== undefined && <small>Pity : {character.pity}</small>}
    </li>)}</ul>}
    {!!value.facts.length && <ul className="chat-result-facts">{value.facts.map((fact, index) => <li key={index}>{fact}</li>)}</ul>}
  </section>
}
