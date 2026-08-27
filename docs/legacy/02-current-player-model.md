# 02 — Modèle joueur legacy actuel

Statut : EN CONSTRUCTION  
Référence canonique principale : profil `Kichnifou` dans les données Streamer.bot les plus récentes.

## Méthode

- Le profil `Kichnifou` sert de référence fonctionnelle principale car il contient les sections les plus récentes et les plus complètes.
- Les autres profils servent ensuite à tester les anciennes structures, champs absents, valeurs `null`, formats historiques et cas limites.
- Les données peuvent être réparties dans plusieurs JSON : `viewers_data.json` n'est donc pas la seule source.
- Toute propriété reste à confirmer par les scripts si son rôle exact n'est pas certain.
- Une donnée supposée obsolète n'est jamais supprimée sans validation explicite.
- Le futur import devra pouvoir être relancé avec des JSON plus récents sans duplication ni corruption.

## 1. Identité

### Ancien `username`

Statut : `MIGRATION / IDENTITÉ TWITCH`

Dans le système legacy, `username` correspond au pseudo Twitch utilisé comme clé du joueur.

Dans GachaImpact :
- le compte possède un ID interne immuable ;
- le joueur choisit un pseudo GachaImpact distinct ;
- le pseudo GachaImpact est celui affiché dans le jeu ;
- Twitch est optionnel ;
- si Twitch est lié, l'identité Twitch doit être conservée séparément pour permettre la correspondance avec les anciennes données.

## 2. Progression

### `level`

Statut : `MIGRER TEL QUEL`

- Niveau joueur.
- Niveau maximal : 100.
- Une fois niveau 100 atteint, le niveau n'augmente plus.

### `xp`

Statut : `MIGRER TEL QUEL / LOGIQUE À CONFIRMER DANS XP`

- L'XP continue d'être gagnée après le niveau 100.
- Avant le niveau 100, la progression permet de monter de niveau et recevoir des récompenses.
- Au niveau 100, la progression continue à donner les récompenses périodiques mais sans augmenter le niveau.
- Les seuils, calculs et récompenses exacts seront confirmés lors de l'audit du script XP.

### `element`

Statut : `DONNÉE MÉTIER PERMANENTE`

Valeurs :
- Pyro
- Hydro
- Cryo
- Electro
- Anemo
- Geo
- Dendro

Règles :
- choisi une seule fois au début du jeu ;
- actuellement choisi via `!element` ;
- non modifiable ensuite ;
- définit l'élément personnel du joueur ;
- les particules de cet élément sont ses particules attitrées ;
- les particules de son propre élément peuvent être converties en primogemmes au taux 1:1 ;
- les particules des autres éléments peuvent être échangées avec d'autres joueurs, sous réserve des règles d'échange et des stocks disponibles ;
- les règles de conversion et les premières règles d'échange ont été confirmées dans `legacy/05-element-resources-audit.md`.

## 3. Ressources principales

### `primogems`

Statut : `MIGRER TEL QUEL`

Usage actuel validé :
- uniquement utilisées pour les invocations / pulls.

Aucun autre usage connu actuellement.

Les coûts exacts et la logique d'invocation seront documentés lors de l'audit de Pull / Bannière / Pity.

### `moras`

Statut : `MIGRER TEL QUEL`

Usages actuels connus :
- boutique ;
- banque.

Autres usages : `À CONFIRMER DANS LES SCRIPTS`.

### `particles`

Statut : `MIGRER TEL QUEL`

Structure :
- `pyro`
- `hydro`
- `cryo`
- `electro`
- `anemo`
- `geo`
- `dendro`

Règles validées :
- le joueur peut obtenir des particules de n'importe quel élément ;
- les particules correspondant à son élément personnel sont convertibles manuellement en Primogemmes au taux 1:1 ;
- toute quantité entière >= 1 peut être convertie dans la limite du stock disponible ;
- les particules des autres éléments sont échangeables avec des joueurs d'un élément différent ;
- les échanges sont symétriques : X particules contre X particules ;
- le stock disponible pour un échange correspond au stock total moins les quantités déjà réservées ;
- une seule demande d'échange active est autorisée entre deux mêmes joueurs ;
- aucun autre usage des particules n'est considéré définitivement absent avant la fin de l'audit des autres systèmes.

Autres usages : `À CONFIRMER DANS LES SCRIPTS`.

### `tradeRequests`

Statut : `MIGRER / STRUCTURE LEGACY À NORMALISER`

Le legacy stocke les demandes d'échange directement dans chaque profil.

Pour une même demande :
- l'expéditeur possède une entrée `sent` ;
- le destinataire possède une entrée `received`.

Champs observés :
- `type`
- `otherUser`
- `amount`
- `myElement`
- `otherElement`
- `createdAt`

Règles métier confirmées :
- demande uniquement entre deux joueurs d'éléments différents ;
- pas d'auto-échange ;
- une seule demande active par paire ;
- échange symétrique X contre X ;
- stocks réservés pendant l'attente ;
- stock disponible = total - réservé ;
- les demandes expirent au changement de journée ;
- cible GachaImpact : expiration automatique au reset serveur 00:00 `Europe/Paris` ;
- annulation/refus libère les réservations.

Important :
la duplication `sent` / `received` est une nécessité du modèle JSON legacy et ne doit pas être reproduite aveuglément dans le futur schéma relationnel.

Le futur modèle devra posséder une source de vérité unique pour chaque demande d'échange.

## 4. À auditer ensuite

Prochain bloc prévu :
- Box / possessions de personnages
- `constellation`
- `copies`
- dates de première obtention
- équipe active
- pity / garantie / sélection de bannière

Puis :
- options ;
- missions ;
- stats ;
- dates ;
- codes ;
- faveur ;
- coffre ;
- objets spéciaux ;
- combat ;
- expédition ;
- missions longues ;
- banque ;
- favoris ;
- équipes sauvegardées ;
- données joueur réparties dans les autres JSON.
