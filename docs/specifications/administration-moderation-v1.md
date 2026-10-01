# Administration et modération V1 — étape 22

Étape 22 et correctifs R995–R998 approuvés, promus avec Arcade au checkpoint `f13f90dea5c661015c0c2fac41c660f89716d227` et testés publiquement par le propriétaire. Système, ordre des Rôles, Festivals, Journal dix/page, Historique Bannières et suppression des signalements sont validés dans ce périmètre. Le présent lot affine les groupes Rôles et les filtres du Journal (R1002), candidat review avant dernier smoke visuel ; l'étape 22 reste ouverte. Les décisions métier [R959–R969](decisions-log.md) restent inchangées.

## Accès et navigation

Une seule destination privée `Modération` dépend des attributions `PlayerRoleAssignment` actives lues côté serveur. Les droits se cumulent : `ADMIN` voit Système, Personnages, Codes, Bannières, Événements, Communauté, Giveaway et Journal ; `MODERATOR` voit Communauté et Giveaway ; `TESTER` voit Système pour son propre Player. Le rôle MODERATOR n'accorde aucun outil gameplay. Les flèches du tablist parcourent les seuls onglets disponibles. Les huit onglets tiennent sur une ligne sans troncature à 1920 minimum ; les écrans étroits utilisent un scroll horizontal. Les contrôles frontend guident l'usage ; chaque route revérifie l'identité et la permission en base.

Système conserve Ressources, XP, Gacha et Stella. ADMIN peut choisir un Player actif ; TESTER reste self. `RoleAdminService` est l'unique propriétaire des attributions TESTER/MODERATOR/ADMIN ; l'ancien endpoint `/players/:playerId/tester` et son chemin métier séparé sont supprimés. Les changements ADMIN/MODERATOR demandent confirmation. Un verrou advisory global et la vérification transactionnelle de l'acteur et du nombre d'ADMIN actifs empêchent de retirer le dernier, y compris lors de deux retraits concurrents. L'auto-révocation ADMIN reste possible si un autre ADMIN actif subsiste ; le rejeu exact de sa clé reste lisible, mais une nouvelle mutation est refusée après perte du rôle.

Ordre R995 : Joueur ciblé, Rôles pleine largeur, puis grille des quatre outils gameplay. Testeur, Modérateur et Administrateur sont présentés horizontalement sur desktop, verticalement sur mobile ; chaque groupe aligne texte et bouton de largeur automatique au début de sa colonne avec 10 px d'écart. Protections et confirmations inchangées.

## Mutations et preuve

Les nouvelles mutations utilisent une clé UUID d'idempotence, une `BusinessOperation` de source `ADMIN` et une `AdminAuditEntry` avant/après dans une transaction sérialisable. Un replay strict retourne l'opération existante ; une même clé portant une autre cible, action ou charge échoue en conflit. Le client garde la clé d'une intention ambiguë pour son retry. L'audit contient des diffs compacts sans secret ; le Journal ADMIN lit **dix entrées/page** sous autorité `AdminAuditQueryService`, triées par date puis ID décroissants, avec filtres domaine/action/acteur/cible. Le DTO est assaini côté serveur, y compris pour les anciens audits. Il n'existe ni export massif ni suppression depuis le Journal.

R996 : filtres Domaine/Action immédiatement en haut, sans titre interne Journal Admin, mais aria-label conservé. `admin-audit-presentation` traduit domaines/actions pour les lignes et le titre du détail (ex. Rôles · Testeur attribué), avec humanisation kebab/snake-case inconnue. Les clés persistées et les données techniques avant/après restent intactes.

R1002 : les deux filtres sont des listes déroulantes, avec Tous les domaines/Toutes les actions. La route existante GET audit fournit `facets`, couples distincts domaine/action de tout l'historique sous la même garde ADMIN, indépendamment de la page et des filtres sélectionnés. Ces valeurs techniques sont envoyées telles quelles au serveur, et humanisées par la même couche que les lignes. Action dépend du domaine ; changement de domaine remet page à 1 et efface seulement une action incompatible. Une ancienne option sans entrée conserve un résultat vide propre. Aucune table, migration ni conversion des codes stockés.

Les confirmations sensibles figent à l'ouverture une intention complète : identifiant et nom de la cible, entité métier, action et paramètres, dont une copie des dix IDs de bannière. La confirmation envoie exactement cette intention même si l'écran est réactualisé. Le dialogue modal rend l'arrière-plan inerte, piège le focus, gère Escape et le clic sur fond pour annuler, puis rend le focus au déclencheur. Pendant une mutation en cours, il bloque la fermeture et une double soumission.

`AdminAuditEntry.targetPlayerId` est physiquement obligatoire : pour une opération globale de catalogue, bannière ou Event, l'acteur occupe cette colonne et l'identifiant de l'entité métier est dans le diff. Pour les rôles, possessions et signalements, le Player concerné est la cible.

## Personnages

Le catalogue ADMIN est paginé par vingt avec recherche, rareté, élément, statut et tri. Il permet la création, la correction de métadonnées sûres, la désactivation et la réactivation ; aucune suppression physique. `externalKey` reste immuable après création ; rareté et élément sont figés dès qu'une possession, bannière, vote ou Pull les référence. Un personnage inactif reste dans les possessions et preuves historiques et sort des futurs pools/votes selon leurs contrats. Les références d'images existantes restent en place.

L'audit avant/après Character porte tous les champs modifiables : `characterId`, `externalKey`, `name`, `rarity`, `elementKey`, `weaponType`, `region`, `classKey`, `displayOrder` et `isActive`. Les chemins d'images ne sont pas mutables par cet API.

Dans Personnages, ADMIN voit les possessions du Player ciblé, ajoute un personnage actif du catalogue, corrige C0–C6 et retire une possession seulement si favoris, équipes, loadouts, expédition, Concours et progression C6 n'y sont plus liés. Le service refuse explicitement les dépendances fortes. Un ajout débloque l'avatar de personnage de façon silencieuse ; le déblocage cosmétique reste permanent après un retrait. C6 sur un 5★ crée la progression Concours requise par Box. Aucun Pull, compteur Gacha, statistique économique, Mission ni notification player-facing artificiels ne sont créés.

**Import autonome Personnages + Assets — différé volontairement.** Le propriétaire souhaite créer/importer des personnages et charger portrait, splash art et autres images depuis le jeu sans aide manuelle. Aucun upload ni stockage n'est choisi dans ce lot. Un futur lot décidera stockage, formats/dimensions, validation, compression, versioning, fallback, suppression, CDN/cache, sécurité et comportement déploiement.

## Bannières

ADMIN voit la rotation active/connue suivante, ses dates, dix places, sources, snapshot de génération, vote et diagnostics. Une correction d'urgence valide exactement quatre 5★ et six 4★ actifs distincts, prend le verrou advisory du moteur de rotation, modifie uniquement la composition active et vide les cibles 5★ retirées. Pity 5/4, garantie, Capture, votes fermés et lignes `PullOperation`/`PullResult` restent intactes. L'avant/après est audité et la provenance de correction est jointe à `legacyProvenance` sans réécrire `generationVoteSnapshot`. Une place modifiée emploie la source physique `LEGACY_UNKNOWN` ; la provenance JSON et l'audit précisent l'intervention ADMIN. L'historique de bannière expose la composition courante de la rotation, tandis que l'ancienne composition est conservée dans l'audit/provenance.

Le retry de génération appelle `WeeklyBannerScheduler.catchUp`, propriétaire du snapshot fermé et de la sélection. La requête porte le début de semaine affiché lors de la confirmation ; si la semaine courante a changé, elle est refusée et l'interface doit recharger le cycle. La demande de retry est auditée avant l'appel ; une tentative échouée demeure visible comme demande, et le moteur peut être relancé après correction du catalogue. La génération elle-même reste idempotente selon son contrat propriétaire ; aucune édition arbitraire du snapshot historique n'est offerte.

## Événements

Le panneau **Festivals** occupe la hauteur restante. Sa liste défile dans son propre conteneur flex, sans max-height arbitraire ; l'éditeur Configuration partage cette hauteur lorsqu'il est ouvert. Ajustement visuel uniquement, sans changement du métier ci-dessous.

ADMIN lit les définitions physiques, les deux éditions les plus pertinentes, leurs périodes, statuts, participants et configuration. Les champs structurés futurs passent par le parser métier Event et vérifient l'objet Collection. La définition du mois courant et toute définition avec édition en cours ou déjà programmée refusent un changement de configuration pour protéger les snapshots, même avant la première matérialisation du mois. Désactivation et réactivation modifient la définition, sans éditer points, récompenses, participants, classements ou claims d'une édition active. Une réactivation exige une configuration valide. Les snapshots historiques restent immuables.

## Communauté

Les signalements MP existants demeurent dans Communauté. Les signalements Chat global ajoutent liste de vingt, détail et contexte gelé : aucune exploration libre des messages voisins. MODERATOR et ADMIN peuvent passer le message source actif en `MODERATION` sans le détruire ; le DTO joueur masque son contenu et affiche « Message supprimé par la modération ». Le dossier gelé reste indépendant jusqu'à sa suppression explicite, qui ne supprime pas le message. Chaque action est auditée et idempotente. `!clear`, Concours et Giveaway conservent leurs autorisations spécialisées. Aucun ban, mute, timeout, avertissement ou score de sanction n'est créé.

R997 : chaque ligne possède Ouvrir et Supprimer séparés ; le détail propose Supprimer le signalement, distinct de Modérer le message source. Confirmation : « Le signalement sera supprimé. Le message source ne sera pas supprimé par cette action. ». Réutilisation de `GlobalChatModerationService.deleteReport` et de la route existante ; après succès, liste rechargée et page ajustée depuis la réponse serveur.

## Hors périmètre

Pas de reset générique Boss, Combat, Daily, Mission, Concours, Event, Banque, Shop ou statistiques. Pas d'upload d'assets, de changement Twitch, de migration 057, de mutation des données publiques ni de promotion `main` dans l'étape 22.
