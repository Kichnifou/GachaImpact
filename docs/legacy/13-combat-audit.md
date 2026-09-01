# 13 — Audit legacy Combat

Statut : AUDIT EN COURS — COMBAT QUOTIDIEN R370 À R389 TRAITÉ ; PROCHAINE REPRISE R390 — BOSS MENSUEL
Date : 2026-09-01

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

## R373 — Combat manuel avec Team active

Le mode manuel utilise la Team active du joueur.

Précondition :
- exactement 4 personnages valides, possédés et actifs ;
- aucun des quatre ne doit être KO pour le combat quotidien.

Si la Team active est vide/incomplète ou contient un KO :
- le combat ne peut pas être lancé ;
- l'UI propose de modifier l'équipe via le vrai écran Team.

Combat ne crée pas une copie métier indépendante de la Team active pour le mode manuel.

## R374 — Mode Auto conservé et formule unifiée

Conserver le mode Auto.

Twitch/chat :
- `!combat auto` sélectionne automatiquement la meilleure composition disponible et lance immédiatement le combat.

Standalone UI :
- R386 précise que l'Auto sélectionne d'abord une composition temporaire puis laisse le joueur lancer le combat.

La Team Auto :
- utilise uniquement les personnages possédés, actifs et non-KO ;
- ne modifie jamais la Team active ;
- reste temporaire au contexte Combat.

Correction cible :
- la sélection Auto doit utiliser exactement la même formule autoritative que la vraie probabilité de victoire ;
- aucun score Auto parallèle ne doit diverger du moteur Combat.

R374 impose également que l'ancien avantage artificiel donné aux 5★ par l'algorithme Auto devienne un vrai avantage de rareté dans le calcul de victoire.

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

Si la Team active contient un KO :
- Combat indique clairement le ou les personnages bloquants ;
- proposer l'accès à l'écran Team ;
- ne jamais modifier automatiquement la Team active.

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

## R386 — Auto UI = sélection puis confirmation

Standalone UI :

Bouton `Équipe automatique` :
1. calcule la meilleure composition disponible ;
2. l'affiche comme composition temporaire Combat ;
3. affiche sa chance exacte ;
4. ne lance pas encore le combat.

Le joueur clique ensuite sur `Combattre`.

Cette composition :
- ne remplace jamais la Team active ;
- reste identifiée comme `Auto`.

Twitch/chat :
- `!combat auto` conserve le comportement direct sélection + combat.

## R387 — Définition autoritative d'une victoire manuelle

Une victoire est `manuelle` uniquement lorsqu'elle utilise la Team active sélectionnée par le joueur sans recours au mode Auto.

Compte dans `totalManualCombatWins` :
- UI avec Team active puis `Combattre` ;
- `!combat go`.

Ne compte pas :
- UI après sélection `Équipe automatique`, même si le joueur clique ensuite lui-même sur `Combattre` ;
- `!combat auto`.

Le mode d'origine de la tentative doit donc être conservé côté serveur.

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

# 9. Boss mensuel legacy — constat initial

Le script contient aussi un Boss global mensuel.

Constantes legacy :
- PV de base : 1 500 000 ;
- variation : ±15 % ;
- récompense participant si Boss vaincu :
  - 16 000 Primogemmes ;
  - 500 000 Moras ;
- dégâts de base 5★ : 1 000 ;
- +650 par constellation 5★ ;
- dégâts de base 4★ : 500 ;
- +150 par constellation 4★.

Le Boss :
- possède une résistance élémentaire aléatoire ;
- reçoit 50 % des dégâts d'un personnage de même élément que sa résistance ;
- accepte une attaque par joueur et par jour ;
- utilise la Team active ;
- ignore les KO du combat quotidien ;
- cumule les dégâts de toute la communauté ;
- attribue la récompense à tous les participants ayant fait des dégâts lorsque le Boss est vaincu ;
- enregistre le coup final ;
- possède des statistiques globales et individuelles ;
- est archivé au changement de mois.

R379 conserve ce concept.

Aucune de ces valeurs/règles Boss n'est encore considérée définitive pour le standalone tant que R390+ ne les a pas auditées.

---

# 10. État

Domaine Combat toujours ouvert.

**Sous-système Combat quotidien : cadré R370 à R389.**

Prochaine reprise :
**R390 — Boss mensuel communautaire.**

Points principaux à auditer ensuite :
- génération mensuelle / moment du reset ;
- Boss déjà vaincu avant fin du mois ;
- PV et scaling selon population ;
- résistance élémentaire ;
- une attaque/jour ;
- Team active / Auto éventuel ;
- formule dégâts ;
- récompenses ;
- distribution immédiate vs notification ;
- participants offline ;
- coup final ;
- statistiques / classement ;
- historique Boss ;
- migration du Boss actif ;
- intégration Quotidiennes / Event éventuelle ;
- confidentialité / affichage public.
