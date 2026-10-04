# Arcade V1 — solo étape 23, multijoueur étape 28

## Multijoueur Arcade — étape 28

Étape 28 **VALIDÉE / CLÔTURÉE PAR LE PROPRIÉTAIRE** sous R1034 : lot 6d2ac46 et micro-correctif 8696c1a3 promus via 6d61a9b, déploiement Railway exact SUCCESS/Online Amsterdam, 60 migrations/060, Application ready et health 200 reçus. Recette finale publique acquise : reset Quotidiennes, refus silencieux/invitation seule notification, Rejouer PvP vers SOLO, nouvelle invitation humaine manuelle et rewards overflow explicites sans troncature. Les acquis trois jeux/trois difficultés/invitations/présence/start hors écran/sessions partagées/navigation/rejoin/score des deux/0 XP/Quitter/polling sont conservés. État et preuves au [Master](../master/PROJECT_MASTER_PLAN.md) ; observations rares acceptées en bêta/non bloquantes, sans tests inventés. Historique solo préservé sans attribuer rétroactivement le PvP à R970–R1006.

### Interface et adversaires

Même ScreenId `activities-arcade`, même destination Arcade du Menu, mêmes trois jeux, trois difficultés et plateaux. La colonne gauche desktop reçoit le bloc compact `Jouer contre :`, select, `Amis seulement`, boutons `Prêt/Annuler` et `Refuser` toujours présents. Leur largeur réserve Annuler ; centre et citation solo conservent leur géométrie. Sous le breakpoint de l'arène, le bloc précède le plateau dans le flux. Règles et Records restent accessibles pendant une invitation et une partie.

Le select expose seulement `id`/`displayName` et affiche le pseudo. Le backend exclut soi-même, profil non ACTIVE, élément invalide, AWAY/OFFLINE, présence privée ou bloquée dans les deux sens, toute session ACTIVE solo/partagée et toute invitation PENDING vivante entrante/sortante. Il consulte le service commun Presence/Privacy ; Presence ne dépend pas d'Arcade. `friendsOnly` est un filtre serveur d'amitié ACTIVE, temporaire à l'écran, false par défaut, sans préférence persistée ni détail de relation projeté.

Une sélection seule ne crée rien. Sans cible, Prêt/Refuser sont désactivés. Avec cible, Prêt crée une invitation pour le jeu et la difficulté courants. PENDING sortante : select/checkbox/jeux/difficulté/Commencer sont verrouillés ; Annuler actif, Refuser inactif. PENDING entrante, découverte même par entrée manuelle : jeu/difficulté forcés, select/checkbox/jeux/Commencer verrouillés, Prêt et Refuser actifs.

### Invitation, notifications et démarrage

L'hôte est prêt dès la création. Un seul `ARCADE_INVITE` actionnable est envoyé à l'invité : `<Pseudo> vous invite à jouer à <Nom du jeu>.`, payload invitationId/hostPlayerId/game/difficulty et action `OPEN_ARCADE_INVITE`. Le clic ouvre Arcade et archive cette notification ; seul l'overview autoritatif force un contexte vivant. Un lien périmé/inexistant ouvre normalement Arcade, sans faux bouton Prêt ni erreur. Voir le [cycle Notifications](notifications-v1.md).

Transitions atomiques : `PENDING → STARTED / REFUSED / CANCELLED / EXPIRED / INVALIDATED`. Prêt de l'invité crée immédiatement la session partagée, même si l'hôte est hors écran ; aucun second accord de l'hôte, retour forcé, notification d'acceptation ou démarrage. Annuler et Refuser sont silencieux ; aucune nouvelle Notification persistante, aucun toast global ni message Chat. L'hôte découvre la résolution par overview/poll. R1029 révisée après recette : ARCADE_INVITE reste le seul producteur, ARCADE_INVITE_REFUSED supprimé. Expiration exactement deux minutes après création : libération des deux, aucune session/XP/statistique ni notification supplémentaire. Expiration et invalidation par blocage/inactivité sont réconciliées à la lecture Arcade/Notifications et aux mutations. Tous les états terminaux résolvent l'ancienne invitation actionable ; une référence absente ne conserve pas de ligne actionable.

ONLINE est vérifié à l'invitation, avec confidentialité, blocages et occupation relus sous verrou. Une fois réservés, navigation/AWAY/OFFLINE ne l'annulent pas. Blocage ou inactivité avant Prêt invalide proprement l'invitation au prochain accès/mutation. Aucun remplacement bot, matchmaking, lobby, spectateur, chat, ELO ou timeout de tour.

### Session, tours et résultats

Une `ArcadeSession` MULTIPLAYER a un hôte `playerId` et un invité `opponentPlayerId`. Côtés canoniques internes PLAYER/AI = A/B ; le côté AI ne désigne pas une IA dans ce mode. Les DTO explicites projettent mode, participants (id/pseudo), viewerSide, opponent, invitation entrante/sortante, échéance et ready. Aucun email/auth subject, session de présence, RNG, observation Memory ou face cachée n'est transmis.

Le premier côté est tiré une seule fois et persisté. Pseudonymes/couleurs cyan et violet sont fixes pour les deux clients, avec identification accessible de soi. Aucune citation/automate IA en multijoueur ; la colonne droite peut rester structurellement vide. Le serveur autorise MOVE seulement au participant dont viewerSide égale le tour courant ; aucun résultat, côté, score ou plateau envoyé par le client. `chooseMemoryCard`, alpha-bêta et timers de coups IA restent exclusivement SOLO. Memory conserve tailles, faces sûres, paires et barème versionné ; une paire conserve le tour, un échec reste révélé 500 ms en MULTIPLAYER (700 ms SOLO conservées). L'un ou l'autre humain peut ADVANCE pour cacher les cartes après ce délai ; une concurrence réussit une fois et l'autre client rafraîchit silencieusement. Aucune progression humaine hors écran.

Fin naturelle : un résultat canonique versionné dérive WIN/LOSS/DRAW et les points propres de chaque joueur, y compris ses propres paires Memory. Les deux gagnent leur score dans les agrégats/Records existants ; aucune statistique PvP ou leaderboard séparé. **XP multijoueur = 0**, sans appel au service XP, daily grant, quota consommé, LevelUpFeedback, récompense, overflow, économie ou Mission. Une prochaine partie solo peut encore utiliser son quota quotidien. Le footer conserve cette disponibilité.

Quitter par l'un ou l'autre abandonne la session partagée ; les deux reviennent à la présentation initiale au prochain refresh. Aucun gagnant/perdant, score, played/win/draw/loss, record, XP/grant/quota/récompense/Mission/notification. Quitter concurrent avec le dernier coup donne un seul terminal : FINISHED naturel ou ABANDONED, jamais les deux. R1030 révisée après recette : Rejouer après FINISHED MULTIPLAYER démarre une nouvelle partie SOLO contre l'IA, même jeu/difficulté, via arcade.start et previousSessionId/nouvelle clé. Sans opponent, invitation, notification ni besoin que l'ancien adversaire soit ONLINE/libre. Le résultat PvP reste enregistré avec score/0 XP ; le nouveau solo conserve firstSide aléatoire, banter/IA, scoring, quota/XP/grant normaux, sans XP rétroactive. Après résultat, Jouer contre reste disponible indépendamment : nouveau PvP uniquement par sélection manuelle + Prêt, sans présélection obligatoire de l'ancien adversaire.

### API, persistance et synchronisation

Migration additive **060** : mode/opponent sur sessions, table `arcade_invitations`, cible invitation nullable sur les receipts (session nullable pour les actions sans partie). FK restrictives, CHECK de modes/XP zéro/ready/terminaux/échéance, index partiels ACTIVE et PENDING par rôle. RLS activée, aucun accès client Data API. 057/058/059 ne sont pas modifiées. Le contrôle de l'exclusivité croisée reste sous verrous Player triés par UUID : une seule session ACTIVE solo/partagée ou invitation PENDING entrante/sortante par Player. Transactions Serializable avec retry borné ; session/résultat/score/opération/receipt restent atomiques.

API authentifiée : `GET /api/v1/arcade`, session/records existants ; `GET /api/v1/arcade/opponents?friendsOnly=true|false` ; `POST /api/v1/arcade/invitations` (opponentPlayerId/game/difficulty/friendsOnly, idempotencyKey) ; `POST /api/v1/arcade/invitations/:id/actions` (READY/CANCEL/REFUSE, clé UUID). START SOLO existant sert aussi Rejouer après PvP, sans nouvel endpoint. L'ancien champ de revanche est retiré du type frontend, du schéma strict API, de l'input/fingerprint backend et de toute validation spéciale. Une invitation suit toujours le contrat normal ; envoyer l'ancien champ produit HTTP 400 / VALIDATION_ERROR. MOVE/ADVANCE/QUIT conservent expectedVersion et clé UUID. Intents stricts : mêmes clé/intent rejouent le receipt, autre intent conflit ; ambiguïté réseau réessaie la même clé. Invitations croisées, Ready/cancel/refuse/expiry, doubles Ready/coups/START et Quitter/fin partagent les mêmes verrous et revalidations.

Synchronisation HTTP promue : overview autoritatif publié dès sa réponse, séparé des opponents (2500 ms en idle, focus/filtre/résolution/retour). Une seule lecture en vol par flux, isolation Player/filtre, pas de découverte pendant invitation/session ACTIVE ; erreur opponents locale sans effacer la partie ni bloquer le solo. INVITE/CANCEL/REFUSE appliquent immédiatement la réponse serveur et libèrent pending ; READY STARTED contient la session projetée pour le viewer, publiée immédiatement sans second GET bloquant. Revalidation overview/opponents en arrière-plan ; 409/stale/ambiguïté conservent la relecture autoritative et la même clé. Polling visible : MULTIPLAYER ACTIVE 600 ms, PENDING 900 ms, IDLE 2500 ms, SOLO ACTIVE sans polling supplémentaire. Hidden/écran démonté : aucun poll ; retour focus/visible : refresh immédiat. Backoff exponentiel jusqu’à 16 s, nominal rétabli au succès ; flux coalescés sans chevauchement. Memory PvP REVEAL serveur 500 ms ; client attend nextActionAt avec marge 80 ms et minimum 60 ms, sans floor 750 ms. SOLO conserve 700 ms serveur et minimum 750 ms client/timers IA. Aucune face HIDDEN anticipée ni optimisme avant confirmation serveur. Aucun SLA Internet fixe promis. Rechargement/navigation conservent l’état serveur ; pas de WebSocket/Realtime/nouvelle infrastructure payante/Twitch. Railway Hobby existant est autorisé selon le registre limité à son périmètre du Master ; aucune autre dépense autorisée implicitement.

## Solo — contrat et historique préservés

Source canonique du domaine, décisions propriétaire **R970–R990, R991–R994 puis R999–R1001/R1003** du 01/10/2026. Étape 23 validée publiquement dans le périmètre du [Master](../master/PROJECT_MASTER_PLAN.md) : dernier polish b373aa2 promu au checkpoint `2aa086edddcde8de8325f4e999c1e41d7d9e3976`, contrôles techniques antérieurs acquis et dernier smoke propriétaire R1004 confirmé sur layout, Quitter, Règles, Puissance 4 et Records. Micro-polish résiduel R1006 candidat review dans le lot étape 24 ; aucun changement score, XP, IA, sessions, barème, privacy ou DB/migration. Repère DB de ce checkpoint solo historique : 058, avant 059 ; le Master porte le public courant. Les anciennes pistes Réflexes / séquence Mémoire / jauge Précision sont abandonnées.

R1006 : la citation reste à droite, centrée verticalement, en italique et entre guillemets. Son texte gagne l'espace libre vers la gauche, avec wrap naturel, sans agrandir/rétrécir le plateau selon la longueur. Les onglets de jeu retirent localement la translation `translateY(-1px)` du hover global, reproduite avant correction sur boutons déverrouillés ; couleur/bordure et focus restent visibles dans leur cadre. Aucun AppButton global modifié ; Commencer/Rejouer en bas et contrôles supérieurs conservés.

## Surface et navigation

`Activités > Arcade`, `#activities/arcade`, entre Événement et Concours. Une coque commune propose Memory, Puissance 4 et Morpion, difficulté Moyen par défaut, joueur/adversaire, plateau, statut, bilan inline, Commencer/Rejouer ou Quitter, scores et quota du jour. Aucun démarrage au GET ou au changement d'onglet. Une seule partie ACTIVE globale sélectionne son jeu et verrouille difficulté et trois boutons de jeux, sans clignotement réseau. Entrée, reload et retour navigateur reprennent automatiquement l'état serveur ; retour Records/feedback reprend la boucle locale. Pas de Pause/Reprendre. Les timers s'arrêtent hors écran/onglet visible et devant les modales ou feedbacks.

Aucune carte Quotidiennes, entrée principale/Menu, modification Accueil/sidebar/DailyTracker, renommage Entraînement Combat ou historique détaillé. `Records →` ouvre Personnel / Global / Score, sans les trois anciennes notes explicatives et avec sous-onglets Score plus petits. `Règles & gains` ouvre une modale Général/Memory/Puissance 4/Morpion avec règles et tableaux de gains, sans déplacer le plateau. Escape, croix, backdrop, piège et restitution du focus réutilisent `useModalDialog`. À 1920×1080 et 2560×1440, toute la surface utile Arcade tient sans scroll interne ; le body garde un scroll borné sur petit desktop et le document un flux naturel mobile. Les modales possèdent leur body défilant.

Présentation R999–R1001/R1003 : seul le h1 accessible Arcade est conservé ; le contexte visuel vient d'Activités > Arcade. Dans l'arène, Quitter occupe une zone supérieure stable à gauche pendant ACTIVE, même durant ADVANCE ou retry ; Règles & gains et Records sont compacts à droite. Commencer/Rejouer restent centrés en bas. Les labels Cercle cyan/Symbole violet et les chiffres visibles des colonnes Puissance 4 disparaissent (aria-labels numérotés conservés), les compteurs Memory restent. La zone résultat est vide sans résultat, sans ligne Partie libre ; le footer affiche seulement XP du jour obtenue/disponible. Citation en italique entre guillemets, centrée verticalement à côté du plateau. Taille des plateaux bornée par largeur et hauteur disponibles (`cqh`), avec croissance sur grand écran ; sous-onglets Score de style secondaire neutre, plus petits que les onglets principaux.

Règles Général : cartes « XP par jour » / « Jusqu’à 10 XP par jeu » / « 30 XP maximum », « Parties suivantes » / « Score uniquement. Obtenable à l’infini. » / « Deviens le plus fort de tes amis ! », « Interruption » / « La partie se conserve tant qu’elle n’est pas terminée. » / « Impossible de jouer à un autre jeu tant qu’une partie n’est pas finie. », et abandon sans score ni XP. Les deux paragraphes inférieurs sont retirés. Memory conserve les tailles et la mémoire observée, sans exposer les pourcentages internes d'exploitation ; les politiques physiques ci-dessous restent inchangées.

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

Le frontend protège double clic et requêtes concurrentes. Une mutation ambiguë est retentée automatiquement **une fois**, avec exactement les mêmes sessionId/position/version/clé ; une deuxième ambiguïté déclenche un GET. Un état autoritaire plus avancé permet de reprendre sans inventer de récompense ni attribuer à ce GET un receipt ; sinon une erreur discrète et Actualiser remplacent le bouton de retry technique. Un replay recharge aussi l'état courant. Quitter suspend les nouveaux timers dès l'ouverture de la confirmation, cible l'identité de la session, attend la mutation en vol, relit la session et utilise sa version courante si elle reste ACTIVE. Une fin naturelle ou une autre session ne reçoit pas de QUIT. Les gardes serveur restent inchangées. Les timers/listeners sont nettoyés au démontage/logout. Chargement à l'entrée et revalidation focus/retour visible ; aucune nouvelle action pendant ce rechargement, sans polling global ni appel sur frames/mouvements souris.

## Propriétaire XP et feedback

`PrismaPlayerXpService.grant` applique `planPlayerXpGrant`, récompenses de niveaux et overflow, économie et Missions normales. Arcade n'incrémente ni messages, ni messages comptés, ni cooldown Chat. Une partie libre ne fait **aucun appel grant(0)** : zéro effet de progression, économie ou Missions.

La réponse récompensée contient les vrais snapshots progression/ressources et les récompenses effectivement accordées. `publishProgressionUpdate` et la file `LevelUpFeedback` existantes présentent niveaux multiples et paliers d'overflow au niveau 100. Avec des rewards serveur, la modale affiche explicitement « Récompenses : » suivi des montants formatés par levelUpRewardLabel, avec retour à la ligne local sans ellipsis desktop/mobile. Un ou plusieurs paliers niveau 100 affichent tous les totaux effectivement reçus, sans calcul ni choix élémentaire frontend ; raccord Arcade et Gacha/Cryo conservés. Durée/fade 5,4 s et verrou de fermeture 1 s inchangés. Dédoublonnage par opération ; lecture d'un ancien résultat/replay = aucune nouvelle modale. Un replay recharge les snapshots actuels au lieu de rétablir d'anciens soldes. Le bilan score/XP reste inline. Records se ferme devant les feedbacks prioritaires du shell.

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

057 est publique depuis la promotion `81066ba`. La migration **`20261001120000_058_harden_arcade_session_lifecycle`**, désormais publique au checkpoint `f13f90d`, étend statut/versions/CHECK terminal et remplace l'index actif par Player seul. Son DDL est transactionnel et échoue en cas de plusieurs ACTIVE, sans réécriture ni abandon automatique. Les 58 migrations ont été testées par **Prisma migrate deploy/status dans un schéma privé isolé** avant leur promotion. Le statut public relu pendant le dernier polish est à jour sur 058 ; aucune migration candidate ni 059. Aucune fixture/gameplay publique ni écriture manuelle du registre pendant ce polish.

Les preuves d'idempotence, grants et résultats restent durables. [Rétention V1](data-retention-v1.md) : aucune purge d'ancienneté décidée pour Arcade ; aucun scheduler de purge ajouté. Une future rétention ne devra jamais supprimer les gardes de double crédit.

Garanties anti-automatisation limitées aux règles autoritaires, versions, quotas XP, délais de transition et concurrence. Pas de CAPTCHA, détection comportementale, sanction, plafond score caché ou preuve d'humanité. Une automatisation de coups légaux reste possible ; cette V1 n'annonce pas l'empêcher. Pas de PvP, Twitch, API IA, achat, upload, Admin reset/score, lore, Tutoriel ou refonte d'un autre domaine.

## Contrôles des candidats Arcade antérieurs

Tests moteurs/IA/barème, routes strictes, frontend/reprise/Records/overflow et PostgreSQL privé : secrets, snapshots catalogue figés, quotas/pertes/égalités, score libre, minuit, concurrence, replay, rollback après récompenses, XP propriétaire, overflow/Missions, bigint, rangs et confidentialité. Les tests d'intégration utilisent des fixtures privées proches de la fin ; les fins naturelles des moteurs sont aussi testées séparément.

Inspection du dernier polish dans Chromium local, **GameShell avec `index.css` et `App.css` réels**, données synthétiques et réseau externe bloqué : 2560×1440, 1920×1080, 1366×768 et 390×844 ; Memory trois tailles et fini, deux alignements, règles Général/Memory, Records Score et confirmation Quitter. Body Arcade : **737/737 px à 1920 et 1097/1097 px à 2560** (scrollHeight/clientHeight), cinq plateaux sans débordement ; plateau inchangé à l'ouverture des règles. Memory Moyen grandit de **555×555 à 620×620 px**. Quitter, Rejouer et footer restent visibles sur ces deux formats. Le petit desktop conserve un scroll borné (500/425 px), mobile un flux vertical. Captures inspectées ; sous-onglets Score neutres de 30 px contre 36 px pour les principaux. La review indépendante de ce dernier polish est acquise sur b373aa2 ; le dernier smoke visuel propriétaire est désormais acquis dans le périmètre R1004 après promotion technique. Les mesures de ce paragraphe restent celles du polish antérieur.


## Contrôles du micro-polish R1006

Le lot étape 24 corrige uniquement les onglets et la citation. Mesures locales GameShell réel sur quatre formats : trois jeux Moyen finis, répliques courtes/longues, taille des plateaux identique ; hover relatif 0 px, focus conservé et aucune superposition desktop (gouttière minimale 6 px). Petit desktop avec scroll borné, mobile en flux naturel. Preuves et limites dans [Accueil et suivi Quotidiennes](home-daily-tracker-v1.md#inspection-locale-et-stabilité-géométrique) ; candidat review seulement, sans nouveau smoke public de ces ajustements.
