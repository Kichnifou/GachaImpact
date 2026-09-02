# 13 — Audit legacy Combat

Statut : AUDIT EN COURS — COMBAT QUOTIDIEN ET BOSS CADRÉS JUSQU'À R429 ; PROCHAINE REPRISE R430
Date : 2026-09-02

## 1. Périmètre

Domaine audité :
- combat quotidien ;
- équipe ennemie quotidienne ;
- Team active ;
- mode Auto ;
- probabilités de victoire ;
- rareté / constellations / éléments ;
- KO journaliers ;
- récompense de victoire ;
- statistiques Combat ;
- intégration Missions ;
- intégration au hub Quotidiennes ;
- commandes `!combat` ;
- Boss mensuel communautaire ;
- migration et architecture cible.

Le présent checkpoint traite complètement la première passe du **combat quotidien**.

Le Boss mensuel legacy est conservé par R379 mais son audit détaillé commence à R390.

---

## 2. Sources legacy principales

### Code
- `legacy/streamerbot/commands/Combat.txt`

### Données
- `legacy/streamerbot/data/combat_config.json`
- `legacy/streamerbot/data/combat_data.json`
- `legacy/streamerbot/data/monthly_boss.json`
- `legacy/streamerbot/data/viewers_data.json`
- `legacy/streamerbot/data/genshin_characters.json`

### Consommateurs / recroisements
- `legacy/streamerbot/commands/XP.txt`
- `legacy/streamerbot/commands/Missions.txt`
- `legacy/streamerbot/commands/Daily.txt`
- `docs/legacy/08-team-audit.md`
- `docs/legacy/11-missions-daily-audit.md`
- `docs/specifications/decisions-log.md`

---

# 3. Réalité du combat quotidien legacy

Le script gère une équipe ennemie quotidienne de 4 personnages.

Cette équipe est :
- commune à tous les joueurs ;
- générée pour la date courante ;
- stockée dans `combat_data.json`.

Commandes principales :
- `!combat` → affiche les ennemis du jour ;
- `!combat info` → évalue la Team active ;
- `!combat go` → combat avec la Team active ;
- `!combat auto` → construit une Team temporaire puis combat ;
- `!combat elements` → affiche les relations élémentaires ;
- `!combat stat` → statistiques ;
- `!combat boss` / `!combat boss go` → Boss mensuel.

Le combat quotidien exige 4 personnages.

Une victoire :
- termine le combat quotidien du joueur pour la journée ;
- donne 800 Primogemmes ;
- donne 20 000 Moras ;
- incrémente `totalCombatWins`.

Une défaite :
- incrémente `totalCombatLosses` ;
- place les 4 personnages utilisés dans les KO du jour ;
- n'empêche pas une nouvelle tentative avec 4 autres personnages disponibles.

Le joueur peut donc retenter jusqu'à :
- gagner ;
- ou ne plus disposer de 4 personnages non-KO.

Le KO legacy est propre au combat quotidien.

Il n'enlève pas le personnage de la Team ou de la Box.

---

# 4. Formule legacy réellement observée

Legacy quotidien :

```text
chance = 50
       + relations élémentaires × 3
       + constellations 5★ × 1
       + constellations 4★ × 0,5
```

Puis clamp :
- minimum 20 % ;
- maximum 85 %.

Le vrai calcul quotidien legacy ne donnait aucun bonus intrinsèque de rareté à C0.

En revanche, l'algorithme Auto utilisait un score différent :
- relation favorable : +10 ;
- relation défavorable : -10 ;
- 5★ : +20 ;
- 4★ : +10 ;
- constellation 5★ : +3 ;
- constellation 4★ : +1,5.

Il existait donc une incohérence :
l'Auto favorisait intrinsèquement les 5★ alors que la vraie chance de victoire ne le faisait pas.

R374/R378 imposent que cet avantage des 5★ devienne réel dans la formule standalone.

---

# 5. Relations élémentaires legacy

Matrice conservée :

| Élément | Fort contre | Faible contre |
|---|---|---|
| Pyro | Cryo, Dendro | Hydro, Geo |
| Hydro | Pyro, Geo | Electro, Dendro |
| Cryo | Hydro, Anemo | Pyro, Electro |
| Electro | Hydro, Cryo | Dendro, Geo |
| Anemo | Dendro, Electro | Cryo, Geo |
| Geo | Electro, Anemo | Hydro, Pyro |
| Dendro | Hydro, Electro | Pyro, Anemo |

Chaque personnage joueur est comparé aux 4 ennemis.

Avec 4 personnages de chaque côté, il peut donc exister jusqu'à 16 relations élémentaires évaluées.

---

# 6. Décisions standalone validées — R370 à R389

## R370 — Équipe ennemie quotidienne globale

Conserver une équipe ennemie quotidienne commune à tous les joueurs.

À chaque journée serveur :
- reset à 00:00 `Europe/Paris` ;
- génération serveur d'une équipe de 4 personnages distincts ;
- uniquement depuis les personnages actifs du catalogue ;
- équipe identique pour tous les joueurs pendant la journée.

Le client ne génère jamais lui-même cette équipe.

## R371 — Tentatives multiples après défaite

Conserver le système de plusieurs tentatives quotidiennes.

Après une défaite :
- les 4 personnages utilisés deviennent KO pour le combat quotidien ;
- le joueur peut retenter avec 4 autres personnages disponibles.

Le processus continue jusqu'à :
- victoire ;
- ou impossibilité de composer 4 personnages non-KO.

Une victoire clôt le combat quotidien pour cette journée.

## R372 — KO limité au combat quotidien

Un personnage KO reste utilisable dans les autres systèmes.

Le KO ne retire pas le personnage :
- de la Box ;
- de la Team active ;
- des Saved Teams ;
- d'Expedition ;
- du Boss mensuel ;
- des autres mécaniques qui l'autorisent.

Le KO signifie uniquement :
`indisponible pour une nouvelle tentative du combat quotidien jusqu'au prochain reset`.

## R373 — ⚠️ RÉVISÉ PAR R423 / R425 / R426

La règle initiale imposant directement la Team active au mode manuel est supprimée.

Le Combat quotidien utilise désormais sa propre composition persistante de quatre slots.

La Team active :
- n'est jamais appliquée automatiquement ;
- n'est jamais modifiée par Combat ;
- peut être copiée volontairement via `Sélectionner l'équipe active`.

Une attaque nécessite toujours exactement 4 personnages valides, possédés, actifs et non-KO.

La définition finale du mode manuel est donnée par R426.

## R374 — Mode Auto conservé et formule unifiée — MIS À JOUR R423 / R427

Conserver le mode Auto uniquement pour le Combat quotidien.

Twitch/chat :
- `!combat auto` sélectionne automatiquement la meilleure composition disponible et lance immédiatement le combat.

Standalone UI :
- `Équipe automatique` calcule la meilleure composition disponible ;
- remplit les quatre slots persistants du Combat quotidien ;
- affiche la chance calculée ;
- attend ensuite le clic `Combattre`.

La composition Auto :
- utilise uniquement les personnages possédés, actifs et non-KO ;
- ne modifie jamais la Team active ;
- est mémorisée dans les slots Combat selon R427.

La tentative immédiatement associée à l'utilisation d'Auto est marquée `AUTO`.

La composition elle-même n'est pas marquée Auto éternellement.

La sélection Auto utilise exactement la même formule autoritative que le vrai calcul de victoire.

L'ancien avantage artificiel donné aux 5★ par l'algorithme Auto est intégré à la vraie formule via R380/R381.

Le Boss ne possède aucun Auto.

## R375 — Afficher la chance exacte

Afficher la probabilité exacte de victoire avant le combat.

Exemple :
`Chance de victoire : 78,5 %`.

Cette valeur :
- vient du serveur ;
- est recalculée lorsque la composition utilisée change ;
- utilise exactement la formule réelle du tirage.

Le résultat du combat peut également rappeler cette chance.

## R376 — Récompense quotidienne V1

Conserver :
- +800 Primogemmes ;
- +20 000 Moras.

Récompense attribuée uniquement à la première victoire quotidienne.

Les gains passent par le service économique autoritatif et alimentent :
- `totalPrimosEarned` ;
- `totalMorasEarned`.

## R377 — Matrice élémentaire conservée

Conserver la matrice élémentaire legacy définie dans `combat_config.json`.

Le principe reste :
- avantage ;
- désavantage ;
- neutre.

Le poids exact de la relation est ajusté par R380/R381 afin d'équilibrer la nouvelle formule globale.

## R378 — Les 5★ sont intrinsèquement plus puissants

Changer la formule réelle :
- un 5★ C0 doit être intrinsèquement plus fort qu'un 4★ C0, même à élément identique.

Cette différence n'est plus réservée au score Auto.

La valeur finale est définie avec R380/R381.

## R379 — Boss mensuel communautaire conservé

Conserver le concept du Boss mensuel communautaire dans le standalone.

Il reste rattaché au Domaine Combat mais constitue un sous-système distinct du combat quotidien.

Son audit détaillé commence à R390.

Éléments legacy à auditer :
- Boss mensuel global ;
- PV communs ;
- résistance élémentaire ;
- une attaque quotidienne par joueur ;
- dégâts cumulés ;
- récompense communautaire ;
- statistiques / records ;
- coup final ;
- génération/archivage mensuel.

## R380 — Formule de rareté cible — ✅ DÉCIDÉE PAR ÉQUILIBRAGE

Formule V1 retenue :

- personnage 4★ : **+3 points de chance** ;
- personnage 5★ : **+6 points de chance**.

Justification :
- reprend le rapport 10/20 du score Auto legacy ;
- rend enfin le bonus de rareté réellement autoritatif ;
- un 5★ C0 est nettement supérieur à un 4★ C0 ;
- la formule reste simple à expliquer.

Cette décision reste révisable après playtests si le ressenti réel est mauvais.

## R381 — Constellations / poids élémentaire — ✅ DÉCIDÉ PAR ÉQUILIBRAGE

Conserver au maximum les proportions legacy :

Constellations :
- 4★ : **+0,5 point par constellation** ;
- 5★ : **+1 point par constellation**.

Relations élémentaires :
- avantage : **+4 points** ;
- désavantage : **-4 points** ;
- neutre : 0.

Le poids élémentaire passe donc de ±3 legacy à ±4 afin qu'une excellente composition élémentaire puisse réellement approcher le plafond de victoire.

Propriété d'équilibrage recherchée :
- 4★ C6 → bonus intrinsèque total = 3 + 3 = 6 ;
- 5★ C0 → bonus intrinsèque total = 6.

Ainsi un 4★ maximisé rejoint approximativement un 5★ C0 sur la puissance brute, tandis que le 5★ garde un plafond supérieur grâce à ses constellations.

## R382 — Nouveau clamp

Remplacer les limites legacy 20 % / 85 % par :

- minimum : **5 %** ;
- maximum : **95 %**.

Il reste donc toujours :
- une petite chance de gagner avec une très mauvaise composition ;
- une petite chance d'échouer même avec une composition extrêmement optimisée.

## Formule V1 résultante

```text
chance brute =
    50
  + 3 × nombre de 4★
  + 6 × nombre de 5★
  + 0,5 × somme des constellations 4★
  + 1 × somme des constellations 5★
  + 4 × avantages élémentaires
  - 4 × désavantages élémentaires

chance finale = clamp(chance brute, 5, 95)
```

Chaque relation élémentaire compare un personnage joueur à un personnage ennemi.

### Exemples de contrôle

#### 4×5★ C0, aucune relation nette
```text
50 + 24 = 74 %
```

#### 4×5★ C0 avec +4 relations favorables nettes
```text
50 + 24 + 16 = 90 %
```

#### 4×5★ C0 avec +6 relations favorables nettes
```text
50 + 24 + 24 = 98 % brut
→ 95 % final
```

#### 4×4★ C0, aucune relation nette
```text
50 + 12 = 62 %
```

#### 4×4★ C6, aucune relation nette
```text
50 + 12 + 12 = 74 %
```

Cela donne volontairement :
- 4×4★ C6 neutres ≈ 4×5★ C0 neutres ;
- les 5★ C1+ reprennent ensuite l'avantage ;
- les avantages élémentaires restent déterminants.

## R383 — Présentation des KO

Dans l'écran Combat :
- portrait KO assombri ;
- badge `💀 KO` ;
- indication `Disponible demain`.

Dans la fiche du personnage :
- afficher un statut Combat :
  - `OK` ;
  - ou `KO`.

Le statut KO ne modifie pas la présence du personnage dans la Box/Team.

Si la composition Combat quotidienne contient un KO :
- Combat indique clairement le ou les personnages bloquants ;
- l'attaque est impossible tant que la composition n'est pas valide ;
- le joueur peut remplacer directement les personnages dans les slots ou utiliser `Sélectionner l'équipe active` ;
- la Team active n'est jamais modifiée automatiquement.

## R384 — États Combat dans Quotidiennes

La carte Combat du hub `Quotidiennes` utilise des états détaillés :

### À faire
Aucune tentative aujourd'hui et aucune victoire.

### En cours
Au moins une défaite a eu lieu mais une nouvelle Team de 4 personnages non-KO reste possible.

L'UI peut afficher par exemple :
`8 personnages KO`.

### Terminé
Victoire obtenue aujourd'hui.

### Bloqué aujourd'hui
Aucune victoire obtenue mais moins de 4 personnages non-KO restent disponibles.

Le bouton `Accéder` reste disponible dans tous les états.

Le hub ne lance jamais lui-même le combat.

## R385 — Le quotidien est réussi uniquement à la victoire

Une tentative ou une défaite ne valide pas l'activité quotidienne Combat.

L'activité devient `Terminé` uniquement lors de la première victoire de la journée.

Si le joueur n'a plus 4 personnages disponibles sans avoir gagné :
- état `Bloqué aujourd'hui` ;
- activité quotidienne non réussie.

## R386 — Auto UI = sélection puis confirmation — MIS À JOUR R427

Standalone UI :

Bouton `Équipe automatique` :
1. calcule la meilleure composition disponible ;
2. remplit les quatre slots persistants du Combat quotidien ;
3. affiche la chance exacte ;
4. ne lance pas encore le combat.

Le joueur clique ensuite sur `Combattre`.

La tentative associée à cette utilisation d'Auto est marquée `AUTO`.

Les personnages sélectionnés restent ensuite mémorisés dans les slots.

Lors d'une future tentative, si le joueur réutilise simplement cette composition sans recliquer sur `Équipe automatique`, la tentative devient `MANUAL`.

L'origine Auto n'est donc jamais attachée définitivement à la composition.

Twitch/chat :
- `!combat auto` conserve le comportement direct sélection + combat.

## R387 — Définition autoritative d'une victoire manuelle — RÉVISÉ R426 / R427

Une victoire est `manuelle` lorsque la tentative exécutée n'a pas utilisé l'action Auto pour générer sa composition.

Peuvent donc compter dans `totalManualCombatWins` :
- composition construite manuellement dans les quatre slots ;
- composition persistante réutilisée ;
- `Sélectionner l'équipe active` puis `Combattre` ;
- ancienne composition créée par Auto mais réutilisée ultérieurement sans relancer Auto.

Ne comptent pas :
- tentative exécutée après `Équipe automatique` pour cette tentative ;
- `!combat auto`.

Le serveur conserve explicitement le mode `MANUAL` ou `AUTO` de chaque tentative.

La sémantique précise de `!combat go` avec les nouveaux slots persistants sera finalisée dans le bloc commandes R430+.

## R388 — Missions Combat

Missions permanentes B/A/S :
- utilisent `totalCombatWins` ;
- victoire manuelle ou Auto comptent.

Seuils legacy conservés :
- B : 5 victoires ;
- A : 20 victoires ;
- S : 100 victoires.

Mission Z `Maître du combat` :
- utilise `totalManualCombatWins` ;
- objectif : 50 victoires manuelles.

Le Domaine Combat résout donc la dépendance Combat reportée par R309/R339 du Domaine Missions.

## R389 — Détails de la formule accessibles

L'écran Combat affiche la chance finale clairement.

Un contrôle `Détails du calcul` permet d'afficher :

- base ;
- bonus rareté ;
- bonus constellations ;
- avantages élémentaires ;
- désavantages élémentaires ;
- résultat brut ;
- clamp éventuel ;
- chance finale.

Exemple :
```text
Base : 50 %
Rareté : +21 %
Constellations : +6,5 %
Avantages : +16 %
Désavantages : -8 %
Brut : 85,5 %
Final : 85,5 %
```

Si le clamp s'applique :
```text
Brut : 101 %
Maximum : 95 %
Final : 95 %
```

Cette vue est informative uniquement.
Elle ne recalcule jamais la chance côté client.

---

# 7. Règles techniques dérivées — Combat quotidien

- `CombatService` est propriétaire du calcul et du tirage ;
- l'équipe ennemie est server-authoritative ;
- seuls les personnages actifs du catalogue peuvent être générés comme ennemis ;
- un personnage désactivé est inutilisable en Team Combat/Auto ;
- une défaite ne modifie jamais la Team active ;
- les KO sont un état journalier propre au combat quotidien ;
- reset KO à 00:00 `Europe/Paris` ;
- victoire et récompense sont atomiques/idempotentes ;
- double clic/retry multi-canal ne peut pas payer deux fois ;
- la formule de preview et la formule du tirage sont strictement identiques ;
- l'Auto appelle cette même formule pour comparer les compositions ;
- la Team Auto ne devient jamais une Saved Team ni la Team active ;
- `totalCombatFights` augmente pour chaque tentative réellement exécutée ;
- `totalCombatLosses` augmente sur une vraie défaite ;
- `totalCombatWins` augmente sur la première victoire réussie ;
- `totalManualCombatWins` augmente seulement si cette victoire est de mode manuel ;
- une fois `lastWinDate` égal au jour serveur, aucune nouvelle tentative quotidienne n'est autorisée ;
- gains économiques centralisés ;
- MissionService consomme l'événement autoritatif de victoire sans recalculer Combat.

---

# 8. Architecture cible provisoire — Combat quotidien

```text
Combat UI / chat interne / Twitch
                |
                v
          CombatService
          ├── getDailyEncounter()
          ├── evaluate(team, mode)
          ├── buildBestAutoTeam()
          └── fight(team, mode)
                |
       ┌────────┼─────────┐
       v        v         v
   Team/Box   Economy   Mission
    reads     Service   Service
```

Le nom exact des services/tables/API sera fixé en Phase 2/3.

---

# 9. Boss mensuel communautaire — décisions R390 à R422

## 9.1 Base legacy

Le Boss legacy fournit la base suivante :
- un Boss communautaire ;
- environ 1 500 000 PV ;
- variation de PV ±15 % ;
- une résistance élémentaire ;
- une attaque par joueur/jour ;
- dégâts cumulés globalement ;
- récompense de tous les participants lorsque le Boss est vaincu ;
- coup final ;
- statistiques globales et individuelles ;
- historique mensuel.

R379 conserve le concept.

## R390 — Un Boss par mois civil

Un seul Boss est généré par mois.

Nouvelle instance :
- premier jour du mois ;
- 00:00 `Europe/Paris`.

L'ancien Boss est archivé avant création du suivant.

## R391 — Pas de respawn intra-mois

Si le Boss est vaincu avant la fin du mois :
- il reste vaincu ;
- aucun nouveau Boss n'apparaît immédiatement ;
- l'écran affiche son bilan ;
- attendre le premier du mois suivant.

## R392 / R402 — Difficulté adaptative des PV

La première valeur de référence standalone est :

`baseHp = 1 500 000`

Cette valeur évolue ensuite selon le résultat du mois précédent.

### Boss vaincu

Pour chaque journée calendaire restant après le jour de la victoire :

`+75 000 baseHp`

Augmentation maximale d'un mois au suivant :

`+1 500 000`

Exemple :
- Boss vaincu le 20 d'un mois de 30 jours ;
- 10 jours restants ;
- augmentation : +750 000 ;
- base suivante depuis 1,5M : 2,25M.

### Boss non vaincu

La base suivante perd exactement les PV qui restaient au Boss :

`nouveauBaseHp = ancienBaseHp - currentHp`

Plancher :

`500 000 baseHp`

Il n'existe pas de plafond absolu global de difficulté.

## R393 — Une attaque Boss par joueur et par jour

Chaque joueur dispose d'une attaque Boss quotidienne.

Reset :
- 00:00 `Europe/Paris`.

Cette attaque est indépendante :
- du combat quotidien ;
- de sa victoire/défaite ;
- de ses personnages KO.

## R394 — Composition Boss indépendante — RÉVISÉ R423/R424/R425

Le Boss possède quatre slots de composition propres.

Ces slots :
- ne sont pas la Team active ;
- ne modifient jamais la Team active ;
- ne sont pas une Saved Team ;
- sont indépendants des quatre slots du Combat quotidien.

Le joueur peut :
- sélectionner manuellement ses personnages ;
- remplacer individuellement un slot ;
- cliquer sur `Sélectionner l'équipe active` pour effectuer une copie ponctuelle ;
- ouvrir `Modifier mes Teams` s'il souhaite modifier ses vraies Teams.

Première utilisation :
- les quatre slots sont vides.

La composition Boss est persistante indéfiniment.

Elle n'est vidée :
- ni au reset quotidien ;
- ni lorsque le Boss est vaincu ;
- ni au changement de mois.

## R395 — Aucun Auto Boss

Le Boss ne propose aucune composition automatique.

Pas de :
- bouton Auto ;
- meilleure équipe automatique ;
- `!combat boss auto`.

La composition appartient au joueur.

## R396 — Résistance élémentaire

Chaque Boss possède une résistance aléatoire parmi les sept éléments.

Un personnage du même élément que cette résistance inflige :

`dégâts × 0,5`

La résistance reste identique pendant tout le Boss.

## R397 / R429 — Preview des dégâts

Les dégâts sont recalculés en temps réel quand la composition ou l'état des personnages change.

Dans la vue normale, afficher uniquement :

`Dégâts prévus : X`

Les détails sont masqués par défaut.

Le panneau `Voir les détails` peut afficher :
- chaque personnage ;
- rareté ;
- constellation ;
- dégâts avant résistance ;
- pénalité de résistance éventuelle ;
- dégâts finaux individuels ;
- total.

Le serveur reste source de vérité.

## R398 — Formule Boss

Conserver la formule legacy V1.

4★ :

`500 + 150 × constellation`

5★ :

`1 000 + 650 × constellation`

Puis appliquer la résistance élémentaire éventuelle.

## R399 / R406 — Participation

Une attaque valide ayant infligé plus de 0 dégât suffit à devenir participant du Boss.

Aucun minimum supplémentaire :
- de dégâts ;
- d'attaques ;
- de classement.

Tous les participants éligibles reçoivent la même récompense si le Boss est vaincu.

## R400 — Distribution automatique

Lorsque le Boss atteint 0 PV :
- figer les participants éligibles ;
- créditer automatiquement chaque participant ;
- joueurs offline compris ;
- aucune action Claim requise ;
- opération atomique et idempotente ;
- aucun double paiement.

Chaque participant reçoit une notification UI.

Aucune notification Twitch asynchrone.

## R401 — Coup final

Conserver :
- identité du joueur ayant porté le coup final ;
- statistique de coups finaux.

Le coup final est honorifique.

Aucun bonus économique supplémentaire.

## R403 — Notifications persistantes tant qu'elles sont non lues

Règle transverse :

Notification non lue :
- aucune expiration automatique liée à l'âge ;
- reste présente jusqu'à lecture ou suppression manuelle.

Notification lue :
- peut être supprimée manuellement ;
- sinon nettoyée au prochain reset quotidien.

Toute notification :
- lue ou non ;
- peut être supprimée manuellement.

Supprimer une notification ne supprime jamais :
- une récompense ;
- un claim ;
- une demande ;
- un état métier.

## R404 — Écran du Boss vaincu

Lorsque le Boss est vaincu, l'écran de combat Boss laisse place au bilan du mois.

Afficher notamment :

### Boss
- nom ;
- mois ;
- résistance ;
- baseHp ;
- maxHp ;
- date/heure de victoire ;
- temps/nombre de jours nécessaires.

### Communauté
- nombre de participants ;
- nombre d'attaques ;
- dégâts totaux ;
- moyenne de dégâts par attaque.

### Records
- plus gros contributeur total ;
- plus gros coup ;
- coup final ;
- plus grand nombre d'attaques ;
- Top 3 des dégâts.

### Joueur courant
- dégâts totaux ;
- nombre d'attaques ;
- meilleur coup ;
- pourcentage des dégâts du Boss ;
- position au classement.

## R405 — Récompense Boss

Conserver en V1 pour chaque participant éligible :
- 16 000 Primogemmes ;
- 500 000 Moras.

Les gains utilisent le service économique central.

## R407 — Classement public

Le classement mensuel Boss est public.

Classement principal :
- dégâts totaux.

Records secondaires notamment :
- meilleur coup ;
- attaques ;
- coup final.

## R408 — Historique Boss

L'écran Boss possède :
- `Boss actuel` ;
- `Historique`.

Chaque ancien Boss peut conserver :
- mois ;
- nom ;
- résistance ;
- baseHp ;
- maxHp ;
- vaincu ou non ;
- date de victoire ;
- PV restants si non vaincu ;
- participants ;
- attaques ;
- dégâts ;
- coup final ;
- meilleur contributeur ;
- meilleur coup ;
- statistiques utiles au bilan.

## R409 — Intégration Quotidiennes

Ne pas créer une carte Boss séparée.

La carte Combat conserve comme état principal le Combat quotidien.

Elle peut afficher un sous-indicateur :
- `Attaque Boss disponible` ;
- `Boss attaqué aujourd'hui ✅`.

L'attaque Boss n'est pas nécessaire pour considérer le Combat quotidien terminé.

## R410 — Informations de résistance

L'écran Boss explique clairement l'effet de la résistance.

Exemple :

`Electro — Résistance du Boss : dégâts ×0,5`

Aucune composition n'est automatiquement suggérée.

## R411 — Snapshot d'une attaque Boss

Au lancement d'une attaque :
1. revalider les quatre personnages ;
2. snapshotter leur identité ;
3. snapshotter les constellations/valeurs nécessaires ;
4. calculer les dégâts ;
5. appliquer/persister l'attaque.

Une évolution ultérieure du personnage ne modifie jamais cette attaque historique.

## R412 — Personnage désactivé

Un personnage désactivé ne peut pas être utilisé contre le Boss.

Si une composition contient un personnage devenu invalide :
- attaque refusée ;
- attaque quotidienne non consommée.

## R413 / R424 — Mémoire Boss persistante

La composition Boss est mémorisée dès qu'elle change.

Cette mémoire persiste indéfiniment :
- d'un jour à l'autre ;
- après victoire du Boss ;
- d'un mois à l'autre.

Elle disparaît seulement si :
- le joueur la modifie ;
- un personnage devient invalide/désactivé.

## R414 — Composition partielle

Pendant la préparation :
- 0 à 4 slots remplis sont autorisés.

Pour attaquer :
- exactement 4 personnages ;
- tous distincts ;
- possédés ;
- actifs.

`Sélectionner l'équipe active` peut copier une Team partielle sans erreur ; seuls les slots existants sont remplis.

## R415 — Désactivation d'un personnage mémorisé

Si un personnage mémorisé est désactivé :
- vider uniquement son slot ;
- conserver les autres personnages.

Les anciennes attaques conservent leur snapshot historique.

## R416 — Reset quotidien

Le reset quotidien :
- rend une nouvelle attaque Boss disponible ;
- ne modifie pas la composition Boss.

## R417 — État actuel des personnages

Les slots mémorisent les IDs des personnages, pas leurs anciennes stats.

Si un personnage passe par exemple de C2 à C3 :
- le prochain preview utilise C3 ;
- la prochaine attaque utilise C3 ;
- l'attaque exécutée snapshotte ensuite C3.

## R418 — Scaling visible

Le bilan indique l'effet sur le Boss suivant.

Exemple victoire :

`10 jours d'avance → +750 000 baseHp le mois prochain`

Exemple échec :

`300 000 PV restants → -300 000 baseHp le mois prochain`

## R419 — baseHp et maxHp

Conserver deux notions distinctes :

`baseHp`
- difficulté adaptative persistante.

`maxHp`
- PV réels du Boss après variation mensuelle de ±15 % autour de baseHp.

Le scaling agit sur baseHp.

## R420 — Réduction après échec

Si le Boss n'est pas vaincu :

`nouveauBaseHp = ancienBaseHp - currentHp`

Réduction absolue, pas proportionnelle.

Plancher :
`500 000`

## R421 / R428 — Écran Combat à deux onglets

L'écran `Combat` possède deux onglets distincts :

1. `Combat quotidien` — ouvert par défaut ;
2. `Boss mensuel`.

Ce sont deux vues différentes.

Elles ne partagent pas :
- leur composition ;
- leur état ;
- leur mémoire.

Une cohérence générale de design est souhaitée, mais il ne faut pas imposer un composant unique si les deux vues doivent évoluer différemment.

## R422 / R423 / R425 — Slots du Combat quotidien

Le Combat quotidien possède lui aussi quatre slots indépendants du système Team.

Première utilisation :
- quatre slots vides.

Le joueur peut :
- sélectionner manuellement les personnages ;
- cliquer sur `Sélectionner l'équipe active` ;
- utiliser `Équipe automatique`.

Aucune de ces opérations ne modifie la Team active.

## R423 — Principe commun des compositions

Combat quotidien et Boss utilisent le même principe métier général :
- quatre slots propres au mode ;
- 0..4 en préparation ;
- 4/4 pour agir ;
- copie volontaire de la Team active ;
- aucune modification des vraies Teams ;
- mémoire persistante.

Mais les deux mémoires restent totalement indépendantes.

## R424 — Persistance indéfinie

La composition quotidienne et la composition Boss ne sont jamais vidées automatiquement pour une raison temporelle.

Pas de reset :
- quotidien ;
- hebdomadaire ;
- mensuel ;
- après victoire.

Exception :
- personnage rendu invalide/désactivé.

## R425 — Première utilisation

Lors de la toute première ouverture d'un mode sans composition mémorisée :

- Combat quotidien : 4 slots vides ;
- Boss : 4 slots vides.

La Team active n'est jamais préremplie automatiquement.

## R426 — Tentative manuelle

Pour le Combat quotidien, une tentative est `MANUAL` lorsque Auto n'a pas été utilisé pour générer la composition de cette tentative.

Sont notamment manuels :
- sélection personnage par personnage ;
- composition persistante réutilisée ;
- `Sélectionner l'équipe active` puis attaque ;
- ancienne composition issue d'Auto réutilisée plus tard sans relancer Auto.

Le serveur persiste le mode réel de chaque tentative.

## R427 — Auto et mémoire

`Équipe automatique` :
- calcule la meilleure composition ;
- remplit les quatre slots ;
- mémorise cette composition ;
- marque la tentative associée `AUTO`.

La composition n'est pas elle-même marquée Auto de manière permanente.

Si elle est réutilisée plus tard sans relancer Auto :
- la nouvelle tentative est `MANUAL`.

## R428 — Deux interfaces et deux mémoires

`Combat quotidien` et `Boss mensuel` restent deux onglets/interfaces différents.

Chacun possède :
- sa propre composition persistante ;
- son propre rendu ;
- ses propres actions.

Combat quotidien :
- 4 ennemis ;
- chance de victoire ;
- KO ;
- plusieurs tentatives ;
- Auto.

Boss :
- Boss unique ;
- PV ;
- résistance ;
- dégâts prévus ;
- une attaque/jour ;
- aucun Auto.

## R429 — Informations compactes + détails déroulants

### Combat quotidien

Vue principale :
`Chance de victoire : X %`

Panneau détaillé :
- base ;
- rareté ;
- constellations ;
- avantages ;
- désavantages ;
- valeur brute ;
- clamp ;
- valeur finale.

### Boss

Vue principale :
`Dégâts prévus : X`

Panneau détaillé :
- dégâts par personnage ;
- constellation ;
- résistance ;
- réduction ;
- total.

Les informations détaillées ne sont pas ouvertes par défaut.

---

# 10. Règles techniques communes des compositions

Prévoir deux mémoires persistantes distinctes, conceptuellement :
- `dailyCombatComposition` ;
- `bossCombatComposition`.

Les noms définitifs seront décidés avec le modèle de données.

Chaque mémoire :
- référence des IDs de personnages ;
- contient au maximum 4 IDs distincts ;
- accepte des slots vides ;
- ne constitue jamais une Team ;
- ne modifie jamais `activeTeamId`.

Les previews utilisent l'état actuel des personnages.

Les attaques exécutées utilisent des snapshots autoritatifs.

---

# 11. État

Domaine Combat toujours ouvert.

Combat quotidien :
- gameplay cadré ;
- formule cadrée ;
- KO cadrés ;
- Auto cadré ;
- slots persistants cadrés ;
- Missions cadrées ;
- UX principale cadrée.

Boss mensuel :
- cycle cadré ;
- scaling cadré ;
- composition cadrée ;
- dégâts cadrés ;
- résistance cadrée ;
- participation/récompenses cadrées ;
- classement/historique cadrés ;
- UX principale cadrée.

Décisions traitées jusqu'à :
**R429**

Prochaine reprise :
**R430**

Restent notamment :
- comportement exact de `!combat go` avec les nouveaux slots ;
- comportement exact de `!combat boss go` ;
- migration du Combat quotidien legacy ;
- migration du Boss legacy actif ;
- migration participants/statistiques Boss ;
- initialisation de baseHp au cutover ;
- concurrence/idempotence sur le coup final ;
- changement de mois pendant une attaque ;
- edge cases du Boss non vaincu ;
- dernière passe de clôture Combat.