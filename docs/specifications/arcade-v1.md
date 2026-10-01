# Arcade V1 — étape 23

Source canonique du domaine, décisions propriétaire **R970–R990** du 01/10/2026. Candidat `d2a32fd6ffcc61de49c9789f3bd4a79a6f8309e5` et correctif Event `95beab5d071bef47ccd96546768061403319bd7c` approuvés par review indépendante ChatGPT ; prêts à la promotion technique groupée. La validation publique du gameplay, du ressenti des difficultés et du responsive par le propriétaire reste à faire. Statut de déploiement dans le [Master](../master/PROJECT_MASTER_PLAN.md). Les anciennes pistes Réflexes / séquence Mémoire / jauge Précision sont abandonnées.

## Surface et navigation

`Activités > Arcade`, `#activities/arcade`, entre Événement et Concours. Une coque commune propose Memory, Puissance 4 et Morpion, difficulté Moyen par défaut, joueur/adversaire, plateau, statut, bilan inline, Commencer/Reprendre/Rejouer, scores et quota du jour. Aucun démarrage au GET ou au changement d'onglet. Une partie active affiche sa difficulté verrouillée. Pause, fermeture, changement de jeu ou d'écran conservent la partie. Les trois jeux sont disponibles chaque jour dans l'ordre choisi.

Aucune carte Quotidiennes, entrée principale/Menu, modification Accueil/sidebar/DailyTracker, renommage Entraînement Combat ou historique détaillé. Le lien `Records →` ouvre une seule modale Personnel / Global / Score. Le body Arcade possède le scroll desktop ; le document reprend un flux naturel sur mobile. Les contrôles et le footer restent fixes dans le cadre desktop. La modale possède son body défilant et ses filtres/pagination fixes ; Escape, croix, backdrop et restitution du focus suivent le pattern partagé.

## Moteurs et adversaires

Les règles et les politiques IA sont des fonctions pures distinctes sous `server/src/domain/arcade/`. Les identités de jeu sont `MEMORY`, `CONNECT_FOUR`, `TIC_TAC_TOE` ; difficultés `EASY`, `MEDIUM`, `HARD`. Règles et barème portent une version, initialement **1**. Le serveur tire une seule fois le premier participant, à chances égales, puis conserve ce choix et l'état de son RNG privé. Aucun retry ne retire un coup ou le premier joueur.

### Memory

Grille 6×6 : dix-huit personnages distincts du catalogue actif disposant d'au moins un chemin portrait, chacun exactement deux fois. Le serveur fige nom, élément, chemins et identités des paires à la création. Moins de dix-huit portraits rend Memory explicitement indisponible. Le rendu réutilise `CharacterPortraitFrame` et ses fallbacks, sans nouveau téléchargement ni génération d'assets.

Deux cartes différentes par tour ; une paire est attribuée au participant et lui permet de rejouer. Un échec garde les deux cartes visibles au moins 700 ms côté serveur, puis un avancement les cache et change le tour. Les cartes acquises ne sont plus jouables. Les dix-huit paires attribuées terminent naturellement la partie ; plus de paires gagne, 9/9 donne une égalité. Aucun aperçu initial.

L'IA reçoit uniquement les positions disponibles, ses observations et les cartes visibles. **Elle ne reçoit jamais les faces cachées du moteur.** Chaque révélation de l'un ou l'autre participant nourrit ses observations ; la première carte peut guider le second choix. Paramètres centralisés :

| Difficulté | Observations conservées | Exploitation d'une paire connue |
| --- | ---: | ---: |
| Facile | 6 | 50 % |
| Moyen | 18 | 85 % |
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

## Points, score et XP

`performancePoints` est le résultat du barème pur versionné. À **chaque fin naturelle**, `scoreAwarded = performancePoints`. `xpAwarded = performancePoints` uniquement pour la première partie terminée de ce jeu, de ce Player et de cette date métier Europe/Paris, sinon zéro. Toutes les difficultés partagent ce quota. Une défaite ou égalité le consomme aussi. Ouvrir, interrompre, reprendre ou consulter ne le consomme jamais.

| Jeu / résultat | Facile | Moyen | Difficile |
| --- | ---: | ---: | ---: |
| Memory défaite (0–8 paires) | 1–2 | 1–4 | 1–6 |
| Memory égalité (9 paires) | 3 | 5 | 7 |
| Memory victoire (10–18 paires) | 4–6 | 6–8 | 8–10 |
| Puissance 4 / Morpion défaite | 2 | 3 | 4 |
| Puissance 4 / Morpion égalité | 3 | 5 | 7 |
| Puissance 4 / Morpion victoire | 6 | 8 | 10 |

Interpolation Memory entière : `minimum + floor((maximum − minimum) × progression / 8)`, progression = paires en défaite, paires − 10 en victoire. Victoire > égalité > défaite dans chaque difficulté ; plus de paires ne réduit jamais les points. Ni vitesse réseau, ni horloge client, ni durée de jeu dans le barème.

Plafond 10 XP par jeu, 30 XP Arcade par jour ; les scores n'ont pas de plafond quotidien. Exemple : première victoire Difficile Puissance 4 = **+10 score / +10 XP** ; suivante le même jour = **+10 score / +0 XP**. L'UI indique « Partie libre — score disponible, XP du jour déjà obtenue ». Score cumulatif sans saison/reset, non achetable, non dépensable, non convertible, sans récompense de classement. Le total Arcade est toujours la somme calculée des trois scores, jamais un second compteur stocké.

## Persistance, reprise et transaction

Une session ACTIVE maximum par Player/jeu. Impossible d'en créer une nouvelle ou de changer sa difficulté avant sa fin. Aucun abandon rémunéré, endpoint de finalisation libre ou expiration donnant un résultat fictif. IA et dissimulation progressent par actions explicites versionnées, uniquement quand l'écran est actif ; aucune progression de fond au GET.

Le dernier coup naturel finalise immédiatement. Date métier prise **à cette finalisation**, même si la partie a commencé avant minuit. Le résultat et son receipt gardent cette date après minuit ; un replay ne crée jamais le grant du nouveau jour.

`ArcadeService` authentifie/résout le Player actif, verrouille Player puis réutilise les propriétaires XP/économie dans une transaction SERIALIZABLE avec quatre essais maximum sur conflit concurrent. Le résultat terminal, record, compteurs, score, grant quotidien, progression, soldes, ledger, Missions et receipt sont atomiques. Une panne après les écritures récompenses les annule toutes. Les contraintes SQL doublent les gardes applicatives.

Chaque mutation impose UUID d'idempotence + version attendue. Receipt exact : réponse persistée rejouée avec `alreadyProcessed=true`. Même clé avec autre intent : 409. Autre clé sur ancienne version : 409 ; coup illégal : 400 ; session d'autrui : 404. Le start exige la dernière session connue (`previousSessionId`, ou null) et `expectedVersion=0`, afin qu'un ancien start ne recrée pas silencieusement une partie. Aucun score, résultat, plateau, timestamp ou gain fourni par le client n'est accepté.

Le frontend protège double clic et requêtes concurrentes, conserve l'intent ambigu pour réessayer exactement, ignore les versions antérieures et recharge l'état courant après replay. Les timers/listeners sont nettoyés au démontage/logout ; changement de jeu conserve les sessions. Chargement à l'entrée et revalidation focus/reprise, sans polling global ni appel sur frames/mouvements souris.

## Propriétaire XP et feedback

`PrismaPlayerXpService.grant` applique `planPlayerXpGrant`, récompenses de niveaux et overflow, économie et Missions normales. Arcade n'incrémente ni messages, ni messages comptés, ni cooldown Chat. Une partie libre ne fait **aucun appel grant(0)** : zéro effet de progression, économie ou Missions.

La réponse récompensée contient les vrais snapshots progression/ressources et les récompenses effectivement accordées. `publishProgressionUpdate` et la file `LevelUpFeedback` existantes présentent niveaux multiples et paliers d'overflow au niveau 100. Dédoublonnage par opération ; lecture d'un ancien résultat/replay = aucune nouvelle modale. Un replay recharge les snapshots actuels au lieu de rétablir d'anciens soldes. Le bilan score/XP reste inline. Records se ferme devant les feedbacks prioritaires du shell.

**Aucun nouveau producteur Notification Arcade, level-up ou tutoriel.** Les notifications Missions normales peuvent naître d'une vraie complétion causée par l'XP, selon R954–R955. Découverte/tutoriel reste à son étape dédiée. Aucune récompense monétaire directe Arcade ; seules les récompenses normales du propriétaire progression peuvent accompagner l'XP.

## Records, classement et confidentialité

- Personnel : meilleurs points/résultat et paires Memory par jeu/difficulté, compteurs terminés et V/E/D, score par difficulté et score du jeu. Aucun record fictif avant une partie finie.
- Global : une seule meilleure performance par Player/jeu/difficulté ; points décroissants, puis paires Memory décroissantes. Un moins bon résultat ne remplace pas le record.
- Score : Memory / Puissance 4 / Morpion / Total ; addition des difficultés, score décroissant. Le cumul reflète aussi le nombre de parties.

Identité publique et seuls Players ACTIVE avec élément, confidentialité existante **GENERAL_STATISTICS = PUBLIC** (défaut Social appliqué si aucune ligne). FRIENDS/PRIVATE exclus du tableau global, sans modifier Social. Pas d'email, subject Auth, receipts ou session privée. Les scores et compteurs BigInt sont des chaînes décimales jusque dans le frontend.

Égalités de performance : rangs compétition **1,1,3** ; UUID Player secondaire stable pour l'ordre et la pagination, sans casser les ex aequo. Dix lignes/page, placeholders en page partielle. Le serveur renvoie rang, position physique, selfPage, statut classé et pagination. Ouverture/changement de catégorie sur la page contenant le joueur ; calcul par index physique, jamais par rang. Navigation manuelle conservée à Actualiser. Ligne propre signalée par fond/bordure et « Vous ». Non classé : page 1, explication, aucune ligne inventée.

## API authentifiée

| Méthode / route | Contrat |
| --- | --- |
| GET `/api/v1/arcade` | Dernière session de chaque jeu, scores, records personnels, quotas de la date courante ; lecture seule |
| GET `/api/v1/arcade/sessions/:sessionId` | Session possédée, projection sûre ; lecture seule |
| POST `/api/v1/arcade/sessions` | `{game,difficulty,expectedVersion:0,previousSessionId,idempotencyKey}` |
| POST `/api/v1/arcade/sessions/:sessionId/actions` | `{kind:'MOVE',position,expectedVersion,idempotencyKey}` ou `{kind:'ADVANCE',expectedVersion,idempotencyKey}` |
| GET `/api/v1/arcade/records` | `kind=GLOBAL|SCORE`, `game`, difficulté, page optionnelle ; TOTAL réservé à Score |

Les objets sont stricts (champs inconnus rejetés). Les mutations renvoient session/summary/operationId/alreadyProcessed/award ; `award=null` hors fin donnant de l'XP. `ARCADE_TOO_EARLY` préserve le délai serveur d'affichage, sans crédit ni nouveau tirage.

## Schéma et limites opérationnelles

Migration additive **`20261001010000_057_add_arcade`** : `arcade_sessions`, `arcade_receipts`, `arcade_daily_grants`, `arcade_stats`. Session = autorité du résultat ; pas de table miroir. Index partiel d'une ACTIVE/Player/jeu ; PK grant Player/jeu/date ; unicité finale/receipt/opération ; PK stats Player/jeu/difficulté, CHECK et FK ; RLS activée, tous privilèges PUBLIC/anon/authenticated révoqués. Accès uniquement via backend autorisé.

Les 57 migrations ont été déployées et contrôlées par **Prisma migrate deploy/status dans un schéma privé isolé**. Au checkpoint de review préalable à la promotion, la base publique est à 056 ; 057 est versionnée, approuvée et prête pour le `preDeploy` Railway déclenché par la promotion `main`. Seuls les logs Railway puis une lecture PostgreSQL peuvent prouver son application publique. Aucun fixture/gameplay public ni registre Prisma modifié manuellement pendant le développement du candidat.

Les preuves d'idempotence, grants et résultats restent durables. [Rétention V1](data-retention-v1.md) : aucune purge d'ancienneté décidée pour Arcade ; aucun scheduler de purge ajouté. Une future rétention ne devra jamais supprimer les gardes de double crédit.

Garanties anti-automatisation limitées aux règles autoritaires, versions, quotas XP, délais de transition et concurrence. Pas de CAPTCHA, détection comportementale, sanction, plafond score caché ou preuve d'humanité. Une automatisation de coups légaux reste possible ; cette V1 n'annonce pas l'empêcher. Pas de PvP, Twitch, API IA, achat, upload, Admin reset/score, lore, Tutoriel ou refonte d'un autre domaine.

## Contrôles du candidat

Tests moteurs/IA/barème, routes strictes, frontend/reprise/Records/overflow et PostgreSQL privé : secrets, snapshots catalogue figés, quotas/pertes/égalités, score libre, minuit, concurrence, replay, rollback après récompenses, XP propriétaire, overflow/Missions, bigint, rangs et confidentialité. Les tests d'intégration utilisent des fixtures privées proches de la fin ; les fins naturelles des moteurs sont aussi testées séparément.

Inspection navigateur locale dans **GameShell avec `index.css` et `App.css` réels**, sans réseau public : 2560×1440, 1920×1080, 1366×768 et 390×844 ; trois plateaux, Records Personnel/Global/Score, pages pleines/partielles/vides, Escape et restitution du focus. Le petit desktop emploie le scroll interne du plateau ; aucun débordement horizontal observé. La collision initiale avec la grille générique du shell a été corrigée dans le CSS Arcade. La review indépendante est acquise ; l'équilibrage ressenti et les tests utilisateur publics restent à valider par le propriétaire après promotion technique.
