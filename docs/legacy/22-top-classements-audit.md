# 22 — Audit Top / Classements globaux

> Domaine 19 de l'audit GachaImpact.  
> Statut : **CLÔTURÉ — décisions produit R714 à R727 validées ; clôture technique finalisée**.  
> Ce document est la source spécialisée validée du domaine Top / Classements globaux.  
> L'état global du projet et la prochaine reprise exacte restent la responsabilité du Master.

---

# 1. Objectif du domaine

Auditer puis spécifier le système global de **Top / Classements**.

Le domaine couvre :

- `!top` ;
- `!top me` ;
- les classements globaux historiques issus de `Top.txt` ;
- la future interface standalone `Classements` ;
- les sources de données de chaque métrique ;
- les règles de visibilité / confidentialité ;
- l'éligibilité des joueurs ;
- les égalités ;
- le nombre de résultats ;
- le classement Moras et l'interaction avec Banque ;
- la distinction entre classements globaux permanents et classements propres à un domaine ;
- la migration ;
- les performances / caches éventuels ;
- la cohérence avec le Profil et les statistiques.

Le Domaine Top ne devient jamais propriétaire des statistiques classées.

Il ne fait que lire / agréger les sources autoritatives des domaines concernés.

---

# 2. Sources réelles inspectées

Source legacy principale :

- `legacy/streamerbot/commands/Top.txt`

Documents recroisés :

- `docs/legacy/09-banque-audit.md`
- `docs/legacy/14-ami-social-audit.md`
- `docs/legacy/07-box-possession-obtention-audit.md`
- `docs/legacy/06-gacha-invocation-audit.md`
- `docs/legacy/04-xp-audit.md`
- `docs/legacy/03-command-data-matrix.md`
- `docs/specifications/decisions-log.md`
- `docs/commands/command-reference.md`
- `docs/master/PROJECT_MASTER_PLAN.md`

Source de données legacy :

- `legacy/streamerbot/data/viewers_data.json`

---

# 3. Nature réelle de `Top.txt`

`Top.txt` est entièrement **read-only**.

Il :

- lit `viewers_data.json` ;
- ne crée aucun viewer ;
- ne modifie aucune statistique ;
- ne sauvegarde aucun JSON ;
- calcule les classements à la demande ;
- ne conserve aucun snapshot de classement ;
- ne possède aucun historique ;
- ne possède aucune saison ;
- ne possède aucune récompense de classement.

La cible doit conserver cette séparation :

**Top = lecture / projection de données possédées par d'autres domaines.**

---

# 4. Syntaxes legacy réellement supportées

## Aide

`!top`

## Résumé personnel

`!top me`

## Progression / activité

- `!top xp`
- `!top level`
- `!top lvl`
- `!top niveau`
- `!top messages`
- `!top msg`
- `!top counted`
- `!top messages-xp`

## Gacha

- `!top pulls`
- `!top luck`
- `!top 5stars`
- `!top 5`
- `!top 4stars`
- `!top 4`
- `!top pity`
- `!top 5050`
- `!top 50/50`
- `!top lose5050`
- `!top lost5050`

## Ressources

- `!top primos`
- `!top moras`
- `!top particles`
- `!top particules`
- `!top pyro`
- `!top hydro`
- `!top cryo`
- `!top electro`
- `!top anemo`
- `!top geo`
- `!top dendro`

## Collection

- `!top box`
- `!top c6`
- `!top copies`

## Statistiques économiques cumulatives

- `!top primos-earned`
- `!top primos-spent`
- `!top moras-earned`
- `!top moras-spent`

Le header du script est ici assez fidèle au code réel.

---

# 5. Nombre de résultats legacy

Constante :

`MaxResults = 5`

Chaque `!top <mode>` renvoie donc au maximum :

**5 joueurs**

Format :

`1. pseudo (valeur) | 2. pseudo (valeur) | ...`

Aucune pagination.

Aucun moyen legacy de voir :

- Top 10 ;
- Top 50 ;
- sa propre position si elle est hors Top 5 ;
- les joueurs suivants.

La future UI standalone pourra naturellement aller plus loin, mais ce point reste produit.

---

# 6. Population classée legacy

`Top.txt` parcourt **toutes les entrées** de `viewers_data.json`.

Il ne vérifie :

- ni niveau minimum ;
- ni élément ;
- ni ancienneté ;
- ni activité récente ;
- ni compte Twitch lié ;
- ni type de profil.

Donc un profil incomplet peut techniquement entrer dans certains classements si sa valeur le permet.

Cible technique cohérente avec la règle transversale déjà validée :

**un classement global de gameplay ne doit considérer comme joueur actif qu'un profil ayant choisi son élément.**

Cette règle remplace les anciens proxies de participation.

Le standalone satisfait naturellement cette condition après onboarding.

---

# 7. Tri et égalités legacy

Le script trie uniquement :

`value décroissante`

Il ne possède aucun second critère explicite.

En cas d'égalité :

- aucun vrai rang partagé n'est calculé ;
- le rendu affiche simplement `1.`, `2.`, `3.` selon l'ordre de la liste après tri ;
- cet ordre n'a pas de garantie métier forte.

La V1 doit décider une vraie politique d'égalité.

Le choix récent du Domaine Giveaway (`classement compétition`) ne s'applique pas automatiquement à Top : Top est un domaine distinct.

---

# 8. `!top me`

`!top me` ne classe personne.

Il affiche au demandeur son propre résumé :

- niveau ;
- XP ;
- total Pulls ;
- total 5★ ;
- taux `luck` ;
- pity 5★ ;
- Primogemmes actuelles ;
- Moras portefeuille actuelles ;
- taille de Box ;
- nombre de C6.

Il ne permet pas :

- `!top me <stat>`
- `!top <pseudo>`

Il ne lit que le profil du demandeur.

La confidentialité n'est donc pas un problème pour `me`, puisque le joueur consulte ses propres données.

La V1 devra décider si cette commande reste utile alors que le Profil standalone contient déjà ces informations.

---

# 9. Progression — XP / niveau

## XP

Source :

`viewer.xp`

Le Domaine XP a validé :

- XP cumulative ;
- non dépensable ;
- continue après le niveau maximum.

Le classement XP est donc une vraie métrique cumulative stable.

## Niveau

Source legacy :

`viewer.level`

Dans la cible, le niveau est dérivable depuis XP et appartient à l'identité toujours visible.

Un Top Niveau peut rester une projection du niveau calculé.

Problème structurel :

une fois beaucoup de joueurs niveau 100, le Top Niveau peut devenir très peu discriminant.

Le Top XP reste alors plus précis.

---

# 10. Messages

Deux métriques legacy distinctes :

## `messages`

Source :

`stats.totalMessages`

Représente les messages observés / comptabilisés comme activité générale selon l'histoire du profil.

## `counted` / `messages-xp`

Source :

`stats.countedMessages`

Représente les messages ayant réellement été retenus pour la logique XP / progression correspondante.

Le Domaine XP a déjà documenté cette séparation.

Le Top ne doit jamais fusionner ces compteurs.

---

# 11. Pulls

Source :

`stats.totalPulls`

Statistique cumulative.

Elle appartient au Domaine Gacha.

Le Top ne recalcule pas les Pulls depuis l'historique de possessions.

Migration :

- conserver le compteur legacy ;
- les nouveaux Pulls continuent à alimenter la même statistique canonique.

---

# 12. 5★ / 4★

Sources :

- `stats.totalFiveStars`
- `stats.totalFourStars`

Ce sont des compteurs cumulés de raretés obtenues via la logique Gacha historique.

Ils ne représentent pas nécessairement :

- nombre de personnages uniques 5★ ;
- taille de Box 5★ ;
- nombre actuel de 5★ actifs.

Le libellé Top doit donc rester clair :

**5★ obtenus / 4★ obtenus**

plutôt que :

**personnages 5★ possédés**.

---

# 13. `luck` legacy

Formule :

`totalFiveStars / totalPulls × 100`

Exemple :

- 1 Pull ;
- 1 cinq étoiles ;

→ `100 %`.

Le script exige seulement :

`totalPulls > 0`

Aucun minimum statistique.

Conséquence :

un joueur avec très peu de Pulls peut dominer artificiellement le classement.

Autre nuance :

ce score ne mesure pas uniquement le hasard brut, car les 5★ peuvent être influencés par :

- pity ;
- garantie ;
- règles du moteur Gacha.

Il s'agit techniquement d'un :

**taux observé de 5★ par Pull**

et non d'une mesure probabiliste pure de chance.

La V1 doit décider :

- conserver `Luck` tel quel ;
- le renommer ;
- ajouter un minimum de Pulls ;
- ou supprimer ce classement.

---

# 14. Pity

Source legacy :

`viewer.pity.pity5`

Affichage :

`X/90`

Le Domaine Social a validé :

- pity / garantie publiques par défaut ;
- mais configurables Public / Amis / Privé.

Donc le Top Pity ne peut pas simplement lire tous les joueurs sans permission.

La valeur reste personnelle et actuelle, pas cumulative.

Un classement Pity est donc un classement d'état instantané.

---

# 15. 50/50 gagnés / perdus

Sources :

- `stats.fiftyFiftyWon`
- `stats.fiftyFiftyLost`

Ce sont des statistiques cumulatives Gacha.

Les aliases legacy sont :

- `5050`
- `50/50`
- `lose5050`
- `lost5050`

La V1 devra choisir des syntaxes canoniques plus lisibles dans l'aide sans devoir supprimer les alias historiques.

---

# 16. Primogemmes actuelles

Source :

`viewer.primogems`

Le Domaine Social a fixé :

**Soldes de monnaies = Privé par défaut**, configurable Public / Amis / Privé.

Le legacy `!top primos` viole donc la politique cible s'il affiche tout le monde sans contrôle.

Un classement public ne peut inclure la valeur actuelle d'un joueur qui n'a pas autorisé sa visibilité selon la politique retenue.

Le Top ne doit jamais contourner la confidentialité d'une monnaie.

---

# 17. Moras actuelles — dette de décision Banque

Legacy :

`!top moras`

classe uniquement :

`viewer.moras`

c'est-à-dire :

**portefeuille**

Il ignore :

`viewer.bank.moras`

Le Domaine Banque a volontairement reporté la décision au Domaine Top.

Trois concepts sont possibles :

## Portefeuille

`walletMoras`

Avantage :

- fidèle au legacy.

Limite :

- déposer en Banque fait mécaniquement baisser son rang sans réduire la richesse totale.

## Patrimoine

`walletMoras + bankMoras`

Avantage :

- représente mieux la richesse réelle.

Limite :

- si la Banque est privée, afficher/dériver ce total peut révéler indirectement son solde.

## Deux classements distincts

Exemples :

- Moras sur soi ;
- Patrimoine Moras.

Mais chacun doit respecter la confidentialité des composantes nécessaires.

Cette décision est explicitement attendue à partir de R714+.

---

# 18. Confidentialité Banque et richesse dérivée

Règles déjà validées :

- solde Banque privé par défaut ;
- soldes monnaies privés par défaut ;
- aucun calcul dérivé ne doit permettre de reconstruire une Banque privée.

Donc :

`patrimoine = portefeuille + banque`

n'est publiable que si la politique de confidentialité autorise réellement les composantes nécessaires.

Même un simple rang sans valeur exacte peut parfois révéler une information.

La stratégie globale des classements vis-à-vis des réglages `Public / Amis / Privé` doit donc être définie explicitement.

---

# 19. Particules

## Total

`!top particles`

additionne les sept soldes actuels :

- Pyro ;
- Hydro ;
- Cryo ;
- Electro ;
- Anemo ;
- Geo ;
- Dendro.

## Par élément

Chaque `!top pyro/hydro/...` classe le solde exact de cet élément.

Ces valeurs appartiennent aux **soldes de monnaies**.

Elles sont donc :

**Privées par défaut dans la cible Social.**

Le legacy ne respecte aucune permission.

---

# 20. Box

`!top box` retourne :

`nombre d'entrées dans viewer.box`

La cible Box a déjà établi :

- personnages désactivés entièrement masqués côté joueur ;
- statistiques visibles de collection excluent le personnage désactivé tant qu'il l'est.

Donc le Top Box cible ne doit pas utiliser aveuglément un `COUNT(*)` sur toutes les possessions historiques.

Il doit compter les possessions réellement actives / player-facing selon les règles du catalogue.

---

# 21. C6

`!top c6` compte les possessions dont :

`constellation >= 6`

Même règle sur les personnages désactivés :

- données conservées ;
- personnage non visible / non compté player-facing tant qu'il est désactivé.

Le Top ne lit pas directement `c6_characters.json`.

Il dérive le nombre depuis les possessions.

---

# 22. Copies

`!top copies`

additionne :

`owned.copies`

sur toute la Box legacy.

Le Domaine Box a corrigé certaines incohérences historiques de `copies`.

La cible doit utiliser la possession canonique migrée/corrigée.

Même règle :

- personnage catalogue désactivé → ne pas l'exposer dans un compteur public player-facing tant qu'il est désactivé.

---

# 23. Statistiques économiques cumulatives

Legacy :

- `totalPrimosEarned`
- `totalPrimosSpent`
- `totalMorasEarned`
- `totalMorasSpent`

Contrairement aux soldes courants, ces champs sont des **statistiques cumulatives**.

Le Domaine Social a validé :

- statistiques générales non sensibles publiques par défaut ;
- mais catégorie configurable.

Il faut néanmoins confirmer si ces quatre compteurs économiques sont classés dans :

- `Statistiques générales` ;
- ou une rubrique économique plus sensible.

Le Top ne doit pas faire cette classification implicitement.

---

# 24. Zéros et entrées sans activité

Pour presque tous les modes, `Top.txt` accepte une valeur égale à zéro.

Il ne rejette que :

- valeur négative / mode inconnu ;
- `luck` si `totalPulls <= 0`.

Donc si un classement possède peu de valeurs positives, le Top 5 peut contenir des joueurs à zéro.

La V1 devra décider si un joueur ayant `0` sur une métrique doit apparaître.

Recommandation technique :

ne pas encombrer un classement avec des zéros lorsque la métrique représente une activité/acquisition.

---

# 25. Aucun classement propre aux nouveaux domaines dans `Top.txt`

Le script historique ne contient aucun Top global pour :

- victoires Combat ;
- victoires Combat manuel ;
- Expeditions terminées ;
- cœurs ;
- niveau d'Amitié ;
- Missions ;
- Boss ;
- Concours ;
- Events ;
- Giveaway ;
- Roue ;
- autres statistiques ajoutées après l'écriture initiale du script.

Cela ne signifie pas qu'elles doivent toutes être ajoutées.

Il faut distinguer :

## Classements globaux permanents

Exemples potentiels :

- XP ;
- Pulls ;
- collection ;
- statistiques cumulatives.

## Classements appartenant déjà à un domaine

Exemples :

- Event → écran/onglet Classement Event ;
- Boss mensuel → classement Boss ;
- Concours → classements/historiques Concours ;
- Giveaway → classement de la session Twitch.

Ces classements spécialisés ne doivent pas être dupliqués arbitrairement dans Top.

---

# 26. Écran standalone `Classements`

Aucun écran legacy n'existe.

La V1 peut naturellement proposer une vraie interface graphique.

Conceptuellement, elle peut offrir :

- catégories ;
- sélecteur de métrique ;
- liste classée ;
- rang ;
- pseudo/avatar ;
- valeur ;
- ouverture du Profil en cliquant sur un joueur lorsque permis ;
- mise en évidence de son propre rang ;
- pagination / chargement progressif.

Le Domaine Social a déjà validé :

**les identités dans de futurs classements peuvent ouvrir le Profil.**

Le détail exact reste à décider.

---

# 27. Confidentialité : problème central

Le legacy rend tous les Tops publics.

La cible possède désormais une vraie confidentialité.

Matrice initiale déjà validée :

| Donnée | Valeur initiale |
|---|---|
| Niveau / élément | Toujours visible |
| Statistiques générales | Public |
| Box | Public |
| Pity / garantie | Public |
| Soldes de monnaies | Privé |
| Banque | Privé |
| Historiques détaillés | Privé |

Tous sauf identité toujours visible restent configurables.

Le Top doit donc posséder une politique claire.

Questions :

- un joueur avec une métrique `Privé` est-il simplement absent de ce classement ?
- `Amis uniquement` peut-il apparaître dans un classement personnalisé visible seulement par ses amis ?
- ou les classements globaux utilisent-ils uniquement les données `Public` ?
- un joueur peut-il masquer la valeur mais rester classé anonymement ? probablement non recommandé ;
- comment éviter les déductions via classement de valeurs dérivées ?

À fixer dans R714+.

---

# 28. Activation joueur

La règle transversale :

**élément choisi = joueur Twitch activé**

est applicable ici.

Un profil Twitch-only créé passivement mais sans élément :

- ne doit pas apparaître dans les classements globaux de gameplay ;
- ne doit pas produire des lignes à zéro ;
- rejoint naturellement les classements après activation.

Aucun niveau minimum spécifique Top n'est nécessaire.

---

# 29. `!top` et standalone

Direction conceptuelle probable :

## Standalone

Écran graphique `Classements`.

## Chat interne / Twitch

`!top <métrique>` reste un raccourci compact.

Les deux appellent le même service de Ranking.

Le nombre de résultats peut différer dans la restitution :

- chat : court ;
- UI : pagination / liste plus longue.

La règle métier de rang et de confidentialité reste identique.

---

# 30. Source de vérité / calcul

Top ne possède pas :

- XP ;
- soldes ;
- Box ;
- pity ;
- statistiques.

Chaque classement consomme le domaine propriétaire.

Concept cible :

`RankingMetricRegistry`

ou abstraction équivalente :

- ID stable de métrique ;
- libellé ;
- source ;
- sens de tri ;
- format ;
- catégorie de confidentialité ;
- éligibilité ;
- valeur nulle / zéro ;
- disponibilité UI/chat.

Cela évite un énorme `switch` reproduisant `Top.txt`.

Le nom technique précis sera choisi à l'implémentation.

---

# 31. Pas de table de classement autoritative nécessaire

Les valeurs sont déjà possédées par les domaines.

Le classement peut être :

- calculé à la demande ;
- requêté directement en DB ;
- éventuellement caché pour performance.

Un cache :

- n'est jamais source de vérité ;
- peut être invalidé/recalculé ;
- ne doit pas rendre une donnée privée visible après changement de confidentialité.

Aucune récompense ne dépend actuellement d'un rang Top global.

La cohérence forte économique n'a donc pas les mêmes contraintes qu'un classement donnant une récompense.

---

# 32. Mise à jour des classements

Dans l'UI, un classement peut évoluer après :

- gain d'XP ;
- Pull ;
- mutation de ressource ;
- changement de Box ;
- changement de pity ;
- etc.

Il n'est pas nécessaire de pousser chaque variation mondiale en temps réel à tous les clients.

Une stratégie de rafraîchissement raisonnable / invalidation de cache suffit.

Mais le joueur ne doit pas devoir faire F5 après une action locale pour voir sa propre nouvelle valeur si l'écran Classements est ouvert.

---

# 33. Migration

Le Domaine Top ne possède pas de données historiques à migrer.

Les rangs sont recalculés à partir des données migrées.

Ne pas inventer :

- ancien rang ;
- ancien Top 5 ;
- historique mensuel ;
- podium passé ;
- record historique.

Les statistiques sources suivent leurs propres migrations.

Après import :

- le classement est dérivé du nouvel état canonique ;
- les permissions de confidentialité cibles sont appliquées immédiatement.

---

# 34. `!top` invalide

Dans le legacy, un mode inconnu finit par produire :

`Aucune donnée disponible pour ce top.`

car la valeur retournée est `-1` pour tous les joueurs.

La cible doit plutôt distinguer :

- métrique inconnue ;
- classement valide mais sans entrée visible.

Une commande invalide doit renvoyer une aide compacte.

Correction technique, pas décision produit.

---

# 35. Aliases

Plusieurs aliases legacy sont purement ergonomiques :

- `lvl` / `level` / `niveau`
- `msg` / `messages`
- `counted` / `messages-xp`
- `5` / `5stars`
- `4` / `4stars`
- `particles` / `particules`
- `5050` / `50/50`
- `lose5050` / `lost5050`

La future aide peut afficher une syntaxe canonique unique tout en conservant certains aliases pour compatibilité Twitch.

---

# 36. Décisions techniques acquises

Sans consommer de Rxxx supplémentaires :

- Top reste strictement read-only ;
- aucune statistique n'est possédée par Top ;
- aucune donnée de rang global n'est une source de vérité persistante ;
- aucune donnée Top spécifique n'est à migrer ;
- les rangs sont dérivés des sources canoniques ;
- un profil sans élément n'entre pas dans les classements gameplay globaux ;
- aucun seuil de niveau spécifique n'est appliqué à Top ;
- personnages désactivés exclus des métriques player-facing Box/C6/copies ;
- les permissions sont évaluées côté serveur avant la construction du classement ;
- aucune donnée privée ou `Amis uniquement` n'est envoyée au client d'un classement global ;
- un joueur exclu pour confidentialité ne consomme aucun rang ;
- un cache éventuel de classement n'est jamais autoritatif ;
- un changement de confidentialité invalide immédiatement toute exposition mise en cache ;
- les domaines Event / Boss / Concours / Giveaway restent propriétaires de leurs classements spécialisés ;
- un mode `!top` inconnu renvoie une aide compacte ;
- UI standalone, chat interne et Twitch appellent le même service de Ranking ;
- les égalités utilisent un classement compétition ;
- l'ordre d'affichage de joueurs partageant exactement la même valeur peut être déterministe sans modifier leur rang ;
- les joueurs dont la valeur classée est `0` sont exclus du classement ;
- `!top me` reste une consultation personnelle et peut lire les propres données du joueur indépendamment de leur visibilité publique ;
- `!top <métrique>` reste une consultation d'un classement global public.

---

# 37. Décisions produit validées

## R714 — Classement Moras = patrimoine total — ✅ VALIDÉ

Le classement global `Moras` ne classe plus uniquement le portefeuille comme dans le legacy.

Valeur cible :

`patrimoine Moras = portefeuille + Banque`

Cette valeur reste dérivée et n'est pas persistée comme une nouvelle ressource.

### Confidentialité

Pour qu'un joueur puisse apparaître dans ce classement global :

- la visibilité de son solde de monnaies nécessaire au portefeuille doit être `Public` ;
- la visibilité de sa Banque doit être `Public`.

Si l'une de ces composantes est :

- `Amis uniquement` ;
- ou `Privé` ;

le joueur est entièrement absent du classement Moras.

Il :

- n'est pas affiché anonymement ;
- n'affiche pas une valeur masquée ;
- ne consomme aucun rang ;
- ne décale pas les joueurs publics placés derrière lui.

Exemple :

- Alice : patrimoine 8 000 000 — Public ;
- Bob : patrimoine 20 000 000 — Banque privée ;
- Chloé : patrimoine 6 000 000 — Public.

Classement public :

1. Alice ;
2. Chloé.

Bob n'existe pas dans la projection publique.

Cette décision résout la dépendance volontairement reportée par le Domaine Banque.

---

## R715 — Classements globaux basés uniquement sur les données publiques — ✅ VALIDÉ A

Un classement global possède une vue unique et cohérente pour tous les utilisateurs.

Pour la métrique concernée :

- `Public` → joueur éligible au classement ;
- `Amis uniquement` → joueur absent du classement global ;
- `Privé` → joueur absent du classement global.

Les classements ne changent donc pas selon la personne qui les regarde.

Un ami peut éventuellement consulter une métrique `Amis uniquement` depuis le Profil si cette permission l'autorise, mais cette donnée ne rejoint jamais le classement global.

Aucun classement anonyme de joueurs privés.

Un joueur exclu par confidentialité ne possède aucun rang public.

---

## R716 — Écran standalone `Classements` — ✅ VALIDÉ A

Créer un véritable écran standalone :

**Classements**

Il propose notamment :

- catégories ;
- sélection d'une métrique ;
- rang ;
- avatar ;
- pseudo ;
- valeur ;
- liste complète chargeable ;
- pagination ou virtualisation adaptée ;
- mise en évidence de la ligne du joueur courant lorsqu'il est lui-même classé ;
- clic sur avatar/pseudo ouvrant le Profil conformément aux règles Social.

L'UI n'est pas artificiellement limitée aux cinq premiers joueurs.

Si le propriétaire a rendu la métrique non publique :

- il n'est pas intégré au classement ;
- l'UI peut lui indiquer qu'il n'est pas classé car cette donnée n'est pas publique.

---

## R717 — Chats : Top 5 + rang personnel — ✅ VALIDÉ A

Dans Twitch et le chat interne :

`!top <métrique>`

affiche au maximum les cinq premiers rangs/lignes utiles dans un message compact.

Lorsque le demandeur :

- est éligible au classement ;
- possède une valeur > 0 ;
- et se trouve hors du Top affiché ;

la réponse ajoute son rang personnel compact.

Exemple :

`🏆 XP : 1. Alice (52 000) | 2. Bob (48 000) | 3. Chloé (41 000) | ... | Toi : #12 (21 000)`

Si le demandeur figure déjà parmi les résultats affichés :

- ne pas dupliquer sa ligne.

Si sa métrique n'est pas publique :

- ne pas calculer pour lui un faux rang dans le classement public.

Les réponses Twitch normales restent sur une seule ligne.

---

## R718 — Classement compétition pour les égalités — ✅ VALIDÉ A

Top utilise la même convention de rang que Giveaway :

**classement compétition**

Exemple :

- Alice : 100 → rang 1 ;
- Bob : 100 → rang 1 ;
- Chloé : 80 → rang 3 ;
- David : 70 → rang 4.

Le rang 2 est sauté.

L'ordre visuel à l'intérieur d'un groupe ex æquo peut rester déterministe, par exemple alphabétique, mais ne change jamais le rang.

---

## R719 — `!top me` conservé — ✅ VALIDÉ A

`!top me` reste disponible dans les chats.

Cette commande :

- affiche uniquement les données du demandeur ;
- n'est pas un classement public ;
- ne dépend donc pas de la visibilité publique de ses propres rubriques.

Elle conserve un résumé compact des statistiques personnelles utiles.

Le standalone utilise principalement le Profil, mais `!top me` reste utile sur Twitch et dans le chat interne.

La définition du classement Moras R714 ne force pas `!top me` à masquer les informations personnelles du propriétaire.

---

## R720 — Classements des soldes actuels conservés — ✅ VALIDÉ A

Conserver les classements de soldes actuels :

- Primogemmes ;
- patrimoine Moras ;
- particules totales ;
- Pyro ;
- Hydro ;
- Cryo ;
- Electro ;
- Anemo ;
- Geo ;
- Dendro.

Ces métriques appartiennent à des catégories économiques sensibles.

Elles ne participent au classement global que lorsque leur visibilité nécessaire est `Public`.

Comme les soldes de monnaies et la Banque sont privés par défaut :

- beaucoup de joueurs seront naturellement absents de ces classements tant qu'ils n'ont pas choisi de les rendre publics.

---

## R721 — Statistiques économiques `Earned / Spent` conservées — ✅ VALIDÉ A

Conserver :

- Primogemmes gagnées ;
- Primogemmes dépensées ;
- Moras gagnées ;
- Moras dépensées.

Ces compteurs sont classés dans :

**Statistiques générales cumulatives**

et non dans les soldes actuels.

Ils suivent donc la confidentialité de la rubrique Statistiques :

- `Public` par défaut ;
- configurable `Amis uniquement` ;
- configurable `Privé`.

Seule la valeur `Public` participe aux classements globaux.

Ces compteurs ne permettent pas de déterminer directement le solde courant.

---

## R722 — `Luck` devient `Taux de 5★` avec minimum de 100 Pulls — ✅ VALIDÉ A

La formule reste :

`totalFiveStars / totalPulls × 100`

Mais le libellé player-facing principal devient :

**Taux de 5★**

car cette valeur représente un taux observé et non une mesure pure de chance.

Condition d'entrée :

**au moins 100 Pulls**

Un joueur avec moins de 100 Pulls :

- n'apparaît pas dans ce classement ;
- ne possède pas de rang public pour cette métrique.

La syntaxe canonique player-facing a ensuite été fixée par R731 :

`!top taux5`

L'alias historique :

`!top luck`

reste accepté pour compatibilité mais n'est plus la syntaxe recommandée dans les helpers.

L'UI utilise le libellé clair `Taux de 5★`.

---

## R723 — Top Pity conservé — ✅ VALIDÉ A

Conserver un classement instantané du :

**pity 5★ actuel**

Valeur :

`pity5 / 90`

Il permet notamment de voir quels joueurs publics sont actuellement les plus proches de leur prochain 5★.

La métrique suit la rubrique de confidentialité Pity/Garantie.

Seules les valeurs `Public` apparaissent dans le classement global.

---

## R724 — Exclure les valeurs égales à zéro — ✅ VALIDÉ A

Une entrée avec valeur `0` n'apparaît pas dans un classement.

Exemples :

- 0 Pull ;
- 0 C6 ;
- 0 victoire ;
- 0 Expedition ;
- 0 particule.

Le service ne complète jamais artificiellement un Top 5 avec des joueurs sans activité pour cette métrique.

Cette exclusion intervient avant le calcul des rangs.

---

## R725 — Ajouter les statistiques globales récentes — ✅ VALIDÉ A

En plus des métriques legacy pertinentes, ajouter les classements permanents basés sur les statistiques cumulatives fiables déjà définies par les domaines récents.

Au minimum :

### Combat

- victoires Combat totales : `totalCombatWins` ;
- victoires Combat manuel : `totalManualCombatWins`.

### Expedition

- Expeditions terminées : `totalExpeditionsCompleted`.

### Social

- cœurs envoyés : `totalFriendHeartsSent`.

Ces métriques suivent la rubrique :

**Statistiques générales**

et nécessitent donc une visibilité `Public` pour apparaître globalement.

Ne pas recopier dans Top :

- classement Event ;
- Boss mensuel ;
- Concours ;
- Giveaway ;

car ces domaines possèdent déjà leurs propres classements spécialisés.

---

## R726 — Organisation de l'écran par catégories — ✅ VALIDÉ A

L'écran `Classements` organise les métriques par catégories.

### Progression

- XP ;
- Niveau ;
- Messages ;
- Messages XP.

### Gacha

- Pulls ;
- Taux de 5★ ;
- 5★ obtenus ;
- 4★ obtenus ;
- Pity ;
- 50/50 gagnés ;
- 50/50 perdus.

### Ressources

- Primogemmes ;
- patrimoine Moras ;
- particules totales ;
- particules par élément ;
- Primogemmes gagnées ;
- Primogemmes dépensées ;
- Moras gagnées ;
- Moras dépensées.

### Collection

- personnages possédés / Box ;
- C6 ;
- copies.

### Activité

- victoires Combat ;
- victoires Combat manuel ;
- Expeditions terminées ;
- cœurs envoyés.

La structure peut évoluer à partir du registre de métriques sans transformer chaque nouveau Top en logique frontend hardcodée.

---

## R727 — Classements globaux live, sans saisons ni récompenses — ✅ VALIDÉ A

Les classements globaux V1 représentent l'état courant.

Ne pas créer :

- saisons globales ;
- récompenses de rang ;
- ancien Top 1 ;
- podium hebdomadaire/mensuel ;
- historique mondial des rangs ;
- snapshots périodiques de tous les Tops.

Les classements spécialisés disposant déjà de leur propre historique ou récompenses continuent à les gérer dans leur domaine.

Top global reste :

**consultatif et honorifique.**

---

# 38. Contrat cible `!top`

## `!top`

Sans argument :

- aide compacte avec les principales catégories/métriques.

## `!top me`

- résumé personnel ;
- aucune exposition tierce ;
- disponible Twitch et chat interne.

## `!top <métrique>`

- classement global public ;
- maximum cinq résultats dans le chat ;
- rang personnel ajouté s'il est éligible et hors des lignes déjà affichées ;
- égalités en classement compétition ;
- valeurs 0 exclues ;
- profils sans élément exclus ;
- métriques non publiques exclues.

Aliases historiques ergonomiques peuvent rester acceptés.

Les aides doivent privilégier une syntaxe canonique lisible.

De nouvelles syntaxes simples peuvent notamment exposer :

- `!top combat`
- `!top combat-manuel`
- `!top expeditions`
- `!top coeurs`

Le mapping exact des aliases appartient au CommandRouter/configuration, pas à une logique métier dupliquée.

---

# 39. Confidentialité et calcul de rang

Pipeline conceptuel :

1. sélectionner la métrique ;
2. déterminer sa catégorie de confidentialité ;
3. filtrer les profils sans élément ;
4. filtrer les joueurs dont la métrique n'est pas `Public` ;
5. calculer la valeur depuis la source autoritative ;
6. exclure les valeurs <= 0 lorsque la métrique suit cette règle ;
7. trier décroissant ;
8. calculer les rangs compétition ;
9. retourner uniquement les résultats autorisés.

Une entrée masquée n'est jamais :

- conservée comme rang fantôme ;
- remplacée par `Privé` ;
- exposée anonymement.

Le calcul se fait directement sur la population visible.

---

# 40. Moras / Banque

`!top moras` et l'écran `Patrimoine Moras` utilisent :

`walletMoras + bankMoras`

Le portefeuille et la Banque restent deux ressources distinctes.

Le patrimoine :

- est dérivé ;
- n'est pas dépensable directement ;
- n'est pas persisté comme solde autonome.

Pour entrer dans ce classement global :

- portefeuille/monnaies = Public ;
- Banque = Public.

Aucune donnée dérivée ne doit permettre de reconstruire une Banque non publique.

---

# 41. Métriques cibles

Le registre de Ranking V1 doit au minimum pouvoir représenter les métriques validées de ce domaine.

Chaque définition conceptuelle possède :

- ID stable ;
- libellé ;
- catégorie UI ;
- source autoritative ;
- format d'affichage ;
- direction de tri ;
- catégorie de confidentialité ;
- règle d'éligibilité ;
- aliases chat ;
- disponibilité UI/chat.

Le Top ne possède jamais une copie autoritative de ces valeurs.

---

# 42. UI standalone

L'écran `Classements` :

- utilise le même RankingService que les chats ;
- peut afficher bien plus que cinq joueurs ;
- utilise pagination / chargement progressif / virtualisation selon le volume réel ;
- met en valeur le Top 3 visuellement ;
- affiche les ex æquo avec le même rang ;
- permet d'ouvrir le Profil depuis l'identité d'un joueur ;
- permet de changer rapidement de catégorie et métrique ;
- indique proprement une absence de données visibles ;
- indique au propriétaire lorsqu'il ne participe pas parce que sa donnée n'est pas publique.

Aucun rang caché n'est calculé côté client.

---

# 43. Migration

Aucun rang Top legacy n'est à migrer.

Après migration des sources :

- tous les classements sont recalculés depuis les données canoniques ;
- les règles de confidentialité V1 sont immédiatement appliquées ;
- les personnages désactivés sont exclus des métriques Collection player-facing ;
- aucun ancien Top 5 n'est reconstruit.

Ne pas inventer :

- historique des rangs ;
- ancien podium ;
- record de classement ;
- saison passée.

---

# 44. Critères d'acceptation

Le Domaine Top / Classements est prêt pour la V1 si les tests peuvent prouver notamment que :

1. Top n'écrit aucune statistique métier ;
2. un profil sans élément n'apparaît dans aucun classement gameplay global ;
3. aucun niveau minimum supplémentaire n'est nécessaire ;
4. une donnée `Privé` est totalement absente du classement ;
5. une donnée `Amis uniquement` est totalement absente du classement global, même pour un ami ;
6. un joueur absent pour confidentialité ne consomme aucun rang ;
7. un joueur à valeur 0 ne consomme aucun rang ;
8. les égalités donnent `1er, 1er, 3e` ;
9. le Top chat renvoie au maximum cinq résultats principaux ;
10. le rang personnel hors Top est affiché uniquement si le demandeur participe réellement au classement ;
11. `!top me` reste consultable pour ses propres données ;
12. l'écran standalone permet de parcourir la liste complète ;
13. les identités classées ouvrent le Profil ;
14. `!top moras` utilise portefeuille + Banque ;
15. un patrimoine Moras n'est classé que si portefeuille/monnaies et Banque sont tous deux Public ;
16. Primogemmes et particules actuelles suivent la confidentialité des soldes ;
17. les statistiques Earned/Spent suivent la rubrique Statistiques ;
18. `Taux de 5★` utilise la formule historique ;
19. moins de 100 Pulls exclut du classement Taux de 5★ ;
20. Pity reste classable lorsqu'il est Public ;
21. Box/C6/copies ignorent les personnages actuellement désactivés player-facing ;
22. Combat total est disponible ;
23. Combat manuel est disponible ;
24. Expeditions terminées sont disponibles ;
25. cœurs envoyés sont disponibles ;
26. Event/Boss/Concours/Giveaway ne sont pas dupliqués dans Top global ;
27. aucune récompense n'est accordée pour un rang global ;
28. aucune saison Top globale n'est créée ;
29. aucun historique de rang legacy absent n'est inventé ;
30. un changement Public → Privé retire la donnée du classement et des caches applicables ;
31. UI et chats obtiennent leurs résultats du même service ;
32. une métrique inconnue renvoie une aide et non un faux Top vide.

---

# 45. Conclusion du domaine

**Domaine Top / Classements globaux : CLÔTURÉ après R727.**

Le domaine définit maintenant :

- métriques globales ;
- confidentialité ;
- patrimoine Moras ;
- ex æquo ;
- Top chat ;
- rang personnel ;
- écran standalone ;
- nouveaux classements cumulés ;
- Taux de 5★ ;
- Pity ;
- exclusion des zéros ;
- absence de saisons/récompenses ;
- migration ;
- architecture read-only.

Le domaine ne doit être rouvert que si :

- une nouvelle statistique globale nécessite réellement un classement transversal ;
- la politique de confidentialité est explicitement révisée ;
- le sweep final révèle une dépendance oubliée ;
- une décision produit est explicitement modifiée.

---

# 46. Sweep final obligatoire

Même après clôture Top / Classements et du dernier audit Help, le sweep exhaustif final des **37 scripts `.txt` et 17 JSON** reste obligatoire avant le modèle de données cible final et la V1.
