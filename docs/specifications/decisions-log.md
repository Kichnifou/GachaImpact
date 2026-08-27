# Journal des décisions validées

Statut : évolutif.

## Identité joueur
- `VALIDÉ` — Le compte GachaImpact possède un ID interne immuable.
- `VALIDÉ` — Le pseudo GachaImpact est distinct du pseudo Twitch et peut être le pseudo affiché.
- `VALIDÉ` — Un compte Twitch peut être lié séparément.
- `VALIDÉ` — Le pseudo / identifiant Twitch nécessaire à la correspondance legacy doit être conservé.
- `VALIDÉ` — Un joueur sans Twitch doit profiter de 100 % du jeu.

## Migration
- `VALIDÉ` — Tous les historiques utiles, statistiques et dates sont migrés.
- `VALIDÉ` — Les bots connus (ex. StreamElements, WizeBot) sont exclus.
- `VALIDÉ` — Une donnée supposée obsolète n'est supprimée qu'après validation explicite.
- `VALIDÉ` — La migration doit pouvoir être relancée avec des JSON Streamer.bot plus récents sans duplication ni corruption.
- `VALIDÉ` — Le profil Kichnifou sert de référence fonctionnelle la plus complète pour le schéma actuel.

## XP
- `VALIDÉ` — Niveau maximal : 100.
- `VALIDÉ` — Après le niveau 100, l'XP/progression continue à produire les récompenses périodiques sans augmenter le niveau.
- `VALIDÉ` — Le code réel XP utilise 30 XP par palier, avec gains de +1/+2/+3 XP selon la longueur du message éligible (seuils exacts documentés dans `legacy/04-xp-audit.md`).
- `VALIDÉ` — Récompense de level-up V1 : +800 Primogemmes et +10 000 Moras à chaque palier ; à partir du niveau 5, +80 particules de l'élément personnel ; à partir du niveau 10, +40 particules d'un autre élément aléatoire.
- `VALIDÉ` — Les montants de level-up sont conservés pour la V1 et seront réévalués seulement lors d'un futur audit global de l'économie.

## Personnages / C6
- `VALIDÉ` — `constellation` reste plafonnée à C6.
- `VALIDÉ` — `copies` conserve le nombre historique total, y compris au-delà de C6.
- `À AUDITER DANS SCRIPT` — Les doublons après C6 peuvent augmenter des caractéristiques utilisées dans les concours.

## Bannière / invocation
- `VALIDÉ` — Une seule bannière active est présentée dans la nouvelle interface ; pas de sélecteur Permanent/Temporaire.
- `VALIDÉ` — La bannière hebdomadaire peut proposer plusieurs personnages 5★.
- `VALIDÉ` — Le joueur sélectionne une cible avant d'invoquer.
- `VALIDÉ` — Les joueurs peuvent voter chaque semaine pour influencer une future bannière.
- `À AUDITER DANS SCRIPT` — Règles exactes de sélection, pity, garantie, brillance, votes et rotation.

## Architecture
- `VALIDÉ` — Le navigateur ne détient jamais la sauvegarde autoritative.
- `VALIDÉ` — La logique métier doit être centralisée côté serveur.
- `VALIDÉ` — Bouton UI, commande chat GachaImpact et future commande Twitch doivent appeler la même action métier.
- `VALIDÉ` — Streamer.bot disparaît de la logique GachaImpact à terme.

## Ressources
- `VALIDÉ` — Les Primogemmes servent uniquement aux invocations / pulls.
- `VALIDÉ` — Les Moras sont utilisées au minimum pour la Boutique et la Banque.
- `À AUDITER DANS LES SCRIPTS` — Vérifier s'il existe d'autres usages des Moras.
- `VALIDÉ` — Le joueur peut posséder des particules des sept éléments.
- `VALIDÉ` — Les particules correspondant à l'élément personnel du joueur peuvent être converties en Primogemmes au taux 1:1.
- `VALIDÉ` — Les particules des autres éléments peuvent être échangées avec d'autres joueurs.
- `À AUDITER DANS LES SCRIPTS` — Vérifier s'il existe d'autres usages des particules.

## Élément joueur
- `VALIDÉ` — Le joueur choisit son élément une seule fois au début du jeu.
- `VALIDÉ` — L'élément joueur est non modifiable ensuite.
- `VALIDÉ` — Il s'agit d'une donnée métier permanente, pas d'une préférence d'affichage.
- `VALIDÉ` — L'élément choisi détermine quelles particules sont ses particules attitrées.
- `VALIDÉ` — Dans l'application standalone, le choix de l'élément fait partie obligatoirement de l'inscription/onboarding afin que le joueur dispose immédiatement des prérequis élémentaires dès son premier niveau.

## Twitch / entrée dans le jeu
- `VALIDÉ` — Un nouveau chatter Twitch continue à être enregistré automatiquement dans les données du jeu lors de ses premiers messages, comme dans le legacy.
- `VALIDÉ` — Cet enregistrement Twitch passif n'équivaut pas à un compte standalone complètement onboardé.
- `VALIDÉ` — Le chatter Twitch peut progresser par les messages jusqu'au seuil d'onboarding ; direction produit : passage jusqu'au niveau 2.
- `VALIDÉ` — Si aucun élément n'a été choisi à ce stade, le jeu demande le choix d'un élément et bloque ensuite les mécaniques actives tant que ce choix n'est pas effectué.
- `VALIDÉ` — `!element <élément>` reste la porte d'activation naturelle du profil Twitch.
- `À SPÉCIFIER` — Le modèle technique d'un profil Twitch-only, sa future liaison à un compte GachaImpact et les règles anti-spam de rappel d'onboarding seront définis dans la spécification Auth/Twitch.

## Récompense quotidienne
- `VALIDÉ` — La récompense quotidienne est conservée durablement comme mécanique du jeu.
- `VALIDÉ` — V1 : +160 Primogemmes, +160 particules de l'élément du joueur et +10 000 Moras.
- `VALIDÉ` — Reset global quotidien à 00:00 dans le fuseau `Europe/Paris`.
- `VALIDÉ` — Une récompense quotidienne non réclamée est perdue ; les jours manqués ne s'accumulent pas.
- `VALIDÉ` — Une seule opération métier idempotente gère la réclamation, quel que soit le canal.
- `VALIDÉ` — La réclamation peut venir du bouton UI, du premier message éligible du chat GachaImpact, ou du premier message Twitch éligible d'un profil ayant choisi son élément.
- `VALIDÉ` — Le bloc en bas à gauche évolue vers un suivi des activités quotidiennes : navigation compacte par chevrons `‹` / `›`, masquage d'une proposition pour la journée, préférences d'affichage futures, puis état « tout est à jour » lorsque plus rien n'est à proposer.
- `VALIDÉ` — Le claim affiche un feedback visuel temporaire près des compteurs de ressources plutôt que de surcharger la carte avec les montants permanents.
- `VALIDÉ` — Conserver la date de dernière réclamation et, dans la nouvelle implémentation, la date de première réclamation ; pas d'historique quotidien détaillé dédié requis.
- `FUTUR / À CONCEVOIR` — Streak quotidien avec bonus après 7 jours consécutifs ; idée actuelle : +1 000 Primogemmes, +30 000 Moras, +800 particules de l'élément personnel. La règle exacte n'est pas encore figée.
- `FUTUR / À CONCEVOIR` — Des calendriers de connexion événementiels pourront proposer des récompenses différentes selon les jours pendant certains événements.

## Faveur
- `VALIDÉ` — Une Faveur GachaImpact est inspirée de la Blessing of the Welkin Moon, mais ses jours ne diminuent que lorsqu'une récompense est effectivement réclamée.
- `VALIDÉ` — Une absence ne consomme donc pas de jour de Faveur.
- `À AUDITER` — Les attributions par événements de stream et abonnements Twitch, ainsi que leur future intégration sans Streamer.bot, seront traitées dans le domaine Faveur/Twitch.