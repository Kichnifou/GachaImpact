# 23 — Audit Help / cohérence finale des commandes

> Domaine 20 de l'audit GachaImpact.  
> Statut : **CLÔTURÉ — décisions produit R728 à R731 validées ; cohérence Help cible définie**.  
> Ce document est la source spécialisée du domaine Help / cohérence finale des commandes.  
> L'état global du projet et la prochaine reprise exacte restent la responsabilité du Master.

---

# 1. Objectif du domaine

Auditer la commande legacy `!help`, la recroiser avec l'ensemble des commandes réellement validées pendant les audits spécialisés et définir la cible V1 de l'aide textuelle.

Le domaine couvre :

- le comportement réel de `legacy/streamerbot/commands/Help.txt` ;
- les catégories et routes d'aide ;
- la distinction entre catégories d'aide et aide directe par commande ;
- la cohérence des syntaxes player-facing ;
- la disponibilité selon le canal ;
- la séparation joueur / administration ;
- la correction des références legacy devenues obsolètes ;
- la cohérence avec `docs/commands/command-reference.md` ;
- la cohérence avec les décisions spécialisées déjà validées ;
- la préparation de la future aide Twitch/chat et de la future section Aide / Guide standalone.

Le domaine Help ne possède aucune logique métier de gameplay.

Il décrit et oriente vers des commandes dont les règles restent possédées par leurs domaines respectifs.

---

# 2. Sources inspectées

Source legacy principale :

- `legacy/streamerbot/commands/Help.txt`

Sources de cohérence :

- `docs/commands/command-reference.md`
- `docs/legacy/03-command-data-matrix.md`
- `docs/specifications/decisions-log.md`
- `docs/master/PROJECT_MASTER_PLAN.md`
- audits spécialisés `docs/legacy/04-*` à `docs/legacy/22-*`
- inventaire réel des scripts de `legacy/streamerbot/commands/`

Le vrai code de `Help.txt` a été lu intégralement.

---

# 3. Nature réelle de `Help.txt`

Le script legacy est strictement statique.

Il :

- lit l'entrée de la commande ;
- route cette entrée vers une catégorie ;
- envoie une ligne de texte ;
- ne lit aucun fichier JSON ;
- ne lit aucun profil joueur ;
- ne crée aucun viewer ;
- ne modifie aucune donnée ;
- ne sauvegarde rien.

Le header de `Help.txt` est ici cohérent avec le code réel.

Conséquence :

`!help` ne doit pas devenir dépendant du niveau, de l'élément, des ressources ou d'un état de progression du joueur.

La ligne historique de `docs/legacy/03-command-data-matrix.md` indiquant que Help lit `viewers_data.json` est incorrecte et doit être corrigée.

---

# 4. Structure legacy actuelle

Sans argument :

`!help`

affiche huit catégories :

- progression ;
- gacha ;
- ressources ;
- collection ;
- social ;
- shop ;
- stats ;
- code.

Le routeur accepte aussi plusieurs entrées historiques comme :

- `xp` ;
- `pull` / `pulls` ;
- `sac` ;
- `box` ;
- `team` ;
- `echanger` / `échange` / `echange` ;
- `boutique` ;
- `top` ;
- `codes` ;
- `gift`.

Le problème est qu'une partie de ces tokens mélange :

- nom de catégorie ;
- nom de commande ;
- alias historique ;
- système qui n'est plus une commande canonique.

---

# 5. Couverture réelle du Help legacy

L'inventaire des scripts de commandes contient 37 scripts.

Trois scripts ne correspondent pas à une commande joueur canonique V1 :

- `XP.txt` : orchestrateur de messages / XP, pas `!xp` ;
- `Gift.txt` : Custom Reward Twitch `Gift Suprême`, pas commande `!gift` canonique ;
- `Subscription.txt` : trigger Twitch de Faveur, pas commande `!subscription`.

Il reste donc 34 racines de commandes player-facing en comptant `!help` lui-même, soit 33 autres racines à pouvoir documenter.

Le Help legacy ne représente directement que 14 de ces 33 autres racines :

- `!element`
- `!banniere`
- `!select`
- `!pull`
- `!pity`
- `!sac`
- `!convertir`
- `!box`
- `!obtention`
- `!team`
- `!echanger`
- `!shop`
- `!top`
- `!code`

Dix-neuf racines validées sont absentes de l'aide legacy :

- `!vote`
- `!banque`
- `!coffre`
- `!passifs`
- `!combat`
- `!quotis`
- `!mission`
- `!expedition`
- `!roue`
- `!ami`
- `!infos`
- `!liste`
- `!event`
- `!concours`
- `!stella`
- `!legende`
- `!faveur`
- `!wish`
- `!giveaway`

Le Help legacy est donc structurellement incomplet pour la V1.

---

# 6. Écarts legacy identifiés

## 6.1 `gift` mal routé

Dans le legacy :

`!help gift`

route vers l'aide des Codes cadeaux.

La cible a depuis établi que :

- `Gift Suprême` est une Custom Reward Twitch ;
- aucune commande joueur `!gift` n'est canonique en V1.

Le mapping `gift -> code` doit disparaître.

Ce point est une correction évidente, pas une décision produit supplémentaire.

## 6.2 Gacha incomplet

L'aide Gacha legacy ne mentionne pas `!vote`.

Elle présente aussi le Pull sous une forme partielle :

`!pull / !pull 10`

La syntaxe cible est :

`!pull` ou `!pull <1..10>`.

## 6.3 Collection incomplète et trop orientée raccourcis legacy

Le Help legacy expose directement :

`!box a/c/d/e`

La V1 conserve la règle transverse suivante :

- les helpers présentent une syntaxe canonique ;
- les aliases éventuels restent une compatibilité, pas la syntaxe mise en avant.

La catégorie Collection doit également connaître `!stella` et `!legende`.

## 6.4 Social mal regroupé

Le Help legacy range dans Social :

- Team ;
- Échanger.

La cible distingue désormais clairement :

- Social : Ami / Infos / Liste ;
- Équipe : Team / Passifs / Combat ;
- Ressources : Sac / Conversion / Banque / Échanges / Boutique / Coffre.

## 6.5 Quotidiennes absentes

Le Help legacy ignore complètement :

- `!quotis`
- `!mission`
- `!expedition`
- `!roue`
- `!combat`

alors que ces systèmes sont centraux dans la boucle quotidienne.

## 6.6 `!passifs` absent

Le vrai contrat player-facing est :

`!passifs`

au pluriel.

Le nom technique du fichier `Passif.txt` ne doit pas conduire à inventer `!passif` comme syntaxe canonique.

## 6.7 Top : vocabulaire `luck` obsolète comme syntaxe recommandée

R722 a déjà remplacé le libellé player-facing `Luck` par :

**Taux de 5★**

R731 fixe désormais également la syntaxe canonique :

`!top taux5`

L'ancien :

`!top luck`

peut rester accepté comme alias de compatibilité, mais ne doit plus être recommandé dans l'aide.

## 6.8 Code incomplet

Le Help legacy ne présente que :

`!code NOMDUCODE`

La cible possède deux usages :

- `!code` : consulter les codes disponibles ;
- `!code <CODE>` : réclamer un code.

## 6.9 Conditions legacy niveau 2 dépassées

Certains scripts historiques contiennent encore des seuils de niveau devenus obsolètes, notamment Wish et l'acquisition de Faveur.

Les audits spécialisés ont déjà remplacé ces règles.

Help ne doit jamais recopier un ancien prérequis depuis le script si le document spécialisé du domaine possède une règle cible plus récente.

---

# 7. Principes transversaux acquis

Sans nouveau Rxxx :

- `!help` reste read-only ;
- aucune persistance spécifique Help ;
- aucune dépendance à l'état du joueur pour afficher l'aide générale ;
- les règles métier restent dans les services/domaines propriétaires ;
- les helpers restent courts ;
- une réponse Twitch normale tient sur une ligne ;
- une syntaxe canonique est affichée même si plusieurs aliases sont acceptés ;
- aucun vocabulaire de migration ou de legacy n'est exposé au joueur ;
- les catégories et commandes indisponibles sur le canal courant peuvent être filtrées ;
- les permissions sont appliquées avant de présenter une action réservée ;
- un token inconnu renvoie une aide compacte ;
- le futur routeur doit éviter de reproduire un gros `switch` statique difficile à maintenir ;
- une configuration/registry centralisée de métadonnées de commandes est préférable ;
- les descriptions Help ne deviennent jamais une seconde source de vérité des règles économiques ou gameplay détaillées.

---

# 8. R728 — Catégories + aide directe par commande — ✅ VALIDÉ B

La cible conserve une aide à deux niveaux.

## Niveau 1 — catégories

`!help`

affiche les catégories principales.

Exemple conceptuel :

`!help progression | gacha | ressources | collection | equipe | activites | social | events | classements | twitch`

## Niveau 2 — catégorie

Exemple :

`!help gacha`

affiche les commandes Gacha principales et leur usage court.

## Niveau 3 — commande directe

Exemples :

- `!help pull`
- `!help team`
- `!help banque`
- `!help ami`

affichent l'aide compacte de la commande elle-même.

### Résolution des ambiguïtés

Lorsqu'un token est aussi historiquement un alias de catégorie et le nom réel d'une commande, la commande directe est prioritaire.

Exemples :

- `!help box` -> aide de `!box`, pas toute la catégorie Collection ;
- `!help shop` -> aide de `!shop`, pas toute la catégorie Ressources ;
- `!help top` -> aide de `!top`, pas seulement le résumé de catégorie Classements.

La catégorie reste accessible par son nom fonctionnel explicite.

---

# 9. R729 — Dix catégories fonctionnelles — ✅ VALIDÉ A

Les catégories principales cibles sont :

1. `progression`
2. `gacha`
3. `ressources`
4. `collection`
5. `equipe`
6. `activites`
7. `social`
8. `events`
9. `classements`
10. `twitch`

## Progression

Couvre principalement :

- `!element`
- progression XP obtenue en parlant dans les chats éligibles ;
- `!faveur` pour consulter l'état personnel de Faveur.

Il n'existe pas de commande canonique `!xp`.

## Gacha

- `!banniere`
- `!select`
- `!vote`
- `!pull`
- `!pity`

## Ressources

- `!sac`
- `!convertir`
- `!banque`
- `!echanger`
- `!shop`
- `!coffre`

## Collection

- `!box`
- `!obtention`
- `!stella`
- `!legende`

## Équipe

- `!team`
- `!passifs`
- `!combat`

Combat reste propriétaire de ses règles, mais son accès est cohérent dans cette catégorie car il dépend fortement de la composition utilisée.

## Activités

- `!quotis`
- `!mission`
- `!expedition`
- `!roue`

`!combat` peut également être rappelé par `!quotis`, mais sa documentation principale reste dans Équipe/Combat.

## Social

- `!ami`
- `!infos`
- `!liste`

## Events

- `!event`
- `!concours`
- `!code`

Les Codes restent un système transversal de récompense, mais cette catégorie est une porte d'entrée cohérente pour les activités temporaires et récompenses événementielles.

## Classements

- `!top`

## Twitch

Cette catégorie explique les fonctionnalités réellement spécifiques ou acquises via Twitch :

- acquisition de Faveur via subscriptions compatibles ;
- `Gift Suprême` via Custom Reward Twitch ;
- `!wish` ;
- consultation publique du Giveaway via `!giveaway stats`.

`!faveur` peut être documenté directement depuis sa propre aide même si son acquisition est Twitch-only.

### Alias de catégories

Des aliases non ambigus peuvent être acceptés pour confort.

Exemples possibles :

- `xp` -> `progression`
- `stats` -> `classements`
- `quotidiennes` / `daily` -> `activites`
- `équipe` -> `equipe`

Un alias ne doit pas voler le token canonique d'une vraie commande.

---

# 10. R730 — Séparer aide joueur et administration — ✅ VALIDÉ A

L'aide publique normale ne doit pas exposer inutilement les mutations réservées au broadcaster/Admin.

## Aide joueur Twitch

`!help twitch` peut expliquer :

- Faveur / subscriptions ;
- Gift Suprême ;
- `!wish` ;
- `!giveaway stats`.

## Administration Giveaway

Les commandes :

- `!giveaway open`
- `!giveaway close`
- `!giveaway reroll`

restent réservées aux personnes autorisées.

Elles :

- ne sont pas placardées dans l'aide publique normale ;
- sont documentées dans la future Documentation Technique Twitch ;
- peuvent être accessibles via une aide Admin dédiée uniquement si l'utilisateur courant possède les permissions nécessaires.

La cible peut donc prévoir conceptuellement :

`!help admin`

mais ce token n'est utile que pour un utilisateur autorisé et ne doit pas apparaître dans le Help joueur public.

---

# 11. R731 — Syntaxe canonique `!top taux5` — ✅ VALIDÉ A

Le classement player-facing :

**Taux de 5★**

utilise désormais comme syntaxe canonique :

`!top taux5`

L'alias historique :

`!top luck`

reste acceptable pour compatibilité.

Les helpers et la future documentation recommandent uniquement :

`!top taux5`

Cette décision ne modifie pas la formule ni le minimum de 100 Pulls validés par R722.

---

# 12. Catalogue des racines player-facing

La cible Help doit connaître les racines suivantes :

- `!help`
- `!element`
- `!banniere`
- `!select`
- `!vote`
- `!pull`
- `!pity`
- `!sac`
- `!convertir`
- `!banque`
- `!echanger`
- `!shop`
- `!coffre`
- `!box`
- `!obtention`
- `!stella`
- `!legende`
- `!team`
- `!passifs`
- `!combat`
- `!quotis`
- `!mission`
- `!expedition`
- `!roue`
- `!ami`
- `!infos`
- `!liste`
- `!event`
- `!concours`
- `!code`
- `!top`
- `!faveur`
- `!wish`
- `!giveaway`

Ne pas inventer :

- `!xp`
- `!gift`
- `!subscription`

---

# 13. Disponibilité selon le canal

La métadonnée Help cible doit pouvoir distinguer au minimum :

- UI standalone ;
- chat interne ;
- Twitch ;
- Admin.

Le même catalogue conceptuel peut être utilisé pour construire les aides, mais le rendu est filtré selon le canal.

Exemples :

- `!wish` : Twitch uniquement ;
- Gift Suprême : Twitch uniquement, sans racine `!gift` ;
- acquisition de Faveur : événement Twitch ;
- `!faveur` : consultation chat interne/Twitch selon le contrat validé ;
- commandes Admin Giveaway : uniquement personnes autorisées ;
- une commande non disponible sur le canal courant ne doit pas être présentée comme exécutable sur ce canal.

---

# 14. Cible technique du routeur d'aide

Le nom technique final n'est pas figé.

Conceptuellement, disposer d'un registre central avec pour chaque commande :

- token canonique ;
- aliases acceptés ;
- catégorie(s) ;
- syntaxe canonique courte ;
- résumé player-facing ;
- canaux disponibles ;
- niveau de permission ;
- éventuel lien/navigation UI ;
- identifiant du domaine propriétaire.

Ce registre sert à construire :

- `!help`
- `!help <categorie>`
- `!help <commande>`
- les helpers de syntaxe lorsque cela est pertinent.

Important :

le registre Help contient des métadonnées de présentation.

Il ne doit pas recopier les règles métier détaillées comme :

- probabilités Gacha ;
- soldes ;
- calculs Combat ;
- règles de récompense ;
- transitions de missions.

Ces règles restent dans leurs services et documents propriétaires.

---

# 15. Comportement d'erreur

## Token inconnu

Exemple conceptuel :

`⚠️ Aide inconnue. Utilise !help pour voir les catégories.`

## Commande connue mais indisponible sur ce canal

Ne pas prétendre qu'elle peut être utilisée ici.

La réponse peut indiquer brièvement le canal adapté lorsque cela aide réellement le joueur.

## Action Admin sans permission

Ne pas exposer le détail opérationnel de l'administration au joueur non autorisé.

La réponse reste courte.

---

# 16. Standalone : Aide / Guide distinct du Help textuel

La future section standalone `Aide / Guide` ne doit pas être une simple copie graphique de `!help`.

Elle pourra proposer :

- guide de démarrage ;
- catégories fonctionnelles ;
- fiches de systèmes ;
- recherche ;
- commandes disponibles dans le chat interne ;
- informations plus riches que la limite d'une ligne Twitch.

Le registre des commandes pourra alimenter les portions « commandes », mais l'Aide standalone reste une expérience joueur plus large.

Le prototype V0 actuel ne possède pas encore cet écran.

Sa conception détaillée pourra être faite lors de l'implémentation V1 à partir des documents validés.

---

# 17. Documentation Twitch externe

Deux documents externes restent prévus à la toute fin du sweep documentaire.

## Guide de démarrage Twitch

Objectif :

guider un nouveau viewer dans l'ordre naturel de découverte du jeu.

Direction :

- choix de l'élément ;
- messages / XP ;
- `!quotis` ;
- premières activités ;
- Gacha ;
- ressources ;
- Box / Team ;
- Social ;
- Events ;
- fonctionnalités spécifiques Twitch.

## Documentation Technique Twitch

Objectif :

référence exhaustive du fonctionnement Twitch.

Elle couvrira notamment :

- commandes ;
- syntaxes ;
- prérequis ;
- coûts ;
- cooldowns / resets ;
- récompenses ;
- probabilités lorsque pertinentes ;
- règles spécifiques ;
- Faveur / Subscription ;
- Gift Suprême ;
- Giveaway / Wish ;
- administration.

Ces documents ne doivent être rédigés définitivement qu'après :

1. le sweep exhaustif des 37 scripts ;
2. le sweep exhaustif des 17 JSON ;
3. la correction des dernières incohérences détectées.

Les captures Notion fournies servent de référence de présentation, jamais de source de vérité métier.

---

# 18. Migration

Help ne possède aucune donnée persistante à migrer.

À conserver éventuellement pour compatibilité textuelle :

- certains aliases historiques utiles ;
- les noms de commandes encore valides.

À ne pas conserver comme comportement cible :

- catégories historiques devenues incohérentes ;
- mapping `gift -> code` ;
- syntaxes obsolètes mises en avant ;
- prérequis legacy remplacés par un audit spécialisé plus récent.

---

# 19. Definition of Ready pour implémentation future

Le domaine Help est suffisamment cadré pour un futur lot Codex lorsque les points suivants sont appliqués :

- registre des commandes canonique connu ;
- catégories R729 connues ;
- aide directe R728 connue ;
- séparation Admin R730 connue ;
- syntaxe `!top taux5` R731 connue ;
- disponibilité par canal connue dans `command-reference.md` ;
- syntaxes détaillées possédées par les domaines spécialisés ;
- aucun besoin de persistance Help ;
- aucune logique métier dupliquée dans le routeur Help.

L'implémentation devra néanmoins être précédée du sweep exhaustif final afin de s'assurer qu'aucune racine, alias ou contradiction player-facing n'a été oubliée.

---

# 20. État de clôture

Décisions produit validées :

- R728 — catégories + aide directe par commande ;
- R729 — dix catégories fonctionnelles ;
- R730 — séparation aide joueur / administration ;
- R731 — `!top taux5` canonique, `!top luck` alias.

Corrections techniques acquises :

- Help est réellement sans JSON et sans état joueur ;
- la matrice legacy doit être corrigée ;
- aucun `!xp`, `!gift` ou `!subscription` player-facing n'est inventé ;
- `!help gift` ne route plus vers Codes dans la cible ;
- `!vote` et les autres commandes validées doivent entrer dans le catalogue Help ;
- `!passifs` est la syntaxe canonique ;
- `!code` possède consultation et claim ;
- l'aide respecte les canaux et permissions ;
- le Help Twitch reste compact et sur une ligne ;
- l'Aide / Guide standalone reste distincte du Help textuel.

Statut final du domaine :

**CLÔTURÉ après R731, sous réserve des corrections factuelles pouvant ressortir du sweep exhaustif final.**

La prochaine étape globale n'est pas définie ici ; elle appartient au Master.
