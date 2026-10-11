# Roue graphique V1

Contrat spécialisé du lot D autorisé le 11/10/2026. Le [Master](../master/PROJECT_MASTER_PLAN.md) porte le statut, les SHA et les preuves ; ce contrat décrit le comportement. [Owner métier](../legacy/17-roue-quotidien-audit.md), [layout transverse](ui-layout-contract-v1.md).

## Distribution et autorité

Le moteur `selectWheelReward` reste le propriétaire unique : 100 valeurs entières équiprobables, rien 2 %, sept éléments à 10 % chacun, Moras 20 %, Primogemmes 8 %. `getWheelProbabilities` énumère ces valeurs sans RNG et groupe leurs récompenses exactes, quantité incluse. Le serializer `wheel/today` joint cette projection à la lecture authentifiée. Le navigateur conserve cette même projection après le reçu de spin ; aucune table frontend de probabilités ni configuration économique supplémentaire.

Le SVG utilise les angles cumulés de cette projection : rien 7,2°, chaque élément 36°, Moras 72°, Primogemmes 28,8°. Couleurs et chemins d'icônes sont des métadonnées de présentation. Projection absente/invalide : aucune roue ni demande de spin activée ; aucune distribution inventée. Le détail Probabilités reprend exactement la projection reçue, dont les sept éléments et les quantités réelles.

`SpinDailyWheel` et `PrismaWheelStore` conservent droit quotidien Europe/Paris, transaction, verrou Player, RNG, crédit et reçu persisté. Aucune modification de ces responsabilités, aucun second tirage client. UI, chat et Twitch continuent d'utiliser le même moteur existant ; le lot n'ajoute aucune intégration Twitch.

## Présentation d'un reçu réel

Avant la réponse, état Tirage et garde synchrone empêchant deux clics. La roue tourne seulement après réception d'un nouveau résultat serveur, cinq tours plus l'angle nécessaire pour centrer le secteur exact sous le pointeur fixe. Décélération de 3,8 secondes ; transition terminée ou garde de 4,1 secondes révèle le gain. Passer termine uniquement la présentation. Réduction des animations ou onglet caché : restitution immédiate sans mutation supplémentaire.

Le résultat confirmé bloque localement une seconde intention même si le parent n'a pas encore publié son DTO. Une réponse `alreadySpun`, un résultat chargé après F5, un gain par chat/autre onglet ou une journée importée dont le gain historique est inconnu ne simulent aucun nouveau spin. La réouverture dépend uniquement de la nouvelle `businessDate` serveur. Aucun reset calculé par une horloge client.

Le résultat réel reste visible ; particules de l'élément effectivement attribué, absence de gain explicite, Moras et Primogemmes avec quantités autoritatives. Un éclat bref accompagne seulement un nouveau reçu présenté ; aucune célébration lors d'une lecture historique.

## Géométrie et accessibilité

Le panneau Quotidiennes conserve ses contrôles structurels. Seul son body lorsqu'il contient la roue adopte un contenu sans scroll dédié ; les autres onglets et le GameShell ne changent pas. La carte réserve son titre, le statut et les actions avant d'attribuer le reste au stage. `ResizeObserver` prend le minimum largeur/hauteur disponible pour le diamètre SVG. Mobile utilise le flux normal du shell et une carte bornée au viewport ; faible hauteur : espacement réduit, commandes conservées. Aucun masquage de scrollbar pour dissimuler un dépassement.

Boutons partagés sombres avec états focus/disabled/pending. Passer rend le focus à Probabilités s'il le détenait. Détail dans une modale bornée, Tab/Escape et retour du focus via `useModalDialog`. Résultat annoncé par statut accessible ; SVG et table textuelle décrivent la même distribution. `prefers-reduced-motion` supprime rotation et éclat.

## Vérifications et limites

Tests ciblés : projection de chacun des 100 rolls, somme 100 %, sept éléments, angles et arrêt au secteur réel, chaque type de gain, garde double clic, skip sans seconde mutation, reçu déjà utilisé, F5 simulé, ancien gain inconnu, reset confirmé par DTO, réduction des mouvements, détail et clavier. Recette visuelle requise sous GameShell complet/CSS compilés à 390×844, 1366×768, 1920×1080, 2560×1440, faible hauteur desktop et mobile paysage. Le résultat des contrôles et la recette publique humaine restent au Master ; aucun scénario économique public de test.

[Preuve locale intégrée du 11/10](../architecture/evidence/consolidated-d-20261011.json) : 54 états Roue et six captures de probabilités sur six formats, douze positions réelles de rotation dont une transition intégralement attendue à 3,8 secondes. Le contrôle complet sur `15652ed` reste **FAIL, 6/8 étapes** : frontend 1525 réussites/4 échecs, backend non-DB 2393 réussites/6 échecs ; les dix assertions de baseline sont nommées dans la preuve. Builds, types, lint et diff passent. Les visuels portent `07574ec` et leur hash CSS ; le full inclut la reprise C et le premier correctif sources B, mais précède le correctif Unicode B et ses 76 tests distincts. Aucune revue, publication ou recette humaine n’est présumée.

Qualification finale combinée sur `9ade5e3` : full **FAIL6/8**, frontend1530 PASS/4 FAIL et backend2394 PASS/6 FAIL, exactement les dix assertions historiques, sans timeout supplémentaire ; builds/types/lint/diff PASS. Nouvelle campagne54états/six modales/douze positions PASS avec six PNG inspectés et CSS de production `index-D_ncPCj0.css` (hash dans la preuve). Harnais GameShell compilé privé/fixtures synthétiques : seul ce CSS est chargé, aucun module dev ni réseau extérieur. Trois timeouts initiaux de chargement du harnais Vite sont conservés distinctement, sans réussite déduite ; aucun changement produit ni affaiblissement des assertions pour la passe compilée. Revue indépendante sur SHA publié, déploiement et recette humaine restent des preuves séparées au Master.
