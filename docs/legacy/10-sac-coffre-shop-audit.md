# 10 — Audit legacy Sac / Coffre / Shop

Statut : AUDIT EN COURS — OUVERT APRÈS CLÔTURE DU DOMAINE BANQUE R237–R255
Date : 2026-08-31

## 1. Périmètre

Domaine audité :
- `!sac` ;
- `!coffre` ;
- `!shop` ;
- données de boutique ;
- ressources affichées dans le Sac ;
- objets de collection du Coffre ;
- récompenses achetées ;
- frontière avec Missions / Event / Gacha / Ressources ;
- direction UI standalone ;
- migration des données concernées.

Ne pas redécider les règles déjà validées dans les domaines Ressources, Gacha, Banque, Box ou Team.

---

## 2. Sources legacy principales

### Code
- `legacy/streamerbot/commands/Sac.txt`
- `legacy/streamerbot/commands/Coffre.txt`
- `legacy/streamerbot/commands/Shop.txt`

### Consommateurs / producteurs connexes
- `legacy/streamerbot/commands/Event.txt`
- `legacy/streamerbot/commands/Missions.txt`
- autres scripts à scanner si une dépendance apparaît pendant l'audit.

### Données
- `legacy/streamerbot/data/shop_items.json`
- `legacy/streamerbot/data/viewers_data.json`
- `legacy/streamerbot/data/missions_pool.json`
- `legacy/streamerbot/data/monthly_events_data.json`

---

## 3. `Sac.txt` — réalité du legacy

`!sac` est uniquement une commande de consultation.

Il lit :
- `primogems` ;
- `moras` ;
- les sept stocks de `particles` ;
- l'élément principal du joueur.

Il dérive également :
- le nombre de vœux possibles = `primogems / 160`.

Présentation legacy :
- élément principal en premier ;
- puis les six autres éléments ;
- une seule ligne Twitch.

Le script :
- ne crée pas de viewer ;
- ne modifie aucune donnée ;
- ne sauvegarde pas `viewers_data.json`.

Conclusion provisoire :
le `Sac` legacy n'est pas réellement un inventaire d'objets ; c'est surtout une vue consolidée des ressources principales.

---

## 4. `Coffre.txt` — réalité du legacy

`!coffre` affiche les objets collectionnables permanents du joueur.

Source :
- `viewer["coffre"]`.

Structure conceptuelle :

```json
{
  "coffre": {
    "lanterne_nouvel_an": 1,
    "coeur_cristallin": 1,
    "coquillage_dore": 2
  }
}
```

Le script :
- ne donne aucune récompense ;
- ne consomme aucun objet ;
- ne modifie pas les quantités ;
- ignore à l'affichage les quantités <= 0 ;
- affiche les objets connus dans un ordre annuel fixe ;
- affiche les IDs inconnus avec un placeholder ;
- splitte le message Twitch si nécessaire.

Objets connus :
1. Lanterne du Nouvel An
2. Cœur Cristallin
3. Bourgeon Éternel
4. Œuf Enchanté
5. Fleur de Printemps
6. Coquillage Doré
7. Étoile Filante
8. Boussole Antique
9. Gerbe de Récolte
10. Citrouille Hantée
11. Feuille Ancienne
12. Flocon Enchanté

---

## 5. Producteur réel du Coffre

`Event.txt` est le producteur métier des objets de collection.

Commande :
- `!event collection`

Règles legacy observées :
- coût = 80 unités de la monnaie événementielle du mois ;
- une acquisition de l'objet du mois par joueur et par année ;
- l'achat ajoute `+1` à `viewer["coffre"][collectionItemId]` ;
- l'historique annuel d'achat est suivi séparément dans `monthly_events_data.json`.

Le Coffre lui-même n'est donc pas propriétaire de la règle d'acquisition.

La mécanique complète des événements sera auditée dans son propre domaine ; ici on ne fixe que la représentation inventaire/collection.

---

## 6. `Shop.txt` — structure générale

`!shop` lit :
- `shop_items.json` ;
- `viewers_data.json` ;
- `missions_pool.json` pour l'article Mission et les changements de mission.

La boutique legacy possède trois articles actifs :
1. Primos
2. Ticket
3. Mission

Tous les prix utilisent les Moras du portefeuille.

Les achats ordinaires :
- vérifient le portefeuille ;
- débitent les Moras ;
- incrémentent `totalMorasSpent` ;
- rollbackent le débit si l'effet de l'article échoue.

La Banque n'est jamais débitée directement.

---

## 7. Article Primos

Configuration :
- 50 000 Moras ;
- récompense : 160 Primogemmes.

Le code réel supporte :

```text
!shop primos <nombre>
```

Le nombre représente plusieurs lots de 160 Primos :
- coût total = 50 000 × nombre ;
- gain = 160 × nombre.

Le code incrémente `totalPrimosEarned`.

### Incohérence legacy détectée

`shop_items.json` contient :

```json
"maxPurchasePerCommand": 1
```

pour l'article Primos, mais :
- le header de `Shop.txt` documente explicitement `!shop primos nombre` ;
- le parser accepte plusieurs lots ;
- le moteur multiplie le coût et la récompense.

Cette propriété JSON est donc incohérente avec le comportement réel du script et devra être arbitrée/documentée.

---

## 8. Article Ticket

Prix :
- 150 000 Moras.

Le Ticket n'est pas ajouté dans un inventaire.

Il est immédiatement consommé au moment de l'achat et tire une récompense aléatoire.

`shop_items.json` définit actuellement cinq résultats avec poids égaux :
- +1 600 Primogemmes ;
- +1 000 particules de l'élément principal ;
- +800 particules d'un autre élément aléatoire ;
- +10 pity 5★, plafonnée à 90 dans le legacy ;
- remboursement +50 000 Moras.

Chaque entrée a `chanceWeight = 1`.

Conséquences statistiques :
- les Primogemmes gagnées incrémentent `totalPrimosEarned` ;
- les Moras gagnées incrémentent `totalMorasEarned` ;
- les particules principales utilisent aussi le compteur legacy concerné ;
- la pity est modifiée directement.

Important :
les règles finales de pity du Domaine Gacha restent prioritaires ; l'intégration future d'une récompense `+pity` doit respecter le moteur Gacha central et ses invariants, pas écrire directement un champ.

---

## 9. Article Mission

Prix :
- 10 000 Moras.

Effet :
- attribue une mission journalière aléatoire depuis `missions_pool.json` ;
- une mission du jour déjà attribuée bloque un nouvel achat ;
- la mission annoncée vaut actuellement 800 Primogemmes selon la configuration du Shop.

Le Shop initialise notamment :
- `missionId`
- `type`
- `progress`
- `target`
- `completed`
- `rewardClaimed`
- `startedAt`
- `description`
- `switchCount`
- `switchDate`

La logique détaillée des objectifs/progression/récompenses appartient au futur audit Missions.

---

## 10. `!shop switch`

Le Shop possède également la mécanique de changement de mission journalière.

Préconditions :
- une mission du jour existe ;
- elle n'est pas terminée/réclamée.

Prix :
- premier switch : 20 000 Moras ;
- puis double à chaque switch du même jour ;
- 20k → 40k → 80k → 160k → etc. ;
- protection legacy vers 1 000 000 000 maximum.

Sélection :
- 10 % de chance de retomber sur la mission actuelle ;
- 90 % répartis uniformément entre les autres missions actives.

Le changement :
- dépense des Moras ;
- incrémente `totalMorasSpent` ;
- remplace la mission ;
- remet sa progression à zéro ;
- incrémente `switchCount`.

Cette mécanique doit être recroisée avec le futur audit Missions avant clôture définitive de sa sémantique.

---

## 11. Frontières métier provisoires

### Sac
Vue/agrégateur de ressources et futurs objets.

Il ne doit pas devenir propriétaire des soldes de ressources.

### Coffre
Vue de collection d'objets événementiels permanents.

La source d'acquisition reste Event.

### Shop
Orchestre des achats mais doit appeler les services métier centraux :
- ResourceService / économie ;
- Gacha pour toute modification de pity ;
- Missions pour attribution/changement de mission ;
- Inventaire si de vrais objets stockables apparaissent.

---

## 12. Règles déjà acquises des autres domaines

- dépenses Shop depuis le portefeuille Moras uniquement ;
- toute dépense réelle incrémente `totalMorasSpent` ;
- tout gain réel de Primos/Moras suit les compteurs Earned validés ;
- opérations serveur atomiques/idempotentes ;
- aucun solde négatif ;
- données dérivables non stockées inutilement ;
- recherche UI temps réel par sous-chaîne contiguë sur les listes pertinentes ;
- helpers Twitch/chat courts et sur une seule ligne ;
- aucune référence à une migration dans les helpers.

---

## 13. Migration — première direction

À préserver :
- soldes ressources via leurs domaines respectifs ;
- `viewer["coffre"]` ;
- données de mission existantes, mais leur migration finale appartient au Domaine Missions ;
- toute donnée réellement persistante liée aux articles.

Ne pas inventer :
- historique d'achats Shop absent ;
- historique d'ouverture Ticket absent ;
- provenance précise des objets du Coffre si elle n'existe plus dans les données.

Les IDs inconnus du Coffre doivent être conservés et signalés, pas supprimés silencieusement.

---

## 14. Points fonctionnels à décider

Première passe :
- relation UI entre Sac et Coffre ;
- place des ressources déjà visibles ailleurs dans le Sac ;
- comportement du Ticket : immédiat ou véritable objet stockable ;
- quantité d'achat des lots de Primos ;
- place de la Mission dans l'UI Boutique ;
- évolution future de la boutique vers des articles dynamiques ;
- présentation/recherche/filtres du Sac ;
- confidentialité du Sac/Coffre ;
- historique d'achats éventuel.

---

## 15. État

Domaine ouvert.

Aucune nouvelle décision R256+ n'est encore inscrite.
