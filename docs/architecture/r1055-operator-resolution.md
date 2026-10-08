# R1055 — Abandon contrôlé et relations legacy

Date :08/10/2026. **R1055/R1056 et 063 déployés ; correctif ciblé de consentement/chargement candidat review uniquement.** Production f633760 inchangée. B Ceo ACTIVE/DATA_IMPORTED/LEGACY/non-canary ; A ACTIVE/Auth-Web et tiers intacts au diagnostic daté. Ancien plan expiré sans consommation, OAuth/comparaisons effectués mais aucun choix confirmé/archivage. STOP review indépendante avant promotion et nouveau plan. Raccordement communautaire global restant, onze faits Ceo différés. [État courant et preuves](../master/PROJECT_MASTER_PLAN.md#r1055-consent-fix-20261008), [contrat propriétaire](../specifications/decisions-log.md#r1055--liaison-twitch-unifiée-et-progression-définitive-2026-10-06).

<a id="consentement-technique-20261008"></a>

## Consentement : projection technique bornée, graphes bruts conservés

Le diagnostic local du plan réel démontre une invalidation causée uniquement par deux dates APPLICATION de A, répétées dans les projections personnelle/partagée. Restaurer ces dates en mémoire reproduit exactement l'empreinte originale. Le candidat utilise `consent-activity-evidence.ts` pour les empreintes de comparaison et de plan, sans modifier la capture ni la classification du graphe, le backup ou sa preuve brute. Les empreintes de consentement sont versionnées 2 ; un ancien fingerprint n'est jamais accepté par équivalence implicite.

L'exception porte exclusivement sur les six colonnes connues de `player_activity_state`. `last_app_activity_at` et `updated_at` ne sont redondants que si les horodatages UTC sont reconnus et `updated_at` est exactement leur maximum, microsecondes conservées. Une ligne sans activité GAMEPLAY/chat interne/Twitch est absente de la projection de consentement ; sa création technique neutralise uniquement le comptage de la FK personnelle connue `player_activity_state(player_id)->players(id)` classée OWNED_PERSONAL. La classification retournée et le graphe brut restent exhaustifs. Autre FK, catégorie partagée/inconnue, colonne future, valeur/date anormale ou timestamp inexpliqué restent invalidants.

GAMEPLAY, chat interne et Twitch sont conservés dans la projection ; toute modification de ces dates continue d'invalider le consentement. Tous les autres champs et `updated_at` métier, gameplay/économie, identités, relations, opérations, sécurité et graphes de tiers gardent leurs preuves exactes, y compris les modifications à comptage constant. Cette exception ne change ni consentement explicite, ni expiration/révocation, ni sûreté, ni verrouillage/transaction, ni compensation EXACT_PREIMAGE. Les backups restent des préimages brutes complètes et ne bénéficient pas d'une relaxation de rollback.

La comparaison UI a son propre état chargement/erreur/réessai et AbortController, distincts de la lecture du compte et de l'inspection runtime/chat. Sa borne est 35 s : transaction serveur inchangée de 30 s plus cinq secondes de transport. Compte/runtime conservent huit secondes. À la sortie/changement de session, chaque lecture est annulée et les réponses obsolètes ignorées. Aucun second OAuth pendant chargement/erreur ou en présence d'une résolution ; aucun « Non connecté » ou erreur de chat fabriqué par l'attente de comparaison.

Validation locale : opérateur/liaison PostgreSQL **54 PASS**, WEB/TWITCH symétriques, première ligne technique et activité technique sur ligne métier, modifications significatives/tiers, révocation/expiration/concurrence/rollback et backups exacts. UI : comparaison au-delà de huit secondes, erreur propre, borne dédiée, annulation/réponse obsolète et OAuth bloqué. `verify:full` **8/8**, 1 378 frontend/1 981 backend non-DB. Huit contrôles visuels GameShell PC/mobile synthétiques, sans requête publique ; aucune validation humaine Ceo revendiquée. Aucun nouveau mécanisme d'archivage, DDL ou changement de politique relationnelle.

Complément de validation : 13 tests DB sûreté/équivalence PASS, soit **67 cas DB distincts** au total ; fermeture locale sans connexion/transaction/verrou/schéma restant. L'oracle matérialisé conserve son moteur SQL indépendant et suit seulement les exclusions techniques déjà acquises en 063 et le consentement version2 ; première passe échouée et cause conservées au Master. Aucun SQL produit/performance reconfiguré.

## Décisions acquises — les deux choix sont symétriques

Le propriétaire autorise, au **choix humain explicite Twitch**, l'abandon intégral de la progression standalone A. A n'a pas à rester jouable. Ses ressources, XP, personnages, statistiques et droits de jeu ne sont pas fusionnés avec B. L'archive conserve les preuves et historiques nécessaires aux tiers, sans suppression brutale des relations ni FK. Le choix WEB applique exactement le principe inverse : plusieurs mois de gameplay Web restent intacts face à un profil Twitch minimal abandonné. Ni Twitch ni le standalone ne possède de priorité automatique.

Les anciennes amitiés doivent être rétablies automatiquement entre Players migrés à partir des **Twitch User IDs immuables vérifiés**, puis suivre le Player définitif après liaison. Niveaux, cœurs, dates et preuves anti-double-claim sont conservés. Aucun lien inventé, aucune récompense additionnée, aucun écrasement de relation standalone. L'ami absent reste différé, sans Player fantôme. La mission de promotion autorise uniquement l'import séparé B ; aucun réimport des canaries ni raccordement communautaire global.

**Clarification propriétaire finale :** les JSON figés Streamer.bot sont la source de vérité de la sauvegarde legacy, pas une priorité sur une sauvegarde Web significative. L'import indépendant ne remplace jamais A. Seul le choix du joueur rend une sauvegarde jouable. La continuité d'une relation communautaire prouvée n'autorise aucune addition de ressources, statistiques ou récompenses. Une collision entre deux relations distinctes de la paire définitive reste `LEGACY_FRIENDSHIP_EFFECTIVE_RELATION_CONFLICT` : aucune préférence implicite, maximum ou addition. Une politique supplémentaire de remplacement partagé nécessiterait une décision explicite préservant les tiers ; elle n'est pas inventée ici.

La proposition antérieure de transférer l'amitié et les accès MP de A vers B est **abandonnée** à la suite de la précision propriétaire. Les relations standalone de A et les relations provenant des sources legacy ont des provenances distinctes.

## Preuves disponibles et limites

Le préflight public du 08/10 a terminé : **282 FK, 4 895 lignes/55 tables, fingerprint complet, moteur 1 295 ms**, puis OPERATOR_REQUIRED sur 23 catégories. La performance SQL est résolue dans ce parcours ; aucune optimisation, augmentation de borne ou nouvelle campagne de performances n'est requise.

Une seule lecture complémentaire agrégée READ ONLY a été faite le **08/10 à 10:21:31 UTC**, depuis la configuration canonique : Repeatable Read, statement 5 s, transaction 20 s, processus borné à 35 s. SQL 872 ms ; transaction et déconnexion 1 623 ms ; helper environ 3 s. Elle ne lit ni contenu de message, ni secret. OFF11/flag false et A ACTIVE/Auth-Web seul sont confirmés ; aucune identité/target/import B. Artefacts privés ignorés : `local-data/identity-resolutions/r1055-operator-audit-20261008/`. Aucun second préflight ni mutation publique.

Les nombres suivants sont **des références par FK**, avec recouvrements, pas 23 relations ni leur somme en objets uniques. Les qualificatifs métier proposés n'ont changé aucune classification de production. Les catégories inconnues et les états non démontrés continuent à bloquer.

## Audit des 23 catégories

| # | Référence bloquante | État réel démontré | Traitement nécessaire |
| --- | --- | --- | --- |
| 1 | `arcade_invitations.guest_player_id` (4) | Une EXPIRED ; trois STARTED avec session FINISHED ; toutes résolues | Historique terminal conservable, sous preuve conjointe invitation/session. Le classement inconditionnel est trop conservateur pour ces lignes. |
| 2 | `arcade_invitations.host_player_id` (1) | REFUSED, résolue | Historique terminal conservable ; ne pas généraliser à une invitation en attente. |
| 3 | `arcade_receipts.session_id:external` (29) | Sessions FINISHED ; A est participant ; opérations COMPLETED | Preuves du résultat chez un autre propriétaire de session. Conserver propriétaire, participant, session et reçu ; aucune réattribution. |
| 4 | `arcade_stats.best_session_id:external` (1) | Session FINISHED, A participant | Record personnel lié à une session partagée terminée ; conserver score et attribution. A archivé peut disparaître du classement actif, pas le score du tiers. |
| 5 | `boss_attacks.operation_id` (18) | Opérations de A COMPLETED ; 12 attaques ancien mois, 6 mois courant | Ledger personnel avec rattachement collectif. Ancien mois terminal ; mois courant implique abandon audité des gains futurs, avec protections transactionnelles. |
| 6 | `boss_attacks.player_id` (18) | Mêmes attaques | Ne pas effacer les dégâts ni le mérite historique de A ou recalculer le Boss au détriment des autres. |
| 7 | `direct_conversation_participants.player_id` (1) | Rangement non archivé ; pas de typing actif | Droit privé de A, pas simple historique détachable. L'abandon ne donne aucun accès à B ; préserver les accusés et le rangement du tiers. |
| 8 | `direct_conversations.player_a_id` (1) | Une conversation partagée | Conserver la conversation et sa paire historique ; interdire tout nouvel envoi vers A archivé tout en laissant au tiers la lecture. |
| 9 | `direct_messages.author_player_id` (97) | Messages de A | Conserver auteur, ordre, contenu, modération, replies et droits du tiers ; aucun remplacement d'auteur par B. |
| 10 | `direct_messages.operation_id` (97) | Opérations COMPLETED | Preuves terminales immuables ; aucune suppression ou appropriation des opérations par B. |
| 11 | `event_game_b_daily_states.discoverer_player_id` (2) | Résolus, jours passés, éditions closes, non legacy | Attribution historique de découverte, pas droit économique futur distinct. Condition terminale démontrable, sans modification du résultat communautaire. |
| 12 | `event_participants.player_id` (1 unsafe) | Une édition courante ; une autre participation ancienne déjà admissible | Points personnels mais destinataire de futurs gains collectifs. Conserver les acquis ; exclure A archivé des nouveaux gains, sans crédit sur B ni effet sur les autres. |
| 13 | `event_social_messages.recipient_player_id` (18) | 16 vus/2 non vus ; jours anciens | Droits de destinataire privés. Archiver/abandonner le droit de A sans le donner à B. L'ancienneté et `viewedAt` ne prouvent pas l'absence de livraison Twitch restante. |
| 14 | `event_social_messages.sender_player_id` (18) | 17 vus/1 non vu par les destinataires ; jours anciens | Conserver auteur et gains déjà reçus. Les destinataires tiers gardent leurs droits ; aucune relivraison ni récompense rejouée. |
| 15 | `friend_hearts.operation_id` (16) | Cœurs envoyés par A, opérations COMPLETED, dates passées | Ledger économique terminé ; conserver les opérations et toutes leurs contreparties. |
| 16 | `friend_hearts.recipient_player_id` (13) | Cœurs reçus, paire cohérente, opérations tierces COMPLETED | Conserver auteur tiers, gain A, gain tiers et quota historique ; aucune addition au gagnant. |
| 17 | `friend_hearts.sender_player_id` (16) | Mêmes cœurs émis par A | Conserver les attributions sur la relation historique ; ne jamais déplacer les endpoints de l'amitié sous ces lignes. |
| 18 | `friend_requests.recipient_player_id` (2) | ACCEPTED, résolues | Historique terminal conservable. Une demande PENDING d'un autre cas impose une clôture explicite, pas une fausse acceptation/refus du tiers. |
| 19 | `friendships.player_a_id` (1) | ACTIVE, progression commune non vide | Vraie relation active. Au choix Twitch, clôture `ARCHIVED` de la relation standalone, conservation de niveau/cœurs/participants/ledger ; aucune succession implicite vers B. |
| 20 | `global_chat_mentions.mentioned_player_id` (2) | Mentions historiques | Conserver attribution A et message d'origine ; aucune notification rétroactive vers B. |
| 21 | `player_boss_participations.player_id` (2) | Un mois passé, un mois courant ; Boss non vaincus | L'ancien mois est terminé même sans `defeatedAt` (R439). Le mois courant porte des gains futurs abandonnables, à neutraliser sans retirer dégâts et preuves. |
| 22 | `player_expeditions.player_id` (1) | RUNNING, échéance non atteinte, personnage présent | État exclusivement personnel. Peut rester figé comme progression abandonnée ; aucun claim/reconcile après archivage, aucune récompense ou personnage transféré. |
| 23 | `resource_movements.operation_id:external` (13) | Opérations `friendship.heart` de tiers COMPLETED | Contreparties légitimes de cœurs reçus. Conserver le parent externe et les deux côtés du ledger ; l'externalité n'est pas une opération orpheline. |

### Sources métier vérifiées

- [Social et MP](../legacy/14-ami-social-audit.md) : amitié/niveau partagés, quotas directionnels, R453–R459 ; historique MP sans expiration R503, droits d'auteur R504, lecture après perte du droit d'envoi R508, rangement individuel R512. Owners : `friendship-service.ts`, `direct-message-service.ts`. Le trigger de migration 029 contrôle l'appartenance d'un cœur à sa paire lors d'une écriture du cœur, pas lors d'un changement ultérieur de la paire.
- [Boss](../legacy/13-combat-audit.md) R439 : un Boss non vaincu d'un ancien mois devient un échec historique. À la baseline, `rewardParticipants` sélectionnait tous les participants sans exclusion des archives ; le candidat protège ce fanout sous verrou.
- [Event](../legacy/16-event-monthly-audit.md) : à la baseline, le fanout Jeu B créditait tous les participants ; le candidat exclut les archives sous verrou, sans retirer leurs attributions terminées. `event-chat-presence.ts` recherche les messages sans opération `event.message.delivery`, sans filtre de jour ou de lecture. **Trois messages non vus ne signifient donc pas trois livraisons en attente.** Aucun nombre de deliveries engagées n'est démontré par cette lecture agrégée : leur contrôle exact reste une gate du plan opérateur.
- [Arcade](../specifications/arcade-v1.md) et owners `arcade-invitations`, `arcade-finalization`, `arcade-transaction` : les terminaux constatés sont conservables ; un duel réellement ACTIVE reste bloquant tant qu'une clôture canonique ne préserve pas l'adversaire.
- [Expéditions](../legacy/12-expedition-audit.md), owner `expedition-service.ts` : pas de scheduler global d'expédition ; les lectures/réconciliations et claims refusent désormais un Player archivé sous verrou.

R1053 décrit un tirage Event validé mais **pas encore implémenté**. Il ne démontre ni droit ferme actuel à une Stella ni rétroactivité obligatoire sur toutes les éditions closes. Il n'impose donc pas une attente indéfinie à Ceo. Son activation future devra préciser sa borne de catch-up et respecter les abandons audités ; aucun tirage/reward/RNG n'est ajouté ici.

## Deux gates distinctes, déjà déterminées par R1055

`planLegacyCanary` reçoit un Twitch User ID vérifié et le Player cible attendu ; il ne reçoit pas A. Sans TwitchIdentity existante, il choisit un UUID neuf B, mapping TWITCH_ONLY, capture le préimage de B et vérifie ses références. `applyLegacyCanary` revalide sous verrou, écrit le backup avant toute écriture métier, puis crée B. Une collision d'UUID n'écrase jamais A. Le backup v3 comprend maintenant le préimage social complet ; les faits dont le second endpoint n'est pas vérifié/importé restent différés. La matérialisation sociale ne touche aucun gameplay personnel tiers.

Le refus SAFE sur A avant même le plan B provenait du helper opératoire privé ; ce n'est pas une contrainte du migrateur. Le contrat R1055 distingue explicitement import ciblé et futur choix du perdant. Les résultats doivent donc être séparés :

1. **IMPORT_B_READY** : identité/source/mapping/preimage/rehearsal/backup/opérations valides pour B neuf. A et ses tiers sont préservés exactement. A peut rester OPERATOR_REQUIRED.
2. **ARCHIVE_A_OPERATOR_REQUIRED** : le futur choix Twitch reste refusé tant que clôture sûre, plan opérateur et consentement frais ne sont pas acquis. Le choix Web évalue B, pas A.

Cette séparation est maintenant prouvée avec les API canoniques sur PostgreSQL local. **Elle ne lève pas l'interdiction propriétaire d'import public avant implémentation testée et review indépendante.** Elle n'autorise ni OAuth anticipé ni choix automatique.

## Résolution opérateur implémentée

`TwitchCanonicalizationOperator.prepare` est distinct du classifieur self-service. La classification SHARED_ACTIVE reste OPERATOR_REQUIRED ; le plan autorise uniquement une clôture définie, pour un choix, une paire Web/Twitch vérifiée et une durée de quinze minutes. L'opérateur doit être ACTIVE/ADMIN et dans l'allowlist existante. OFF, révision attendue, flag false, acquittement Streamer.bot et absence globale d'opération PENDING/outbound incertain sont requis. Préparer ne ferme aucune relation et ne déplace aucune identité.

Le fingerprint couvre les graphes personnels exacts, les identités, les images complètes des relations affectées, leurs enfants et parents externes, les preuves sociales et d'import, les conséquences et le contrôle d'autorité. Le backup local neuf est synchronisé avant enregistrement du plan. Les données privées restent dans cet artefact ; le DTO n'expose que l'ID opaque, l'expiration et les conséquences agrégées. Une modification invisible ou tierce à comptage constant invalide le plan/consentement. Les catégories inconnues restent bloquées.

Le choix reste le POST authentifié existant après OAuth canonique, avec révision affichée, ID du plan et acquittement d'abandon supplémentaires. La comparaison et les cases sont réinitialisées si la preuve change. Transaction SERIALIZABLE bornée, ordre Twitch → Social → Players affectés triés → domaines. Clôture sociale, déplacement des identités/target, archive, réconciliation des faits legacy, audit et consommation du plan sont atomiques. Même choix terminal idempotent ; choix inverse refusé. Les limites transactionnelles existantes ne sont pas élargies et aucune opération PostgreSQL n'est abandonnée en arrière-plan.

Un échec avant commit restaure exactement les deux graphes et les tiers. Un choix terminé n'est pas réversible par le rollback canary. La conservation d'un backup n'autorise aucune compensation publique tardive : nouvelle activité, identité déplacée, nouvelle référence ou postimage modifiée imposent STOP.

### Clôtures et protection des tiers

- Amitiés du perdant : ARCHIVED avec marqueur d'abandon, mêmes endpoints, niveaux, cœurs et ledgers. Demandes ouvertes clôturées par l'owner Social ; les anciennes acceptations restent historiques. Les blocages de contact restent protecteurs et ne sont pas effacés.
- MP : même conversation, auteurs, contenus, replies, modération, accusés et droits de lecture du tiers. Aucun accès privé transmis au gagnant ; envoi vers une archive refusé. Le rangement du tiers reste intact.
- Event social : les destinataires tiers gardent les messages émis ; seul l'accès du perdant est abandonné. Aucune récompense/livraison rejouée. Les envois déjà engagés ou ambigus bloquent.
- Boss/Event : attaques, dégâts, points et acquis restent historiques. Les fanouts verrouillent les destinataires et excluent ARCHIVED des nouveaux gains sans réduire les gains des tiers. SUSPENDED garde sa politique existante.
- Expédition : état personnel figé ; claim et réconciliation refusés après verrou si ARCHIVED. Aucun gain ni personnage transféré. Banque, codes et notifications évitent également les écritures sur l'archive.
- Arcade/Concours/échange véritablement actif, Giveaway ouvert/différé, opérateur/credentials spécialisés : STOP. Aucun forfait, remboursement ou clôture de ces activités n'est inventé.

La migration 063 ajoute une barrière physique sur les 71 tables du graphe personnel canonique et les deux tables d'identité. INSERT/UPDATE/DELETE vérifie les propriétaires anciens et nouveaux sous verrou ; les quatre enfants indirects résolvent leur parent sous verrou. ARCHIVED ne peut pas être recrédité, déplacé, supprimé ou réactivé par un acteur périmé. L'erreur devient un 409 métier sans SQL/identifiant privé. Cette barrière complète les owners applicatifs : elle ne remplace pas le contrat des relations partagées. Une nouvelle table exige un audit explicite et la mise à jour de l'inventaire testé.

## Restauration durable des amitiés — R1056

`LegacyFriendshipFact` conserve le fait JSON exact par paire source : hash du snapshot/contenu, niveau, cœurs, dates et preuves Helix des deux endpoints. Les noms ne servent qu'à retrouver ces preuves ; le Player final est résolu exclusivement par Twitch User ID immuable et, si nécessaire, résolution WEB terminée. Une preuve manquante ou un ami non importé reste DEFERRED, sans Player fantôme. Source/provenance contradictoire, date incohérente, paire devenue identique, relation révoquée ou blocage donnent un résultat explicite.

À l'import ciblé, l'owner enregistre les preuves de l'endpoint importé puis matérialise seulement les paires entièrement prouvées. Aucun faux FriendHeart, opération de jeu, ressource, récompense, statistique ou mission n'est créé. Le backup canary v3 englobe les faits, versions de relation, cœurs et carryovers dans leur forme SQL exacte ; rollback compare le postimage audité, contrôle toutes les références et restaure le préimage. Les backups v1/v2 restent lisibles.

Au changement de Player définitif, les endpoints d'une relation portant un ledger ne sont jamais modifiés : l'ancienne version est clôturée et conservée, une nouvelle version rattache les Players définitifs. L'unicité partielle impose une seule version effective par paire et par fait. La progression sociale commune continue sans addition ; les récompenses et opérations historiques restent à leurs propriétaires. Seul l'usage directionnel réellement prouvé du jour et du même tiers peut être reporté comme protection anti-double-claim, avec provenance, sans gain ni statistique.

Une relation standalone distincte déjà présente sur la paire définitive n'est pas remplacée. La collision bloque, même si le legacy est source de vérité de sa propre sauvegarde. Le choix WEB conserve intégralement le gameplay Web ; le choix TWITCH conserve intégralement le gameplay Twitch. La clôture consentie de la relation du perdant peut libérer une paire, mais ne supprime aucune preuve et ne contourne aucun blocage tiers.

Pour les Players déjà importés, le rapprochement social dispose d'un owner local distinct, borné à une paire et deux rapports vérifiés : plan READ ONLY, fingerprint, application avec backup durable et rollback EXACT_PREIMAGE conditionné au postimage. Il ne rejoue aucun import personnel. Son usage public exige une autorisation ciblée ultérieure ; les trois canaries restent inchangées dans cette mission.

Le propriétaire GLOBAL de purge ne connaît pas encore la compensation de ces nouvelles preuves : il refuse explicitement en présence d'un plan opérateur ou d'une relation legacy matérialisée. Ce refus protège les graphes ; GLOBAL reste interdit dans la mission.

## Vérification et limites

Les tests synthétiques sur PostgreSQL 17.11 rejouent la chaîne physique de 63 migrations dans des schémas privés : séparation import B/archivage A, WEB/TWITCH, consentement et preuves périmés, modifications tierces, rollback atomique, idempotence, relations croisées, source corrompue, ami différé et reprise, collision, quota du jour, acteur périmé et libération des connexions. Les owners d'activités sont testés avec de véritables gains tiers et des courses observées via les verrous PostgreSQL. Les comptes et logs finaux figurent au Master, sans additionner deux fois les réexécutions.

Le contrôle visuel Codex utilise le GameShell réel, ses styles de production et des données synthétiques locales aux largeurs 1366 et 390 pixels. Il couvre les deux choix autorisés et l'état entièrement bloqué. Ce contrôle ne fabrique aucune session et ne constitue pas une recette humaine/publique Ceo.

La rapidité publique de 1,295 seconde est une preuve du moteur de classification déjà déployé, pas une mesure du plan opérateur complet. L'import séparé B puis OAuth/comparaisons appartiennent aux étapes publiques datées au Master ; aucun choix n'a été confirmé. Le présent correctif ne réalise aucun nouveau préflight public, import, OAuth, plan, NATIVE ni réparation canary. La cause historique de l'incident PostgreSQL/Concours reste non démontrée ; P0 demeure clôturé par sa recette antérieure. Dette Supabase après migration des joueurs, sans chantier infrastructure dans ce lot.

## Prochaine action

Review indépendante du SHA de ce correctif, puis seulement mission autorisée de promotion/déploiement contrôlés ; 063 et B sont déjà acquis et ne doivent pas être rejoués. Après disponibilité humaine et gates fraîches : vérifier A/B significatifs, actifs et distincts, identités/provenance/backup/tiers intacts, puis préparer le plan opérateur frais sans choix. Liaison humaine depuis Configuration > Compte > Lier Twitch ; le joueur compare, consent et choisit explicitement. Ceo NATIVE attend la recette F5/reconnexion du choix et la procédure séparée d'extension. Aucun OAuth anticipé ni nouveau plan dans la mission du correctif.
