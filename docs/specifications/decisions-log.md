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
- `À AUDITER DANS SCRIPT` — Formule exacte, seuils et récompenses dans XP.

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