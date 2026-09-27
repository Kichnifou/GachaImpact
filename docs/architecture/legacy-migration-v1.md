# Migration legacy V1 — contrat canonique

Statut : **socle candidat `review` ; cutover public non exécuté**. Ce document remplace la [matrice du pilote](twitch-pilot-mapping.md) pour la migration globale. Les règles produit R927–R938 sont validées dans le [journal](../specifications/decisions-log.md) ; les chiffres ci-dessous décrivent seulement la capture figée du 26 septembre 2026. La [procédure opératoire](../process/legacy-cutover-runbook.md) porte les gates et commandes.

## Frontière

Streamer.bot reste autoritatif jusqu'au cutover. Le socle ne lit que la copie locale ignorée par Git, jamais le dossier vivant. Il ne crée pas de route publique d'application, ne lie pas de Player public, ne branche ni chat Twitch ni EventSub et n'envoie rien à Twitch. La migration 049 du pilote reste intacte. Les migrations additives 050–052 rendent le mapping global représentable et sécurisent les nouvelles tables côté backend (RLS, aucun droit navigateur). Elles sont appliquées sur DEV depuis le 27 septembre 2026, avec 52 migrations suivies, zéro batch public et dix Players publics conservés ; le seed de référence ajoute les personnages 119/120, portant le catalogue à 120.

Une source prouve seulement les faits qu'elle contient. Un solde legacy établit un état initial, pas un `ResourceMovement`. Un claim sans date ni opération garde `claimedAt = null`, `operationId = null`, `origin = LEGACY` et une provenance. Aucune `BusinessOperation`, `BossAttack`, `FriendHeart`, `PullOperation`, `BankTransaction` ou récompense n'est fabriquée pour remplir une FK ou faire paraître un historique complet.

## Snapshot et couverture

Capture locale : `20260926T145119069Z`, SHA-256 d'ensemble `1852d7141a121c335c5928a8265c20e840e5c5dd20ccee12b054b99f780806ba`. Le lecteur vérifie le manifest, la taille et le hash des 17 JSON avant analyse. Le scanner inspecte aussi les 168 profils exclus et classe les chemins structuraux à clés dynamiques ; un fichier ou champ nouveau bloque la préparation jusqu'à examen et classement explicite. La capture actuelle compte 31 071 propriétés observées, 0 chemin inconnu, 213 profils, 45 avec élément valide.

| Source | Destination ou disposition |
| --- | --- |
| `viewers_data.json` | 45 profils éligibles, états personnels, claims Codes, Faveur, Combat et préférences équivalentes ; 168 exclus scannés, sans Player créé. |
| `friendships_data.json` | Amitiés, demandes, carry-over directionnel du dernier cœur ; relations avec profils exclus abandonnées selon R933. |
| `c6_characters.json` | Progression Concours certaine ; Box reste autoritaire pour possession/constellation, contradiction en quarantaine. |
| `genshin_characters.json` | Catalogue V1 complété uniquement pour 119/120 depuis la source ; composition de la bannière active et exclusions de la bannière précédente. Les autres métadonnées V1 validées restent autoritaires. |
| `banner_votes.json` | Votes individuels de la semaine courante des seuls Players éligibles ; dates exactes de vote inconnues. |
| `combat_data.json` | Rencontre et ennemis uniquement si la date égale le jour métier du cutover. |
| `monthly_boss.json` | Boss connus, participants, contributions, agrégats, dates connues au niveau réel de précision, coup final et preuves de distribution. |
| `contests_data.json` | Verrous du jour si pertinents ; historique abandonné selon R564. Une session encore active bloque la capture de cutover jusqu'à sa clôture. |
| `monthly_events_data.json` | Édition courante si mois/année égaux au cutover, sinon seuls soldes saisonniers et acquisitions Collection certaines ; `monthlyDraw` sans mécanique. |
| `monthly_events.json` | Vide, `RESIDUAL_NO_MECHANIC`. |
| `gift_codes.json` | Douze définitions annuelles, mois, message et récompenses exactes ; claims personnels proviennent de `usedCodes`. |
| `giveaway.json` | Session fermée, participants, messages, gagnant et état de distribution comme provenance, sans crédit. |
| `long_missions.json`, `missions_pool.json` | Configuration legacy scannée ; définitions et règles Missions V1 validées autoritaires. Progression certaine des viewers migrée. |
| `shop_items.json`, `combat_config.json`, `element_passives.json` | Configuration legacy scannée et comparée ; règles et catalogues V1 validés autoritaires. |

## Identité et comptes

La population est calculée depuis l'élément choisi parmi pyro, hydro, cryo, electro, anemo, geo et dendro ; 45 n'est pas codé comme seuil général. Avant un vrai cutover, un opérateur lance explicitement la résolution Helix avec credentials applicatifs valides, sans scope chat. Le login legacy n'est qu'une clé d'entrée : le Twitch User ID vérifié devient l'identité durable. Un login introuvable, un ID dupliqué, un compte renommé sans ancien ID vérifié ou un conflit avec `TwitchIdentity` existante bloque. Les IDs de répétition numériques sont des fixtures et ne prouvent aucune identité réelle.

Une correspondance TwitchIdentity vérifiée avec un compte web conserve son `Player.id`, son WebIdentity/Auth, son pseudo GachaImpact, ses rôles, ses préférences non gameplay et sa confidentialité. Son gameplay de test est remplacé par le legacy. Les nouveaux profils Twitch-only reçoivent initialement le display name Twitch actuel ; le login legacy est gardé séparément dans `MigrationMapping`. Aucune égalité de `displayName` ne provoque un rattachement. Un compte web sans profil legacy conserve son identité mais perd le gameplay de test et retrouve `elementKey = null`.

## Mapping métier

L'état personnel remplace les soldes de ressources et Banque, progression XP/messages, pity/garantie/Capture et compteurs Gacha, Box/constellations/copies, Teams, Missions, Roue, récompense quotidienne, Expédition, statistiques Combat/économie/social et cosmétique de personnages possédés. Le tri Box legacy remplace sa préférence standalone équivalente. Les anciens profils sans section Banque, Missions, statistiques ou Teams sont initialisés au minimum certain ; un champ présent mais illisible bloque. Les états liés au jour et l'Expédition sont évalués à l'instant explicite du cutover, également pendant la répétition. Le premier Pull natif consomme une fois le contexte `legacyLastPullWasFiveStar`.

`dates.lastXpDate` est un **jour**, conservé dans `PlayerProgression.legacyLastXpDate`. `lastMessageTime` est l'instant du dernier message connu qui a donné de l'XP, conservé dans `lastXpMessageAt`. L'heure exacte du dernier gain XP toutes sources confondues reste inconnue : `lastXpAt = null` jusqu'au premier gain natif. Une divergence entre les jours source et message produit une issue INFO ou WARNING ; une date présente mais invalide est classée `BLOCKER` dans le plan. Aucun minuit ou instant de cutover ne sert de faux gain XP.

Pour les C6, une date de déblocage inconnue reste inconnue. Une entrée spécialisée sans possession C6 Box reste en quarantaine. Une Box C6 avec `copies = 6` est corrigée à 7 avec avertissement ; aucune possession C6 n'est déduite d'une entrée spécialisée orpheline. La seule exception de date pour la Box est le fallback d'obtention R135/R138 déjà validé : l'instant de cutover est stocké avec sa provenance `firstObtainedAtFallback`, jamais présenté comme une date source certaine. Les récompenses de Missions déjà obtenues restent des verrous, sans rattrapage économique. Une date de début de Mission active inconnue reste `NULL` ; si la source affirme un déblocage Z sans aucune date représentable, le plan bloque au lieu de fabriquer une date de cutover. L'avatar/titre de test équipé est vidé sauf preuve migrable ; les avatars des personnages possédés sont dérivés silencieusement.

La bannière conserve ses quatre 5★ et six 4★ actifs jusqu'au lundi suivant. Leur provenance indique que la source exacte des slots n'est pas connue ; aucune génération/vote antérieur n'est inventé. Les votes individuels de la semaine active deviennent `BannerVote` legacy sans fausse heure. Une cible personnelle n'est conservée que si elle fait partie des quatre 5★ importés ; pity et garantie restent inchangés sinon. Les agrégats de vote se dérivent des votes éligibles.

Le Boss conserve chaque instance réellement présente dans `monthly_boss.json`, sans créer les mois manquants. `BossLegacyAggregate` garde les totaux source et statistiques globales ; `BossLegacyContribution` garde la contribution et le jour de dernière attaque, distinct d'un instant inconnu. Les cumuls joueur sont le maximum de ses compteurs `viewer.stats` et de la somme reconstruite, jamais leur addition. Les écarts sont rapportés. Une attaque déjà faite le jour du cutover est bloquée par ce carry-over. Une distribution connue crée une preuve `BossReward` legacy sans opération, date ou montant inventés.

Les amitiés et demandes ne créent aucun Player fantôme. `FriendshipLegacyHeartState` conserve les deux directions de cooldown sans créer de cœur ni gain. L'Event du mois conserve participation, points, monnaies, claims de palier, états quotidiens, fenêtres Jeu A, solution/essais et état résolu du Jeu B, Game C, messages non délivrés et Collection certaine. Une fenêtre Jeu A absente alors qu'un claim quotidien existe peut être générée de manière déterministe au cutover et marquée comme telle ; une fenêtre présente est conservée. Un Jeu B trouvé sans instant exact garde un verrou `legacyFound`, sans date fabriquée. Si l'Event source est ancien, ses points, classement et états quotidiens ne deviennent pas l'édition active ; le solde saisonnier et la Collection prouvée demeurent. Un nouveau champ de calendrier de Noël dans un snapshot futur exige classification et mapping avant cutover.

Les 12 codes annuels restent publiés avec récompenses source. `CODE-YYYY` verrouille cette édition ; `CODE` prouve un claim ponctuel. Les définitions anciennes absentes du catalogue, dont REBIRTH et QUEDULOVE dans la capture, sont créées en `DISABLED` sans récompense ni période inventée, puis liées aux claims historiques. La session Giveaway est `CLOSED`, aucune reward n'est relancée. `GiveawayWin` conserve le gagnant connu avec `origin = LEGACY`, une provenance et sans faux instant ni opération ; `drawIndex = 0` est un emplacement technique, l'ordre réel des tirages n'étant pas établi. Les acteurs d'ouverture et de fermeture sont reliés aux Players résolus quand la source les permet ; les identifiants legacy restent en provenance.

Faveur projette les `N` jours restants du snapshot sur un intervalle de jours métier inclusifs. Le premier jour est celui du cutover, sauf si `lastClaimDate` ou `obtainedDate` vaut ce jour : dans ce cas, la première journée payable est le lendemain. Avec `N = 0`, les bornes restent nulles. `obtainedDate` et `lastClaimDate` restent des dates de provenance distinctes ; aucun grant, opération ou crédit +800/+1600 n'est créé. Un claim legacy certain porte `origin = LEGACY` et n'invente ni canal, ni instant, ni opération.

Si le snapshot Giveaway contient `previousWinner`, il est résolu vers un Player migrable et conservé comme gagnant immédiatement précédent connu ; un profil exclu bloque. `rerolledAt` conserve l'instant source lorsqu'il existe. Le nombre total de rerolls reste inconnu (`rerollCount = null`) et seul le gagnant courant certain crée un `GiveawayWin` legacy, sans reconstituer de tirages intermédiaires.

## Purge, application et preuves

Le plan de purge classe explicitement les tables en référentiels V1, comptes/préférences à conserver et 107 tables de gameplay à vider dans le schéma de répétition courant, dont `player_sessions` et `giveaway_wins`. Les compteurs par table sont établis **avant** mutation ; l'ordre de suppression est calculé depuis les FK et chaque table est supprimée par `DELETE`, sans `TRUNCATE CASCADE`. Une table nouvelle ou une FK d'une table conservée vers une table à supprimer bloque. Chat global, MP, demandes, reports, lectures, échanges, notifications et historiques de test (Pull, Banque, Shop, etc.) sont vidés. Les sessions web pré-cutover sont invalidées ; les utilisateurs se reconnectent après ouverture. La répétition ne possède aucune fonction d'application au schéma public.

`MigrationBatch` relie les 17 `MigrationSourceFile`, les `MigrationMapping` par profil et les `MigrationIssue` ; le batch privé n'est `COMPLETED` qu'après les contrôles de couverture, identité, catalogues, purge, domaines et absence d'opération/reward fictifs. La répétition sur la capture figée a donné 45 profils, 86 amitiés, 19 demandes, 69 claims Codes, deux Boss, douze participants Event, une bannière, une rencontre Combat et une session Giveaway, avec 0 chemin inconnu. Les chiffres sont des contrôles de cette capture, pas des constantes métier. Les sept divergences Boss et les 31 cibles de bannière invalides sont signalées comme telles. Les 516 avertissements personnels détaillent surtout 480 champs Missions de profils anciens et 34 Teams absentes ; un avertissement Box et un C6 complètent le compte. Leurs détails restent dans le batch privé, tandis que le rapport partagé ne donne que les agrégats.

La répétition corrigée vérifie 44 états Faveur, le champ de date XP des 45 profils éligibles, un `GiveawayWin` legacy et la purge d'une session web de fixture ; ces comptes sont propres à la capture figée.

## Conditions de blocage connues

- Capture modifiée, nouveau chemin, catalogue manquant, identité Twitch introuvable ou conflictuelle, valeur source présente mais illisible, FK impossible ou source ambiguë.
- Concours encore actif au cutover : attendre sa clôture puis recapturer ; une reprise de tour à mi-session n'est pas autorisée par ce contrat.
- Snapshot final de décembre avec structure Calendrier inconnue : examiner, classer et mapper ses chemins avant cutover.
- Toute divergence entre le rapport privé et le plan final ou toute récompense/opération créée à l'import.

Ces conditions interdisent le cutover public ; elles ne justifient ni une supposition d'identité ni la perte silencieuse de données.
