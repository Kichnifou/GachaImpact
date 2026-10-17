# GACHAIMPACT — Maintenance post-V1 : performances R1102 et améliorations joueurs

> Mandat propriétaire transmis le 17/10/2026, consolidé avec les deux errata ci-dessous. Périmètre autorisé, sans présumer son exécution. L'état réel et la reprise restent exclusivement dans le [Master](../master/PROJECT_MASTER_PLAN.md). Les checkpoints du mandat sont historiques à recontrôler avant livraison.

## ERRATUM UI — Shop Événement : confirmation intégrée aux cartes

Ajouter ce correctif frontend au lot UI indépendant. Examiner `src/screens/EventShopSection.tsx`, `src/screens/EventScreen.tsx`, `src/event/event-shop-layout.css` et `src/event/event-general-shop.css`.

- Supprimer le succès sous les cartes ; le présenter uniquement dans la carte Primogemmes, Moras ou Collection ayant effectué l'opération.
- Remplacer temporairement « Vous recevez » par une confirmation verte discrète, avec la même police que l'état Collection « Obtenu — édition 2026 ».
- Préserver exactement les quantités obtenues et dépensées. Pour Collection, conserver l'état durable d'obtention et intégrer la confirmation dans le même espace.
- Hauteur de chaque carte et de la grille strictement identique avant, pendant et après confirmation : aucun mouvement des boutons, réduction, reflow visible ou nouveau scroll.
- Les textes longs reviennent à la ligne dans l'espace réservé, avec présentation compacte ; aucune troncature des montants.
- Effacer l'ancien succès dès une nouvelle opération. Préserver pending, erreurs accessibles, retries, clés d'idempotence et confirmations économiques.
- Qualifier le GameShell compilé/CSS production en desktop et mobile, succès/erreur/textes longs. Aucun changement backend, conversion ou récompense.
- Livraison selon les gates normales du sous-lot UI ; ne pas la bloquer sur les autres sous-lots indépendants.

Le mandat initial et l'erratum Arcade sont conservés ci-dessous dans leur intégralité.

## Complément UI propriétaire du 17/10/2026 — mission toujours continue

Ne pas interrompre les sous-lots engagés ; ajouter ces ajustements avant livraison si possible, sinon en correctif complémentaire dans la même mission. Continuer A à G après ces correctifs.

### Concours : récompenses alignées

Dans les quatre cartes de résultat, afficher d'abord « 1er · 800 Primos », puis le titre de Concours compact/discret. Les récompenses partagent exactement le même axe horizontal ; réserver la ligne de titre même en son absence si nécessaire. Garder le nouveau titre immédiatement après promotion. Ne pas modifier scores, classements, récompenses ni inutilement les dimensions des cartes. Examiner ContestScreen et ses styles ; tests ciblés et rendu desktop/mobile, titres absents/multiples.

### Invocation : compteur du bouton Voir

Petite pastille bleue sobre en haut à droite de « Voir », chiffre 10–11px, sans déplacer/agrandir le bouton ni gêner clic/focus/texte. Libellé accessible donnant le nombre disponible. Aucun compteur nécessaire sur « Arrêter » pendant le visionnage.

Compter les **diffuseurs distincts** disponibles dans « Invocations en direct », avec exactement les mêmes critères, y compris PAUSED encore accessible. Mise à jour sans ouvrir la modale, zéro uniquement après confirmation serveur ; aucune valeur inventée pendant chargement/erreur. Rechercher la réutilisation des données existantes ou une lecture légère authentifiée, à fréquence raisonnable et seulement écran visible. Ne pas poller agressivement ni rappeler fréquemment la liste qui effectue aussi réconciliation/nettoyage. Préserver sessions, baux, droits et comportements existants. Examiner SharedInvocationControls, use-shared-invocations, types API et service backend partagé. Tests et rendu desktop/mobile pour 0/1/plusieurs diffuseurs, déduplication, pause, indisponibilité et cycle visible/masqué. Contrats et Master reflètent seulement la livraison réelle.

## 1. Mission

Le propriétaire confirme que la correction frontend R1102 a amélioré la fluidité de GachaImpact après sa sortie officielle du 16 octobre 2026.

Il demande maintenant une mission consolidée comprenant :

1. Finalisation des deux optimisations backend différées de R1102 : Chat global et réconciliation des codes cadeaux.
2. Correction de l'affichage des titres obtenus à la fin d'un Concours.
3. Affichage des titres de Concours dans la fiche détaillée d'un personnage possédé.
4. Déplacement des Légendes C6 vers un onglet dédié du profil.
5. Remplacement du lot de Primogemmes de la Boutique par une Masterless Stella Fortuna à 50 000 000 Moras.
6. Ajout des anniversaires de joueurs : date définitive, confidentialité contrôlée et récompenses automatiques annuelles.

Le propriétaire autorise l'implémentation, les tests et la livraison des modifications demandées.

**Objectif : améliorer le jeu déjà en production, sans refonte inutile ni régression économique ou sociale.**

## 2. Bootstrap et checkpoint

Dépôt : `https://github.com/Kichnifou/GachaImpact`

Dernier checkpoint GitHub vérifié :

`be84a11da06e9af6065bcfd487771789aefc9012`

Au contrôle : main et review alignées, divergence 0/0.

Vérifier les HEAD distants frais, l'ascendance et le worktree avant toute modification.

Lire obligatoirement :

- `AGENTS.md`
- `.chatgpt/CHATGPT_GUIDE.md`
- `docs/master/PROJECT_MASTER_PLAN.md`
- `docs/process/implementation-workflow.md`
- `docs/process/conversation-handoff.md`
- `docs/architecture/r1102-launch-performance.md`
- `docs/architecture/evidence/r1102-performance.json`
- `docs/architecture/evidence/r1102-postflight.json`

Consulter ensuite les contrats métier, UI, économie, confidentialité et notifications correspondant aux changements.

La V1 reste terminée. Ne pas rouvrir les anciens pending.

## 3. LOT A — Finaliser les performances R1102

### A1. Optimisation du Chat global

R1102 a déjà livré le ralentissement et la désynchronisation du polling frontend. Cette correction est acceptée et ne doit pas être annulée.

Le correctif backend expérimental est conservé dans le commit :

`73e4fda15b9b3537cc546d6fb4439f4b44a2741a`

Il avait été retiré de la livraison définitive faute de qualification PostgreSQL complète.

Reprendre son analyse, sans cherry-pick aveugle.

Objectifs :

- Éviter de recharger à chaque polling les relations complètes des 200 messages connus.
- Hydrater uniquement les messages réellement nouveaux ou modifiés lorsque le contrat le permet.
- Maintenir la fenêtre canonique, les curseurs, générations et ordres.
- Préserver les suppressions, mentions, réponses, auteurs, historiques et restrictions de visibilité.
- Conserver les protections de rétention, modération et confidentialité.
- Ne pas ajouter de cache partagé entre joueurs.
- Ne pas modifier les règles de commande, XP, récompense ou idempotence.

La suite PostgreSQL précédente avait réussi quatre scénarios, mais le scénario du parent expiré n'était pas qualifié.

**Cette fois, obtenir la preuve complète avant promotion.**

Examiner pourquoi la préparation des fixtures privées expirait et résoudre cette difficulté proprement, sans ajouter une infrastructure payante ou augmenter aveuglément les timeouts.

### A2. Optimisation des codes cadeaux

Le même commit expérimental contient :

- Le regroupement des lectures de notifications.
- La suppression de consultations N+1.
- Une matérialisation annuelle moins redondante.

Reprendre ces optimisations après inspection du code courant.

Préserver :

- Les dates de disponibilité.
- Les activations et désactivations administratives.
- Les claims et récompenses.
- Les notifications.
- Les règles de déduplication.
- Les courses entre claim, désactivation et réconciliation.
- Les historiques et preuves économiques.

Les tests PostgreSQL précédents avaient échoué pendant leur préparation.

Réussir les scénarios de concurrence privés avant de promouvoir ce backend.

### A3. Mesure finale

Comparer les appels `/chat/updates`, les lectures PostgreSQL, les durées HTTP, les 5xx, les verrous et les timeouts Prisma.

Conserver les observations naturelles en production, sans charge synthétique publique.

Les optimisations backend restent un sous-lot indépendant : si une preuve critique manque encore, ne pas les promouvoir. Poursuivre les autres ajustements qualifiés.

## 4. LOT B — Concours : actualisation du titre après victoire

### Défaut réellement montré

Capture propriétaire du 16 octobre :

Dans Activités → Concours, le dernier résultat affiche :

**« ✨ Durin devient Icône d'Argent ! »**

Mais sur la carte du gagnant Ceotryd, Durin affiche encore :

**« Icône de Bronze »**

Les deux informations se contredisent.

### Comportement demandé

À la fin d'un Concours, si une Légende obtient une promotion, sa carte de résultat doit immédiatement afficher le **nouveau titre**, sans F5.

Exemple :

- Avant : Icône de Bronze.
- Victoire et promotion : Icône d'Argent.
- Résultat affiché : Icône d'Argent.

Si aucune promotion n'a lieu, conserver le titre existant.

### Analyse technique

Inspecter :

- `server/src/application/contest/contest-service.ts`
- `src/screens/ContestScreen.tsx`
- Les données `titleRankSnapshot`, `promotions` et événements `TITLE_PROMOTED`.
- La synchronisation de fin de Concours.

Le backend conserve un titre pris au lancement du Concours pour certains calculs, tandis que la progression est actualisée à la fin.

Faire la distinction entre le **snapshot servant au calcul historique** et le **titre final devant être présenté**.

Privilégier l'utilisation des promotions persistées ou d'une projection finale autoritaire.

Ne pas recalculer les scores, redistribuer les récompenses ou modifier les rangs.

Vérifier également :

- Résultat immédiatement après victoire.
- Rechargement de la page.
- Consultation du dernier résultat.
- Historique des Concours.
- Promotions sur plusieurs thèmes.
- Cas sans promotion.
- Consultation depuis un autre joueur.

Les résultats historiques doivent rester fidèles à l'état acquis à la fin de chaque Concours, sans utiliser incorrectement un titre gagné lors d'un Concours ultérieur.

## 5. LOT C — Afficher les titres sur la fiche d'un personnage possédé

### Écran concerné

`src/components/BoxCharacterDetailModal.tsx`

Capture propriétaire : fiche de Durin, portrait à gauche, informations et expédition à droite, statistiques Concours dans la partie inférieure.

Les statistiques C6 sont déjà affichées, mais les titres de Concours gagnés ne le sont pas.

### Modification demandée

Ajouter les titres réellement obtenus par le personnage dans sa fiche.

Exemples :

- Icône de Bronze
- Icône d'Argent
- Titan d'Or
- Autres titres existants selon les thèmes

Ces titres correspondent aux **titres de progression Concours de chaque personnage**, pas aux titres cosmétiques équipés par le joueur.

Les données existent déjà dans les progressions `C6CompetitionProgress` et la présentation des Légendes.

### Intégration visuelle

Le propriétaire laisse carte blanche sur le design, avec une contrainte importante :

**Conserver autant que possible les dimensions et la composition actuelle de la modale.**

Proposition de direction :

- Petit bloc compact « Titres » près du nom, de la constellation ou des informations de personnage.
- Badges discrets avec une hiérarchie visuelle par rang.
- Si plusieurs titres sont possédés, présentation condensée et possibilité de consulter les autres.
- Pas d'énorme panneau supplémentaire.
- Aucun titre affiché s'il n'en existe pas.
- Aucun espace vide réservé inutilement.

L'implémentation exacte peut être ajustée si une composition plus élégante ressort du GameShell compilé.

Éviter d'ajouter une requête réseau à chaque rendu ou à chaque carte. Réutiliser ou étendre proprement une projection existante, avec lecture groupée lorsque nécessaire.

Après promotion dans un Concours, une nouvelle ouverture ou une actualisation pertinente de la fiche doit refléter le nouveau titre, sans forcer un F5.

Respecter les viewports desktop et mobile, les contrôles existants, la lisibilité, le focus et les règles de hauteur du contrat UI.

## 6. LOT D — Nouvel onglet « Légendes » dans le profil

### Défaut visuel

Dans `src/screens/ProfileScreen.tsx`, l'onglet **Box** affiche les cartes des personnages, puis ajoute en dessous une liste brute :

« Légendes C6 »

Cette liste comporte des éléments dépliables avec les statistiques et titres.

Le rendu manque d'intégration et pollue la présentation de la Box.

### Modification demandée

Créer un nouvel onglet **« Légendes »** dans la navigation interne du profil, idéalement à côté de Box.

Déplacer dans ce nouvel onglet l'intégralité de la section Légendes C6.

Le contenu ne doit plus apparaître sous les cartes de l'onglet Box.

### Présentation

Créer une interface cohérente avec les autres rubriques du profil :

- Liste ou cartes des Légendes C6 possédées.
- Portrait et nom des personnages.
- Statistiques Concours.
- Nombre de participations et de victoires.
- Titres obtenus par thème, avec leur rang.
- États vides soignés.

Réutiliser les composants et données déjà disponibles.

Le propriétaire n'impose pas une maquette précise : privilégier une présentation élégante, lisible et compacte.

### Confidentialité

La consultation d'un profil tiers doit continuer à respecter les permissions existantes :

- BOX pour la liste des personnages.
- GENERAL_STATISTICS pour les détails des Légendes.

Ne jamais élargir implicitement les droits existants.

Si l'information est privée, ne pas laisser le nouvel onglet contourner cette restriction.

Vérifier également la navigation, les ancres du tutoriel, le responsive, les états chargés et les profils sans Légendes.

## 7. LOT E — Boutique : remplacer le lot de Primogemmes par une Stella Fortuna

### Décision économique explicite

Supprimer de l'offre achetable le **lot de 160 Primogemmes contre 50 000 Moras**.

Le remplacer par :

**1 Masterless Stella Fortuna = 50 000 000 Moras.**

Il s'agit bien de l'objet spécial existant utilisé pour renforcer les personnages, et non d'une nouvelle monnaie ou d'une Primogemme.

### Fonctionnement

- Achat unitaire : une Stella par achat.
- Prix fixe : 50 millions de Moras.
- Achat possible plusieurs fois si le joueur dispose des Moras nécessaires.
- Pas de limite quotidienne supplémentaire inventée.
- Montant exact vérifié côté serveur.
- Refus propre en cas de solde insuffisant.
- Débit Moras et attribution de la Stella atomiques.
- Stock immédiatement actualisé dans le Sac, la Box et les autres projections pertinentes.
- Historique d'achat avec la nouvelle récompense correctement affichée.
- Replay de la même clé d'idempotence sans second débit ni seconde Stella.

### Architecture existante

Inspecter :

- `server/src/infrastructure/database/prisma-shop-store.ts`
- `server/src/application/shop/shop-store.ts`
- `server/src/application/shop/shop-services.ts`
- `server/src/infrastructure/database/prisma-box-store.ts`
- `src/screens/ShopScreen.tsx`
- Les routes Boutique et les contrats de commandes.

Il existe déjà le helper :

`creditMasterlessStellaFortuna`

L'utiliser ou réutiliser sa logique transactionnelle autoritaire.

La Stella n'est pas une `ResourceKey` ordinaire : ne pas la représenter artificiellement comme des Primogemmes.

Créer le type d'effet adapté avec compatibilité de sérialisation, historique et affichage.

### Compatibilité des achats historiques

Le catalogue contient aujourd'hui l'article `primogem-bundle`.

**Ne pas transformer rétroactivement les anciens achats de Primogemmes en achats de Stella.**

Privilégier la désactivation de l'ancien article et la création contrôlée d'une nouvelle définition, avec un nouvel identifiant stable.

Préserver les références historiques, snapshots, preuves et opérations déjà terminées.

La modification du catalogue doit être versionnée par une migration Prisma propre et reproductible, sans écriture manuelle dans `_prisma_migrations`.

### Commandes Chat et Twitch

La commande `!shop primos` existe actuellement.

Adapter le système partagé :

- Introduire une commande claire, par exemple `!shop stella`.
- Mettre à jour `!shop`, l'aide, les descriptions et présentations.
- Ne plus permettre de nouveaux achats de l'ancien lot via UI, API, Chat ou Twitch.
- Refuser les anciennes commandes obsolètes avec une explication naturelle.
- Préserver la possibilité de vérifier/rejouer correctement les anciennes opérations déjà confirmées avec leur clé exacte.
- Conserver un unique service métier autoritaire pour tous les points d'entrée.

Ne pas modifier le ticket aléatoire, le système de Défi ou les autres articles.

### Tests

Vérifier sur PostgreSQL privé :

- Achat réussi à 50 000 000.
- Solde insuffisant.
- Achats simultanés.
- Retry et réponse réseau perdue.
- Absence de double débit.
- Historique ancien et nouveau.
- Compatibilité des commandes.
- Récompense visible dans le stock Stella.
- Absence de mutation sur les vrais joueurs.

## 8. LOT F — Anniversaires des joueurs

Nouvelle fonctionnalité expressément demandée.

### F1. Enregistrement de l'anniversaire

Permettre à un joueur de renseigner son anniversaire depuis son propre profil.

Enregistrer uniquement **le jour et le mois**. L'année de naissance n'est pas nécessaire pour cette fonctionnalité.

Règles :

- Saisie facultative.
- Date réelle et validée côté serveur.
- L'utilisateur ne peut l'enregistrer qu'une seule fois.
- Après le premier enregistrement réussi, la date devient **définitive et non modifiable**.
- Les tentatives de modification par API doivent être refusées.
- Deux enregistrements concurrents ne peuvent pas contourner cette règle.
- Un retry strictement identique ne doit pas créer une seconde opération.
- Aucun autre joueur ne peut définir ou modifier cette date.

Avant confirmation, afficher clairement :

« Attention : votre anniversaire ne pourra plus être modifié après validation. »

Prévoir une confirmation explicite, puis un affichage en lecture seule après validation.

Une modification de visibilité ne doit jamais modifier le jour ou le mois enregistré.

### F2. Confidentialité

**L'anniversaire est PRIVÉ par défaut.**

Même les amis ne peuvent pas le voir tant que le joueur n'a pas choisi de le rendre visible.

Ajouter le paramètre approprié au système de confidentialité existant.

Comportement demandé :

- PRIVÉ : seul le propriétaire voit sa date.
- PUBLIC : les autres joueurs peuvent la consulter sur son profil.
- Possibilité de repasser de PUBLIC à PRIVÉ à tout moment.
- Le changement de confidentialité n'affecte ni la date définitive ni les récompenses.

Pour limiter les données personnelles, ne pas afficher d'année ni d'âge.

Contrôler la confidentialité côté serveur dans les DTO, API et projections de profils tiers, pas seulement en CSS.

Aucune exposition implicite dans le Chat, les commandes, classements, résultats de recherche ou logs.

### F3. Récompense annuelle

À chaque anniversaire, attribuer automatiquement au joueur :

- **50 000 Primogemmes**
- **200 000 Moras**

Une fois par année civile de l'anniversaire.

Les récompenses sont automatiques : aucun bouton « Réclamer » nécessaire.

La remise doit être indépendante de la présence du joueur, de son navigateur et de Twitch.

Utiliser exclusivement l'horloge serveur et le calendrier **Europe/Paris**, conformément aux mécanismes temporels existants.

### F4. Exécution et garanties économiques

Réutiliser le moteur économique serveur et les patterns éprouvés d'opérations idempotentes, notifications et scheduler.

Garanties obligatoires :

- Une seule attribution annuelle par joueur.
- Débit/crédit et preuve durable cohérents.
- Les deux récompenses appartiennent à une même attribution logique atomique.
- Aucun double gain après retry, redéploiement, redémarrage ou concurrence.
- Aucune duplication par plusieurs workers.
- Les joueurs Twitch-only et standalone sont pris en charge selon le Player autoritaire existant.
- Aucun compte ARCHIVED/supprimé ne reçoit un nouveau gain.
- Pas de dépendance au premier message Chat.
- L'enregistrement de l'anniversaire n'attribue aucune récompense rétroactive pour des années précédentes.
- Si l'anniversaire est enregistré le jour même, le joueur est éligible à l'attribution de cette année une seule fois.
- Les événements annuels manqués lors d'une indisponibilité serveur doivent être rattrapés de façon idempotente, sans récompenser des années antérieures à l'enregistrement.

Pour le **29 février**, permettre cette date valide et effectuer l'anniversaire le **28 février les années non bissextiles**. Documenter et tester ce comportement.

Ne jamais effectuer de crédits de QA sur de vrais comptes.

### F5. Notification

Le jour de l'anniversaire, produire une notification personnelle avec un texte chaleureux, par exemple :

« 🎂 Joyeux anniversaire ! GachaImpact t'offre 50 000 Primogemmes et 200 000 Moras pour fêter cette journée ! »

La notification :

- Est envoyée/créée automatiquement lors de l'attribution.
- Est visible dans le système de notifications existant.
- Est privée, indépendamment du paramètre PUBLIC/PRIVÉ de l'anniversaire.
- Ne peut pas être créée plusieurs fois pour la même attribution annuelle.
- N'exige aucun claim.
- Se comporte correctement avec lu/archivé.
- Réutilise les patterns de déduplication et d'affichage existants.

La réception n'est pas une condition nécessaire au crédit : les gains sont persistés de manière autoritaire.

### F6. Interface

Intégrer l'anniversaire dans le profil, de préférence dans l'Aperçu ou dans un petit bloc accessible depuis celui-ci.

Avant saisie : présentation sobre et bouton permettant de définir la date.

Après saisie : afficher la date et une indication discrète qu'elle est définitive.

Pour les autres joueurs : afficher uniquement la date si PUBLIC.

Pas de nouvelle page complète si les composants existants suffisent.

Le rendu doit rester élégant et compatible avec le profil actuel.

### F7. Migration et sécurité

Effectuer uniquement les migrations additives nécessaires, avec suivi Prisma officiel.

Assurer la cohérence avec :

- La suppression sécurisée des comptes.
- Les protections anti-restauration.
- Les récupérations et liaisons d'identité.
- Les sauvegardes privées.
- Les règles de conservation des données.
- Les projections de confidentialité.
- Les historiques économiques.

La date doit disparaître des données actives lors d'une suppression de compte conformément au contrat existant.

Ne pas affaiblir les restrictions d'accès aux données personnelles.

### F8. Tests

Utiliser des fixtures privées et une horloge injectable.

Couvrir :

- Première saisie.
- Seconde saisie interdite.
- Retry identique.
- Deux soumissions concurrentes avec dates différentes.
- Date invalide.
- Visibilité privée par défaut.
- Bascule publique et retour privé.
- Absence de fuite dans les autres API.
- Anniversaire normal.
- 29 février en année bissextile et non bissextile.
- Passage de minuit Europe/Paris.
- Changement d'heure.
- Plusieurs traitements concurrents.
- Arrêt/reprise du scheduler.
- Récompense déjà versée.
- Compte archivé ou supprimé.
- Attribution sans connexion.
- Notification et ressources correctement persistées.
- Suppression de compte et protections anti-restauration.

La review indépendante de ce domaine est obligatoire.

## 9. Qualité UI et non-régression

Pour les écrans modifiés, réutiliser les composants et patterns existants.

Vérifier le GameShell compilé avec les styles de production, notamment :

- 1920 × 1080
- 1366 × 768
- 390 × 844
- 390 × 600

Vérifier également les états utiles : chargement, succès, erreur, contenu vide, titres multiples, textes longs, indisponibilité et pending.

Ne pas corriger un dépassement en masquant simplement un scrollbar, en déplaçant le scroll vers un parent ou en réduisant excessivement les textes.

Préserver la navigation, l'accessibilité, les interactions manette/souris lorsqu'applicables et les tutoriels existants.

## 10. Organisation de la livraison

Une seule mission Codex est autorisée, mais **avec des frontières de risque explicites**.

Organisation recommandée :

1. Correctifs backend de performance R1102.
2. Corrections et améliorations visuelles Concours/Légendes.
3. Modification économique Boutique/Stella.
4. Anniversaires et récompenses automatiques.

Ces sous-ensembles peuvent recevoir des commits, qualifications et reviews distincts.

Ne pas bloquer une petite correction UI déjà validée simplement parce que les tests d'un système économique indépendant prennent davantage de temps.

Inversement, ne pas promouvoir un code sensible tant que ses propres garanties ne sont pas acquises.

Chaque sous-ensemble autorisé et validé poursuit normalement son cycle :

**Implémentation → tests → review → review indépendante lorsque requise → fast-forward main → déploiements → postflight.**

Pas de GO supplémentaire entre les gates réussies.

Les changements sensibles ne doivent pas être déployés sous prétexte qu'ils sont inclus dans une mission consolidée.

### Restrictions permanentes

- Aucune action économique de QA sur les joueurs publics.
- Aucun tirage Gacha artificiel.
- Aucune suppression réelle de compte de test en production.
- Aucune migration ou restauration de joueurs.
- Aucun changement Twitch GLOBAL hors adaptation des commandes explicitement demandées.
- Aucun changement de règles économiques en dehors de la Stella et des récompenses d'anniversaire définies ici.
- Aucun nouveau service ou abonnement payant.
- Aucun changement aveugle du pool Prisma ou des timeouts.
- Aucun benchmark de charge destructif en production.
- Aucun force-push.

En cas de blocker sérieux, ne suspendre que le sous-ensemble concerné.

## 11. Documentation

Mettre à jour les documents spécialisés concernés :

- Chat et performances R1102.
- Concours et progression des titres.
- Profil, Box et Légendes.
- Boutique et commandes.
- Anniversaires et confidentialité.
- Notifications et économie.
- Migrations/modèle physique si nécessaire.

Le Master reste l'unique état global vivant.

Consigner les décisions et la livraison réellement acquise sans inventer de recette propriétaire.

Ne pas réécrire les archives historiques ou rouvrir artificiellement la roadmap V1.

## 12. Rapport de fin

Fournir un bilan court et exploitable :

### A. Implémentation
Pour chaque demande : corrigée/livrée, techniquement qualifiée mais non livrée, ou bloquée.

### B. Vérifications
Tests ciblés, quick/full, PostgreSQL privé, reviews indépendantes et éventuelles limites.

### C. Performances
Mesures avant/après réellement comparables, bénéfices confirmés, problèmes non résolus.

### D. Livraison GitHub
SHA exact de chaque candidat, SHA final `main`/`review`, divergence, migrations, déploiements Railway/Cloudflare et postflight.

### E. Recette propriétaire
Une courte checklist des opérations à essayer dans le jeu :

- Nouveau titre de Concours visible sur le résultat.
- Titres visibles dans la fiche du personnage.
- Onglet Légendes distinct de Box.
- Nouvelle Stella dans la Boutique.
- Configuration et confidentialité de l'anniversaire.
- Fluidité du Chat et des interactions ordinaires.

Ne jamais provoquer un achat réel, une attribution économique ou une suppression pour réaliser cette recette.

**Objectif : livrer une maintenance post-V1 propre, avec les améliorations demandées et des garanties complètes pour les données des joueurs, tout en conservant la fluidité retrouvée après R1102.**

---

# ERRATUM — GACHAIMPACT — Arcade multijoueur : revanche et retour au solo

Ce complément fait partie de la mission de maintenance post-V1 précédemment transmise. Il ajoute une amélioration explicitement demandée au système Arcade, sans modifier les autres lots.

## 1. Comportement demandé après une partie multijoueur

Actuellement, lorsqu'une partie multijoueur se termine naturellement, le bouton « Rejouer » lance directement une nouvelle partie SOLO contre le bot.

Ce fonctionnement doit être remplacé.

Après la fin d'une partie multijoueur (Memory, Puissance 4 ou Morpion) :

- Les deux joueurs restent sélectionnés dans le bloc « Jouer contre ».
- Le jeu et la difficulté restent ceux de la partie terminée.
- Les boutons « Prêt » et « Refuser » restent visibles mais grisés et désactivés.
- Deux nouveaux boutons apparaissent juste en dessous : **« Rejouer »** et **« Jouer solo »**.
- Le résultat et le plateau de la partie terminée restent affichés pendant l'attente.
- Le bouton « Rejouer » actuellement situé sous le plateau ne doit pas rester en doublon pour cet état multijoueur.

Ce fonctionnement concerne uniquement les parties MULTIPLAYER terminées naturellement, pas les parties SOLO ou abandonnées.

## 2. Bouton « Rejouer » — revanche multijoueur

Lorsqu'un joueur clique sur « Rejouer » :

1. Sa demande de revanche est enregistrée côté serveur.
2. Son interface affiche discrètement « En attente de l'autre joueur… ».
3. L'autre joueur voit que son adversaire souhaite rejouer.
4. La nouvelle partie ne démarre que lorsque **les deux joueurs ont cliqué sur « Rejouer »**.
5. Dès que les deux demandes sont confirmées, une nouvelle partie MULTIPLAYER démarre automatiquement pour les deux.

La revanche conserve :

- Les mêmes deux joueurs.
- Le même jeu.
- La même difficulté.

Elle crée une nouvelle session avec un nouveau plateau et le tirage normal du premier joueur, sans réutiliser l'état de la partie précédente.

Les deux joueurs n'ont pas besoin de repasser par une invitation, « Prêt » ou « Refuser ».

Un simple clic de l'un des joueurs ne doit jamais lancer la partie à lui seul.

Les demandes de revanche doivent être liées à l'identifiant exact de la partie terminée. Une ancienne demande ne doit pas pouvoir démarrer une revanche sur une autre partie.

## 3. Bouton « Jouer solo »

Le bouton « Jouer solo » reste accessible après le résultat multijoueur, même si le joueur a déjà demandé une revanche.

Un clic :

- Annule sa participation à la revanche en attente.
- Libère l'ancien adversaire, qui revient à l'interface Arcade normale.
- Lance immédiatement une nouvelle partie SOLO contre l'IA.
- Conserve le jeu et la difficulté précédents.
- Utilise le fonctionnement SOLO existant, avec ses règles habituelles de score et d'XP.

La nouvelle partie SOLO doit être une session distincte et indépendante du résultat PvP précédent.

Les deux joueurs peuvent choisir séparément de retourner en SOLO.

En cas de clics concurrents entre « Rejouer » et « Jouer solo », le serveur doit résoudre les transitions atomiquement, sans créer simultanément une partie SOLO et une partie MULTIPLAYER pour un même joueur.

## 4. Déconnexion ou départ de l'écran : délai de 5 secondes

**Condition essentielle demandée par le propriétaire :**

Tant que la revanche n'a pas commencé, les deux joueurs doivent rester présents sur l'écran Arcade de la partie terminée.

Si l'un des joueurs :

- Se déconnecte du jeu.
- Ferme le navigateur ou son onglet.
- Navigue vers une autre page ou une autre activité.
- Quitte Arcade.
- Perd sa connexion et cesse d'être détectable.

Pendant **plus de 5 secondes**, l'attente de revanche est automatiquement annulée pour les deux joueurs.

Résultat :

- Les deux interfaces reviennent à l'état initial normal d'Arcade.
- L'ancien adversaire n'est plus sélectionné.
- « Prêt » et « Refuser » retrouvent leur fonctionnement normal.
- Les boutons spécifiques « Rejouer » et « Jouer solo » de l'après-match disparaissent.
- Les joueurs peuvent sélectionner un adversaire, envoyer une nouvelle invitation ou commencer normalement une partie SOLO.

La partie terminée reste enregistrée dans l'historique, avec ses scores et résultats. L'annulation de la revanche ne doit jamais annuler les résultats acquis.

Si un joueur revient dans les 5 secondes, il peut retrouver l'attente encore valide. Après expiration, le retour ne doit jamais restaurer une revanche périmée.

### Gestion technique

L'ancien système de présence général utilise des heartbeats trop espacés pour détecter précisément un départ de 5 secondes.

Ne pas se contenter de cette présence générale.

Mettre en place une détection adaptée **uniquement à l'état d'attente de revanche**, avec une présence/validité côté serveur liée à la session, sans multiplier inutilement les requêtes ou écritures.

Le serveur doit être autoritaire sur :

- Les deux joueurs concernés.
- Leur demande de revanche.
- Leur présence dans le contexte Arcade.
- L'expiration de l'attente.
- La création de la nouvelle session.

Ne pas dépendre uniquement d'un `setTimeout` frontend ou d'un événement de fermeture navigateur, qui peut ne jamais parvenir au serveur.

Les deux interfaces doivent converger vers le même état après expiration, au prochain rafraîchissement autoritaire. Viser une détection au seuil des 5 secondes avec seulement la latence de synchronisation inévitable.

Lors d'un changement d'onglet navigateur, traiter une page durablement masquée comme absente de l'attente, sans annuler pour un bref changement inférieur à 5 secondes.

Préserver les corrections de performance R1102 : aucun polling agressif global, aucun nouvel appel permanent quand aucune revanche n'est en attente.

## 5. Contrats existants et compatibilité

Consulter notamment :

- `docs/specifications/arcade-v1.md`
- `src/screens/ArcadeScreen.tsx`
- `src/arcade/use-arcade.ts`
- `src/api/arcade-types.ts`
- `server/src/application/arcade/arcade-service.ts`
- `server/src/application/arcade/arcade-invitations.ts`
- `server/src/application/arcade/arcade-transaction.ts`
- Les routes API Arcade et les tests PostgreSQL multijoueurs.

L'ancien contrat R1030, où « Rejouer » après FINISHED MULTIPLAYER démarrait directement un SOLO, est **supersédé uniquement par ce nouveau comportement après-match**.

Conserver :

- Une seule session ACTIVE par joueur.
- Les verrous et l'ordre de verrouillage existants.
- Les clés d'idempotence.
- Les scores et records PvP acquis.
- L'absence d'XP en multijoueur.
- Les règles d'XP SOLO existantes.
- Les invitations ordinaires et leurs notifications.
- Les trois jeux et les trois difficultés.
- Le fonctionnement de « Quitter » pendant une partie ACTIVE.
- Les protections contre les doubles sessions et les courses concurrentes.

Aucune notification persistante supplémentaire n'est nécessaire pour proposer une revanche : un état discret dans Arcade suffit.

## 6. Tests obligatoires

Qualifier sur fixtures privées :

- Fin naturelle MULTIPLAYER et apparition des deux boutons.
- Conservation des deux joueurs sélectionnés.
- « Prêt » et « Refuser » désactivés.
- Un seul clic « Rejouer » : aucune nouvelle partie.
- Deux clics « Rejouer » : une seule nouvelle session PvP.
- Deux clics simultanés ou répétitions réseau.
- « Jouer solo » depuis l'état terminé.
- « Jouer solo » après avoir demandé une revanche.
- Concurrence entre « Rejouer » et « Jouer solo ».
- Départ de l'écran inférieur à 5 secondes puis retour.
- Départ supérieur à 5 secondes.
- Déconnexion, fermeture, perte réseau et reconnexion.
- Plusieurs onglets du même joueur.
- Expiration pendant un clic de revanche.
- Rechargement navigateur pendant l'attente.
- Résultats, scores, historiques et idempotence conservés.
- Absence de nouvelle récompense ou XP PvP.
- Compatibilité PC/mobile, focus et lisibilité des nouveaux boutons.

Les tests de concurrence et de persistance PostgreSQL sont obligatoires avant promotion.

## 7. Livraison

Intégrer ce changement comme un sous-lot Arcade indépendant dans la mission consolidée précédente.

Respecter les gates habituelles : tests, review indépendante du vrai SHA GitHub, correction éventuelle, fast-forward `main`, déploiements et postflight.

Ne pas attendre de nouveau GO générique lorsque les gates sont acquises.

Mettre à jour le contrat Arcade et le Master selon le résultat réel.

**Résultat attendu : après chaque partie PvP, les joueurs peuvent facilement prendre leur revanche ensemble ou repartir jouer seuls. Une revanche ne doit jamais rester bloquée si l'un des joueurs quitte l'écran plus de 5 secondes.**
