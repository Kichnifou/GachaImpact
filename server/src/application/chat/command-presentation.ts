/** Public command text only. Internal exceptions/logs keep their original values. */
export function commandText(text: string, kind?: 'success' | 'warning' | 'info' | 'error') {
  if (/^[\s]*(?:✅|⚠️?|ℹ️?|❌)/u.test(text)) return text;
  if (!kind && /^[\s]*\p{Extended_Pictographic}/u.test(text)) return text;
  const status = kind ?? (/^(?:Syntaxe|Commande (?:inconnue|indisponible)|Cette (?:commande|fonctionnalité)|Joueur introuvable|Demande d’échange introuvable|Nom ambigu|Légende introuvable|Personnage .*introuvable|Candidat .*introuvable|Ce personnage ne fait pas|Cet article .*indisponible|Vous ne possédez pas|Action impossible|Rang Z verrouillé|Les Légendes .*privées|La Faveur .*privée)/u.test(text) ? 'warning' : 'info');
  return `${({success:'✅',warning:'⚠️',info:'ℹ️',error:'❌'})[status]} ${text}`;
}
