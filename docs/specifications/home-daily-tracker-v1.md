# Accueil dynamique et suivi Quotidiennes — étape 24

Lot candidat review du 02/10/2026. Demande propriétaire : neuf activités inchangées, projection commune, suivi manuel dans le cadre existant de sidebar, synthèse Accueil ; aucune nouvelle récompense. Les détails de présentation et de coordination sont arbitrés sous sa délégation. Validation publique de l'étape 24 non acquise.

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

L'Aperçu conserve ses neuf cartes dans l'ordre ci-dessus et ses actions spécialisées. Accueil conserve BannerHero compact, bannière réelle et cinq raccourcis, puis affiche Aujourd'hui avec jusqu'à trois suggestions et une information en cours. Sidebar affiche une seule activité avec chevrons manuels, Tout voir et masquage ; aucune rotation automatique.

Priorité initiale : récompense quotidienne, expédition prête, autres activités actionnables dans l'ordre canonique, puis attentes utiles. La sélection consultée reste stable tant qu'elle est pertinente. Après une complétion confirmée, la suggestion suivante devient disponible après un court feedback dans une région réservée. Une action en vol fige son activité et son intention ; pending du claim partagé avec Aperçu/Accueil. Les autres actions naviguent uniquement.

## Préférences, géométrie et limites

Masquage local, versionné par environnement, Player et date métier Paris confirmée par les DTO serveur. Aucun snapshot métier ni secret stocké. Le masquage survit au refresh du navigateur, expire le jour suivant et peut être annulé ; il n'est pas synchronisé entre appareils et n'affecte jamais l'Aperçu. Storage indisponible : mémoire locale.

Le cadre inférieur de sidebar conserve l'enveloppe attribuée par le shell et trois régions bornées : header, centre flexible, footer stable. Sa bounding box ne dépend pas de l'activité, du texte, d'une erreur ou du chargement. Contrôles explicites dans une section, aucun bouton imbriqué. Les cartes supérieures et le responsive du shell restent propriétaires de leur layout ; à 390 px, le shell courant place les cartes secondaires dans le flux avant le Chat. Aucun nouveau drawer n'est introduit.

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

`verify:quick` **5/5** également réussi. Validation publique propriétaire et review indépendante de ce candidat non acquises.

## Inspection locale et stabilité géométrique

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

## Périmètre exclu

Aucun Arcade, Mission permanente, Banque, Code, Concours, claim-all, tutoriel, préférence permanente, table, migration ou dépendance ajoutée au catalogue quotidien. Aucun changement des barèmes, moteurs/IA Arcade, présences autonomes Faveur, files de présentation Faveur/Level-up/Invocation, Story, OAuth, Twitch/Streamer.bot, Gift/Giveaway. Aucune mutation publique ni promotion main dans ce lot.
