# 19 — Audit Codes cadeaux

> Domaine 16 de l'audit GachaImpact.  
> Statut : **EN COURS — audit technique initial réalisé, directions produit utilisateur intégrées, premières décisions à reprendre à R673**.  
> Ce document devient la source spécialisée du domaine Codes cadeaux.  
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

# 26. Points produit à décider

Reprendre à :

**R673**

À traiter notamment :

- codes ponctuels et codes annuels : conserver les deux familles ?
- workflow Admin `Brouillon → Publié` ;
- création manuelle du texte du code ou génération automatique possible ;
- nom d'affichage séparé du code technique ;
- période : sans expiration / date précise / plage début-fin ;
- comportement des 12 codes Event existants ;
- types de récompense configurables dans l'Admin ;
- écran joueur : afficher uniquement disponibles ou aussi récupérés/expirés ;
- code récupéré : disparaît ou reste visible `Récupéré` ;
- affichage détaillé des récompenses avant claim ;
- notification à la publication ;
- nouveaux joueurs arrivant pendant qu'un code est actif ;
- Twitch : rappel automatique au premier message ou annonce manuelle seulement ;
- plusieurs codes disponibles côté Twitch ;
- règle d'activation Twitch / élément pour le claim ;
- désactivation Admin d'un code déjà publié ;
- modification d'un code après publication ;
- statistiques Admin de claims ;
- contrat final `!code` ;
- migration ;
- critères d'acceptation ;
- clôture du domaine.

---

# 27. Sweep final obligatoire

Même après clôture de Codes cadeaux et des audits restants, le sweep exhaustif final des 36 scripts `.txt` et 17 JSON reste obligatoire avant le modèle de données cible final et la V1.
