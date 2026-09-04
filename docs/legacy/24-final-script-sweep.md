# 24 — Sweep final des 37 scripts legacy

> Vérification de couverture finale des scripts Streamer.bot.  
> Snapshot vérifié : `main` au commit `2a37c48847d0a42516ffad3dafe8ecb449fe3967`.  
> Statut : **CLÔTURÉ — 37/37 scripts couverts ; aucun script orphelin ; aucune nouvelle décision produit requise**.  
> Cette passe ne remplace pas les audits spécialisés : elle vérifie qu'aucun script, producteur, consommateur ou rôle transversal n'a été oublié avant le sweep des 17 JSON.

---

# 1. Objectif

Le projet impose une dernière vérification exhaustive des sources legacy avant de figer le modèle de données V1.

Pour les scripts `.txt`, cette passe doit confirmer :

- que les 37 fichiers réellement présents sont connus ;
- que chacun possède au moins un domaine documentaire propriétaire ;
- que les scripts transversaux ont leurs responsabilités réparties entre les bons domaines ;
- que les commandes player-facing sont cohérentes avec `command-reference.md` ;
- que les actions Twitch non-commandes ne sont pas transformées artificiellement en commandes ;
- que les données principales lues/écrites de la matrice structurelle restent factuellement correctes ;
- que les écarts legacy déjà décidés ne sont pas réouverts ;
- qu'aucune nouvelle décision produit Rxxx n'est inventée pour une simple correction factuelle.

---

# 2. Méthode

La passe a été effectuée à partir :

- du dossier réel `legacy/streamerbot/commands/` ;
- de `docs/legacy/03-command-data-matrix.md` ;
- des audits spécialisés `04` à `23` ;
- de `docs/commands/command-reference.md` ;
- de `docs/specifications/decisions-log.md` ;
- du Master.

Les scripts déjà entièrement absorbés par un audit clôturé ne sont pas réaudités artificiellement depuis zéro.

La passe vérifie leur présence et leur propriétaire documentaire, puis réinspecte directement les scripts transversaux ou ceux pour lesquels une incohérence documentaire est suspectée.

Scripts particulièrement recroisés pendant cette passe :

- `XP.txt` ;
- `Faveur.txt` ;
- `Gift.txt` ;
- `Giveaway.txt` ;
- `Vote.txt` ;
- `Coffre.txt` ;
- `Liste.txt` ;
- `Legende.txt` ;
- `Event.txt` ;
- `Concours.txt`.

---

# 3. Inventaire réel

Le dossier contient exactement **37 fichiers** :

1. `Ami.txt`
2. `Banniere.txt`
3. `Banque.txt`
4. `Box.txt`
5. `Code.txt`
6. `Coffre.txt`
7. `Combat.txt`
8. `Concours.txt`
9. `Convertir.txt`
10. `Daily.txt`
11. `Echanger.txt`
12. `Element.txt`
13. `Event.txt`
14. `Expedition.txt`
15. `Faveur.txt`
16. `Gift.txt`
17. `Giveaway.txt`
18. `Help.txt`
19. `Infos.txt`
20. `Legende.txt`
21. `Liste.txt`
22. `Missions.txt`
23. `Obtention.txt`
24. `Passif.txt`
25. `Pity.txt`
26. `Pull.txt`
27. `Roue.txt`
28. `Sac.txt`
29. `Select.txt`
30. `Shop.txt`
31. `Stella.txt`
32. `Subscription.txt`
33. `Team.txt`
34. `Top.txt`
35. `Vote.txt`
36. `Wish.txt`
37. `XP.txt`

Le Master contenait encore localement le libellé `36 fichiers` dans son inventaire détaillé alors que la liste elle-même en contient 37.

Correction factuelle nécessaire :

**36 -> 37.**

---

# 4. Matrice de couverture 37/37

| # | Script | Domaine / audit propriétaire principal | Recroisements importants | Résultat |
|---:|---|---|---|---|
| 1 | `Ami.txt` | `14-ami-social-audit.md` | Missions, Social | Couvert |
| 2 | `Banniere.txt` | `06-gacha-invocation-audit.md` | Vote, XP rotation | Couvert |
| 3 | `Banque.txt` | `09-banque-audit.md` | XP intérêt legacy, Top Moras | Couvert |
| 4 | `Box.txt` | `07-box-possession-obtention-audit.md` | Team, Expedition, Top | Couvert |
| 5 | `Code.txt` | `19-codes-cadeaux-audit.md` | Event Festival | Couvert |
| 6 | `Coffre.txt` | `10-sac-coffre-shop-audit.md` | Event | Couvert |
| 7 | `Combat.txt` | `13-combat-audit.md` | Team, Missions, Daily | Couvert |
| 8 | `Concours.txt` | `15-concours-c6-audit.md` | Pull C6+, Stella, XP nettoyage | Couvert |
| 9 | `Convertir.txt` | `05-element-resources-audit.md` | Mission quotidienne | Couvert |
| 10 | `Daily.txt` | `11-missions-daily-audit.md` / `17-roue-quotidien-audit.md` | Combat, Expedition, Event, Shop | Couvert |
| 11 | `Echanger.txt` | `05-element-resources-audit.md` | XP expiration legacy | Couvert |
| 12 | `Element.txt` | `05-element-resources-audit.md` | Onboarding, toutes ressources élémentaires | Couvert |
| 13 | `Event.txt` | `16-event-monthly-audit.md` | Coffre, Codes, XP | Couvert |
| 14 | `Expedition.txt` | `12-expedition-audit.md` | Box, Missions, Daily | Couvert |
| 15 | `Faveur.txt` | `18-faveur-subscription-audit.md` | Subscription, XP claim legacy | Couvert |
| 16 | `Gift.txt` | `20-gift-twitch-audit.md` | Twitch Custom Reward, particules | Couvert |
| 17 | `Giveaway.txt` | `21-giveaway-wish-audit.md` | Wish, XP comptage chat | Couvert |
| 18 | `Help.txt` | `23-help-command-coherence-audit.md` | Command reference | Couvert |
| 19 | `Infos.txt` | `14-ami-social-audit.md` | Profil / catalogue | Couvert |
| 20 | `Legende.txt` | `15-concours-c6-audit.md` | C6 characters | Couvert |
| 21 | `Liste.txt` | `14-ami-social-audit.md` | Présence / annuaire cible | Couvert |
| 22 | `Missions.txt` | `11-missions-daily-audit.md` | XP, Pull, Social, Expedition, Combat | Couvert |
| 23 | `Obtention.txt` | `07-box-possession-obtention-audit.md` | Possessions | Couvert |
| 24 | `Passif.txt` | `08-team-audit.md` | Pull | Couvert |
| 25 | `Pity.txt` | `06-gacha-invocation-audit.md` | Pull | Couvert |
| 26 | `Pull.txt` | `06-gacha-invocation-audit.md` | Team/Passifs, Box, Concours, Missions | Couvert |
| 27 | `Roue.txt` | `17-roue-quotidien-audit.md` | Daily, ressources | Couvert |
| 28 | `Sac.txt` | `10-sac-coffre-shop-audit.md` | Ressources | Couvert |
| 29 | `Select.txt` | `06-gacha-invocation-audit.md` | Bannière | Couvert |
| 30 | `Shop.txt` | `10-sac-coffre-shop-audit.md` | Missions quotidiennes | Couvert |
| 31 | `Stella.txt` | `07-box-possession-obtention-audit.md` / `15-concours-c6-audit.md` | C6, copies | Couvert |
| 32 | `Subscription.txt` | `18-faveur-subscription-audit.md` | Twitch EventSub cible | Couvert |
| 33 | `Team.txt` | `08-team-audit.md` | Passifs, Combat, Expedition | Couvert |
| 34 | `Top.txt` | `22-top-classements-audit.md` | Toutes statistiques propriétaires | Couvert |
| 35 | `Vote.txt` | `06-gacha-invocation-audit.md` | Rotation bannière | Couvert |
| 36 | `Wish.txt` | `21-giveaway-wish-audit.md` | Giveaway | Couvert |
| 37 | `XP.txt` | `04-xp-audit.md` + domaines consommateurs | Très transversal | Couvert |

Conclusion :

**37/37 scripts possèdent un propriétaire documentaire explicite.**

Aucun script n'est :

- inconnu ;
- sans audit ;
- laissé dans un état « à décider plus tard » faute de propriétaire ;
- transformé implicitement en service V1 1:1.

---

# 5. Vérification spéciale de `XP.txt`

`XP.txt` est le principal risque du sweep car son nom masque un orchestrateur legacy très large.

Le code réel appelle ou porte notamment :

- création / defaults du viewer ;
- activité et compteur de messages ;
- XP / level-up ;
- overflow niveau 100 ;
- récompense quotidienne du premier message ;
- Faveur quotidienne ;
- intérêt Banque ;
- mission quotidienne `messages` ;
- missions longues ;
- expiration des échanges ;
- comptage chat Giveaway ;
- Event mensuel ;
- messages sociaux Event ;
- monnaie Event quotidienne ;
- synchronisation C6 ;
- nettoyage d'ancien Concours ;
- rotation / initialisation de bannière ;
- application des votes à la bannière.

## Répartition cible confirmée

| Responsabilité legacy de `XP.txt` | Propriétaire V1 / audit |
|---|---|
| Création / defaults Twitch-only | XP / cycle de vie + futur Auth/Twitch |
| Activité / messages | XP + Social/Présence |
| XP / niveaux / récompenses | XP |
| Quotidienne premier message | XP / DailyTracker |
| Faveur quotidienne | Faveur |
| Intérêt bancaire | Banque / scheduler |
| Mission quotidienne messages | Missions |
| Missions longues | Missions |
| Expiration échanges | Échanges |
| Comptage Giveaway | Giveaway |
| Event mensuel | Event |
| Messages sociaux Event | Event |
| Monnaie Event quotidienne | Event |
| Synchronisation C6 | Box / Concours |
| Nettoyage Concours | Concours |
| Rotation bannière | Gacha |
| Application des votes | Gacha / Vote |

Aucune de ces responsabilités ne reste sans propriétaire.

Décision architecturale déjà acquise et confirmée :

**ne jamais recréer un `XPService` monolithique équivalent au script legacy.**

---

# 6. Commandes vs actions non-commandes

Le sweep confirme la distinction suivante.

## Vraies racines player-facing

Le catalogue Help/Commandes possède 34 racines en comptant `!help`.

## Scripts qui ne deviennent pas une commande canonique

### `XP.txt`

Orchestrateur de messages.

Ne pas créer :

`!xp`

### `Gift.txt`

Action prévue pour une Custom Reward Twitch.

Ne pas créer :

`!gift`

comme commande player-facing canonique.

### `Subscription.txt`

Trigger Twitch d'acquisition de Faveur.

Ne pas créer :

`!subscription`

Ces trois distinctions sont déjà intégrées au Domaine Help.

---

# 7. Corrections factuelles découvertes pendant le sweep

Aucune nouvelle décision produit n'est nécessaire.

Quatre corrections documentaires factuelles sont néanmoins requises.

## 7.1 Master — nombre de scripts

Le Master indique encore dans son inventaire détaillé :

`36 fichiers`

alors que le dossier et la liste contiennent :

**37 scripts.**

Correction :

`36 fichiers` -> `37 fichiers`.

---

## 7.2 `command-reference.md` — inventaire initial incomplet

L'inventaire historique en tête du registre omet :

`Giveaway`

alors que `Giveaway.txt` est désormais bien présent parmi les 37 scripts.

Le registre doit afficher l'inventaire réel final et préciser que :

- 37 scripts sont présents ;
- `XP`, `Gift`, `Subscription` ne correspondent pas à trois commandes player-facing canoniques.

Le statut global du registre peut aussi passer de `EN CONSTRUCTION` à :

**CONSOLIDÉ APRÈS SWEEP DES 37 SCRIPTS — sous réserve du sweep des 17 JSON.**

---

## 7.3 Matrice — `Faveur.txt`

Le vrai `Faveur.txt` :

- lit `viewers_data.json` ;
- ne modifie aucune donnée ;
- ne sauvegarde rien ;
- consulte uniquement l'état de Faveur.

La matrice indique encore `R/W` et parle de `consultation/réclamation`.

Correction cible de la ligne :

- accès : `R` ;
- note : consultation de l'état uniquement ; claim quotidien historique porté par `XP.txt`, acquisition portée par `Subscription.txt`.

---

## 7.4 Matrice — `Gift.txt`

La matrice classe encore Gift comme :

`Modération / Récompense admin`

Le vrai script est conçu comme action de Custom Reward Twitch.

Correction cible :

- domaine : `Twitch / Custom Reward` ;
- note : `Gift Suprême`, cible saisie dans la redemption, +1600 particules de l'élément du viewer cible, aucune commande `!gift` canonique V1.

---

## 7.5 Matrice — `Vote.txt`

La matrice indique encore que `Vote.txt` utilise :

`viewers_data.json`

Le vrai script ne le lit pas.

Il utilise :

- `genshin_characters.json` en lecture ;
- `banner_votes.json` en lecture/écriture.

Correction cible :

retirer `viewers_data.json` de cette ligne.

---

# 8. Scripts directement réinspectés — points confirmés

## `Faveur.txt`

Confirmé :

- `!faveur`
- `!faveur pseudo`
- `!faveur @pseudo`
- strictement read-only
- maximum affiché 180 jours
- aucune réclamation dans ce script

La séparation consultation / acquisition / claim est donc importante.

## `Gift.txt`

Confirmé :

- déclenchement prévu via récompense de points de chaîne ;
- cible issue du texte de redemption ;
- résolution de pseudo tolérante ;
- +1600 particules de l'élément du viewer ciblé ;
- mutation de `viewers_data.json`.

## `Giveaway.txt`

Confirmé :

- `open`
- `close`
- `stats`
- `reroll`
- lecture/écriture de `giveaway.json` et `viewers_data.json`.

Le legacy ne vérifie pas réellement le rôle broadcaster/modérateur dans le code.

Cette faiblesse est déjà capturée par l'audit Giveaway/Help cible qui réserve les mutations à l'administration.

## `Vote.txt`

Confirmé :

- `!vote`
- `!vote <personnage>`
- un vote hebdomadaire ;
- catalogue en lecture ;
- `banner_votes.json` en R/W ;
- aucun `viewers_data.json`.

## `Coffre.txt`

Confirmé :

- lecture du coffre ;
- aucune modification des quantités ;
- mais `EnsureViewerDefaults` puis sauvegarde possible de `viewers_data.json`.

Le `R/W prudent` de la matrice reste donc justifié techniquement.

## `Liste.txt`

Confirmé legacy :

- filtre par élément ;
- tri par `lastSeen` ;
- max 40.

La cible Social déjà validée remplace cette restitution par les règles standalone documentées.

Aucune nouvelle décision n'est nécessaire.

## `Legende.txt`

Confirmé :

- lecture seule ;
- `c6_characters.json` ;
- `viewers_data.json` uniquement pour vérifier l'existence du profil ;
- aucun JSON modifié.

## `Event.txt`

Confirmé :

- configuration mensuelle intégrée au script legacy ;
- `viewers_data.json` ;
- `monthly_events_data.json` ;
- commandes et mini-jeux mensuels centralisés dans `!event`.

Le domaine Event possède déjà la cible V1 complète.

## `Concours.txt`

Confirmé :

- `contests_data.json` ;
- `c6_characters.json` ;
- `viewers_data.json` ;
- concours fortement transversal avec C6.

Le domaine Concours/C6 en est bien propriétaire.

---

# 9. Bugs legacy déjà documentés — ne pas réouvrir

Le sweep retrouve ou confirme plusieurs anomalies historiques, mais elles possèdent déjà une décision cible.

Exemples :

- `totalMainElementParticlesEarned` non alimenté uniformément ;
- incohérence historique Stella / `copies` ;
- Capture de brillance pouvant fausser les statistiques 50/50 legacy ;
- fragilité des baselines Missions ;
- écarts de compteurs de particules dans certains producteurs ;
- divergences déjà identifiées entre messages et valeurs de certaines récompenses ;
- absence de contrôle d'autorisation directement dans certaines actions legacy.

Principe :

**migrer les données historiques selon les règles déjà validées, puis corriger le comportement futur dans les services V1 ; ne pas recalculer arbitrairement le passé.**

Aucun nouveau Rxxx n'est créé pour ces points.

---

# 10. Producteurs / consommateurs transversaux

Le sweep confirme les croisements importants suivants :

- Gacha produit possessions, pity, statistiques et récompenses consommées par Box, Missions, Concours et Top ;
- Team produit la composition utilisée par Passifs, Combat et certaines actions Gacha ;
- Missions consomment des événements provenant de plusieurs domaines, mais ne doivent pas forcer ces domaines à dupliquer leur logique ;
- Event produit monnaie/collection et consomme notamment Codes ;
- Banque produit un solde distinct mais Top Moras dérive le patrimoine selon les règles de confidentialité ;
- Social fournit les relations/cœurs et la présentation des profils ;
- Giveaway consomme le chat Twitch pour ses statistiques de session ;
- Daily/Quotidiennes agrège des états de domaines propriétaires sans devenir leur source de vérité ;
- Top reste un pur lecteur / agrégateur ;
- Help reste un pur catalogue de présentation.

Aucun producteur/consommateur majeur découvert dans les scripts ne reste sans domaine documentaire.

---

# 11. Résultat du sweep scripts

## Couverture

**37 / 37 scripts : OK**

## Script orphelin

**0**

## Responsabilité transverse `XP.txt` sans propriétaire

**0 identifiée**

## Nouvelle décision produit nécessaire

**0**

## Corrections factuelles à checkpoint

1. Master `36` -> `37` ;
2. command-reference : ajouter Giveaway à l'inventaire réel + statut consolidé ;
3. matrice Faveur : `R/W` -> `R`, consultation uniquement ;
4. matrice Gift : domaine Custom Reward Twitch ;
5. matrice Vote : supprimer `viewers_data.json` ;
6. ajouter le présent document de sweep ;
7. déplacer le pointeur actif du Master vers le sweep des 17 JSON.

---

# 12. Prochaine étape après checkpoint

Le sweep des scripts est considéré comme terminé lorsque les corrections ci-dessus sont présentes sur `main`.

La prochaine étape globale doit alors devenir :

**Sweep exhaustif final des 17 JSON legacy.**

Objectifs du sweep JSON :

- confirmer les 17 fichiers réellement présents ;
- vérifier chaque producteur et consommateur ;
- distinguer source de vérité, configuration, état temporel, relation et donnée dérivable ;
- confirmer les règles de migration ;
- repérer les champs/fichiers résiduels ou inutilisés ;
- vérifier spécialement `monthly_events.json`, actuellement identifié comme vide / potentiellement résiduel ;
- ne figer le modèle de données V1 qu'après cette passe.

---

# 13. Clôture

Le sweep final des scripts ne remplace aucun audit spécialisé.

Il confirme que la Phase d'audit métier possède maintenant une couverture documentaire complète des **37 sources de code legacy**.

Statut :

**CLÔTURÉ — 37/37 scripts couverts, aucun script orphelin, aucune nouvelle décision produit.**
