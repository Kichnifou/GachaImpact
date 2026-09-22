# Chat global V1 — contrat produit

Statut : décisions produit validées. Le Chat global player-facing est matérialisé par les migrations 032–034, ses routes et le `ChatPanel` réel, avec resynchronisation UI ciblée. Le [Master](../master/PROJECT_MASTER_PLAN.md) porte seul l'état vivant et la validation publique. Les MP restent régis par [l'audit Social R501–R522](../legacy/14-ami-social-audit.md) et ne sont pas encore physiques ; ce contrat ne modifie ni leurs limites, ni leur historique, ni leurs permissions. Les syntaxes et résultats métier des commandes restent dans la [référence des commandes](../commands/command-reference.md).

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

- `@pseudo` dispose d'une autocomplétion légère et d'une mise en évidence pour la personne réellement mentionnée. Aucune notification persistante n'est ajoutée à la cloche Notifications.
- Un joueur bloqué est exclu des suggestions. Sa chaîne `@pseudo` saisie manuellement reste du texte ordinaire et ne produit pas de mention réelle.

## Lecture et non-lus — R876 et R877

- Quand le lecteur est au niveau des messages récents, les nouveaux messages sont suivis naturellement. S'il est remonté, leur arrivée ne déplace pas son scroll ; un indicateur compact, par exemple `3 nouveaux messages ↓`, permet de rejoindre le bas.
- Le panneau de droite conserve les onglets Chat/MP de R506. Les nouveaux messages globaux alimentent le badge Chat pendant la consultation des MP, quand le Chat est replié ou quand il n'est pas effectivement consulté. Un message n'est vu que si l'onglet Chat est réellement affiché **et** que le joueur se trouve au niveau des messages récents ; ouvrir l'onglet loin du bas ne purge pas les non-lus.
- Les vrais messages globaux `PLAYER`, `GAME_RESULT` et `SYSTEM` destinés à tous suivent cette règle. Aucune réponse privée n'est anticipée dans ce mécanisme.
- L'historique de conversation se charge progressivement en remontant, sans pages numérotées player-facing. La fenêtre UI peut garder seulement quelques centaines de lignes en mémoire et charger les précédentes au besoin. Aucun écran séparé « Voir tout l'historique du Chat » n'appartient au premier périmètre. La durée exacte de conservation serveur reste ouverte jusqu'au besoin technique du premier lot.

## Blocage, masquage et signalement — R878 et R879

- Un `PlayerBlock` empêche les interactions directes définies par Social, sans effacer automatiquement tous les messages de la personne du flux public.
- Le joueur peut masquer localement les messages d'une personne : chaque ligne masquée reste à sa place sous `Message masqué — Afficher` et peut être rouverte ponctuellement. Ce filtre d'affichage ne crée pas une relation sociale serveur. Son stockage local ou de session est un détail du futur lot.
- Chaque message global offre `Signaler`. Le signalement conserve un snapshot du message et un contexte raisonnable autour pour la modération privée ; il ne retire pas automatiquement le message public. Le panneau complet de modération reste hors du premier lot.

## Anti-spam et commandes — R880 et R881

- Le serveur protège le Chat global contre les rafales manifestement abusives. Le seuil exact est technique et sera fixé pendant l'implémentation. Ce frein est distinct du quota général de messages et des cooldowns métier des commandes : une commande en cooldown ne doit pas empêcher de discuter normalement.
- Une saisie commençant par `!` est un vrai message public du joueur, conservé dans le flux sous sa forme originale. Elle compte dans `totalMessages`, jamais dans l'XP ni dans `countedMessages` du seul fait d'être une commande, selon [l'audit XP](../legacy/04-xp-audit.md). Son exécution métier reste séparée du stockage/transport ; elle appelle le même service que l'UI lorsque ce service existe.
- Les résultats automatiques portent l'identité `GachaImpact` et se distinguent visuellement des messages `PLAYER`. Dans le périmètre initial, **toutes** les réponses de commandes sont publiques : succès, consultation, aide, erreur, mauvaise syntaxe et commande inconnue. La commande du joueur est elle aussi publique. Une erreur inconnue ou invalide peut orienter brièvement vers `!help`. Les contrats particuliers de la référence des commandes restent applicables.
- Aucune réponse de commande visible seulement par son auteur, aucun canal caché, message système privé ou toast privé n'est prévu ici. Une telle restitution est reportée au polish final, sans préparation technique dans le premier lot.

## Publications automatiques — R882

- Aucun message générique de connexion, déconnexion ou présence ne pollue le flux. La possibilité d'annoncer certains événements publics sera examinée au polish final, sans catalogue hypothétique aujourd'hui.
- Une action UI ne publie rien automatiquement dans le Chat ; elle garde sa restitution UI ou sa notification. Seule une règle produit spécialisée explicite peut prévoir une publication Chat. Une éventuelle extension générale UI → Chat est reportée au polish final.

## Identité et accès aux MP — R883

- Avatar et pseudo d'un message `PLAYER` ouvrent son Profil via le pattern existant. Un menu contextuel réutilise les primitives adaptées pour `Répondre`, `Mentionner`, `Signaler` et `Masquer` selon la ligne et les droits pertinents.
- `Envoyer un message privé` depuis un joueur du Chat peut ouvrir l'onglet MP et le parcours de conversation avec ce joueur, sous les permissions MP existantes. Le MP est toujours rédigé et envoyé dans l'onglet MP ; aucun `!mp` n'existe dans le Chat global ou sur Twitch.

## Disponibilité des commandes internes — R884

- Le Chat conserve le maximum de jeu que les services serveur modernes portent avec le même état métier que l'interface. Il ne crée pas de système parallèle pour une commande.
- Le Concours se joue dans l'interface standalone. `!concours` reste une consultation de sa projection ; aucune création, participation, action, sortie ou annulation de Concours n'est disponible depuis `INTERNAL_CHAT`. Les syntaxes historiques restent documentées dans l'audit du domaine, sans devenir une disponibilité Chat actuelle.
- Event reste complet dans le Chat, Jeu C et sa commande thématique compris. Le texte original de cette commande est public comme toute commande selon R881 ; le message Event persisté conserve les règles de visibilité du domaine Event. Échanges, Combat, Expédition, Amitié et les autres commandes déjà branchées conservent leurs capacités physiques via leurs services propriétaires. La [référence des commandes](../commands/command-reference.md) détaille les syntaxes et l'état physique.

## Frontières du premier lot

Le pont Twitch réel reste différé et n'est ni développé ni préparé physiquement par ce checkpoint. `R633/R634` relèvent de l'Historique global. Les choix techniques de persistance, de diffusion et de rétention seront pris pendant le cadrage du lot physique, sans annoncer de fonctionnalité déjà implémentée.
