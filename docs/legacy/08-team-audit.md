# 08 — Audit legacy Team

Statut : AUDIT EN COURS — R177 À R196 VALIDÉS — GESTION DES TEAMS / PRESETS TRÈS AVANCÉE
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

## 13. Première passe fonctionnelle — décisions validées

### R177 — Taille de l'équipe active — ✅ VALIDÉ

L'équipe active peut contenir de 0 à 4 personnages.

Une mécanique consommatrice peut imposer ses propres préconditions.

Exemple :
- Team accepte 0..4 ;
- Combat peut exiger 4/4.

---

### R178 — Unicité des personnages — ✅ VALIDÉ

Un même personnage ne peut apparaître qu'une seule fois :
- dans l'équipe active ;
- dans une équipe sauvegardée.

---

### R179 — Composition sauvegardable/applicable complète — ✅ VALIDÉ

Pour sauvegarder une nouvelle composition depuis Twitch :
- l'équipe active doit contenir exactement 4 personnages.

Un preset est considéré comme complètement applicable lorsqu'il contient 4/4 personnages.

L'UI peut néanmoins permettre qu'un emplacement d'équipe existe temporairement vide ou incomplet pendant son édition.

---

### R180 — Dix équipes de base + extensions illimitées — ✅ VALIDÉ

Chaque joueur possède 10 emplacements d'équipe permanents de base.

Emplacements 1 à 10 :
- existent toujours ;
- peuvent être vides ;
- ne peuvent jamais être supprimés physiquement ;
- peuvent être vidés, modifiés et renommés.

Au-delà de 10 :
- le joueur peut créer autant d'emplacements supplémentaires qu'il le souhaite ;
- aucun plafond métier artificiel ;
- l'UI affiche après la dernière équipe un emplacement/bouton `+` permettant d'en créer une nouvelle.

Les équipes supplémentaires :
- sont supprimables depuis l'UI ;
- peuvent simplement être vidées depuis Twitch/chat.

Exemple :
- un joueur crée jusqu'à l'équipe 13 ;
- il vide 11 et 13 via Twitch ;
- l'UI affiche toujours les équipes jusqu'à 13 ;
- 11 et 13 apparaissent avec leurs quatre slots vides et restent réutilisables.

---

### R181 — Ordre des personnages uniquement visuel — ✅ VALIDÉ

L'ordre des quatre personnages :
- est conservé pour l'affichage ;
- peut être réorganisé ;
- n'apporte pas actuellement d'effet métier.

Pour la détection de compositions identiques :

`A / B / C / D`

et

`D / C / B / A`

sont la même composition.

---

### R182 — Nommage modernisé des équipes — ✅ VALIDÉ

Nom :
- facultatif ;
- espaces autorisés ;
- accents autorisés ;
- maximum cible : 20 caractères ;
- noms identiques autorisés entre équipes différentes.

Twitch/chat doit correctement gérer les espaces et accents, par exemple :

`!team 11 rename "Boss Électro"`

Les détails de normalisation/sécurité texte sont techniques et seront gérés sans modifier cette règle produit.

---

### R183 — Emplacements permanents et supplémentaires — ✅ VALIDÉ

Les dix premiers emplacements constituent la base permanente du joueur.

Un emplacement supplémentaire possède également sa propre existence tant qu'il n'est pas explicitement supprimé depuis l'UI.

Le futur modèle relationnel ne doit pas créer des colonnes `team1`, `team2`, etc. ; l'identité technique exacte sera définie en Phase 2.

---

### R184 — Vider ≠ supprimer — ✅ VALIDÉ

`Vider` :
- conserve l'emplacement ;
- retire sa composition.

`Supprimer` :
- retire l'emplacement lui-même ;
- disponible uniquement dans l'UI ;
- uniquement pour les équipes >10.

Twitch/chat :
- ne supprime jamais physiquement un emplacement ;
- l'action équivalente à `remove` vide son contenu.

---

### R185 — Personnage désactivé dans les équipes — ✅ VALIDÉ

Équipe active :
- retirer uniquement le personnage désactivé ;
- les autres personnages restent en place ;
- l'équipe peut devenir partielle.

Saved Team 1..10 :
- si elle contient le personnage désactivé, vider toute sa composition ;
- conserver l'emplacement ;
- conserver son nom.

Saved Team >10 :
- si elle contient le personnage désactivé, supprimer entièrement cet emplacement supplémentaire.

Réactivation :
- aucune équipe n'est restaurée automatiquement.

---

### R186 — Application d'un preset — ✅ VALIDÉ

Direction validée initialement :
- appliquer un preset copie sa composition vers l'équipe active ;
- le preset et l'équipe active ne doivent pas être accidentellement modifiés l'un par l'autre.

Cette règle doit être réconciliée avec R192 lors de la prochaine passe afin de préciser le comportement exact après sélection d'une équipe comme active puis modification de cette équipe.

Ne pas inventer cette sémantique avant validation.

---

### R187 — Suppression d'une équipe supplémentaire et numérotation — ✅ VALIDÉ

Lorsqu'une équipe >10 est supprimée depuis l'UI :
- les équipes suivantes sont compactées visuellement ;
- la numérotation reste continue.

Exemple :
- 10, 11, 12, 13, 14 ;
- suppression de 12 ;
- l'ancienne 13 devient visuellement 12 ;
- l'ancienne 14 devient visuellement 13.

L'identité technique interne d'une équipe ne doit pas dépendre de ce numéro d'affichage.

---

### R188 — Passifs visibles sur les compositions — ✅ VALIDÉ

Équipe active :
- afficher les passifs actuellement actifs.

Saved Teams :
- afficher également un aperçu compact des passifs que leur composition produit ;
- permettre un détail plus complet au clic/survol si utile.

Les passifs sont calculés depuis les personnages/éléments de la composition.

Ils ne sont jamais stockés comme état indépendant.

Les valeurs des effets restent celles déjà validées dans le Domaine Gacha R75–R84.

---

### R189 — Équipe active publique — ✅ VALIDÉ

L'équipe active d'un autre joueur peut être consultée depuis son profil :
- même si le joueur est hors ligne ;
- sous réserve des règles de confidentialité.

Visibilités prévues :
- Public ;
- Amis uniquement ;
- Privé.

---

### R190 — Saved Teams privées — ✅ VALIDÉ

Les équipes sauvegardées sont un outil personnel.

Elles ne sont pas automatiquement exposées sur le profil d'un joueur.

Une éventuelle fonctionnalité future de partage explicite d'une équipe devra être conçue séparément.

---

### R191 — Modification directe d'une Saved Team dans l'UI — ✅ VALIDÉ

Dans l'écran Team standalone, une équipe sauvegardée peut être éditée directement :
- ajouter un personnage ;
- retirer ;
- remplacer ;
- réordonner.

Il n'est pas nécessaire de passer systématiquement par :
- équipe active ;
- puis sauvegarde dans un slot.

Twitch/chat peut conserver un workflow plus simple basé sur l'équipe active et les commandes `save` / `apply`.

---

### R192 — Sélection exclusive de l'équipe active dans l'UI — ✅ DIRECTION VALIDÉE

Dans la liste des équipes :
- chaque équipe possède un contrôle d'activation ;
- une seule équipe peut être active à la fois ;
- activer une nouvelle équipe désactive automatiquement l'ancienne ;
- l'équipe choisie devient immédiatement l'équipe active ;
- la colonne gauche de l'interface se met à jour instantanément.

Présentation :
- l'équipe active reste à sa position normale dans la liste ;
- elle ne remonte pas automatiquement en première position ;
- elle est mise en évidence visuellement, par exemple via un encadrement spécifique ;
- couleur exacte à définir lors du polish UI.

Exemple :
- Équipe 4 active ;
- elle reste ligne 4 ;
- la sidebar affiche immédiatement sa composition.

Twitch/chat :
- conserver le fonctionnement textuel actuel de sauvegarde/remplacement explicite ;
- pas besoin de reproduire le sélecteur graphique.

À préciser lors de la prochaine passe :
- interaction exacte entre cette notion d'équipe sélectionnée comme active et R186 ;
- notamment savoir si une modification ultérieure de l'équipe active modifie ou non automatiquement le preset sélectionné.

---

### R193 — Une composition complète unique parmi les Saved Teams — ✅ VALIDÉ

Une même combinaison de quatre personnages ne peut exister que dans une seule Saved Team.

L'ordre visuel ne crée pas une composition différente.

---

### R194 — Prévention des doublons pendant modification/sauvegarde — ✅ VALIDÉ

UI :
- si une modification rendrait une équipe complète identique à une autre Saved Team, refuser la dernière modification ;
- conserver l'état précédent ;
- informer clairement le joueur de l'équipe déjà existante.

Twitch/chat :
- empêcher également `save` de créer/remplacer une équipe par une composition déjà présente ailleurs.

---

### R195 — Réorganisation visuelle des personnages — ✅ VALIDÉ

Dans l'UI :
- permettre de réordonner les quatre personnages ;
- conserver cet ordre pour l'affichage ;
- l'ordre n'affecte pas le gameplay.

Lorsqu'une composition est appliquée/activée, son ordre visuel est repris dans l'équipe active.

---

### R196 — Fiche personnage depuis une équipe publique — ✅ VALIDÉ

Depuis l'équipe active publique d'un autre joueur :
- chaque personnage peut être ouvert ;
- utiliser la même fiche publique de possession que depuis sa Box.

La fiche respecte la granularité de confidentialité déjà validée :
- constellation ;
- copies ;
- première obtention ;
- favori ;
- futures statistiques ;
- autres sous-informations selon permissions.

---

## 14. Décisions techniques prises directement

- les personnages d'une équipe sont référencés par leur identité canonique, jamais par leur nom ;
- les passifs sont dérivés de la composition courante ;
- une modification d'équipe recalcule immédiatement les passifs utilisables par les domaines consommateurs ;
- les données `savedAt` legacy valides seront conservées à la migration même si leur affichage futur n'est pas obligatoire ;
- un preset corrompu ou référençant une possession inexistante n'est pas appliqué aveuglément ;
- les anomalies de migration évidentes sont réparées/journalisées selon les pratiques normales sans demander une décision produit pour chaque cas ;
- `!combat auto` reste une équipe temporaire propre à Combat et ne remplace pas l'équipe active.

---

## 15. État

R177 à R196 validées.

Première passe Team très avancée :
- équipe active 0..4 ;
- unicité ;
- Saved Teams ;
- 10 emplacements permanents ;
- extensions illimitées ;
- suppression/vidage ;
- nommage ;
- doublons ;
- réorganisation ;
- passifs ;
- désactivation ;
- confidentialité ;
- équipe publique ;
- édition directe UI ;
- sélection visuelle de l'équipe active.

Point important à reprendre :
- clarifier précisément l'interaction R186 / R192 avant de figer le modèle métier d'activation.

Audit restant :
- finaliser la relation entre équipe active et Saved Team sélectionnée ;
- auditer les détails restants de `!team` ;
- définir les comportements UI autour des équipes vides/incomplètes ;
- vérifier les derniers consommateurs de Team ;
- vérifier migration réelle `team` / `savedTeams` ;
- vérifier les interactions avec Expedition ;
- confirmer la frontière avec Combat ;
- préciser si d'autres commandes exposent ou modifient la Team ;
- poursuivre jusqu'à clôture du domaine.

Les détails SQL exacts restent réservés à la Phase 2.