# Chat global V1 — contrat produit

Statut : décisions produit validées. Le Chat global player-facing est matérialisé par les migrations 032–035, ses routes et le `ChatPanel` réel, avec resynchronisation UI ciblée. Le [Master](../master/PROJECT_MASTER_PLAN.md) porte seul l'état vivant et la validation publique. Le socle serveur/DB des MP est matérialisé par les migrations 036–038 et leur premier vertical UI est candidat sur `review` dans le même panneau Communauté ; leurs règles restent celles de [l'audit Social R501–R522](../legacy/14-ami-social-audit.md). Les syntaxes et résultats métier des commandes restent dans la [référence des commandes](../commands/command-reference.md).

## Messages et composition — R872

- Un message global V1 accepte du texte brut, des emojis Unicode et des URL cliquables ouvrant clairement une destination externe. Aucun HTML n'est interprété ; aucune image, GIF, pièce jointe ou aperçu média.
- La limite est de 500 caractères. Le champ est compact et monoligne ; Entrée envoie. Il n'y a pas de message multiligne dans le Chat global.
- Ces limites concernent le Chat global, pas les MP.

## Vie du message — R873 et R874

- L'auteur ne peut pas éditer un message envoyé. Il peut le supprimer ; la ligne garde sa position chronologique et affiche `Message supprimé`.
- Une suppression par la modération garde aussi la ligne, avec `Message supprimé par la modération` ; la raison détaillée et l'audit restent privés.
- Aucune réaction emoji n'est prévue dans la V1 initiale.
- Une réponse cible un message, mais reste dans le flux chronologique principal, sans fil séparé. Elle montre un petit aperçu du message ciblé. Si la cible est supprimée ensuite, l'aperçu devient `Message supprimé` et ne conserve aucune copie player-facing de son texte.

## Mentions — R875

- `@pseudo` dispose d'une autocomplétion légère. Une mention réellement résolue est mise en évidence dans le contenu du message, en conservant exactement la casse saisie ; une chaîne non résolue reste du texte ordinaire. Aucune notification persistante n'est ajoutée à la cloche Notifications.
- R885 complète R875 : la saisie manuelle d'un `@pseudo` entier et valide crée également une mention réelle. Le serveur résout le pseudo courant sans tenir le `playerId` fourni par le navigateur pour autorité, sans distinguer casse ni accents selon la normalisation Social ; il déduplique les cibles et borne leur nombre à dix. Un pseudo partiel ou inexistant reste du texte ordinaire. Les messages `COMMAND` ne créent aucune mention sociale.
- Un joueur bloqué est exclu des suggestions. Sa chaîne `@pseudo` saisie manuellement reste du texte ordinaire et ne produit pas de mention réelle.

## Lecture et non-lus — R876 et R877

- Quand le lecteur est au niveau des messages récents, les nouveaux messages sont suivis naturellement. S'il est remonté, leur arrivée ne déplace pas son scroll ; un indicateur compact, par exemple `3 nouveaux messages ↓`, permet de rejoindre le bas.
- Le panneau de droite conserve les onglets Chat/MP de R506. Les nouveaux messages globaux alimentent le badge Chat pendant la consultation des MP, quand le Chat est replié ou quand il n'est pas effectivement consulté. Un message n'est vu que si l'onglet Chat est réellement affiché **et** que le joueur se trouve au niveau des messages récents ; ouvrir l'onglet loin du bas ne purge pas les non-lus.
- Les vrais messages globaux `PLAYER`, `GAME_RESULT` et `SYSTEM` destinés à tous suivent cette règle. Aucune réponse privée n'est anticipée dans ce mécanisme.
- R877 est précisée par R890 : le joueur voit au maximum les **200 messages les plus récents de la génération courante**, sur la liste, les curseurs, les mises à jour, les non-lus et la mémoire client. Les lignes plus anciennes restent conservées en base pour audit/modération, mais ne sont pas chargeables par le parcours joueur. Aucun écran séparé « Voir tout l'historique du Chat » n'appartient au premier périmètre.

## Blocage, masquage et signalement — R878 et R879

- Un `PlayerBlock` empêche les interactions directes définies par Social, sans effacer automatiquement tous les messages de la personne du flux public.
- Le joueur peut masquer localement les messages d'une personne : chaque ligne masquée reste à sa place sous `Message masqué — Afficher` et peut être rouverte ponctuellement. L'action contextuelle de ce même joueur bascule entre `Masquer ce joueur` et `Démasquer ce joueur` et restaure alors toutes ses lignes chargées et futures. Aucun panneau global de joueurs masqués n'est affiché. Ce filtre d'affichage ne crée pas une relation sociale serveur ; son stockage local ou de session est un détail d'implémentation.
- Chaque message global offre `Signaler`. Le signalement conserve un snapshot du message et un contexte raisonnable autour pour la modération privée ; il ne retire pas automatiquement le message public. Le panneau complet de modération reste hors du premier lot.

## Anti-spam et commandes — R880 et R881

- Le serveur protège le Chat global contre les rafales manifestement abusives. Le seuil exact est technique et sera fixé pendant l'implémentation. Ce frein est distinct du quota général de messages et des cooldowns métier des commandes : une commande en cooldown ne doit pas empêcher de discuter normalement.
- Une saisie commençant par `!` est un vrai message public du joueur, conservé dans le flux sous sa forme originale, sauf l'exception de modération R886. Elle compte dans `totalMessages`, jamais dans l'XP ni dans `countedMessages` du seul fait d'être une commande, selon [l'audit XP](../legacy/04-xp-audit.md). Son exécution métier reste séparée du stockage/transport ; elle appelle le même service que l'UI lorsque ce service existe.
- Les résultats automatiques portent l'identité `GachaImpact` et se distinguent visuellement des messages `PLAYER`. Dans le périmètre initial, **toutes** les réponses de commandes sont publiques : succès, consultation, aide, erreur, mauvaise syntaxe et commande inconnue. La commande du joueur est elle aussi publique. Une erreur inconnue ou invalide peut orienter brièvement vers `!help`. Les contrats particuliers de la référence des commandes restent applicables.
- R886 définit l'exception interne de modération `!clear` : le serveur exige une attribution active `MODERATOR` ou `ADMIN` ; `TESTER` seul ne suffit pas. L'opération ouvre une nouvelle génération visible du Chat pour tous, y compris après F5 et pour l'historique/non-lus. L'ancien contenu reste conservé côté serveur pour audit. Ni la commande ni un résultat `GachaImpact` de clear ne restent visibles. Cette commande n'est pas envoyée à Twitch et n'apparaît pas dans l'aide joueur ordinaire.
- Aucune réponse de commande visible seulement par son auteur, aucun canal caché, message système privé ou toast privé n'est prévu ici. Une telle restitution est reportée au polish final, sans préparation technique dans le premier lot.

## Publications automatiques — R882

- Aucun message générique de connexion, déconnexion ou présence ne pollue le flux. La possibilité d'annoncer certains événements publics sera examinée au polish final, sans catalogue hypothétique aujourd'hui.
- Une action UI ne publie rien automatiquement dans le Chat ; elle garde sa restitution UI ou sa notification. Seule une règle produit spécialisée explicite peut prévoir une publication Chat. Une éventuelle extension générale UI → Chat est reportée au polish final.

## Identité et accès aux MP — R883

- Avatar et pseudo d'un message `PLAYER` ouvrent son Profil via le pattern existant. Un menu contextuel réutilise les primitives adaptées pour `Répondre`, `Mentionner`, `Signaler` et `Masquer` selon la ligne et les droits pertinents.
- `Envoyer un message privé` depuis un joueur du Chat peut ouvrir l'onglet MP et le parcours de conversation avec ce joueur, sous les permissions MP existantes. Le MP est toujours rédigé et envoyé dans l'onglet MP ; aucun `!mp` n'existe dans le Chat global ou sur Twitch.
- L'implémentation player-facing attache cette affordance à l'identité Player, à côté du pseudo, sans modifier la rangée R891 ni le clic avatar/pseudo vers Profil. Le même intent est réutilisé depuis le Profil.

## Couleur des auteurs PLAYER — R888

- Le pseudo d'un message `PLAYER` reprend la couleur de l'Élément réel de son auteur. L'avatar et le pseudo lisent la même valeur issue de `elementColors`, y compris pendant l'affichage optimiste du message courant ; l'absence d'Élément valide conserve un violet lisible.
- L'identité système `GachaImpact` conserve son rendu vert et n'utilise pas cette couleur d'auteur.

## Disponibilité des commandes internes — R884

- Le Chat conserve le maximum de jeu que les services serveur modernes portent avec le même état métier que l'interface. Il ne crée pas de système parallèle pour une commande.
- Le Concours se joue dans l'interface standalone. `!concours` reste une consultation de sa projection ; aucune création, participation, action, sortie ou annulation de Concours n'est disponible depuis `INTERNAL_CHAT`. Les syntaxes historiques restent documentées dans l'audit du domaine, sans devenir une disponibilité Chat actuelle.
- Event reste complet dans le Chat, Jeu C et sa commande thématique compris. Le texte original de cette commande est public comme toute commande selon R881 ; le message Event persisté conserve les règles de visibilité du domaine Event. Échanges, Combat, Expédition, Amitié et les autres commandes déjà branchées conservent leurs capacités physiques via leurs services propriétaires. La [référence des commandes](../commands/command-reference.md) détaille les syntaxes et l'état physique.

## Transport HTTP incrémental — TECHNIQUE R887

- Quand le Chat est ouvert et le document visible, le navigateur demande uniquement les messages postérieurs à sa dernière ancre autoritative `(createdAt, id)` et les suppressions des lignes déjà chargées, à cadence courte sans requêtes qui se chevauchent. Le snapshot complet reste réservé au chargement initial et au changement de génération.
- Le panneau replié interroge seulement les non-lus à cadence plus lente. Ce périmètre utilise le polling HTTP authentifié ; Realtime, WebSocket et SSE n'y sont pas introduits.
- Selon R893, toute réouverture du panneau replié recharge autoritativement la page la plus récente puis se replace en bas ; elle ne reprend jamais un ancien scroll comme s'il représentait encore l'état courant.

## Actions et signalement — R891–R892

- Sur un message d'un autre joueur, desktop et menu tactile suivent `Signaler`, `Masquer`, `Copier`, `Mentionner`, `Répondre`. Sur son propre message : `Copier`, `Répondre`, `Supprimer`.
- La confirmation de signalement est ancrée immédiatement sous la rangée d'actions, même lorsque le message est long.

## Frontières du premier lot

Le Chat global est physiquement persisté dans PostgreSQL et diffusé au navigateur par polling HTTP authentifié ; sa fenêtre joueur de 200 ne purge pas les anciennes lignes. Le pont Twitch réel reste différé et n'est ni développé ni préparé physiquement par ce checkpoint. `R633/R634` relèvent de l'Historique global. La durée de conservation administrative définitive reste un choix technique ultérieur distinct de cette fenêtre player-facing.
