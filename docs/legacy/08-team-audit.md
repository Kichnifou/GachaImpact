# 08 — Audit legacy Team

Statut : AUDIT EN COURS — R177 À R235 VALIDÉS — GESTION / UX / COMMANDES TEAM TRÈS AVANCÉES
Date : 2026-08-30

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

### R186 — Application / activation d'une Team — ✅ REMPLACÉ / CLARIFIÉ PAR R192–R197

La direction initiale « copie indépendante du preset vers une équipe active séparée » n'est plus la cible standalone.

Cible finale :
- l'équipe active est directement l'une des Teams du joueur ;
- il existe toujours exactement une Team sélectionnée comme active ;
- activer/appliquer une Team sélectionne cette Team comme active ;
- la sidebar reflète cette même Team, elle n'en possède pas une copie indépendante.

Dans la V1 :
- la sidebar est une vue uniquement ;
- elle ne permet pas directement de modifier la composition ;
- les modifications se font depuis l'écran Team.

Si une future version rend la sidebar éditable :
- elle modifiera la Team actuellement active elle-même.

Côté Twitch/chat :
- `!team <N> apply` signifie sélectionner la Team N comme équipe active.

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

Twitch/chat conserve un workflow plus simple basé sur :
- activation de la Team avec `apply` ;
- modification de la Team active avec `add` / `remove` ;
- création d'une Team supplémentaire avec `new`.

L'ancien concept de `save` comme copie vers un preset n'est plus une action métier cible.

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
- `!team <N> apply` est l'équivalent textuel de l'activation de la Team N ;
- pas besoin de reproduire le sélecteur graphique.

Clarification finale :
- la Team sélectionnée et l'équipe active sont la même entité métier ;
- une modification de la Team active modifie donc cette Team ;
- la sidebar reflète immédiatement les changements.

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

## 14. Deuxième passe fonctionnelle — équipe active / commandes / UX

### R197 — La Team sélectionnée est l'équipe active — ✅ VALIDÉ

Il n'existe pas de composition active séparée des Teams.

Concept :
- chaque joueur possède plusieurs Teams ;
- une seule possède l'état actif ;
- cette Team est celle utilisée par les systèmes du jeu ;
- la sidebar affiche cette même Team.

La sidebar est en lecture seule dans la V1.

---

### R198 — Une Team incomplète reste active — ✅ VALIDÉ

Une Team active peut rester active avec :
- 4/4 ;
- 3/4 ;
- 2/4 ;
- 1/4 ;
- 0/4 personnages.

Aucune bascule automatique vers une autre Team.

Les domaines consommateurs appliquent leurs propres préconditions.

---

### R199 — Team 1 active par défaut — ✅ VALIDÉ

Pour un nouveau joueur :
- les 10 emplacements de base existent ;
- Team 1 est active par défaut ;
- elle peut être entièrement vide.

Une sélection historique existante reste conservée entre les sessions.

---

### R200 — Créer une Team supplémentaire ne l'active pas — ✅ VALIDÉ

Créer Team 11, 12, etc. :
- crée seulement l'emplacement ;
- ne modifie jamais la Team active actuelle.

L'activation reste une action explicite.

---

### R201 — Une Team supplémentaire active ne peut pas être supprimée — ✅ VALIDÉ

Si une Team >10 est active :
- l'action de suppression UI est refusée ;
- le joueur doit d'abord activer une autre Team.

Ne jamais choisir automatiquement une autre Team à sa place.

---

### R202 — Une Team vide peut être activée — ✅ VALIDÉ

Une Team 0/4 peut devenir active.

La sidebar affiche alors quatre emplacements vides.

---

### R203 — `!team` indique la Team active — ✅ VALIDÉ

La réponse Twitch/chat de `!team` indique :
- le numéro actuel de la Team active ;
- son nom s'il existe ;
- sa composition ;
- ses constellations utiles ;
- ses passifs actifs.

Le message Twitch reste sur une seule ligne.

---

### R204 — `!team <N> apply` accepte 0..4 — ✅ VALIDÉ

`apply` sélectionne une Team comme active même si elle est :
- vide ;
- partielle ;
- complète.

Les personnages présents doivent rester valides, possédés et actifs.

---

### R205 — Vider une Team active ne la désactive pas — ✅ VALIDÉ

`!team <N> remove` côté Twitch/chat vide l'emplacement.

Si cette Team est active :
- elle reste active ;
- sa composition devient vide ;
- son nom reste conservé.

Même logique pour `!team remove all` sur la Team active.

---

### R206 — Une Team vide peut être renommée — ✅ VALIDÉ

Le nom appartient à la Team, pas à sa composition.

Une Team vide peut donc recevoir ou conserver un nom.

---

### R207 — Listing Twitch paginé — ✅ VALIDÉ

Commandes recommandées :
- `!team list`
- `!team list <page>`

Compatibilité acceptée :
- `!team liste`
- `!team liste <page>`

Les helpers/documentation ne montrent qu'une seule syntaxe recommandée : `list`.

Pagination :
- 10 Teams par page ;
- `list`, `list 1`, `liste`, `liste 1` → première page.

`!team save` n'est plus une commande de listing.

---

### R208 — Slots vides compactés côté Twitch — ✅ VALIDÉ

Dans `!team list` :
- afficher les Teams non vides de la page ;
- afficher la Team active même si elle est vide ;
- ne pas écrire une ligne pour chaque emplacement vide ;
- permettre un résumé du nombre d'emplacements vides.

Une Team partielle peut être présentée avec son remplissage, par exemple `2/4`.

---

### R209 — Team active publique vide/incomplète — ✅ VALIDÉ

Si les permissions autorisent la consultation :
- une Team publique 2/4 affiche ses deux personnages et deux slots vides ;
- une Team publique 0/4 reste visible comme Team vide.

Ne pas masquer son état réel.

---

### R210 — Nom de Team potentiellement public — ✅ VALIDÉ

Si la Team active est visible :
- son numéro est visible ;
- son nom peut être visible.

Le nom fait partie des sous-informations qui pourront être contrôlées par la future confidentialité granulaire.

---

### R211 — Passifs d'une Team publique — ✅ VALIDÉ

Les passifs de l'équipe active peuvent être affichés avec la Team publique.

Si la Team elle-même n'est pas visible :
- ne jamais exposer ses passifs séparément.

---

### R212 — Renommage Twitch — ✅ VALIDÉ

Accepter :
- `!team <N> rename "Nom"`
- `!team rename "Nom"` pour la Team active.

Les helpers n'affichent qu'une seule syntaxe recommandée selon le contexte.

---

### R213 — Ajout Twitch dans le premier slot vide — ✅ VALIDÉ

`!team add <nom>` :
- agit sur la Team active ;
- place le personnage dans le premier slot vide ;
- ne propose pas de syntaxe de positionnement par numéro de slot.

L'ordre reste modifiable graphiquement dans l'UI.

---

### R214 — `remove all` — ✅ DÉRIVÉ

`!team remove all` :
- vide la Team active ;
- conserve son nom ;
- conserve son emplacement ;
- conserve son état actif.

---

### R215 — Fin de `save` comme action métier — ✅ VALIDÉ

Le modèle standalone ne copie plus une équipe active séparée vers des presets.

Toutes les Teams sont éditées directement.

`!team save` et `!team save <N>` :
- ne modifient plus les données ;
- servent uniquement de helper lorsqu'ils sont utilisés ;
- indiquent la syntaxe actuelle sans mentionner d'ancien système ou de migration.

Exemple de direction de helper :
`Utilise !team 4 apply pour activer la team, puis !team add <personnage>. Pour créer une Team supplémentaire : !team new.`

---

### R216 — `!team new` — ✅ VALIDÉ

Commande recommandée unique :
`!team new`

Effet :
- créer la prochaine Team à la fin de la liste ;
- numéro continu ;
- Team vide ;
- nom vide ;
- non active.

Ne pas proposer systématiquement un alias français.

---

### R217 — Plusieurs Teams supplémentaires vides autorisées — ✅ VALIDÉ

La création d'une nouvelle Team n'exige pas de remplir les précédentes.

Plusieurs Teams >10 peuvent rester vides simultanément.

---

### R218 — Suppression UI d'une Team supplémentaire — ✅ VALIDÉ

Une Team >10 peut être supprimée depuis l'UI :
- vide ou remplie ;
- jamais si elle est active.

Si elle contient des données :
- confirmation UI acceptable.

Twitch/chat :
- aucune confirmation en plusieurs étapes ;
- aucune suppression physique de l'emplacement.

---

### R219 — Numéro public — ✅ DÉRIVÉ

Le numéro de Team est une position d'organisation et peut être affiché lorsque la Team elle-même est visible.

Pas de permission de confidentialité spécifique nécessaire pour le numéro.

---

### R220 — Sauvegarde immédiate des modifications UI — ✅ VALIDÉ

Les modifications de Team sont persistées immédiatement après validation :
- ajout ;
- retrait ;
- remplacement ;
- réorganisation.

Pas de bouton global `Sauvegarder`.

Si la Team est active :
- sidebar et passifs se mettent à jour immédiatement.

---

### R221 — Remplacement direct d'un personnage — ✅ VALIDÉ

Dans l'UI :
- `Changer` remplace directement un personnage par un autre ;
- `Retirer` reste disponible séparément.

Ne pas obliger à retirer puis ajouter manuellement.

---

### R222 — Sélecteur personnage inspiré de la Box — ✅ VALIDÉ

`Ajouter` / `Changer` ouvre un sélecteur utilisant :
- recherche temps réel ;
- filtres pertinents ;
- personnages possédés ;
- personnages actifs uniquement.

Un personnage déjà présent dans la même Team :
- ne peut pas être sélectionné une seconde fois ;
- peut rester visible mais désactivé/grisé.

---

### R223 — Détail Twitch d'une Team — ✅ VALIDÉ

`!team` :
- Team active ;
- composition ;
- passifs.

`!team <N>` :
- Team N ;
- composition ;
- passifs même si non active.

`!team list` :
- aperçu compact paginé.

Toutes les réponses Twitch sont structurées sur une seule ligne.

---

### R224 — Team active identifiable dans `!team list` — ✅ VALIDÉ

Le listing paginé indique clairement quelle Team est active.

---

### R225 — Team partielle dans le listing — ✅ DÉRIVÉ

Une Team partielle non vide peut être affichée par exemple sous forme `2/4`.

Une Team vide non active est résumée avec les autres emplacements vides.

---

### R226 — Recherche temps réel transversale — ✅ VALIDÉ

La recherche UI est instantanée :
- mise à jour à chaque caractère ;
- aucun bouton Rechercher requis.

Matching :
- sous-chaîne contiguë après normalisation ;
- pas de lettres dispersées / fuzzy implicite.

Exemple :
- `Ya` → Yanfei ;
- `Ya` → Yaoyao ;
- `Ya` ne doit pas trouver Yelan.

Cette règle est transversale et vaut pour les listes pertinentes :
- personnages ;
- Box ;
- Team ;
- joueurs ;
- objets ;
- autres interfaces de recherche.

---

### R227 — Passifs actifs même en Team partielle — ✅ VALIDÉ

Les passifs sont calculés sur les personnages réellement présents.

Exemple :
- 1 Pyro → Pyro I ;
- 2 Pyro → Pyro II ;
- 3 ou 4 Pyro → toujours Pyro II.

Une Team n'a pas besoin d'être 4/4 pour fournir ses passifs aux domaines qui les utilisent.

---

### R228 — Recalcul visuel immédiat des passifs — ✅ VALIDÉ

Pendant l'édition :
- toute modification recalcule immédiatement les passifs ;
- aucune actualisation manuelle nécessaire.

---

### R229 — Carte Team horizontale et activation distincte — ✅ VALIDÉ

Chaque Team conserve une carte/ligne horizontale.

Disposition :
- les quatre personnages occupent la largeur utile de la carte ;
- informations comme nom/passifs au-dessus ou au-dessous ;
- ne pas réduire la zone personnages pour placer les passifs à côté.

Activation :
- action distincte de l'édition ;
- petit contrôle en haut à droite ;
- préférence actuelle : interrupteur/curseur gauche → droite ;
- position droite = actif.

La Team active peut recevoir une mise en évidence supplémentaire.

---

### R230 — Même éditeur pour la Team active — ✅ VALIDÉ

La Team active utilise le même éditeur que toutes les autres.

Pas d'écran spécial d'édition de la Team active.

La différence est seulement :
- état actif ;
- synchronisation immédiate sidebar/passifs.

---

### R231 — Nom/numéro actif dans la sidebar — ✅ VALIDÉ

La sidebar affiche discrètement :
- numéro de la Team active ;
- nom s'il existe ;
- composition.

La sidebar reste non éditable en V1.

---

### R232 — Deux drag & drop distincts — ✅ VALIDÉ

#### Réorganisation des personnages
- drag & drop uniquement à l'intérieur d'une Team ;
- déplacement horizontal ;
- change uniquement l'ordre visuel des personnages de cette Team.

#### Réorganisation des Teams
- drag de la carte depuis une zone extérieure aux personnages ;
- déplacement vertical dans la liste des Teams ;
- change la position/numéro de la Team.

Les deux interactions doivent être techniquement et visuellement dissociées afin qu'un drag personnage ne déplace jamais accidentellement la Team entière.

Si la Team déplacée est active :
- elle reste active.

---

### R233 — Protection basée sur les positions 1 à 10 — ✅ VALIDÉ

Après réorganisation :
- positions actuelles 1..10 = non supprimables ;
- positions actuelles 11+ = supprimables sous les autres conditions.

La protection ne suit pas dix anciennes entités historiques.

---

### R234 — Drag libre entre toutes les positions — ✅ VALIDÉ

Une Team peut être déplacée :
- de 18 vers 2 ;
- de 3 vers 14 ;
- ou toute autre position.

Il n'existe pas deux zones bloquées `base` / `supplémentaires`.

La règle de suppression est recalculée selon la nouvelle position.

---

### R235 — Ordre des Teams persisté immédiatement — ✅ VALIDÉ

Le drag vertical :
- renumérote immédiatement les positions ;
- persiste immédiatement le nouvel ordre ;
- ne nécessite pas de bouton Sauvegarder.

Au prochain chargement, le même ordre est restauré.

Les numéros Twitch/chat correspondent toujours à l'ordre courant.

---

## 15. Décisions techniques prises directement

- les personnages d'une équipe sont référencés par leur identité canonique, jamais par leur nom ;
- les passifs sont dérivés de la composition courante ;
- une modification d'équipe recalcule immédiatement les passifs utilisables par les domaines consommateurs ;
- les données `savedAt` legacy valides seront conservées à la migration même si leur affichage futur n'est pas obligatoire ;
- un preset corrompu ou référençant une possession inexistante n'est pas appliqué aveuglément ;
- les anomalies de migration évidentes sont réparées/journalisées selon les pratiques normales sans demander une décision produit pour chaque cas ;
- `!combat auto` reste une équipe temporaire propre à Combat et ne remplace pas l'équipe active.

---

## 16. État

R177 à R235 validées.

Le modèle Team standalone est désormais très avancé :
- une Team du joueur est directement sélectionnée comme active ;
- Team 1 active par défaut ;
- équipe active autorisée 0..4 ;
- 10 positions de base non supprimables selon l'ordre courant ;
- extensions illimitées ;
- création `!team new` ;
- édition directe et autosave ;
- ajout / retrait / remplacement ;
- Teams et personnages réordonnables par deux drag & drop distincts ;
- numérotation dynamique ;
- compositions dupliquées interdites ;
- noms modernisés ;
- passifs dérivés et recalculés immédiatement ;
- visibilité publique de la Team active selon confidentialité ;
- Saved Teams privées ;
- commandes Twitch adaptées au nouveau modèle ;
- helpers courts sans référence à une migration ;
- pagination `!team list` ;
- recherche temps réel transversale validée.

Audit restant :
- vérifier tous les derniers consommateurs de Team ;
- confirmer définitivement que Expedition n'utilise pas Team comme prérequis ;
- scanner les autres scripts lisant `team` ;
- finaliser la migration legacy `team` + `savedTeams` vers le modèle cible ;
- mesurer les anomalies réelles du snapshot ;
- vérifier les cas liés à la réorganisation/numérotation au cutover ;
- faire une dernière passe `Team.txt` / `Passif.txt` / `Infos.txt` / consommateurs ;
- déterminer si le Domaine Team peut être clôturé.

Les détails SQL exacts restent réservés à la Phase 2.