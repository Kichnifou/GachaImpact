# Arcade V1 — étape 23

Source canonique du domaine, décisions propriétaire **R970–R990 puis R991–R994** du 01/10/2026. Le checkpoint `81066badca66ac054d7dc515005eda6d10a8b913` a été promu et testé publiquement : trois fins naturelles et leurs gains cohérents sont acquis. Le correctif `cb7b2a45679985a867ae6ef29b092a63f512449f` est approuvé par review indépendante ChatGPT ; la migration 058 est prête à promotion, mais le public reste à 057 au présent checkpoint. La recette publique du correctif reste à faire par le propriétaire ; l'étape 23 n'est pas clôturée. Statut de déploiement dans le [Master](../master/PROJECT_MASTER_PLAN.md). Les anciennes pistes Réflexes / séquence Mémoire / jauge Précision sont abandonnées.

## Surface et navigation

`Activités > Arcade`, `#activities/arcade`, entre Événement et Concours. Une coque commune propose Memory, Puissance 4 et Morpion, difficulté Moyen par défaut, joueur/adversaire, plateau, statut, bilan inline, Commencer/Rejouer ou Quitter, scores et quota du jour. Aucun démarrage au GET ou au changement d'onglet. Une seule partie ACTIVE globale sélectionne son jeu et verrouille difficulté et trois boutons de jeux, sans clignotement réseau. Entrée, reload et retour navigateur reprennent automatiquement l'état serveur ; retour Records/feedback reprend la boucle locale. Pas de Pause/Reprendre. Les timers s'arrêtent hors écran/onglet visible et devant les modales ou feedbacks.

Aucune carte Quotidiennes, entrée principale/Menu, modification Accueil/sidebar/DailyTracker, renommage Entraînement Combat ou historique détaillé. `Records →` ouvre Personnel / Global / Score, sans les trois anciennes notes explicatives et avec sous-onglets Score plus petits. `Règles & gains` ouvre une modale Général/Memory/Puissance 4/Morpion avec règles et tableaux de gains, sans déplacer le plateau. Escape, croix, backdrop, piège et restitution du focus réutilisent `useModalDialog`. À 1920×1080 et 2560×1440, toute la surface utile Arcade tient sans scroll interne ; le body garde un scroll borné sur petit desktop et le document un flux naturel mobile. Les modales possèdent leur body défilant.

## Moteurs et adversaires

Les règles et les politiques IA sont des fonctions pures distinctes sous `server/src/domain/arcade/`. Les identités de jeu sont `MEMORY`, `CONNECT_FOUR`, `TIC_TAC_TOE` ; difficultés `EASY`, `MEDIUM`, `HARD`. Les nouvelles sessions portent Rules/Scoring **2**, les anciennes conservent **1**. Le serveur tire une seule fois le premier participant, à chances égales, puis conserve ce choix et l'état de son RNG privé. Aucun retry ne retire un coup ou le premier joueur.

### Memory

V2 : Facile **4×4 / 16 cartes / 8 paires**, Moyen **5×5 / 24 cartes / 12 paires**, Difficile **6×6 / 36 cartes / 18 paires**. Le centre Moyen, position 12, est une case astrale décorative non jouable : carte privée null, DTO `BLOCKED`, aria-label « Case centrale décorative ». Il ne compte pas dans les paires et est exclu des coups Player/IA. Chaque personnage distinct du catalogue actif avec portrait apparaît deux fois. Minimum 8/12/18 portraits selon difficulté, sinon indisponibilité explicite. Le serveur fige nom, élément, chemins et identités à la création ; rendu partagé `CharacterPortraitFrame`, sans nouvel asset. Un snapshot **V1 sans layout reste 6×6/18**, quelle que soit sa difficulté ; aucune réécriture historique.

Deux cartes différentes par tour ; une paire est attribuée au participant et lui permet de rejouer. Un échec garde les deux cartes visibles au moins 700 ms côté serveur, puis un avancement les cache et change le tour. Les cartes acquises ne sont plus jouables. Toutes les paires attribuées terminent naturellement la partie ; plus de paires gagne. Égalités V2 : 4/4, 6/6, 9/9 ; V1 : 9/9. Aucun aperçu initial.

L'IA reçoit uniquement les positions disponibles, ses observations et les cartes visibles. **Elle ne reçoit jamais les faces cachées du moteur.** Chaque révélation de l'un ou l'autre participant nourrit ses observations ; la première carte peut guider le second choix. Paramètres centralisés :

| Difficulté | Observations conservées | Exploitation d'une paire connue |
| --- | ---: | ---: |
| Facile | 4 | 50 % |
| Moyen | 12 | 85 % |
| Difficile | 36 | 100 % |

En dehors d'une paire connue exploitée, elle privilégie les positions inconnues. La projection publique n'inclut que position/statut pour une carte cachée ; nom/ID/asset sont transmis seulement pour les cartes visibles ou acquises. Ni seed, RNG, observations privées ni plateau complet ne figurent dans une réponse, erreur ou receipt public. Aucun preload/DOM des portraits cachés.

### Puissance 4 et Morpion

Puissance 4 : 7 colonnes × 6 lignes, gravité, colonne pleine interdite, quatre jetons horizontaux/verticaux/diagonaux gagnent. Morpion : 3×3, case vide obligatoire, trois symboles alignés gagnent. Plateau plein sans victoire = égalité. Arrêt immédiat au premier résultat terminal. Joueur cyan/cercle, IA violet/symbole : la couleur n'est pas le seul indice.

Les simulations IA utilisent le même moteur que les coups réels. Recherche alpha-bêta bornée :

| Difficulté | Profondeur Puissance 4 | Budget de nœuds | Choix imparfait légal |
| --- | ---: | ---: | ---: |
| Facile | 1 | 80 | 65 % |
| Moyen | 3 | 1 400 | 12 % |
| Difficile | 6 | 12 000 | 3 % |

Morpion Difficile explore jusqu'à profondeur 9 avec le même budget. Hors choix imparfait, victoire immédiate et menace adverse immédiate sont prioritaires. Aucun changement de plateau, règle ou résultat pour favoriser un camp ; Difficile n'est pas présenté comme invincible. Budget déterministe testé, pas de recherche illimitée.

### Présentation de l'adversaire

Petit automate astral simplement nommé « Adversaire », sans lore. Catalogue local de répliques courtes : début, paire, échec, belle paire du joueur, coup, menace, situation serrée et résultat. Une référence persistée choisit une phrase au plus par transition pertinente et évite la répétition immédiate. Cette décoration ne consomme aucun RNG gameplay. Aucun Chat, notification, API d'IA ni temps de lecture imposé.

La réplique est placée à droite du plateau, côté adversaire, en italique et entre guillemets ajoutés par le composant ; sur mobile elle suit l'entête adverse. Aucun changement au banter serveur. Morpion emploie cercle cyan creux et croix CSS de même encombrement ; Puissance 4 emploie cercle/losange CSS centrés, forme et couleur distinguant les camps.

## Points, score et XP

`performancePoints` est le résultat du barème pur versionné. À **chaque fin naturelle**, `scoreAwarded = performancePoints`. `xpAwarded = performancePoints` uniquement pour la première partie terminée de ce jeu, de ce Player et de cette date métier Europe/Paris, sinon zéro. Toutes les difficultés partagent ce quota. Une défaite ou égalité le consomme aussi. Ouvrir, interrompre, reprendre ou consulter ne le consomme jamais.

| Jeu / résultat | Facile | Moyen | Difficile |
| --- | ---: | ---: | ---: |
| Memory défaite | 1–2 (0–3 paires) | 1–4 (0–5) | 1–6 (0–8) |
| Memory égalité | 3 (4 paires) | 5 (6) | 7 (9) |
| Memory victoire | 4–6 (5–8 paires) | 6–8 (7–12) | 8–10 (10–18) |
| Puissance 4 / Morpion défaite | 2 | 3 | 4 |
| Puissance 4 / Morpion égalité | 3 | 5 | 7 |
| Puissance 4 / Morpion victoire | 6 | 8 | 10 |

Interpolation Memory entière : pour `h = totalPairs / 2`, défaite `1 + floor(paires × (lossMax − 1) / (h − 1))`, victoire `winMin + floor((paires − h − 1) × (winMax − winMin) / (h − 1))`. V1 conserve h=9 dans toutes les difficultés ; la finalisation utilise la scoringVersion persistée. Victoire > égalité > défaite ; plus de paires ne réduit jamais les points. Ni vitesse réseau, ni horloge client, ni durée de jeu dans le barème.

Plafond 10 XP par jeu, 30 XP Arcade par jour ; les scores n'ont pas de plafond quotidien. Exemple : première victoire Difficile Puissance 4 = **+10 score / +10 XP** ; suivante le même jour = **+10 score / +0 XP**. L'UI indique « Partie libre — score disponible, XP du jour déjà obtenue ». Score cumulatif sans saison/reset, non achetable, non dépensable, non convertible, sans récompense de classement. Le total Arcade est toujours la somme calculée des trois scores, jamais un second compteur stocké.

## Persistance, reprise et transaction

Une session ACTIVE maximum par Player pour les trois jeux, protégée sous verrou Player et par index SQL global. Impossible d'en créer une autre ou de changer de difficulté avant fin/abandon. IA et dissimulation progressent par actions explicites versionnées, uniquement quand l'écran est actif ; aucune progression de fond au GET.

Quitter confirme « Quitter cette partie ? » / « Cette partie ne donnera ni score ni XP. ». `QUIT` produit ABANDONED, incrémente la version, conserve finishedAt, état privé et receipt ; outcome/points/XP/businessDate/finishOperationId restent nuls. Aucun appel à la finalisation ni à XP : zéro score, played/V/E/D, grant, ressource, Mission, notification ou récompense de niveau. Replay exact idempotent ; autre clé ne peut rejouer une session abandonnée. Le prochain START peut référencer son ID comme previousSessionId. Le plateau abandonné n'est pas présenté comme reprenable.

Le dernier coup naturel finalise immédiatement. Date métier prise **à cette finalisation**, même si la partie a commencé avant minuit. Le résultat et son receipt gardent cette date après minuit ; un replay ne crée jamais le grant du nouveau jour.

`ArcadeService` authentifie/résout le Player actif, verrouille Player puis réutilise les propriétaires XP/économie dans une transaction SERIALIZABLE avec quatre essais maximum sur conflit concurrent. Le résultat terminal, record, compteurs, score, grant quotidien, progression, soldes, ledger, Missions et receipt sont atomiques. Une panne après les écritures récompenses les annule toutes. Les contraintes SQL doublent les gardes applicatives.

Chaque mutation impose UUID d'idempotence + version attendue. Receipt exact : réponse persistée rejouée avec `alreadyProcessed=true`. Même clé avec autre intent : 409. Autre clé sur ancienne version : 409 ; coup illégal : 400 ; session d'autrui : 404. Le start exige la dernière session connue (`previousSessionId`, ou null) et `expectedVersion=0`, afin qu'un ancien start ne recrée pas silencieusement une partie. Aucun score, résultat, plateau, timestamp ou gain fourni par le client n'est accepté.

Le frontend protège double clic et requêtes concurrentes, conserve l'intent ambigu pour réessayer exactement, ignore les versions antérieures et recharge l'état courant après replay. Les timers/listeners sont nettoyés au démontage/logout. Chargement à l'entrée et revalidation focus/retour visible ; aucune nouvelle action pendant ce rechargement, sans polling global ni appel sur frames/mouvements souris.

## Propriétaire XP et feedback

`PrismaPlayerXpService.grant` applique `planPlayerXpGrant`, récompenses de niveaux et overflow, économie et Missions normales. Arcade n'incrémente ni messages, ni messages comptés, ni cooldown Chat. Une partie libre ne fait **aucun appel grant(0)** : zéro effet de progression, économie ou Missions.

La réponse récompensée contient les vrais snapshots progression/ressources et les récompenses effectivement accordées. `publishProgressionUpdate` et la file `LevelUpFeedback` existantes présentent niveaux multiples et paliers d'overflow au niveau 100. Dédoublonnage par opération ; lecture d'un ancien résultat/replay = aucune nouvelle modale. Un replay recharge les snapshots actuels au lieu de rétablir d'anciens soldes. Le bilan score/XP reste inline. Records se ferme devant les feedbacks prioritaires du shell.

**Aucun nouveau producteur Notification Arcade, level-up ou tutoriel.** Les notifications Missions normales peuvent naître d'une vraie complétion causée par l'XP, selon R954–R955. Découverte/tutoriel reste à son étape dédiée. Aucune récompense monétaire directe Arcade ; seules les récompenses normales du propriétaire progression peuvent accompagner l'XP.

## Records, classement et confidentialité

- Personnel : meilleurs points/résultat et paires Memory par jeu/difficulté, compteurs terminés et V/E/D, score par difficulté et score du jeu. Aucun record fictif avant une partie finie.
- Global : une seule meilleure performance par Player/jeu/difficulté ; points décroissants uniquement, UUID stable entre ex aequo. Un résultat inférieur ou égal conserve le record existant. Les paires sont informatives et ne départagent pas deux versions de tailles différentes ; le total vient de rulesVersion/difficulty de la meilleure session (`2 / 18 paires` V1 ou `8 / 12 paires` V2 Moyen).
- Score : Memory / Puissance 4 / Morpion / Total ; addition des difficultés, score décroissant. Le cumul reflète aussi le nombre de parties.

Identité publique et seuls Players ACTIVE avec élément, confidentialité existante **GENERAL_STATISTICS = PUBLIC** (défaut Social appliqué si aucune ligne). FRIENDS/PRIVATE exclus du tableau global, sans modifier Social. Pas d'email, subject Auth, receipts ou session privée. Les scores et compteurs BigInt sont des chaînes décimales jusque dans le frontend.

Égalités de performance : rangs compétition **1,1,3** ; UUID Player secondaire stable pour l'ordre et la pagination, sans casser les ex aequo. Dix lignes/page, placeholders en page partielle. Le serveur renvoie rang, position physique, selfPage, statut classé et pagination. Ouverture/changement de catégorie sur la page contenant le joueur ; calcul par index physique, jamais par rang. Navigation manuelle conservée à Actualiser. Ligne propre signalée par fond/bordure et « Vous ». Non classé : page 1, explication, aucune ligne inventée.

## API authentifiée

| Méthode / route | Contrat |
| --- | --- |
| GET `/api/v1/arcade` | Dernière session de chaque jeu, scores, records personnels, quotas de la date courante ; lecture seule |
| GET `/api/v1/arcade/sessions/:sessionId` | Session possédée, projection sûre ; lecture seule |
| POST `/api/v1/arcade/sessions` | `{game,difficulty,expectedVersion:0,previousSessionId,idempotencyKey}` |
| POST `/api/v1/arcade/sessions/:sessionId/actions` | `{kind:'MOVE',position,expectedVersion,idempotencyKey}` ou `{kind:'ADVANCE'|'QUIT',expectedVersion,idempotencyKey}` |
| GET `/api/v1/arcade/records` | `kind=GLOBAL|SCORE`, `game`, difficulté, page optionnelle ; TOTAL réservé à Score |

Les objets sont stricts (champs inconnus rejetés). Les mutations renvoient session/summary/operationId/alreadyProcessed/award ; `award=null` hors fin donnant de l'XP. `ARCADE_TOO_EARLY` préserve le délai serveur d'affichage, sans crédit ni nouveau tirage.

## Schéma et limites opérationnelles

Migration additive **`20261001010000_057_add_arcade`** : `arcade_sessions`, `arcade_receipts`, `arcade_daily_grants`, `arcade_stats`. Session = autorité du résultat ; pas de table miroir. Index partiel d'une ACTIVE/Player/jeu ; PK grant Player/jeu/date ; unicité finale/receipt/opération ; PK stats Player/jeu/difficulté, CHECK et FK ; RLS activée, tous privilèges PUBLIC/anon/authenticated révoqués. Accès uniquement via backend autorisé.

057 est publique depuis la promotion `81066ba`. La candidate **`20261001120000_058_harden_arcade_session_lifecycle`** étend statut/versions/CHECK terminal et remplace l'index actif par Player seul. Son DDL est transactionnel et échoue en cas de plusieurs ACTIVE, sans réécriture ni abandon automatique. Les 58 migrations sont testées par **Prisma migrate deploy/status dans un schéma privé isolé** ; public reste à 057, avec uniquement 058 en attente. Aucun fixture/gameplay public ni registre Prisma modifié manuellement pendant le correctif.

Les preuves d'idempotence, grants et résultats restent durables. [Rétention V1](data-retention-v1.md) : aucune purge d'ancienneté décidée pour Arcade ; aucun scheduler de purge ajouté. Une future rétention ne devra jamais supprimer les gardes de double crédit.

Garanties anti-automatisation limitées aux règles autoritaires, versions, quotas XP, délais de transition et concurrence. Pas de CAPTCHA, détection comportementale, sanction, plafond score caché ou preuve d'humanité. Une automatisation de coups légaux reste possible ; cette V1 n'annonce pas l'empêcher. Pas de PvP, Twitch, API IA, achat, upload, Admin reset/score, lore, Tutoriel ou refonte d'un autre domaine.

## Contrôles du candidat

Tests moteurs/IA/barème, routes strictes, frontend/reprise/Records/overflow et PostgreSQL privé : secrets, snapshots catalogue figés, quotas/pertes/égalités, score libre, minuit, concurrence, replay, rollback après récompenses, XP propriétaire, overflow/Missions, bigint, rangs et confidentialité. Les tests d'intégration utilisent des fixtures privées proches de la fin ; les fins naturelles des moteurs sont aussi testées séparément.

Inspection corrective Chromium locale dans **GameShell avec `index.css` et `App.css` réels**, sans réseau public : 2560×1440, 1920×1080, 1366×768 et 390×844 ; Memory trois tailles, deux alignements, règles Général/Memory, Records Score et confirmation Quitter. Mesures du body Arcade : 678/678 px à 1920 et 1038/1038 px à 2560 (scrollHeight/clientHeight), cinq plateaux sans débordement ; plateau inchangé à l'ouverture des règles. Le petit desktop conserve un scroll borné, mobile un flux vertical. Captures détaillées des marqueurs CSS inspectées. La review indépendante du correctif est acquise ; la recette publique reste réservée au propriétaire.
