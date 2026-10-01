export const arcadeBanter = {
  START: ['À vous de jouer. Je règle mes constellations.', 'Prêt. Mes calculs sont presque au point.'],
  PAIR: ['Une paire ! Mes notes servent enfin.', 'Deux étoiles qui vont ensemble.'],
  MISS: ['Ce coup était… presque prévu.', 'Je classe cela dans les découvertes.'],
  PLAYER_PAIR: ['Belle paire. Je prends des notes.', 'Bien vu. Je vais devoir suivre.'],
  MOVE: ['Ce pion était une décision artistique.', 'Je réfléchis à la prochaine étoile.'],
  CLOSE: ['La constellation se resserre.', 'Nous ne sommes pas loin du dénouement.'],
  THREAT: ['Une ligne se dessine. Je reste attentif.', 'Voilà un coup qui mérite réflexion.'],
  WIN: ['Bien joué. Cette manche est à vous.', 'Une belle victoire. On rejoue ?'],
  LOSS: ['Cette fois, mes calculs ont tenu.', 'Merci pour cette partie. À la suivante ?'],
  DRAW: ['Équilibre parfait. Ou presque.', 'Nous partageons cette constellation.'],
} as const;
export type BanterEvent = keyof typeof arcadeBanter;
/** Decoration depends only on public counters, never on the gameplay random source. */
export function banterId(event: BanterEvent, turn: number, previous?: string): string {
  let index = turn % arcadeBanter[event].length;
  if (`${event}:${index}` === previous) index = (index + 1) % arcadeBanter[event].length;
  return `${event}:${index}`;
}
export function banterText(id: string): string { const [event, index] = id.split(':'); return arcadeBanter[event as BanterEvent]?.[Number(index)] ?? ''; }
