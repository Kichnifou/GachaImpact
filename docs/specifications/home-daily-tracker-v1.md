# Accueil dynamique et suivi Quotidiennes — étape 24

## Retouches Sidebar/Home 25A — recette publique finale acquise

Le propriétaire confirme la recette publique finale du correctif 25A sur **a23a42304da7396da2ceeaa5a1e245a79310cec1** : Précédent, ordre des contrôles et Suivant stable ; carte sidebar entière cliquable avec ses contrôles indépendants ; titre Home simple, hauteur Quotidiennes/BannerHero et splash recentré. Les validations publiques Pause/reprise/persistance, Terminer/replay, responsive et Invocation normale acquises sur 9aef02c sont conservées. **25A est clôturée dans son périmètre réel de prototype**. Cette preuve propriétaire est transmise par la mission, sans nouvelle vérification de déploiement Railway/Cloudflare ni mutation publique ici. **Aucune nouvelle retouche Home dans 25B** : seules des ancres de présentation sont raccordées aux composants existants ; état courant du Tutoriel au [Master](../master/PROJECT_MASTER_PLAN.md).

- Sidebar : titre `[position/total]` conservé. Plus aucun bouton Accéder/Récupérer dans le centre ; bouton sibling couvrant la carte avec label explicite, destination/claim partagé via run(), disabled en unknown/error/sans destination/lock. ×, ↺, ‹, Tout voir, › ont leur couche propre et restent indépendants au clic/clavier ; aucun bouton imbriqué, focus du cadre et hover seulement actionnable. La collision action centrale/navigation devient structurellement impossible.
- Home : titre toujours **Quotidiennes**, sans plage ni seconde ligne. Liste dailyActionableSuggestions et trois cartes maximum inchangées, cartes confirmées toujours gelées pendant claim/pending/feedback ; total retiré du state de présentation. Ongoing et restoreAll inchangés.
- Footer Home rendu seulement pour erreur/feedback ou activités masquées ; aucune réserve vide permanente. La grille minmax(0,1fr) + auto conserve le bord inférieur du résumé et attribue la hauteur libérée au BannerHero. Mobile reste en flux naturel.
- Artwork compact : taille conservée à 1,22, object-position et origine recentrés ; contain sur desktop, contain/bas sur mobile. Inspection Skirk réelle, texte lisible et tête conservée ; Invocation normale inchangée, aucun footer Invocation/Pull/Changer.

Chromium local GameShell/CSS production aux formats 2560×1440, 1920×1080, 1366×768 et 390×844, Team 4/4, Skirk réelle, Chat ouvert et Expédition RUNNING : plusieurs/une/aucune + ongoing/terminées/erreur, carte au clavier, claim partagé simple envoi, contrôles indépendants, masques/restoreAll et footer feedback/erreur contrôlés. Aucun overflow horizontal ; résumé desktop intrinsèque sans scroll en contenu normal, mobile en flux document. Comparaison locale aux règles CSS et au footer de la base 9aef02c :

| Format | Quotidiennes avant → après | BannerHero avant → après |
| --- | --- | --- |
| 2560×1440 | 320,938 → 284,938 px | 906,063 → 942,063 px |
| 1920×1080 | 320,938 → 284,938 px | 546,063 → 582,063 px |
| 1366×768 | 268,938 → 238,938 px | 286,063 → 316,063 px |
| 390×844 | 467,938 → 435,938 px | 475 → 475 px, flux naturel |

Géométrie, object-fit, object-position et transform du mode Invocation normal comparés à la base et inchangés aux quatre formats. Captures inspectées localement ; ces contrôles synthétiques ne remplacent pas la recette publique du correctif.

Contrôles du correctif : ciblés frontend PASS 155/155, dont carte native et contrôles indépendants, inactivation, titre simple et gel des cartes, footer conditionnel. Dernier verify:full PASS 8/8 : frontend 1192/1192, backend hors DB 1099/1099, typechecks/builds/lint et diff-check ; verify:quick PASS 5/5. Aucun changement des règles quotidiennes, du backend, du schéma ou des dépendances.

## Historique — retouches UX A–E approuvées et promues avec 25A du 02/10/2026

A–E sont implémentées, contrôlées localement et approuvées indépendamment avec [25A Tutoriel](tutorial-v1.md) sur a30e7e9. **État post-fast-forward : promues sur main ; déploiement technique à vérifier et validation publique Axel non acquise** ; le smoke acquis sur 268c687 reste limité à la version antérieure. Décisions durables R1021/R1022 au [journal](decisions-log.md) ; état Git et prochaine action au [Master](../master/PROJECT_MASTER_PLAN.md).

- A : `Quotidiennes [position/total]`, index 1-based de la sélection réelle dans tracker.suggestions ; masques, LIFO et total suivis. Sans suggestion, titre simple. La seconde ligne permanente disparaît ; tracker.message reste dans l'état vide utile.
- B : liste complète dailyActionableSuggestions après masques, trois premières cartes maximum ; titre `[1/1]`, `[1–2/2]` ou `[1–3/6]`. Aucun ongoing ni taux de complétion. Cartes **et total** partagent le gel claim/pending/feedback. La seconde ligne sous le titre disparaît ; en absence d'action, le message central conserve notamment attente/incomplet.
- C : centre flex `space-evenly` selon la hauteur réellement disponible ; petits formats compacts, header/footer stables, aucun changement global AppButton.
- D : grille desktop BannerHero minmax(0,1fr) + résumé auto ; résumé aligné en bas, intrinsèque, sans flex vide sous les cartes. Le scroll exceptionnel du résumé reste borné, mobile en flux naturel.
- E : artwork existant compact agrandi de 22 %, origine à droite ; desktop contain, mobile contain/70 % de la région et origine bas-droite après inspection réelle pour conserver la tête. Texte lisible, aucun footer Invocation/Pull/Changer, clic global conservé. Aucun sélecteur du mode Invocation normal modifié.

Chromium réel avec GameShell/CSS production, Team 4/4, cible Keqing réelle, Communauté, scénarios plusieurs/une/aucune + ongoing/terminées/erreur, masques/LIFO et claim avec gel : **32 états UX aux quatre formats**, sans chevauchement ni overflow horizontal. Résumé desktop sans scroll en contenu normal (`scrollHeight = clientHeight`), bord inférieur aligné au Home ; document propriétaire du scroll mobile. Les mesures du scénario plusieurs sans masque sont :

| Viewport | BannerHero | Quotidiennes Home | Gap action → navigation sidebar |
| --- | --- | --- | --- |
| 2560×1440 | 906,063 px | 320,938 px | 171,859 px |
| 1920×1080 | 546,063 px | 320,938 px | 77,578 px |
| 1366×768 | 286,063 px | 268,938 px | 17,438 px |
| 390×844 | 475 px, flux naturel | 467,937 px | 11,297 px |

Sans la seconde ligne Home, la bannière desktop récupère 21 px par rapport aux mesures antérieures du micro-polish. Le cadrage a été inspecté dans les captures réelles, puis corrigé sur mobile. Tests des titres/navigation/masques/LIFO/zéro/ongoing/gel ajoutés ; tests existants BannerHero et navigation conservés/adaptés. Ciblés frontend PASS 138/138 ; suite finale PASS 1175/1175 et verify:full PASS 8/8. Le mode Invocation normal a aussi été comparé dans Chromium aux règles CSS du HEAD de base : géométrie, object-fit, position et transform inchangés aux quatre formats. Les preuves Chromium sont synthétiques/locales, sans mutation publique ; elles ne valent pas validation propriétaire.

## Smoke public acquis et demandes A–E avant implémentation — historique de passation du 02/10/2026

Le dernier micro-polish **b35f988**, approuvé indépendamment, a été promu via **268c68750f5fcb939e6d17b94b18699eb262577b**. Le propriétaire a effectué le smoke public : projection commune, navigation, masques/reload, restoreLast/LIFO, Accueil dynamique/cartes cliquables, BannerHero et Expédition compacts, claim partagé, Sidebar/Home et 2560×1440 validés dans le périmètre des recettes documentées. Validations Administration/Journal/Arcade antérieures conservées ; **aucun défaut métier restant signalé**.

Les cinq retouches suivantes étaient demandées, ouvertes et non implémentées au checkpoint documentaire e941c9a. Elles sont maintenant candidates dans le lot décrit ci-dessus ; le tableau est mis à jour avec la définition Home autorisée par la mission.

| Point | Cible du prochain correctif |
| --- | --- |
| A — titre sidebar | Supprimer la ligne permanente « 6 activités disponibles ». Titre `Quotidiennes [1/6]` : position actuelle sélectionnée dans les suggestions visibles parcourables / total de cette même liste ; suit masques, restauration et vraie sélection. Indicateur de navigation, jamais progression métier. Sans suggestion, `Quotidiennes` ou état compact cohérent, sans `[0/0]` obligatoire. |
| B — titre Accueil | Supprimer la deuxième ligne ; titre `Quotidiennes [1/1]`, `[1–2/2]` ou `[1–3/6]` selon la plage des trois premières cartes actionnables dans la liste complète après masques. Aucun ongoing ni taux de complétion ; total gelé avec les cartes pendant claim/pending/feedback. |
| C — espacement sidebar | Répartir dynamiquement titre / état / action dans le centre selon la hauteur disponible ; petite hauteur compacte, grande hauteur plus aérée. Header/footer restent en place, sans valeurs figées pour 1440p. |
| D — Quotidiennes Accueil plus basses | Desktop : section aussi basse que possible dans la même structure shell, uniquement sa hauteur intrinsèque nécessaire ; toute hauteur libre restante revient à BannerHero. |
| E — splash Home plus imposant | Exploiter davantage la carte comme sur Invocation : personnage plus grand, cadrage propre, sans déformation/crop catastrophique, texte lisible. Conserver bannière compacte, clic global vers Invocation, aucun footer Invocation, Pity ou bouton Pull. |

Le contrat métier ci-dessous reste inchangé ; sa présentation est amendée par le candidat A–E ci-dessus. Reprise globale au [Master](../master/PROJECT_MASTER_PLAN.md). [25A — prototype Tutoriel](tutorial-v1.md), R1015–R1020, est livré dans le même candidat ; Help final différé après validation du prototype.

## Historique — approbation et checkpoint de promotion du dernier micro-polish — 02/10/2026

Approbation indépendante ChatGPT acquise sur **`b35f98819e9402f8f8fe3b333ceab30e1807db38`**, parent exact **`e848ea6f0eaaab021b6baba2400d1ddea84c565b`**. R1014 approuvée techniquement, présentation R1011–R1013 précisée ; aucun correctif code ni nouvelle décision demandé. Un seul checkpoint docs-only sur review, puis fast-forward strict de toute la chaîne autorisée vers main. État post-fast-forward visé : main/review égales, divergence 0/0, retour review propre ; aucun déploiement réussi anticipé.

Avant promotion, registre PostgreSQL public en lecture seule : **58 terminées, 0 inachevée, dernière `20261001120000_058_harden_arcade_session_lifecycle`, aucune 059**. Prisma migrate status : code 0, 58 migrations à jour. Aucun code/migration après b35f988 ; grandes suites et inspection du candidat ci-dessous non relancées pour cette mission. Les contrôles Railway/Supabase/bundle public sont dédiés au SHA final après push main.

Prochaine étape après ces vérifications techniques : **dernier smoke propriétaire Sidebar / Accueil / Aperçu**. Métier étape 24 et étapes 22/23 validés dans leurs périmètres acquis ; finition de b35f988 encore à recetter publiquement. Aucun gameplay, masque réel, claim, mutation publique ou action Twitch par Codex. **STOP ; étape 25 non commencée.**

## Historique — dernier micro-polish UX candidat — 02/10/2026

Base vérifiée par fetch : HEAD/origin/review/origin/main = **e848ea6f0eaaab021b6baba2400d1ddea84c565b**, divergence 0/0, branche review propre, aucun commit inconnu. Un seul commit de micro-polish au-dessus de cette base, review uniquement. Métier publiquement validé ; contrôle technique local du nouveau candidat distinct de sa future recette publique. Prochaine étape : **review indépendante ChatGPT du commit poussé, sans promotion main** ; STOP, étape 25 non commencée.

Le candidat précise R1011–R1013 pour la densité et ajoute uniquement **R1014** pour le contrat durable ↺ = annulation du dernier masque. Aucun domaine, projection métier, priorité, claim, horloge Paris, revalidation, backend, dépendance ou migration modifié ; zéro mutation publique.

## Historique — approbation UX et checkpoint de promotion — 02/10/2026

Review indépendante ChatGPT acquise sur **`865c303a9931acb4cdfba4cebd5dcf80b554e6ff`**, parent exact **`51e0710087a7b807cea5557f5e9db4edd2315892`**. R1011–R1013 acquises techniquement ; étape 24 prête à la promotion strictement autorisée dans cette mission. Un seul checkpoint docs-only suit le candidat, puis toute la chaîne rejoint main/review par fast-forward strict. Aucun correctif code ni nouvelle décision ; suites/inspections ci-dessous non relancées ici.

Avant promotion, Prisma migrate status : code 0, 58 migrations à jour ; registre public en lecture seule : **58 terminées, 0 inachevée, dernière `20261001120000_058_harden_arcade_session_lifecycle`, aucune 059**. Aucune migration dans le candidat. Les preuves du déploiement exact Railway et du bundle public seront contrôlées après le push main, sans résultat anticipé ici.

Prochaine action après ces contrôles techniques : **smoke UX final propriétaire Sidebar / Accueil / Aperçu**. Premier smoke métier et validation 22/23 conservés dans leur périmètre déjà acquis ; finition UX finale non encore validée publiquement. Aucun gameplay, masque utilisateur, mutation publique ni action Twitch par Codex ; STOP, étape 25 non commencée.

## Historique — review indépendante et checkpoint de promotion du 02/10/2026

Approbation ChatGPT transmise par la mission propriétaire sur **`2df4fa154e40fbc4bf6d040f126069e98c9a1901`** et **`52e7a2bbe9ff00e44cb109c1f423f6d8775b05e8`**, parent exact du second : 2df4fa1. R1004–R1010 acquises techniquement ; séparation Actions / En cours, limites trois/deux, masques partagés et absence de duplication acquises. Les étapes 22/23 restent publiquement validées dans leur seul périmètre documenté ; leurs derniers micro-ajustements et l'étape 24 restent à recetter.

Un seul checkpoint docs-only suit 52e7a2b, puis toute la chaîne depuis **`2aa086edddcde8de8325f4e999c1e41d7d9e3976`** est destinée au fast-forward strict main/review autorisé par cette mission. Aucun code ni migration ajouté. Lecture Prisma avant promotion : code 0, 58 migrations à jour ; registre public : 58 terminées, 0 inachevée, dernière `20261001120000_058_harden_arcade_session_lifecycle`, aucune 059. Les suites et inspections ci-dessous n'ont pas été relancées pour ce checkpoint documentaire.

Après les contrôles techniques dédiés Railway/Supabase/bundle public, prochaine action : **recette publique propriétaire Sidebar / Accueil / Aperçu et micro-polish Admin/Arcade**, puis arbitrage des retours. Aucun déploiement réussi ni test public anticipé par ce document ; aucune recette gameplay Codex, mutation publique ou action Twitch. STOP, étape 25 non ouverte.

## Matrice des autorités et raccordements

| Activité | Source autoritative existante | États utiles | Destination | Invalidation |
| --- | --- | --- | --- | --- |
| Faveur | `FavorDto`, présence propriétaire | inactive, crédit confirmé, traitement automatique/erreur | Aperçu, sans claim manuel | lifecycle présence existant, lecture lors du changement de jour |
| Récompense quotidienne | `DailyRewardTodayDto` | disponible, réclamée | claim existant ou Aperçu | réponse claim, focus, date métier |
| Roue | `WheelTodayDto` | tentative disponible, résultat reçu | Quotidiennes > Roue | spin confirmé, focus, date métier |
| Défi | `DailyChallengeDto` | non acheté, progression, terminé | Quotidiennes > Défi | achat/switch/action/chat confirmé, focus, date métier |
| Combat | `DailyCombatDto` | formation à préparer, en cours, bloqué, victoire | Combat quotidien | formation/combat/chat confirmé, focus, date métier |
| Boss | `MonthlyBossDto` | préparation, attaque disponible/utilisée, boss vaincu | Combat > Boss | attaque/formation/lecture propriétaire, focus, date métier |
| Expédition | snapshot et `expeditionOverview` | départ disponible, en cours, prête, départ utilisé | Box, fiche du personnage actif si présente | départ/claim, échéance et notifications existantes, focus, date métier |
| Amitié | résumé `FriendsSnapshot` | aucun ami, cœurs disponibles, tous envoyés, indisponible | Social > Amis | contrôleur existant et réponse métier, focus/date métier |
| Événement | `EventDto`, helpers Event propriétaires | inscription/calendrier/bonus, Jeu A/B/C, attente, terminé | Général → Jeu A → Jeu B → Jeu C | réponse métier, échéances existantes, focus, date métier |

Une source absente, d'une autre journée ou en erreur reste inconnue/incomplète. Disponible, en cours, attente, terminé et non éligible sont distincts. Le nombre affiché compte uniquement les activités actionnables connues et non masquées, une fois chacune ; aucun ratio global de complétion. Les helpers Event conservent leurs subtilités : messages non-inscrit, calendrier, solution collective, fenêtres et ordre prioritaire. Shop/Classement ne créent pas une tâche.

## Trois surfaces

L'Aperçu conserve ses neuf cartes dans l'ordre ci-dessus et ses actions spécialisées. Accueil présente la bannière réelle compacte (titre/art/contexte/date et clic global Invocation, aucun footer Pity/Garantie/Capture/x1/x10), puis **Quotidiennes**. Ses cinq raccourcis redondants sont supprimés, destinations globales conservées. **Trois cartes actionnables maximum**, boutons uniques avec hover/focus et micro-libellé Accéder/Récupérer bas-droite ; micro-action clavier Voir l'Aperçu. Aucun heading visuel Actions/En cours, mais séparation logique conservée. Reward appelle toujours le claim partagé, avec disabled/aria-busy et gel des cartes pendant pending/feedback.

**Deux lignes secondaires maximum** : `home-daily-presentation.ts` réutilise `dailyOngoingItems` sans modifier la projection. Expédition non-actionnable prioritaire, y compris COMPLETED confirmé ; RUNNING affiche « Expédition · <personnage réel> · <countdown> » depuis le détail projeté, sans « En cours ». WAITING conserve son statut réel sans ajout artificiel ; countdown issu du snapshot. Aucun personnage inventé, aucun faux terminé unknown/error, aucune duplication READY/départ actionnable, masque respecté. Un état terminé peut afficher « Expédition · Terminé · Expédition effectuée. » quand c'est le seul détail réellement disponible. Les autres attentes/progressions restent des lignes compactes. Sidebar affiche une seule activité avec chevrons manuels, Tout voir et masquage ; aucune rotation automatique. [R1011–R1014](decisions-log.md) amendent la présentation initiale et la restauration locale.

Suivi sidebar : priorité initiale récompense quotidienne, expédition prête, autres activités actionnables dans l'ordre canonique, puis attentes utiles. La sélection consultée reste stable tant qu'elle est pertinente. Après une complétion confirmée, la suggestion suivante devient disponible après le court feedback existant, présenté dans la même zone que le statut compact, sans ligne réservée supplémentaire. Une action en vol fige son activité et son intention ; pending du claim partagé avec Aperçu/Accueil. Les autres actions naviguent uniquement.

Correctif de conformité de R1007–R1010 au-dessus de `2df4fa154e40fbc4bf6d040f126069e98c9a1901` : la review indépendante a identifié que la liste mixte de sidebar produisait des cartes d'attente sur l'Accueil, doublonnait l'Expédition RUNNING et la laissait visible dans le footer après masquage. `dailyActionableSuggestions` réutilise la priorité existante mais garde uniquement `actionable === true`, hors unknown/error. `dailyOngoingItems` sélectionne les états waiting/in_progress visibles et exclut les IDs des cartes confirmées, y compris pendant leur feedback verrouillé. Les mêmes masques s'appliquent aux deux zones. Expédition READY reste une action prioritaire ; RUNNING apparaît une seule fois dans En cours. Sans action mais avec attente, aucune fausse carte ; sans action ni attente, état vide existant. Le tracker garde sa liste mixte, l'Aperçu reste complet. Aucun nouvel ID R, règle métier, callback, requête ou architecture modifié.

## Préférences, géométrie et limites

Masquage local, versionné par environnement, Player et date métier Paris confirmée par les DTO serveur. Aucun snapshot métier ni secret stocké. Le masquage survit au refresh du navigateur, expire le jour suivant et peut être annulé ; il n'est pas synchronisé entre appareils et n'affecte jamais l'Aperçu. Storage indisponible : mémoire locale. ↺ sidebar appelle restoreLast() : retire le dernier ID de hidden et sélectionne l'activité restaurée encore pertinente. L'ordre de masquage persiste au reload ; filtrage des IDs invalides et doublons sans tri canonique. ARIA « Réafficher <activité> », focus sur le titre, cellule réservée invisible/disabled sans masque. L'action plurielle Accueil appelle restoreAll() et supprime tous les masques. Aucune nouvelle clé ni donnée métier, suggestions/priorités inchangées (R1014).

Le cadre inférieur de sidebar conserve l'enveloppe attribuée par le shell et trois régions bornées : header, centre flexible sans bouton visible et hit-target couvrant la carte, footer stable de navigation ancré en bas. Aucune icône centrale, aucun fallback de détail ; « Disponible. » reste dans la projection mais sa ligne n'est pas rendue dans le tracker. Les statuts significatifs restent affichés ; aucun selected.detail secondaire dans le tracker. Expédition RUNNING réutilise le détail réel « <personnage> · HH:MM:SS » comme état compact, sans « En cours ». Pending/succès/erreur claim remplacent cet état dans une seule zone ; aucune ligne feedback permanente. Refresh silencieux, aria-busy conservé sur sidebar et Accueil. Détails Home/Aperçu/projection préservés. Le hit-target sibling est sous les contrôles indépendants du header/footer ; aucun bouton central ne peut entrer en collision avec chevrons/Tout voir. Réafficher est une micro-action ↺ accessible, cellule d'en-tête toujours réservée via visibility:hidden sans masques ; fermeture et restauration séparées, aucune ligne footer dynamique. Sa bounding box ne dépend pas de l'activité, du texte, d'une erreur ou du chargement. Aucun bouton imbriqué. Les cartes supérieures et le responsive du shell restent propriétaires de leur layout ; à 390 px, les cartes secondaires restent dans le flux avant le Chat. Aucun nouveau drawer ; Accueil mobile en flux naturel. Desktop : grille deux lignes minmax(0,1fr) auto, bannière height:100%/min-height:0 sans clamp ; artwork et fallback dans la même région bornée, média contain ; le cadrage compact courant est celui du correctif de recette décrit ci-dessus. Quotidiennes intrinsèques en bas, sans espace flexible vide sous les cartes ; max-height/scroll seulement pour un contenu exceptionnel.

Tout terminé : état calme ; seulement des attentes : Rien à faire pour le moment avec échéance connue ; tout masqué : Aucune activité affichée et Réafficher ; sources inconnues/erreurs : état incomplet. Un masquage ou une erreur ne devient jamais une complétion.

## Coordination et budget de lecture

`src/dailies/daily-summary.ts` projette les snapshots déjà présents ; ces composants n'effectuent aucun GET. `AppBootstrap` réutilise ses loaders avec `daily-read-coordinator.ts` : un vol partagé par domaine, révision après réponse confirmée, attente d'une mutation avant la relecture demandée, rejet des réponses d'une session remplacée et des dates métier antérieures à la dernière reçue. Événement conserve en plus son coordinateur métier, les jalons et sa file de présentation. Les réponses de mutation propagent directement le snapshot confirmé ; les ressources et feedbacks utilisent les callbacks propriétaires existants.

Un réveil groupé focus/visible ou minuit Paris demande au maximum **huit lectures quotidiennes** : Récompense, Roue, Défi, Combat, Boss, Expédition, Événement et Faveur ; Amitié partage **une lecture Friends** avec son contrôleur existant. Les requêtes déjà en vol sont réutilisées. Focus et visible simultanés sont coalescés pendant 750 ms, sans chevauchement ; une frontière de minuit survenant pendant un vol est conservée pour une relecture après ce vol. Aucune relecture groupée au montage des trois surfaces, aucun polling quotidien ajouté, aucun chargement Box/threads MP pour découvrir la disponibilité. Ces nombres décrivent le budget de ces loaders, pas l'ensemble du trafic du shell : les mécanismes existants de présence, notifications et Social continuent, dont le polling Friends 5 s actif / 30 s inactif.

Le prochain minuit est calculé dans `Europe/Paris`, y compris journées de 23/25 h ; l'horloge du navigateur sert à réveiller une lecture, jamais à autoriser une récompense ni à choisir la date des masques. Les DTO établissent la journée. Expédition garde son snapshot monotone : le passage à zéro demande Expédition/Notifications une fois pour cette échéance, sans claim ni crédit local. Les échéances Événement restent celles de son hook propriétaire. Une lecture échouée conserve les derniers détails confirmés tout en retirant leur actionnabilité et en indiquant l'erreur.

Exemple synthétique contrôlé : huit activités disponibles, Récompense sélectionnée et Expédition prête en seconde priorité. Un claim partagé produit une seule intention, passe le compteur à sept sur réponse confirmée et affiche « Récompense récupérée. » pendant 900 ms ; la sélection passe ensuite à Expédition. Masquer Roue réduit seulement le compteur/suggestions Accueil et sidebar ; Aperçu garde sa carte et son état. La prochaine date serveur utilise une nouvelle clé de masques.

## Contrôles exécutés le 02/10/2026

- Tests de projection, préférences, claim commun, navigation exacte et horloge : **58 tests sur trois fichiers**, inclus dans la suite complète. Relecture concurrente/mutation/session remplacée, attente derrière mutation, ancienne date après minuit, stockage bloqué, compte/journée/environnement, gel d'intention/900 ms, retour Aperçu, Roue/Défi sans consommation, Boss sans attaque, Social Amis sans envoi ni annuaire, ordre Événement/calendrier/solution B collective/messages non-inscrit, journées Paris 23/25 h et minuit pendant lecture couverts.
- Suite frontend **1 119/1 119 sur 109 fichiers** ; backend hors DB **1 073/1 073 sur 101 fichiers**. `verify:full` **8/8**, typechecks/builds frontend et backend, lint sans erreur. Les premiers passages ont révélé des fixtures/assertions obsolètes et une monnaie Événement perdue dans l'état attente ; corrigés avant l'exécution finale. Les tests privés DB n'ont pas été exécutés pour ce lot frontend.
- Prisma validate et `prisma migrate status` en lecture seule : codes retour 0, schéma valide, **58 migrations, base à jour**, aucune migration candidate. Les warnings lint React existants demeurent, avec la synchronisation du reset quotidien à la session ; warning Vite de bundle >500 kB également conservé. Aucun upgrade de dépendance.

`verify:quick` **5/5** également réussi lors de l'implémentation. Review indépendante acquise selon le checkpoint historique ; premier smoke propriétaire désormais acquis dans le périmètre indiqué en tête, finition visuelle encore à recetter.

## Inspection locale et stabilité géométrique

Les mesures de cette section concernent le candidat initial `2df4fa1`. Les contrôles du correctif de séparation Accueil figurent dans la section suivante.

Chromium avec GameShell complet, `index.css`/`App.css`/CSS métier réellement chargés, DTO synthétiques et réseau externe bloqué : **2560×1440, 1920×1080, 1366×768, 390×844**. Pour chaque format : disponible multiple/unique, tout terminé, attente, inconnu, erreur, refresh, tout masqué, pending et feedback. Deux fixtures indépendantes, équipe vide puis quatre personnages avec vraie cible de bannière sélectionnée. Comparaison avec le bouton Quotidiennes antérieur dans la même enveloppe : **écart maximal x/y/largeur/hauteur = 0 px sur les 80 mesures** ; aucun débordement des footers ni du centre sur l'équipe complète, aucun bouton imbriqué ou overflow horizontal du document. Les cartes supérieures et l'alignement inférieur avec le shell sont conservés.

| Format | Carte basse, équipe vide (largeur × hauteur) | Carte basse, équipe complète (largeur × hauteur) |
| --- | ---: | ---: |
| 2560×1440 | 290 × 803,203 px | 290 × 646,516 px |
| 1920×1080 | 290 × 514,922 px | 290 × 359,734 px |
| 1366×768 | 290 × 282 px | 290 × 153,313 px |
| 390×844 | 372 × 110,578 px | 372 × 110,578 px |

La hauteur dépend normalement des cartes supérieures et du viewport, jamais de l'état du suivi. Petit desktop : centre et footer sont placés côte à côte pour tenir dans l'espace réel d'une équipe complète. Mobile : même hauteur que l'ancien bouton, contenu condensé. Accueil zéro/une/trois suggestions conserve ses cinq destinations et BannerHero ; synthèse mobile bornée et scrollable, avec trois suggestions `scrollHeight/clientHeight = 562/448 px`. Aperçu garde neuf cartes : scroll borné sur 1366 (`432/317 px`) et flux mobile existant. La bannière sélectionnée reste dans son cadre en 1366 après réduction locale de son padding, sans changer l'écran Invocation.

Micro-polish Administration : titre ciblé long sans overflow, groupes desktop début/centre/fin et mobile verticaux ; actions Progression/Objets à **17 px du bas de leur carte** dans les quatre formats. Journal : dix lignes, aucun JSON en liste, trois colonnes égales, titres humains et acteurs longs ; les lignes prennent leur hauteur intrinsèque dans la liste bornée, sans chevauchement. Détail Retour/titre/métadonnées/UUID/Avant/Après inspecté. Micro-polish Arcade : trois jeux Moyen finis avec répliques courtes et longues sur quatre formats ; **largeur/hauteur des plateaux inchangées**, hover relatif des onglets **0 px**, focus conservé dans le cadre. Sur desktop, aucun chevauchement citation/plateau, gouttière minimale **6 px** ; body sans scroll aux deux grands formats, scroll borné **75 px** en 1366. Mobile conserve son flux : la réplique longue déplace verticalement le plateau sans changer sa taille.

Captures Accueil, suivi, Aperçu, Administration/Journal/détail et les trois plateaux inspectées localement. Ces preuves sont des contrôles techniques et visuels synthétiques ; elles ne constituent pas une recette publique gameplay ni une validation esthétique finale d'Axel. Les masques restent locaux, non synchronisés entre appareils. Aucun domaine privé DB touché, aucun test DB mutatif requis pour ce lot frontend.

## Contrôles du correctif Accueil — 02/10/2026

Défaut reproduit avant correction : sept nouveaux cas échouent dans les tests directs de l'Accueil. Après correction : dix tests ajoutés (neuf cas UI et un test des helpers), plus renforcement du test existant de gel des cartes pendant pending/feedback. RUNNING avec zéro/une/deux actions, masque et restauration, trois actions avec RUNNING, Event WAITING, priorité READY, vide inchangé, unknown/error exclus, limite de deux états visibles et absence de duplication d'une progression actionnable couverts. Les 68 tests quotidiens et les régressions HomeScreen/GameShell impactées passent : **85/85 sur sept fichiers**.

Suite frontend complète **1 129/1 129 sur 109 fichiers**, backend hors DB **1 073/1 073 sur 101 fichiers** ; typechecks/builds/lint, `verify:quick` **5/5**, `verify:full` **8/8**, diff-check réussis. Prisma validate et migrate status : codes retour 0, schéma valide et **58 migrations à jour**, lecture seule. Backend et schéma inchangés ; aucun test DB mutatif exécuté. Warnings React/bundle antérieurs conservés, aucune dépendance ajoutée.

Inspection Chromium locale, GameShell/CSS réels et équipe complète : **32 cas sur les quatre formats** (une/trois actions et Expédition RUNNING + Event WAITING, attente seule, READY, terminé, unknown, erreur, Expédition masquée). Aucun doublon, carte d'attente, masque ignoré ou overflow horizontal ; cinq destinations et accès Aperçu conservés. Deux lignes En cours au maximum, scroll local accessible sur 1366/mobile, captures inspectées. Ces preuves sont locales et synthétiques ; ni mutation publique ni validation publique du correctif. L'implémentation avait été publiée sur review uniquement ; sa review indépendante est désormais acquise et la promotion relève du checkpoint dédié ci-dessus.

## Contrôles du polish de densité — 02/10/2026

Treize échecs reproduits avant correction sur les attentes de présentation. Huit nouveaux cas de contrôleur UI et assertions existantes adaptées : **96/96 ciblés sur sept fichiers** (contrôleur quotidien, projection, navigation, HomeScreen, BannerHero, GameShell et deep-link Expédition). Carte entière, claim concurrent/pending/feedback, micro-actions, restauration réservée, statuts significatifs, absence raccourcis/footer compact, footer normal et target picker, RUNNING/WAITING/COMPLETED/unknown/error, READY sans duplication et masques couverts.

Frontend **1 137/1 137 sur 109 fichiers**, backend hors DB **1 073/1 073 sur 101 fichiers** ; typechecks/builds/lint, `verify:quick` **5/5**, `verify:full` **8/8**, diff-check réussis. Prisma validate et migrate status : codes 0, **58 migrations à jour**, lecture seule, aucune 059 ni migration ajoutée. Warnings React et bundle Vite >500 kB antérieurs conservés. Aucun test DB mutatif ni changement backend/dépendance.

Un passage complet intermédiaire avec Chromium en parallèle a échoué sur le test MP existant « replaces the receipt… after TTL » : fixture horodatée `Date.now() + 120 ms`, cas exécuté en 167 ms, statut déjà expiré à l'assertion. Relecture du test et du calcul Date.now, puis exécution isolée : PASS (1, 80 exclus). Aucun code/test MP modifié ; suite complète relancée sans inspection parallèle pour le bilan final ci-dessus.

Chromium local avec GameShell/CSS réels, équipe complète, objectif et Chat ouvert, réseau externe bloqué : **44 états sur les quatre formats**. Reward/Roue/Défi, Expédition RUNNING, Event WAITING, terminé, tout masqué, unknown, erreur, feedback claim et revalidation. Scénario principal : sept activités disponibles, trois cartes, Expédition RUNNING en ligne unique. Captures Accueil/sidebar inspectées ; aucun chevauchement, débordement horizontal ni scroll tracker. Le panneau Home tient sans scroll aux trois desktops dans ce scénario ; mobile en flux naturel. Cadres tracker/supérieurs comparés à la baseline : desktop x/y/largeur/hauteur et mobile largeur/hauteur **écart maximal 0 px**. Réafficher visible/invisible : tous les descendants inchangés (**0 px**), masques conservés au reload puis restauration effective.

| Format | Tracker largeur × hauteur | Home scrollHeight / clientHeight, scénario principal |
| --- | ---: | ---: |
| 2560×1440 | 290 × 646,516 px | 925 / 925 px |
| 1920×1080 | 290 × 359,734 px | 584 / 584 px |
| 1366×768 | 290 × 153,313 px | 353 / 353 px |
| 390×844 | 372 × 110,578 px | 485 / 485 px |

Parcours clavier Chromium également exécuté : Enter sur la carte Reward lance le stub partagé et rend la carte disabled/aria-busy, puis Enter sur Roue ouvre son écran ; Space sur la micro-action Aperçu ouvre l'Aperçu avec ses neuf activités. Aucune erreur JavaScript, réseau externe bloqué, aucune opération publique.

Ces preuves sont locales/synthétiques, sans validation publique du polish. Le métier validé au premier smoke reste intact. L'implémentation 865c303 avait été publiée uniquement sur review, parent 51e0710 ; sa review indépendante est désormais acquise et la promotion relève du checkpoint dédié ci-dessus. Étape 25 non commencée.

## Périmètre exclu

Aucun Arcade, Mission permanente, Banque, Code, Concours, claim-all, tutoriel, préférence permanente, table, migration ou dépendance ajoutée au catalogue quotidien. Aucun changement des barèmes, moteurs/IA Arcade, présences autonomes Faveur, files de présentation Faveur/Level-up/Invocation, Story, OAuth, Twitch/Streamer.bot, Gift/Giveaway. Aucune mutation publique ; promotion main uniquement dans la mission dédiée explicitement autorisée.

## Contrôles du dernier micro-polish — 02/10/2026

Quatre échecs ciblés reproduits avant correction ; cinq cas ajoutés et assertions existantes adaptées : refresh silencieux/aria-busy et détails Home préservés, persistance LIFO non canonique après reload, sélection/ARIA/focus, restoreAll pluriel, Expédition réelle sans En cours, pending/succès dans une zone d'état unique. Erreur claim, READY/WAITING/COMPLETED/unknown/error et invariants cartes/navigation déjà couverts, réexécutés : **101/101 ciblés sur sept fichiers**.

Frontend complet **1 142/1 142 sur 109 fichiers**, backend hors DB **1 073/1 073 sur 101 fichiers** ; typechecks/builds frontend/backend, lint sans erreur, `verify:full` **8/8**, `verify:quick` **5/5**, diff-check réussis. Prisma validate et migrate status : codes retour **0/0**, schéma valide, **58 migrations à jour**, lecture seule. Aucune migration 059, modification backend/DB/dépendance ni test DB mutatif. Warnings React et bundle Vite >500 kB antérieurs conservés. Logs complets hors dépôt.

Chromium local, GameShell complet avec CSS réels, réseau externe bloqué : **60 états sur quatre formats**. Scénario principal exact : équipe 4/4, objectif actuel, Chat ouvert, six activités disponibles, Roue sélectionnée, Expédition RUNNING et Récompense masquée. Autres états : trois annulations après reload (Défi, Roue, Récompense), Expédition sidebar, pending/succès/avancement claim, refresh, source en erreur, terminé, tout masqué et restauration globale. Huit contrôles supplémentaires isolent la vraie Expédition COMPLETED (ligne « Expédition · Terminé · Expédition effectuée. », zéro carte) et l'erreur du stub claim (une seule zone d'état, gap ≥6 px), chacun sur les quatre formats. Aucun chevauchement/intersection, détail/feedback sidebar supplémentaire, overflow horizontal ou scroll tracker dans les 52 états principaux. Cadres tracker/supérieurs : écart maximal **0 px** desktop x/y/largeur/hauteur et mobile largeur/hauteur, comparés à la base e848ea6. Captures des quatre formats inspectées ; artwork réel existant, cadrage desktop borné sans déformation. Carte/action Home inchangée.

| Format | Gap action → navigation | Hauteur bannière avant → après | Hauteur Quotidiennes | Home scrollHeight / clientHeight |
| --- | ---: | ---: | ---: | ---: |
| 2560×1440 | 242,766 px | 300 → 885,063 px | 341,938 px | 340 / 340 |
| 1920×1080 | 101,375 px | 280,797 → 525,063 px | 341,938 px | 340 / 340 |
| 1366×768 | 16,656 px | 199,672 → 265,063 px | 289,938 px | 288 / 288 |
| 390×844 | 11,297 px | 475 → 475 px (flux mobile) | 508,938 px | 507 / 507 |

À 1920×1080 : action x=172,188 / y=899,625 / 65,625×28 px, bord inférieur=927,625 ; navigation x=71 / y=1029 / 268×24 px. Aucun recouvrement, gap 101,375 px ≥6. Résumé y=720,063 / hauteur=341,938 / bas=1062, égal au bas du centre ; bannière y=181 / hauteur=525,063, 14 px entre les panneaux. Les trois desktops ont un résumé intrinsèque sans scroll ni grande zone vide ; mobile conserve son flux naturel. Ces preuves techniques synthétiques n'anticipent aucune approbation indépendante ni recette publique du nouveau candidat.

## Retouche du tracker sidebar — mission de clôture du 03/10/2026

Fond subtil bleuté en dégradé, titre central légèrement agrandi et affirmé avec text-transform:uppercase : 15 px normal, 12 px desktop compact, 11 px <=1120. Header Quotidiennes [position/total] conservé. Géométrie, ordre/priorités, masques/LIFO, cinq contrôles indépendants, hit-target, claim partagé, compteurs et synchronisation inchangés ; aucune logique daily modifiée. Inspection GameShell/CSS production aux quatre formats avec équipe 4/4, tous les titres et états plein/partiel/terminé/attente/erreur/refresh et restauration LIFO ; résultats de ce candidat au Master. Retouche candidate, pas de nouvelle recette publique présumée.
