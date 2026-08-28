# 08 — Audit legacy Team

Statut : AUDIT EN COURS — OUVERT APRÈS CLÔTURE DU DOMAINE BOX R117–R176
Date : 2026-08-28

## 1. Périmètre

Domaine audité :
- équipe active ;
- équipes sauvegardées ;
- ajout / retrait / remplacement ;
- validation des personnages possédés et actifs ;
- ordre / slots ;
- doublons ;
- noms des équipes ;
- application / suppression ;
- passifs élémentaires dépendant de l'équipe active ;
- présentation Twitch/chat ;
- direction UI standalone ;
- interactions avec Combat, Gacha, Box et personnages désactivés ;
- migration des données `team` et `savedTeams`.

Les règles internes propres à Combat, Expedition ou Concours restent dans leurs domaines respectifs.

---

## 2. Sources legacy principales

### Code
- `legacy/streamerbot/commands/Team.txt`
- `legacy/streamerbot/commands/Passif.txt`
- consommateurs à vérifier progressivement :
  - `legacy/streamerbot/commands/Pull.txt`
  - `legacy/streamerbot/commands/Combat.txt`
  - autres scripts utilisant l'équipe active si découverts

### Données
- `legacy/streamerbot/data/viewers_data.json`
  - `team`
  - `savedTeams`
- `legacy/streamerbot/data/genshin_characters.json`
- `legacy/streamerbot/data/element_passives.json`

### Documentation déjà validée
- `docs/master/PROJECT_MASTER_PLAN.md`
- `docs/legacy/07-box-possession-obtention-audit.md`
- `docs/legacy/06-gacha-invocation-audit.md`
- `docs/legacy/03-command-data-matrix.md`

---

## 3. Structure legacy observée

### Équipe active

Le profil joueur possède un tableau :

```json
"team": [48, 32, 97, 64]
```

Le legacy :
- accepte une équipe vide ;
- accepte une équipe partielle ;
- limite l'équipe active à 4 personnages ;
- bloque l'ajout d'un personnage déjà présent ;
- exige que le personnage soit possédé lors de l'ajout ;
- conserve l'ordre du tableau pour l'affichage.

### Équipes sauvegardées

Structure observée :

```json
"savedTeams": {
  "1": {
    "name": "",
    "characters": [12, 19, 27, 40],
    "savedAt": "2026-08-11 16:42:27"
  },
  "2": {
    "name": "",
    "characters": [48, 32, 97, 64],
    "savedAt": "2026-08-11 16:44:14"
  }
}
```

Le legacy prévoit :
- 10 slots maximum ;
- 4 personnages obligatoires pour sauvegarder ;
- remplacement possible d'un slot existant ;
- suppression d'un slot ;
- renommage ;
- application du preset à l'équipe active ;
- date `savedAt`.

---

## 4. Commande legacy `!team`

Formes réellement présentes :

- `!team`
- `!team help`
- `!team add <Nom>`
- `!team remove <Nom>`
- `!team remove all`
- `!team save`
- `!team save <1..10>`
- `!team <1..10>`
- `!team <1..10> apply`
- `!team <1..10> remove`
- `!team <1..10> rename "Nom"`

La recherche personnage dans `Team.txt` utilise le nom exact après normalisation texte.

---

## 5. Doublons

### Équipe active

Le legacy empêche normalement un même personnage d'être ajouté plusieurs fois.

### Équipes sauvegardées

Le legacy empêche de sauvegarder la même composition dans deux slots différents.

Pour comparer deux compositions, il trie les IDs avant de construire une signature.

Conséquence :
- `[1, 2, 3, 4]`
- `[4, 3, 2, 1]`

sont considérées comme la même composition pour la détection de doublon.

L'ordre est néanmoins conservé dans le tableau sauvegardé.

---

## 6. Application d'une équipe sauvegardée

Le legacy exige au moment de l'application :
- exactement 4 IDs ;
- possession de chaque personnage.

Si la validation réussit :
- le tableau sauvegardé remplace entièrement l'équipe active.

Le legacy ne vérifie pas encore le futur concept de personnage catalogue `disabled`, car ce concept n'existe pas de la même manière dans Streamer.bot.

Règle déjà validée dans le Domaine Box :
- un personnage désactivé disparaît de l'équipe active et des équipes sauvegardées ;
- sa réactivation ne le réinsère pas automatiquement.

La forme exacte du nettoyage d'un preset devenu incomplet doit être précisée dans le Domaine Team.

---

## 7. Noms des équipes sauvegardées

Legacy :
- nom facultatif ;
- 10 caractères maximum ;
- espaces interdits ;
- commande avec guillemets ;
- pas d'unicité des noms identifiée.

Ces restrictions peuvent être en partie liées à la présentation Twitch et doivent être réévaluées pour l'UI standalone.

---

## 8. Passifs élémentaires

`Team.txt` affiche les passifs actifs en comptant les éléments de l'équipe.

`element_passives.json` indique :
- équipe maximum : 4 ;
- passifs uniquement depuis l'équipe ;
- maximum 2 stacks par élément ;
- les personnages supplémentaires du même élément au-delà de 2 n'augmentent pas le stack.

Règles Gacha déjà validées R75–R84 :
- seuls les personnages de l'équipe active alimentent les passifs ;
- maximum 2 stacks par élément ;
- plusieurs éléments/passifs peuvent être actifs en même temps ;
- les effets détaillés sont déjà définis dans le Domaine Gacha.

Le Domaine Team doit surtout définir :
- comment ces passifs sont présentés ;
- comment l'équipe active les expose ;
- comment les changements d'équipe les recalculent.

---

## 9. `!passifs`

`Passif.txt` :
- ne lit pas le profil joueur ;
- ne modifie aucune donnée ;
- affiche la table générale des passifs ;
- permet le détail par élément.

Cette commande décrit donc les règles générales disponibles, contrairement à `!team` qui affiche les passifs réellement actifs pour le joueur.

---

## 10. Interaction avec Combat — frontière initiale

Le legacy Combat utilise l'équipe active pour `!combat go`.

Combat exige actuellement :
- exactement 4 personnages ;
- personnages uniques ;
- personnages possédés ;
- autres validations propres à Combat.

Il existe aussi un mode `!combat auto` qui construit une équipe temporaire sans remplacer l'équipe active.

Conséquence importante :
- le Domaine Team peut autoriser une équipe partielle ;
- un domaine consommateur comme Combat peut exiger une équipe complète pour sa propre action.

La règle finale de taille de l'équipe active reste à valider dans ce domaine.

---

## 11. Données observées

Le snapshot `viewers_data.json` contient réellement :
- des joueurs avec `team: []` ;
- des joueurs avec équipe active complète ;
- des `savedTeams` vides ;
- des `savedTeams` contenant plusieurs presets.

Exemple du profil de référence legacy :
- équipe active de 4 personnages ;
- deux équipes sauvegardées ;
- chaque preset contient `name`, `characters`, `savedAt`.

Ne pas transformer cet exemple en schéma SQL définitif.

---

## 12. Règles déjà héritées d'autres domaines

### Personnage désactivé
Validé dans le Domaine Box :
- absent de l'équipe active ;
- absent des équipes sauvegardées ;
- non utilisable pour les passifs ;
- réactivation sans restauration automatique dans les équipes.

### Possession
La source de vérité n'est pas Team :
- Team référence des personnages possédés ;
- Team ne modifie jamais une possession.

### Passifs Gacha
Les valeurs et probabilités R75–R84 sont déjà validées et ne doivent pas être redécidées ici.

---

## 13. Points à décider

Première passe fonctionnelle :
- taille autorisée de l'équipe active ;
- unicité des personnages ;
- nombre de presets sauvegardés ;
- sauvegarde d'une équipe partielle ou uniquement complète ;
- importance ou non de l'ordre des slots ;
- comportement des doublons de presets ;
- règles de nommage des presets ;
- UX de sauvegarde/application/remplacement ;
- présentation des passifs actifs ;
- conséquences d'une désactivation sur un preset.

Les anomalies de migration pure ou cas de corruption évidents pourront être tranchés techniquement sans solliciter une décision utilisateur à chaque fois.

---

## 14. État

Domaine ouvert.

Aucune nouvelle décision R177+ n'est encore inscrite dans ce document.
