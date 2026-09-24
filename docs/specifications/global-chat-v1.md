# Chat global V1 — contrat produit

Statut : décisions produit validées. Le Chat global player-facing est matérialisé par les migrations 032–035 et 039, ses routes et le `ChatPanel` réel, avec resynchronisation UI ciblée. Le [Master](../master/PROJECT_MASTER_PLAN.md) porte seul l'état vivant et la validation publique. Le socle serveur/DB et le premier vertical UI des MP sont matérialisés sur main par les migrations 036–039 dans le même panneau Communauté ; leurs règles restent celles de [l'audit Social R501–R522](../legacy/14-ami-social-audit.md). Les syntaxes et résultats métier des commandes restent dans la [référence des commandes](../commands/command-reference.md).

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
- R895 distingue désormais l'ordre durable de l'affichage live. `submissionOrder` reste l'autorité serveur des snapshots, pages, fenêtres, non-lus et curseurs. Dans une session déjà affichée, une ligne inconnue est ajoutée lors de sa livraison sans déplacer les lignes visibles ; une ligne connue et la confirmation d'un optimistic sont remplacées en place. Un chargement d'historique préfixe les anciennes lignes en préservant le viewport.

## Blocage, masquage et signalement — R878 et R879

- Un `PlayerBlock` empêche les interactions directes définies par Social, sans effacer automatiquement tous les messages de la personne du flux public.
- Le joueur peut masquer localement les messages d'une personne : chaque ligne masquée reste à sa place sous `Message masqué — Afficher` et peut être rouverte ponctuellement. L'action contextuelle de ce même joueur bascule entre `Masquer ce joueur` et `Démasquer ce joueur` et restaure alors toutes ses lignes chargées et futures. Aucun panneau global de joueurs masqués n'est affiché. Ce filtre d'affichage ne crée pas une relation sociale serveur ; son stockage local ou de session est un détail d'implémentation.
- Chaque message global offre `Signaler`. Le signalement conserve un snapshot du message et un contexte raisonnable autour pour la modération privée ; il ne retire pas automatiquement le message public. Le panneau complet de modération reste hors du premier lot.

## Anti-spam et commandes — R880, R881, R894 et R897

- R894 impose 750 ms entre deux nouveaux messages `PLAYER` ou `COMMAND` acceptés. Trois nouveaux envois acceptés dans un intervalle strictement inférieur à quatre secondes déclenchent, au troisième, un verrou de trois secondes exactement. Entrée et Envoyer sont alors des no-op silencieux : aucun intent, appel, optimistic, feedback ou perte de draft/réponse/mentions ; les tentatives bloquées ne prolongent rien. Le serveur applique les mêmes bornes avec `CHAT_PACING_LIMIT`. Un retry exact conserve sa clé, est résolu par l'idempotence avant le pacing et ne compte jamais comme nouvel envoi. Seule la durée, auparavant quatre secondes, est révisée et doit être revalidée publiquement ; le filet défensif historique de dix messages sur dix secondes reste distinct.
- R897 rend visible uniquement le verrou long déjà défini par R894 : pendant ces trois secondes, le champ ne peut plus être modifié, le bouton est désactivé et le placeholder vaut `Spam, veuillez attendre...`. À l'échéance locale exacte, le champ et son placeholder normal reviennent automatiquement ; si sa désactivation lui avait retiré le focus, il récupère focus et caret final sauf déplacement volontaire vers un autre contrôle. Le simple espacement de 750 ms reste silencieux et n'empêche jamais d'écrire. Les nouveaux envois acceptés localement affichent immédiatement leur optimistic puis passent par un coordinateur réseau unique, dans leur ordre local et avec au moins 750 ms entre deux démarrages. Une erreur ne casse pas la suite de la file ; un retry exact garde sa clé, repasse par la même infrastructure, ne crée ni nouvelle intention de pacing ni second optimistic. La sécurité transport est séparée du verrou visuel : une connexion lente n'allonge pas l'état Spam, mais un M4 optimistic attend dans la queue jusqu'à la borne serveur sûre dérivée de l'acceptation de M3. Un rejet déterministe recalcule les tentatives conservées sans perdre le brouillon. Cette version trois secondes + auto-focus reste à revalider publiquement.
- Une saisie commençant par `!` est un vrai message public du joueur, conservé dans le flux sous sa forme originale, sauf l'exception de modération R886. Elle compte dans `totalMessages`, jamais dans l'XP ni dans `countedMessages` du seul fait d'être une commande, selon [l'audit XP](../legacy/04-xp-audit.md). Son exécution métier reste séparée du stockage/transport ; elle appelle le même service que l'UI lorsque ce service existe.
- Les résultats automatiques portent l'identité `GachaImpact` et se distinguent visuellement des messages `PLAYER`. Dans le périmètre initial, **toutes** les réponses de commandes sont publiques : succès, consultation, aide, erreur, mauvaise syntaxe et commande inconnue. La commande du joueur est elle aussi publique. Une erreur inconnue ou invalide peut orienter brièvement vers `!help`. Les contrats particuliers de la référence des commandes restent applicables.
- R886 définit l'exception interne de modération `!clear` : le serveur exige une attribution active `MODERATOR` ou `ADMIN` ; `TESTER` seul ne suffit pas. L'opération ouvre une nouvelle génération visible du Chat pour tous, y compris après F5 et pour l'historique/non-lus. L'ancien contenu reste conservé côté serveur pour audit. Ni la commande ni un résultat `GachaImpact` de clear ne restent visibles. Cette commande n'est pas envoyée à Twitch et n'apparaît pas dans l'aide joueur ordinaire.
- Aucune réponse de commande visible seulement par son auteur, aucun canal caché, message système privé ou toast privé n'est prévu ici. Une telle restitution est reportée au polish final, sans préparation technique dans le premier lot.

## Publications automatiques — R882

- Aucun message générique de connexion, déconnexion ou présence ne pollue le flux. La possibilité d'annoncer certains événements publics sera examinée au polish final, sans catalogue hypothétique aujourd'hui.
- Une action UI ne publie rien automatiquement dans le Chat ; elle garde sa restitution UI ou sa notification. Seule une règle produit spécialisée explicite peut prévoir une publication Chat. Une éventuelle extension générale UI → Chat est reportée au polish final.

## Identité et accès aux MP — R883

- Avatar et pseudo d'un message `PLAYER` ouvrent son Profil via le pattern existant. Un menu contextuel réutilise les primitives adaptées pour `Répondre`, `Mentionner`, `Signaler` et `Masquer` selon la ligne et les droits pertinents.
- `Message privé` depuis un joueur du Chat peut ouvrir l'onglet MP et le parcours de conversation avec ce joueur, sous les permissions MP existantes. Le MP est toujours rédigé et envoyé dans l'onglet MP ; aucun `!mp` n'existe dans le Chat global ou sur Twitch.
- L'implémentation player-facing place cette affordance dans les actions du message, entre `Copier` et `Mentionner`, sans bouton accolé au pseudo et sans modifier le clic avatar/pseudo vers Profil. Le même intent est réutilisé depuis le Profil.

## Couleur des auteurs PLAYER — R888

- Le pseudo d'un message `PLAYER` reprend la couleur de l'Élément réel de son auteur. L'avatar et le pseudo lisent la même valeur issue de `elementColors`, y compris pendant l'affichage optimiste du message courant ; l'absence d'Élément valide conserve un violet lisible.
- L'identité système `GachaImpact` conserve son rendu vert et n'utilise pas cette couleur d'auteur.

## Disponibilité des commandes internes — R884

- Le Chat conserve le maximum de jeu que les services serveur modernes portent avec le même état métier que l'interface. Il ne crée pas de système parallèle pour une commande.
- Le Concours se joue dans l'interface standalone. `!concours` reste une consultation de sa projection ; aucune création, participation, action, sortie ou annulation de Concours n'est disponible depuis `INTERNAL_CHAT`. Les syntaxes historiques restent documentées dans l'audit du domaine, sans devenir une disponibilité Chat actuelle.
- Event reste complet dans le Chat, Jeu C et sa commande thématique compris. Le texte original de cette commande est public comme toute commande selon R881 ; le message Event persisté conserve les règles de visibilité du domaine Event. Échanges, Combat, Expédition, Amitié et les autres commandes déjà branchées conservent leurs capacités physiques via leurs services propriétaires. La [référence des commandes](../commands/command-reference.md) détaille les syntaxes et l'état physique.

## Transport HTTP incrémental — TECHNIQUE R887

- Quand le Chat est ouvert et le document visible, le navigateur transmet son ancre compatible `(createdAt, id)` et les IDs connus de la fenêtre canonique de 200 fournis par le snapshot, même si les pages historiques ne sont pas encore rendues ; le serveur résout l'ancre vers `submissionOrder` et restitue dans une même réponse toutes les lignes réellement inconnues de cette fenêtre, y compris une arrivée tardive antérieure. Le frontend ajoute ces inconnues dans l'ordre de livraison observé, sans réordonner les lignes déjà montées. Un ID n'est considéré connu qu'après avoir été fourni par un snapshot ou effectivement transmis au client. Les suppressions connues suivent la même fenêtre, à une cadence start-to-start de 350 ms sans requêtes qui se chevauchent. Le snapshot complet reste réservé au chargement initial et au changement de génération.
- Le panneau replié interroge seulement les non-lus à cadence plus lente. Ce périmètre utilise le polling HTTP authentifié ; Realtime, WebSocket et SSE n'y sont pas introduits.
- Selon R893 révisée, toute réouverture du panneau replié place le snapshot local courant au bas avant le premier paint visible, puis recharge autoritativement la page récente en arrière-plan et reste au bas tant que le lecteur demeure dans ce mode. Elle n'attend jamais le réseau et ne reprend pas un ancien scroll comme s'il représentait encore l'état courant.

## Actions et signalement — R891–R892

- Sur un message d'un autre joueur, desktop et menu tactile suivent `Signaler`, `Masquer`, `Copier`, `Message privé`, `Mentionner`, `Répondre`. Desktop affiche l'action Message privé comme une icône seule accessible dans une rangée compacte ; tactile conserve son texte. Sur son propre message : `Copier`, `Répondre`, `Supprimer`.
- La confirmation de signalement est ancrée immédiatement sous la rangée d'actions, même lorsque le message est long.
- Cette révision R891 — icône `✉`, overlay compact, ordre courant et confirmation Signaler — est validée publiquement et n'est pas modifiée par le correctif R897/MP.

## Frontières du premier lot

Le Chat global est physiquement persisté dans PostgreSQL et diffusé au navigateur par polling HTTP authentifié ; sa fenêtre joueur de 200 ne purge pas les anciennes lignes. Le pont Twitch réel reste différé et n'est ni développé ni préparé physiquement par ce checkpoint. `R633/R634` relèvent de l'Historique global. La durée de conservation administrative définitive reste un choix technique ultérieur distinct de cette fenêtre player-facing.

## Polish du premier vertical MP — R896

- La liste locale expose toujours les onglets `Conversations` et `Archives`. Un clic manuel sur l'onglet principal MP revient à `Conversations`, tandis qu'un intent Player explicite ouvre toujours sa cible sans démonter le cache éphémère par Player.
- Les deux onglets gardent une présentation discrète à soulignement et chaque libellé est centré dans sa moitié. La recherche de destinataire, validée publiquement, interroge après 50 ms une route MP légère qui ne projette que l'identité ACTIVE, exclut soi-même, normalise casse et accents et borne le résultat à vingt. Une réponse obsolète ne peut pas remplacer une recherche plus récente. Le premier clic ouvre la cible et la sélection ne relance pas la recherche. Après sélection, l'aide vaut exactement `Écrivez le premier message.`.
- Un deep-link Player remplace immédiatement la recherche, ses résultats et toute cible précédente avant la résolution serveur. Chaque conversation réutilise son snapshot mémoire ou son dernier message connu, puis se revalide immédiatement. L'envoi crée une seule bulle optimistic réconciliée par `clientIntentKey`, avec le même rendu opaque qu'une bulle confirmée ; la projection serveur fraîche remplace toujours un même ID.
- Les bulles ne contiennent que le message. Une unique ligne hors bulle décrit le dernier événement s'il est sortant : `Envoi...`, `Envoyé`, `Lu ✓`, puis une durée simple en heures, jours, mois ou années. Elle disparaît après une réponse reçue.
- Ouverture d'une conversation non lue, envoi et réglage des accusés mettent d'abord l'état local à jour. L'envoi force le bas ; une réception ne le suit que si le lecteur y était déjà. La scrollbar est seulement rendue transparente au bas. Le polling HTTP reste sans overlap : 500 ms start-to-start pour un fil ouvert, 1 250 ms pour la liste visible et 5 s quand MP est inactif.

## Mutations MP — R504, R513 et R514

- Un message propre actif expose une barre absolue hors flux, dans l'ordre `Modifier` (`✎`) puis `Supprimer` (`×`); un tombstone propre expose seulement `Restaurer` (`↶`) et un message reçu n'expose aucune action auteur. Aucun bouton `⋯` n'existe par message ; celui du header de conversation reste inchangé. Desktop utilise hover/focus et un pointer coarse bascule la même barre par tap, fermée par tap extérieur, Escape, changement de conversation ou lancement d'une action.
- Modifier ouvre un textarea inline multiligne, garde la même bulle et affiche `Modifié` après succès sans remplacer le statut de livraison. Après layout, le scroll owner rend l'éditeur entier visible par déplacement minimal, puis focus le textarea avec le caret en fin de contenu. Entrée simple sauvegarde, Ctrl/Meta+Entrée insère une ligne, une composition IME ne valide jamais et un pointerdown extérieur annule sans mutation ; ce seul complément d'interaction reste candidat à revalidation publique.
- Supprimer demande `Supprimer ce message ?` dans un overlay absolu sous la bulle, sans modifier sa géométrie ; clic extérieur ou Escape annule sans mutation. Confirmer ferme immédiatement cet overlay avant de lancer ou attendre la mutation optimistic : il ne coexiste jamais avec `Message supprimé`, reste fermé pendant retry ambigu et ne se rouvre pas après rollback déterministe. La suppression conserve la ligne et affiche `Message supprimé` aux deux participants. Le dernier tombstone n'affiche plus `Envoyé`/`Lu` et son aperçu de liste reste `Message supprimé`.
- Seul l'auteur peut restaurer son tombstone tant qu'il appartient aux 500 derniers et que son contenu n'a pas été purgé. Les mutations edit/delete/restore renvoient un patch player-facing borné (`id`, `content`, `editedAt`, `deletedAt`, `restoredAt`) que le cache adopte immédiatement avant revalidation ; DELETE ne révèle jamais le contenu supprimé. Un petit cache éphémère isolé par Player/conversation permet la restauration optimistic du contenu supprimé dans la session et rollbacke le tombstone sur refus déterministe. R504 et sa purge sont inchangées. Il n'existe aucune suppression de conversation, signalement ou administration MP.

## Historique complet MP — R515

- `Historique complet`, dans le menu du header, ouvre une vue interne distincte du fil live. Son cache mémoire est isolé par Player/conversation, ne remplace jamais les 500 récents, ne poll pas l'historique et est vidé au changement de Player. Retour conserve draft, cache et scroll du fil normal.
- La page initiale charge les 50 plus récents ; remontée et chargement après jump utilisent `beforeOrder`/`afterOrder`, tandis que recherche et date utilisent `aroundOrder`. Le DOM reste en `submissionOrder ASC`; prepend compense le viewport. Ces GET participant-only restent disponibles après blocage et ne modifient jamais lecture, accusés, badges ou activité.
- La recherche serveur case-insensitive reste dans une seule conversation, du plus récent au plus ancien, avec debounce 200 ms, requêtes sérialisées et protection stale. `deletedAt IS NULL` et `content IS NOT NULL` excluent impérativement tout message supprimé, même restaurable. Un clic charge le contexte et met brièvement la ligne en évidence.
- La date locale est convertie en ISO par le navigateur ; le serveur choisit le premier `createdAt >= cible`, sinon le dernier antérieur. Les tombstones restent à leur position avec `Message supprimé`; `canRestore` est vrai seulement pour le tombstone propre encore contenu et situé dans les 500 derniers. Les mêmes actions auteur sont réutilisées. Cette implémentation R515 est candidate sur `review`, non validée publiquement.
