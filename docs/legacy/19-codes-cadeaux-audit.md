# 19 — Audit Codes cadeaux

> Domaine 16 de l'audit GachaImpact.  
> Statut : **CLÔTURÉ — décisions produit R673 à R691 validées ; clôture technique finalisée**.  
> Ce document est la source spécialisée validée du domaine Codes cadeaux.  
> L'état global du projet et la prochaine reprise exacte restent la responsabilité du Master.

---

# 1. Objectif du domaine

Auditer puis spécifier le système de **Codes cadeaux** de GachaImpact.

Le domaine couvre notamment :

- la commande `!code` ;
- `gift_codes.json` ;
- `usedCodes` dans les profils joueurs ;
- les codes permanents / ponctuels ;
- les codes annuels liés aux Festivals ;
- l'écran joueur `Codes` ;
- l'action `Récupérer` ;
- les notifications de nouveau code ;
- la résolution automatique des notifications après claim ;
- la future interface Admin de création / publication ;
- les types de récompenses configurables ;
- les dates de disponibilité / expiration ;
- la notification Twitch éventuelle ;
- les interactions avec Event ;
- la migration ;
- l'atomicité et l'idempotence.

Le moteur Codes reste propriétaire de la validation et de la réclamation des codes.

Event peut uniquement signaler qu'un code associé est disponible et rediriger vers l'écran Codes.

---

# 2. Sources réelles inspectées

Sources principales :

- `legacy/streamerbot/commands/Code.txt`
- `legacy/streamerbot/data/gift_codes.json`
- `legacy/streamerbot/data/viewers_data.json`
- `docs/legacy/16-event-monthly-audit.md`
- `docs/legacy/05-element-resources-audit.md`
- `docs/master/PROJECT_MASTER_PLAN.md`
- `docs/legacy/03-command-data-matrix.md`
- `docs/commands/command-reference.md`
- `docs/specifications/decisions-log.md`

Le code réellement exécuté est la source de vérité sur le comportement legacy.

---

# 3. Directions produit déjà fournies par le propriétaire

Avant les décisions R673+, les intentions suivantes sont déjà explicites :

- l'administrateur peut créer des codes quand il le souhaite ;
- les codes ne sont pas réservés aux Events ;
- un écran joueur `Codes` affiche les codes actuellement récupérables ;
- chaque code récupérable possède un bouton `Récupérer` ;
- l'administrateur peut définir le code / nom et les récompenses ;
- les récompenses doivent pouvoir inclure notamment Primogemmes, Moras et d'autres types pertinents selon le moteur cible ;
- un écran / outil Admin est nécessaire pour créer puis publier les codes ;
- la publication d'un code doit prévenir les joueurs via une notification standalone ;
- lorsqu'un code est réclamé, sa notification actionnable disparaît automatiquement même si elle n'avait jamais été ouverte ;
- Event ne réclame pas son propre code : il indique qu'un code Event existe et redirige vers l'écran Codes ;
- côté Twitch, l'annonce exacte reste à finaliser ;
- piste utilisateur : annonce manuelle du streamer et/ou rappel lors du premier message du joueur.

La règle transversale Notifications déjà validée s'applique :

**une notification liée à une action disparaît de la liste active dès que l'action correspondante est accomplie par n'importe quel chemin.**

---

# 4. Commande legacy `!code`

Syntaxe réelle :

`!code NOMDUCODE`

Le code saisi est :

- trim ;
- converti en majuscules ;
- comparé sans tenir compte de la casse aux codes du catalogue.

Sans argument :

`⚠️ utilise : !code NOMDUCODE`

Le script :

- ne crée pas de viewer ;
- exige un profil joueur existant ;
- charge `gift_codes.json` ;
- vérifie que le code existe ;
- vérifie sa disponibilité ;
- vérifie que le joueur ne l'a pas déjà utilisé ;
- applique les récompenses ;
- écrit une clé dans `usedCodes` ;
- sauvegarde le profil ;
- affiche le détail des récompenses.

---

# 5. Pas de découverte des codes dans le legacy

Le legacy ne possède pas :

- `!code liste` ;
- écran Codes ;
- liste des codes actifs ;
- bouton de claim ;
- notification de publication ;
- panneau Admin de création.

Le joueur doit connaître le texte du code par un autre moyen puis taper :

`!code <code>`

La V1 changera donc fortement l'UX sans nécessairement modifier la règle économique d'un claim unique.

---

# 6. Schéma `gift_codes.json`

Chaque entrée possède actuellement :

```json
{
  "code": "FESTIVALNOUVELAN",
  "expiresAt": "",
  "month": 1,
  "annuallyRenewable": true,
  "rewards": {
    "primogems": 1600,
    "moras": 200000,
    "particles": {
      "pyro": 0,
      "hydro": 0,
      "cryo": 0,
      "electro": 0,
      "anemo": 0,
      "geo": 0,
      "dendro": 0
    }
  },
  "message": "..."
}
```

Champs réels :

- `code`
- `expiresAt`
- `month`
- `annuallyRenewable`
- `rewards.primogems`
- `rewards.moras`
- `rewards.particles.<element>`
- `message`

Il n'existe actuellement aucun champ :

- `id` métier indépendant du texte du code ;
- `title` / nom d'affichage séparé ;
- `publishedAt` ;
- `startsAt` ;
- `enabled` ;
- `draft` ;
- `createdBy` ;
- `updatedAt` ;
- ciblage joueur ;
- notification ;
- nombre global de claims.

La future UI Admin nécessitera donc un modèle plus riche.

---

# 7. Deux familles de codes legacy

## 7.1 Code ponctuel / non renouvelable

Pour `annuallyRenewable = false` :

- le code utilise `expiresAt` ;
- `DateTime.TryParse()` doit réussir ;
- si `now > expiresAt`, le code est expiré ;
- la clé stockée dans `usedCodes` est simplement :

`CODE`

Conséquence :

**un code ponctuel ne peut être réclamé qu'une seule fois par joueur pour toute sa vie.**

Il n'existe pas de date de début.

---

## 7.2 Code renouvelable annuellement

Pour `annuallyRenewable = true` :

- `month` doit être compris entre 1 et 12 ;
- le code est utilisable uniquement pendant ce mois ;
- `expiresAt` est ignoré ;
- la clé de claim devient :

`CODE-ANNEE`

Exemple :

`FESTIVALAVENTURIERS-2026`

Le même texte de code peut donc être réutilisé chaque année pendant son mois.

---

# 8. Catalogue réel actuel

`gift_codes.json` contient actuellement **12 codes**, tous liés aux douze Festivals mensuels.

Exemples :

- `FESTIVALNOUVELAN`
- `FESTIVALCOEURS`
- `FESTIVALPRINTEMPS`
- `FESTIVALCLOCHES`
- `FESTIVALFLEURS`
- `FESTIVALETE`
- `FESTIVALETOILES`
- `FESTIVALAVENTURIERS`
- `FESTIVALRECOLTES`
- `FESTIVALOMBRES`
- `FESTIVALBRUMES`
- `FESTIVALNOEL`

Tous sont :

`annuallyRenewable = true`

avec un mois fixe correspondant au Festival.

Aucun code ponctuel non-Event n'est présent dans le snapshot actuel, même si le moteur sait techniquement en lire.

---

# 9. Récompense des 12 codes Event actuels

Les douze entrées actuelles donnent chacune :

- **+1 600 Primogemmes**
- **+200 000 Moras**
- 0 particule de chaque élément

Les messages diffèrent uniquement selon le Festival.

Cette table représente le catalogue legacy actuel.

Elle ne signifie pas que tous les futurs codes Admin doivent utiliser ces montants.

---

# 10. Types de récompenses réellement supportés

`Code.txt` sait actuellement appliquer :

## Primogemmes

- ajoute au solde ;
- incrémente `totalPrimosEarned`.

## Moras

- ajoute au solde ;
- incrémente `totalMorasEarned`.

## Particules élémentaires

Support des sept éléments :

- Pyro ;
- Hydro ;
- Cryo ;
- Electro ;
- Anemo ;
- Geo ;
- Dendro.

Les valeurs <= 0 sont ignorées.

Il n'existe actuellement aucun support Code pour :

- personnage ;
- objet de Collection ;
- monnaie Event ;
- Stella ;
- Faveur ;
- XP ;
- autre récompense générique.

La future interface Admin devra décider si elle reste limitée aux ressources sûres ou s'appuie sur un moteur générique de récompenses.

---

# 11. Bug transversal des particules personnelles

`Code.txt` ajoute directement les particules au stock.

Il ne met pas à jour :

`stats.totalMainElementParticlesEarned`

lorsque les particules du code correspondent à l'élément personnel du joueur.

Cette anomalie appartient à la même famille que celles déjà identifiées dans d'autres scripts.

Règle cible déjà acquise :

toute récompense générée par le jeu correspondant à l'élément personnel doit passer par la mutation Ressources centrale et maintenir le compteur autoritatif.

Aucun nouveau Rxxx produit n'est nécessaire pour ce correctif.

Migration :

- conserver le compteur historique tel quel ;
- ne pas reconstruire rétroactivement les anciens claims de particules.

---

# 12. Claim unique legacy

`usedCodes` est une liste de chaînes.

Avant récompense, le script construit la clé de claim puis cherche une égalité insensible à la casse.

Si la clé existe déjà :

- aucune récompense ;
- message `déjà utilisé`.

Le claim est donc conceptuellement unique par :

- joueur + code pour un code ponctuel ;
- joueur + code + année pour un code annuel.

La V1 doit conserver cette protection mais avec une représentation serveur transactionnelle plus robuste.

---

# 13. Limite de concurrence du legacy

Le legacy :

1. charge le JSON complet ;
2. vérifie `usedCodes` ;
3. applique la récompense ;
4. ajoute la clé ;
5. réécrit le fichier.

Il n'existe pas de transaction de base de données ni contrainte d'unicité concurrente.

Deux claims simultanés pourraient théoriquement produire une course.

Cible :

- claim unique garanti côté serveur ;
- récompense + enregistrement du claim dans la même opération transactionnelle ;
- double clic UI / chat + UI / retry réseau ne paient jamais deux fois.

---

# 14. Dates legacy

Le code utilise :

`DateTime.Now`

Il n'impose pas explicitement `Europe/Paris`.

Pour un code ponctuel :

`DateTime.TryParse(expiresAt)`

La sémantique exacte dépend donc du texte enregistré et de la machine.

La V1 doit utiliser des dates serveur explicites.

Direction technique cohérente avec le reste du projet :

`Europe/Paris` pour les dates métier administratives lorsque l'Admin saisit une date locale.

Le traitement exact de l'heure d'expiration reste à décider.

---

# 15. Aucun état Brouillon / Publié

Dans le legacy, ajouter une entrée valide à `gift_codes.json` suffit conceptuellement à la rendre trouvable par `!code`.

Il n'existe pas de workflow :

`Brouillon → Publié → Expiré / Désactivé`

La demande Admin utilisateur implique désormais un vrai cycle de vie.

Ce point doit être spécifié pendant R673+.

---

# 16. Notifications

Le legacy ne crée aucune notification lorsqu'un code devient disponible.

La V1 possède désormais une règle transversale :

- publication d'un code actif → notification actionnable aux joueurs concernés ;
- claim du code → notification correspondante résolue automatiquement ;
- expiration / désactivation du code → notification actionnable également retirée, car l'action n'est plus réalisable.

La notification ne doit donc pas survivre dans un état trompeur du type :

`Code disponible`

alors que le code a déjà été récupéré ou n'est plus actif.

---

# 17. Écran joueur `Codes` — direction utilisateur

Un véritable écran Codes est souhaité.

Il doit au minimum permettre de voir les codes actuellement récupérables.

Chaque entrée peut conceptuellement présenter :

- nom / code ;
- récompenses ;
- éventuel texte descriptif ;
- expiration / durée restante si applicable ;
- bouton `Récupérer`.

Après claim réussi :

- les récompenses sont appliquées ;
- le bouton ne reste pas actif ;
- la notification liée disparaît.

Le choix entre :

- masquer immédiatement le code ;
- le garder visible en état `Récupéré` ;

reste à décider.

---

# 18. Interface Admin — direction utilisateur

Un espace réservé aux administrateurs doit permettre de créer les codes sans éditer un JSON à la main.

Besoins déjà exprimés :

- définir le nom / texte du code ;
- configurer les récompenses ;
- publier le code.

Fonctions logiquement nécessaires à auditer :

- brouillon ;
- aperçu ;
- date de début éventuelle ;
- date d'expiration éventuelle ;
- code annuel ou ponctuel ;
- modification avant publication ;
- désactivation ;
- historique des codes ;
- nombre de claims ;
- permissions Admin.

L'interface Admin ne doit jamais faire confiance au navigateur pour attribuer des ressources.

La publication et les récompenses restent autoritaires côté serveur.

---

# 19. Interaction Event déjà décidée

Le Domaine Event a déjà fixé :

- Event ne possède pas le moteur de claim ;
- Event peut montrer qu'un code Festival est disponible ;
- l'action correspondante ouvre l'écran Codes ;
- l'écran Codes reste propriétaire de la liste et du bouton de réclamation.

Les douze codes annuels actuels fournissent précisément la preuve legacy de cette relation.

Le futur audit ne doit donc pas recréer un bouton économique indépendant dans Event.

---

# 20. Twitch

Le legacy utilise :

`!code NOMDUCODE`

Cela reste techniquement compatible avec le futur canal Twitch.

Directions utilisateur :

- le streamer peut simplement annoncer lui-même les codes ;
- éventuellement, au premier message éligible, le jeu peut rappeler qu'un ou plusieurs codes sont disponibles.

Le rappel automatique devra éviter le spam.

À décider :

- rappel automatique ou uniquement annonce manuelle ;
- une fois par code / une fois globalement ;
- comportement si plusieurs codes sont disponibles ;
- condition `élément choisi` ou simple profil existant ;
- suppression du rappel lorsqu'ils sont tous réclamés.

---

# 21. Activation Twitch / élément

`Code.txt` legacy exige uniquement qu'un profil existe.

Il ne vérifie :

- ni niveau ;
- ni élément.

La nouvelle règle centrale `élément choisi = joueur Twitch activé` doit remplacer les verrous legacy d'onboarding lorsqu'ils existaient.

Elle ne doit pas être appliquée arbitrairement à un système qui n'était historiquement pas bloqué sans décision produit.

L'éligibilité précise des Codes côté Twitch reste donc à décider pendant R673+.

Le standalone possède de toute façon un élément après onboarding.

---

# 22. Migration du catalogue

Les douze définitions `gift_codes.json` doivent être considérées comme données réelles existantes.

À importer :

- texte du code ;
- type annuel ;
- mois ;
- récompenses ;
- message.

La migration ne publie pas artificiellement un nouveau code si sa période n'est pas active.

Pour une édition annuelle active au cutover :

- elle peut rester disponible normalement ;
- ne pas générer de double claim.

---

# 23. Migration des claims joueurs

`usedCodes` est une donnée métier importante.

À conserver :

## Code ponctuel

`CODE`

→ claim historique définitif.

## Code annuel

`CODE-YYYY`

→ claim de cette édition annuelle.

Ne pas :

- supprimer ces clés ;
- considérer tous les codes comme non utilisés ;
- repayer un code déjà réclamé.

La migration est idempotente.

Aucune récompense n'est distribuée simplement parce que les claims sont importés.

---

# 24. Modèle cible initial

La cible ne devrait pas stocker l'historique uniquement comme tableau de chaînes dans le profil.

Conceptuellement séparer :

## Code

Définition Admin :

- identifiant stable ;
- code saisi par le joueur ;
- nom / titre ;
- description ;
- état ;
- période ;
- type de renouvellement ;
- récompenses ;
- création / publication.

## Claim

Relation :

- joueur ;
- code / édition ;
- date de claim ;
- source du claim : UI / chat interne / Twitch ;
- données transactionnelles utiles.

Cette représentation facilite :

- unicité ;
- historique ;
- statistiques Admin ;
- notification ;
- audit économique.

Le modèle exact appartient au futur modèle de données cible.

---

# 25. Décisions techniques acquises

Sans consommer de Rxxx :

- les claims sont serveur-authoritaires ;
- récompense + claim = même transaction logique ;
- un même claim ne peut jamais être payé deux fois ;
- la casse du texte du code est normalisée pour la comparaison ;
- l'identifiant métier interne du code ne doit pas dépendre uniquement d'un texte modifiable ;
- les récompenses utilisent les services Ressources / Économie centraux ;
- les particules personnelles maintiennent `totalMainElementParticlesEarned` ;
- `totalPrimosEarned` / `totalMorasEarned` continuent à suivre les ressources générées ;
- publication / expiration / désactivation résolvent l'état des notifications ;
- le client Admin ne crédite jamais lui-même les joueurs ;
- les dates ne dépendent plus de `DateTime.Now` local d'un script Streamer.bot ;
- les claims legacy sont migrés sans nouveau paiement.

---

# 26. Décisions produit validées

## R673 — Codes ponctuels et codes annuels — ✅ VALIDÉ A

La V1 conserve deux familles de Codes cadeaux.

### Code ponctuel

Un code créé librement par l'administrateur peut être disponible :

- immédiatement ;
- pendant une période donnée ;
- sans expiration.

Chaque joueur ne peut le réclamer qu'une seule fois.

### Code annuel

Un code peut revenir automatiquement chaque année selon sa période récurrente.

Les codes Festivals utilisent ce modèle.

Chaque joueur possède alors un claim indépendant pour chaque édition annuelle.

---

## R674 — Workflow Admin Brouillon → Publié — ✅ VALIDÉ A

Créer un code ne le rend jamais automatiquement disponible.

Cycle principal :

1. création en `Brouillon` ;
2. configuration ;
3. vérification / aperçu ;
4. publication volontaire par un administrateur ;
5. disponibilité selon les dates configurées.

Un Brouillon :

- est invisible des joueurs ;
- ne peut pas être réclamé ;
- ne crée aucune notification.

La publication est une action serveur autorisée et journalisée.

---

## R675 — Texte manuel avec génération optionnelle — ✅ VALIDÉ A

L'administrateur peut saisir lui-même le code.

Exemple :

`MERCI1000`

L'interface Admin peut également proposer :

`Générer un code`

pour produire automatiquement un token disponible.

Le texte canonique du code est normalisé pour la comparaison, mais un identifiant métier interne distinct reste la véritable identité technique de la définition.

---

## R676 — Nom d'affichage distinct du code — ✅ VALIDÉ A

Chaque définition peut posséder :

- un **nom / titre d'affichage** ;
- le **code à saisir**.

Exemple :

`Merci pour les 100 viewers !`

Code :

`MERCI1000`

Le nom peut évoluer sans modifier l'identité du claim.

---

## R677 — Périodes flexibles — ✅ VALIDÉ A

Un code peut être configuré comme :

- disponible immédiatement ;
- avec date/heure de début ;
- avec date/heure de fin ;
- sans expiration ;
- récurrent annuellement selon son mois pour les codes concernés.

Les dates administratives utilisent les conventions serveur du projet.

Une publication avec date de début future crée un code publié mais pas encore récupérable.

La notification de disponibilité est produite lorsque le code devient réellement réclamable, et non prématurément pendant la période d'attente.

---

## R678 — Conservation des douze codes Event — ✅ VALIDÉ A

Conserver les douze codes Festivals existants.

Récompense de chacun :

- +1 600 Primogemmes ;
- +200 000 Moras.

Ils restent réutilisables une fois par joueur et par année pendant le mois de leur Festival.

Les douze codes sont gérés par le Domaine Codes.

Event indique uniquement qu'un code associé est disponible et redirige vers l'écran Codes.

---

## R679 — Ressources sûres en V1, moteur extensible — ✅ VALIDÉ A

L'interface Admin V1 permet de configurer au minimum :

- Primogemmes ;
- Moras ;
- particules Pyro ;
- particules Hydro ;
- particules Cryo ;
- particules Electro ;
- particules Anemo ;
- particules Geo ;
- particules Dendro.

Ces récompenses passent par les services Ressources / Économie centraux.

La structure du moteur doit permettre d'ajouter plus tard de nouveaux types de récompenses sans reconstruire le système Codes.

La V1 n'autorise pas arbitrairement depuis l'Admin :

- personnages ;
- Faveur ;
- monnaies Event ;
- objets Collection ;
- XP ;
- autres effets métier sensibles

tant que leurs contrats de récompense génériques ne sont pas explicitement définis.

---

## R680 — Écran joueur Disponibles / Récupérés — ✅ VALIDÉ A

L'écran `Codes` possède deux zones principales.

### Disponibles

Codes que le joueur peut actuellement réclamer.

### Récupérés

Historique des codes déjà réclamés par ce joueur.

Les codes expirés que le joueur n'a jamais réclamés ne polluent pas la vue principale.

---

## R681 — Un code réclamé reste visible dans Récupérés — ✅ VALIDÉ A

Après claim réussi :

- le code quitte `Disponibles` ;
- il apparaît dans `Récupérés` ;
- son bouton `Récupérer` disparaît ;
- sa notification actionnable est résolue immédiatement.

L'entrée peut afficher :

- nom ;
- texte du code ;
- récompenses ;
- date de récupération lorsqu'elle est connue ;
- édition annuelle lorsque pertinente.

---

## R682 — Récompenses visibles avant claim — ✅ VALIDÉ A

L'écran Codes affiche clairement les récompenses avant que le joueur clique sur :

`Récupérer`

Exemple :

- 1 600 Primogemmes ;
- 200 000 Moras.

La liste présentée au joueur provient de la même définition serveur que celle utilisée au moment du claim.

---

## R683 — Nouveaux joueurs éligibles tant que le code reste actif — ✅ VALIDÉ A

Un code global actif n'est pas réservé aux comptes qui existaient au moment de sa publication.

Exemple :

- code publié le 1er ;
- nouveau joueur le 5 ;
- expiration le 10.

Le nouveau joueur peut :

- voir le code ;
- le réclamer ;
- recevoir la notification correspondante tant qu'il reste disponible.

La disponibilité dépend de l'état courant du code et non d'une photographie figée des joueurs lors de sa publication.

---

## R684 — Rappel Twitch au premier message éligible — ✅ VALIDÉ A

Lorsqu'un joueur possède au moins un nouveau code actuellement récupérable et non réclamé, son premier message Twitch éligible peut produire un rappel compact.

Exemple :

`🎁 Tu as un code cadeau disponible ! Utilise !code pour voir les codes.`

Le système évite le spam.

Une même disponibilité déjà annoncée ne déclenche pas le rappel à chaque message.

Si plusieurs codes sont disponibles au même moment :

- un seul rappel compact suffit ;
- il ne publie pas une longue liste automatiquement.

Lorsqu'un nouveau code devient disponible plus tard, un nouveau rappel peut être délivré.

Les annonces manuelles du streamer restent évidemment possibles indépendamment de cette mécanique.

---

## R685 — Codes Twitch accessibles avant choix de l'élément — ✅ VALIDÉ A

Le Domaine Codes conserve l'accessibilité historique de `Code.txt`.

Un profil Twitch-only interne existant peut :

- consulter les codes ;
- réclamer un code ;

même s'il n'a pas encore choisi son élément.

La règle centrale :

`élément choisi = joueur Twitch activé`

n'est pas appliquée arbitrairement ici, car Codes n'utilisait historiquement aucun verrou d'onboarding et constitue une mécanique promotionnelle simple.

Un événement Code ne crée cependant pas à lui seul un joueur interne.

---

## R686 — Désactivation Admin — ✅ VALIDÉ A

Un administrateur autorisé peut désactiver un code déjà publié.

Effets :

- aucun nouveau claim ;
- retrait des notifications actionnables correspondantes ;
- conservation de tous les claims déjà effectués ;
- conservation de l'historique et de la définition Admin.

Réactiver ou republier ultérieurement doit respecter l'identité et les claims existants ; cela ne remet jamais automatiquement les anciens joueurs en état `non réclamé`.

---

## R687 — Récompenses verrouillées après le premier claim — ✅ VALIDÉ A

Avant le premier claim, l'administrateur peut encore corriger la configuration.

Dès qu'au moins un joueur a réclamé le code :

### Deviennent immuables

- identité métier ;
- token/code canonique ;
- type ponctuel / annuel ;
- définition des récompenses ;
- règles qui changeraient l'identité d'une édition déjà réclamée.

### Peuvent encore évoluer de manière contrôlée

- titre ;
- description ;
- texte d'information ;
- disponibilité future / date de fin ;
- désactivation.

Une modification de période :

- ne retire jamais une récompense déjà obtenue ;
- recalcule les notifications encore actionnables ;
- ne produit aucun nouveau claim.

---

## R688 — Statistiques Admin simples — ✅ VALIDÉ A

L'outil Admin affiche au minimum pour chaque code :

- état ;
- nombre de claims ;
- date de création ;
- date de publication ;
- période de disponibilité ;
- expiration éventuelle.

Un administrateur autorisé peut consulter le détail des joueurs ayant réclamé le code lorsque nécessaire pour :

- audit ;
- support ;
- diagnostic.

Ces informations administratives ne deviennent pas un classement public.

---

## R689 — `!code` sans argument liste les codes disponibles — ✅ VALIDÉ A

La famille texte cible devient :

`!code`

→ affiche les codes actuellement récupérables par le joueur.

`!code <CODE>`

→ réclame directement le code.

Exemple compact :

`🎁 Codes disponibles : MERCI1000, FESTIVALRECOLTES | !code CODE`

Si le nombre de codes dépasse ce qui peut être présenté proprement dans un seul message, la restitution peut être paginée ou découpée de manière sûre.

La syntaxe canonique de claim reste :

`!code <CODE>`

---

## R690 — Codes globaux pour tous les joueurs en V1 — ✅ VALIDÉ A

La V1 ne possède pas de ciblage avancé des Codes.

Un code publié concerne tous les joueurs qui satisfont ses conditions générales de disponibilité et de claim.

Pas de ciblage V1 :

- par pseudo ;
- par liste de joueurs ;
- par niveau ;
- par amis ;
- par segment personnalisé.

Le modèle peut rester extensible pour une évolution future si une vraie mécanique le justifie.

---

## R691 — Réactivation annuelle + nouvelle notification — ✅ VALIDÉ A

Un code annuel redevient réclamable automatiquement pendant sa nouvelle édition.

Exemple :

`FESTIVALNOEL`

Claim 2026 :

`FESTIVALNOEL / édition 2026`

Décembre 2027 :

- nouvelle édition disponible ;
- nouveau claim autorisé ;
- ancienne récupération 2026 conservée ;
- nouvelle notification de disponibilité ;
- nouveau rappel Twitch possible.

Le joueur ne peut réclamer qu'une fois chaque édition annuelle.

---

# 27. Cycle de vie cible

États conceptuels principaux :

- `Brouillon`
- `Publié / programmé`
- `Disponible`
- `Expiré`
- `Désactivé`

`Disponible` et `Expiré` peuvent être dérivés :

- de l'état publié ;
- de la période ;
- du calendrier serveur.

## Publication immédiate

Si la période commence immédiatement :

- le code devient récupérable ;
- les notifications de disponibilité sont produites.

## Publication programmée

Si le début est futur :

- le code reste publié mais non récupérable ;
- aucune notification `code disponible` n'est envoyée avant l'activation ;
- à l'heure de début, le serveur rend le code disponible et produit les notifications.

## Code annuel

Chaque nouvelle période annuelle constitue une nouvelle **édition de claim** pour ce code.

Les claims des anciennes éditions restent immuables.

## Expiration

À expiration :

- aucun nouveau claim ;
- les notifications actionnables restantes sont résolues ;
- l'ancienne définition et les claims restent conservés.

---

# 28. Notifications Codes

La notification représente l'état :

`ce joueur possède encore un code actuellement récupérable`

Elle est une projection de l'état métier, pas la source de vérité du claim.

Elle disparaît automatiquement lorsqu'elle n'est plus pertinente, notamment si :

- le joueur réclame le code depuis l'écran Codes ;
- il réclame avec `!code <CODE>` ;
- il réclame via Twitch ;
- le code expire ;
- le code est désactivé.

Lire ou supprimer manuellement une notification n'effectue jamais le claim.

## Nouveau joueur

Lorsqu'un joueur devient provisionné pendant qu'un code global est actif :

- calculer les codes encore récupérables ;
- produire les notifications pertinentes.

## Nouvelle liaison standalone

Un joueur Twitch-only qui accède ensuite au standalone retrouve l'état réel des codes encore actifs et non réclamés.

Aucun code déjà réclamé sur Twitch ne réapparaît comme actionnable.

---

# 29. Rappel Twitch

Pour chaque joueur, le serveur doit pouvoir déterminer quels codes disponibles n'ont pas encore été annoncés dans le cycle de rappel courant.

Au premier message normal éligible :

- s'il existe au moins un code nouvellement disponible et non réclamé ;
- produire un seul rappel compact ;
- considérer les codes actuellement concernés comme annoncés pour ce cycle.

Un nouveau code publié/activé plus tard rend à nouveau le joueur éligible à un rappel.

Si tous les codes sont déjà réclamés :

- aucun rappel.

Le rappel Twitch :

- ne distribue aucune récompense ;
- n'effectue aucun claim ;
- n'est pas nécessaire pour pouvoir utiliser le code.

---

# 30. Interface Admin cible

L'outil Admin Codes permet au minimum :

- créer un Brouillon ;
- saisir un titre ;
- saisir ou générer le token du code ;
- ajouter une description/message ;
- choisir ponctuel ou annuel ;
- configurer la période ;
- configurer les récompenses V1 autorisées ;
- prévisualiser ;
- publier ;
- désactiver ;
- ajuster les champs encore modifiables ;
- consulter le nombre de claims ;
- consulter les informations d'audit utiles.

Le token de claim doit être :

- non vide ;
- normalisé ;
- suffisamment contraint pour être utilisable sans ambiguïté dans le chat ;
- unique selon les règles du catalogue.

Les permissions Admin sont vérifiées côté serveur.

Le frontend Admin ne peut jamais :

- créditer directement des ressources ;
- fabriquer un claim ;
- contourner le moteur économique.

---

# 31. Migration du catalogue

Importer les douze codes Event existants comme définitions annuelles publiées.

Pour chacun :

- conserver le texte du code ;
- conserver le mois ;
- conserver +1 600 Primogemmes ;
- conserver +200 000 Moras ;
- conserver le message existant ;
- attribuer un identifiant métier interne stable lors de l'import.

La migration ne crée aucun claim et ne distribue aucune récompense.

Si le code du mois du cutover est actuellement actif :

- il reste normalement disponible ;
- les joueurs qui ne l'ont pas encore réclamé peuvent le réclamer ;
- l'interface peut créer la notification de disponibilité correspondante ;
- les anciens claims importés restent prioritaires et empêchent tout double paiement.

---

# 32. Migration des claims

Importer `usedCodes`.

## Clé ponctuelle

`CODE`

→ claim historique définitif du code correspondant.

## Clé annuelle

`CODE-YYYY`

→ claim de l'édition `YYYY`.

Pour les claims mappables à une définition connue :

- créer la relation de claim correspondante ;
- origine : migration legacy ;
- conserver l'édition lorsqu'elle est connue ;
- ne pas inventer de date exacte de claim si le legacy ne la fournit pas.

Pour une ancienne clé ne correspondant plus à aucune définition connue :

- conserver un marqueur de claim legacy normalisé ;
- ne pas la jeter silencieusement ;
- permettre au système de l'utiliser si la définition correspondante est retrouvée pendant le sweep/import final.

Aucun claim importé ne déclenche :

- récompense ;
- notification de gain ;
- statistiques économiques supplémentaires.

La migration est idempotente.

---

# 33. Producteurs / consommateurs cibles

## Admin Codes

Produit :

- définitions ;
- publication ;
- programmation ;
- désactivation ;
- modifications autorisées.

## Service Codes

Produit :

- liste des codes disponibles par joueur ;
- validation d'un claim ;
- relation de claim ;
- état récupéré / non récupéré ;
- éditions annuelles.

## Économie / Ressources

Applique les récompenses :

- Primogemmes ;
- Moras ;
- particules.

Maintient les statistiques transversales correspondantes.

## Notifications

Consomme l'état de disponibilité :

- nouveau code récupérable ;
- claim ;
- expiration ;
- désactivation.

## Event

Consomme uniquement :

`un code associé au Festival est disponible`

et ouvre l'écran Codes.

Event ne valide ni ne paie le code.

## TwitchBridge / chat

Utilisent :

- `!code`
- `!code <CODE>`
- rappel compact des nouveaux codes disponibles.

Tous appellent le même service Codes.

---

# 34. Contrat cible `!code`

## `!code`

Affiche les codes actuellement disponibles pour le joueur.

Aucune récompense n'est accordée par cette consultation.

## `!code <CODE>`

Tente de réclamer le code.

Validation serveur :

- profil joueur existant ;
- code existant ;
- publié ;
- actuellement disponible ;
- non désactivé ;
- claim encore disponible pour ce joueur / cette édition.

Le token est comparé après normalisation de casse.

### Succès

- claim enregistré ;
- récompenses appliquées ;
- statistiques économiques mises à jour ;
- notification correspondante résolue ;
- réponse compacte avec les gains.

### Déjà utilisé

Aucun effet économique.

### Invalide / indisponible / expiré

Aucun effet économique.

UI, chat interne et Twitch utilisent exactement la même opération métier.

---

# 35. Atomicité / concurrence

Un claim doit être protégé par une contrainte d'unicité conceptuelle sur :

`player + code + édition`

ou équivalent.

Récompenses et création du claim appartiennent à la même transaction logique.

Doivent être sans danger :

- double clic sur `Récupérer` ;
- UI + chat simultanés ;
- UI + Twitch simultanés ;
- retry réseau ;
- plusieurs instances serveur ;
- double réception d'une requête.

Un joueur ne doit jamais pouvoir :

- obtenir deux fois la récompense ;
- recevoir une récompense sans claim enregistré ;
- enregistrer le claim sans recevoir la récompense validée.

---

# 36. Critères d'acceptation

Le Domaine Codes cadeaux est prêt pour la V1 si les tests peuvent prouver notamment que :

1. un Brouillon est invisible et non réclamable ;
2. publier un code immédiatement actif le rend récupérable ;
3. publier un code futur ne crée pas prématurément une notification de disponibilité ;
4. le code devient automatiquement récupérable à son début de période ;
5. un code sans expiration reste disponible jusqu'à désactivation ;
6. un code ponctuel ne peut être réclamé qu'une seule fois par joueur ;
7. un code annuel ne peut être réclamé qu'une fois par édition annuelle ;
8. le même code annuel redevient récupérable l'année suivante ;
9. les douze codes Event conservent +1 600 Primogemmes et +200 000 Moras ;
10. Event ne possède aucun second moteur de claim ;
11. les récompenses sont affichées avant claim dans l'UI ;
12. un claim réussi déplace le code vers `Récupérés` ;
13. un claim réussi retire automatiquement sa notification actionnable ;
14. un claim via Twitch retire également la notification standalone correspondante ;
15. un code expiré ne peut plus être réclamé ;
16. expiration ou désactivation retire les notifications devenues inutiles ;
17. un nouveau joueur voit les codes encore actifs ;
18. un nouveau joueur peut recevoir la notification d'un code encore récupérable ;
19. un profil Twitch-only existant peut réclamer un code sans élément choisi ;
20. un code ne crée jamais à lui seul un profil joueur ;
21. le premier message Twitch pertinent peut produire un seul rappel compact ;
22. plusieurs messages Twitch ne répètent pas le même rappel en boucle ;
23. un nouveau code activé plus tard permet un nouveau rappel ;
24. `!code` sans argument liste les codes disponibles ;
25. `!code <CODE>` réclame exactement le code demandé ;
26. le matching du token est insensible à la casse après normalisation ;
27. un double clic ne paie pas deux fois ;
28. UI + Twitch concurrents ne paient pas deux fois ;
29. un retry réseau ne paie pas deux fois ;
30. les récompenses et le claim réussissent ensemble ou échouent ensemble ;
31. les particules correspondant à l'élément personnel maintiennent `totalMainElementParticlesEarned` ;
32. les gains Primogemmes/Moras maintiennent leurs statistiques économiques ;
33. après le premier claim, les récompenses du code ne peuvent plus être modifiées ;
34. désactiver un code conserve tous les claims passés ;
35. les statistiques Admin comptent les claims sans exposer publiquement les joueurs ;
36. les claims legacy importés empêchent correctement les doubles récompenses ;
37. aucune récompense n'est distribuée pendant la migration ;
38. un claim legacy sans date connue ne reçoit pas une date historique inventée.

---

# 37. Conclusion du domaine

**Domaine Codes cadeaux : CLÔTURÉ après R691.**

Le cycle de vie Admin, les familles de codes, les périodes, les récompenses, l'écran joueur, les notifications, l'intégration Event, Twitch, la migration, l'atomicité et les contrats de commande sont suffisamment définis pour une future implémentation V1 bornée.

Le domaine ne doit être rouvert que si :

- le sweep final révèle une dépendance réelle oubliée ;
- l'outil Admin global introduit une contrainte transversale nouvelle ;
- une décision produit est explicitement révisée.

---

# 38. Sweep final obligatoire

Même après clôture de Codes cadeaux et des audits restants, le sweep exhaustif final des 37 scripts `.txt` et 17 JSON reste obligatoire avant le modèle de données cible final et la V1.
