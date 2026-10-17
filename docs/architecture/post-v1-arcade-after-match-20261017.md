# Arcade post-V1 — revanche et retour au solo / R1107

Mandat propriétaire consolidé du17/10/2026, lotG et erratum. Cette règle remplace le sens de Rejouer après PvP de R1030 ; les invitations ordinaires et le solo restent sous leurs propriétaires existants. L’état livré, les SHA et les gates sont exclusivement au Master.

## Résultat et actions

Une fin naturelle FINISHED MULTIPLAYER crée une fenêtre WAITING attachée exactement à la session terminée, aux deux Players, au jeu et à la difficulté. Une session ABANDONED ou historique sans fenêtre ne l’ouvre pas. Résultat, scores, statistiques, Records et timestamps du match restent conservés. Aucun XP/grant/quota/bonus/Mission économique PvP ajouté.

Le plateau final et l’adversaire restent affichés ; jeux, difficulté, sélection, filtre, Prêt et Refuser sont verrouillés. Rejouer et Jouer solo figurent sous les contrôles multijoueur, sans doublon sous le plateau. Un consentement désactive seulement son Rejouer et affiche l’attente ; Jouer solo reste utilisable. Deux consentements créent une nouvelle session PvP fraîche avec les mêmes participants/jeu/difficulté, premier côté tiré normalement, aucun résultat copié. Aucun nouvel accord ne devient une invitation ordinaire ni ne produit de notification.

Jouer solo ferme atomiquement l’attente pour les deux et crée seulement le solo du demandeur, même jeu/difficulté, avec IA et règles XP normales. L’autre client revient à l’état initial au prochain heartbeat ; il peut ensuite commencer son propre solo ou une nouvelle invitation. Une course Solo/Rejouer ne laisse jamais deux sessions ACTIVE pour un Player ; si la revanche a déjà gagné la course, Solo reçoit un conflit. Les deux choix solo indépendants restent possibles après annulation, sous réserve que la source soit encore le dernier match du jeu et qu’aucune autre partie/invitation n’occupe le demandeur. Le START ancien conserve son contrat et ferme aussi la fenêtre sous les mêmes verrous, pour compatibilité.

## Présence spécifique et expiration

Le serveur donne cinq secondes initiales après la fin, puis conserve une couverture séparée par Player/onglet. Un seul onglet encore présent suffit. Le contexte ne réutilise pas la présence générale du jeu ; il ne se prolonge pas par une lecture de notification ou de liste. TabKey UUID transmis, empreinte SHA256(Player:tab) stockée, séquence strictement croissante par onglet : un paquet retardé ne peut pas réactiver un contexte masqué. Maximum16contextes par Player/32parmatch, tombstones de séquences conservées pendant la fenêtre sans éviction silencieuse.

Heartbeat authentifié léger toutes les2s, sérialisé, uniquement sur Arcade monté/document visible en WAITING. Masquage, pagehide et démontage envoient une absence keepalive puis arrêtent la cadence ; retour visible/pageshow reprend. Déconnexion ou paquet perdu : expiration cinq secondes après la dernière présence serveur confirmée. Un retour avant l’expiration reste valide ; au-delà de cinq secondes la fenêtre des deux est fermée. Échéance exacte encore valide, première milliseconde suivante expirée. Pas de cron rapide/globalpoll/Realtime/infrastructure ajoutée.

L’échéance du couple est le minimum des couvertures maximales de chaque Player. Toute mutation revalide temps, activité, blocages et occupation sous verrous Player triés. Une lecture GET projette CANCELLED si expiré, même sans nettoyage préalable ; une présence/action persiste la fermeture. Aucune reconnexion ni vieux consentement ne ressuscite une fenêtre terminale. CANCELLED/STARTED ont une révision terminale ; le client refuse une ancienne révision et les réponses d’un ancien écran/Player.

## API et transaction

POST /api/v1/arcade/sessions/:sessionId/after-match/presence : corps strict {tabKey,sequence,visible}, no-store, contrôle de participation et profil actif, transaction Serializable courte/retry borné, aucun receipt ni effet métier. Réponse {sessionId,afterMatch,nextSession?} ne divulgue aucun bail, tab/hash, état privé ni RNG ; nextSession n’apparaît que si cette revanche a démarré et reste accessible au participant.

POST mêmepréfixe /actions : {kind:REPLAY|SOLO,tabKey,sequence,idempotencyKey}, aucun jeu/difficulté/cible/score client accepté. Réutilise arcadeTransaction, preuves et fingerprints durables. Même clé/intent rejoue exactement le reçu ; conflit si intent différent. Le client réessaie l’ambiguïté avec la même clé et effectue ensuite une relecture autoritative. Une nouvelle clé sur une revanche déjà créée retrouve cette même session, sans seconde création. Les verrous couvrent les deux joueurs et les courses avec START/Ready/invitation/QUIT ; factories, barèmes et finalisation existants conservés.

## Persistance et qualification

Migration additive088 : ArcadeSession.afterMatch JSONB privé et afterMatchExpiresAt TIMESTAMPTZ nullable, CHECK FINISHED MULTIPLAYER/statuts/échéance, indexes partiels hôte/invité. Aucun nouveau service/table/FK ni ancienne donnée convertie. Les sessions antérieures ont NULL, donc aucun ancien résultat n’ouvre une fenêtre. Inventaire d’effacement JSON mis à jour ; clés opaques et IDs de participants restent internes, aucune identité personnelle additionnelle.

Tests PostgreSQL privés : trois jeux × trois difficultés, un/deux accords, doubles clics/mêmes clés, concurrence Solo/Rejouer, solo de chaque côté, expiration/reconnexion/onglets multiples/séquences retardées, blocages/inactivité/outsider/abandon, compatibilité invitations/solo/XP. Tests UI : bloc contrôles, attente, cadence conditionnelle sérialisée, masquage/retour/pagehide et retour initial. GameShell CSS production aux1920×1080,1366×768,390×844,390×600 ; scroll Arcade existant petitdesktop/mobile conservé, aucun nouveau scroll externe desktop. [Preuves](evidence/post-v1-arcade-after-match.json). Aucune partie ni récompense QA sur compte public ; recette humaine distincte.

## R1108 — filtre des amis

La sélection reste locale et conservée pendant la requête du nouveau filtre. Seule une réponse autoritaire du filtre courant peut retirer un adversaire absent/inéligible. Les réponses périmées sont rejetées par génération/séquence/filtre ; Prêt reste indisponible pendant revalidation ou erreur, sans invitation invalide. Aucun changement de session, droits, transaction ou après-match.
