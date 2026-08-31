# 10 — Audit legacy Sac / Coffre / Shop

Statut : AUDIT EN COURS — R256 À R280 VALIDÉS — SAC / COLLECTION / CŒUR SHOP TRÈS AVANCÉS
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

## 14. Décisions standalone — R256 à R280

### R256 — Coffre intégré au Sac — ✅ VALIDÉ

Dans l'UI standalone :
- le Coffre n'est pas un écran séparé ;
- les objets de `viewer["coffre"]` deviennent la catégorie `Collection` du Sac.

Twitch/chat :
- `!coffre` reste disponible comme commande de consultation.

---

### R257 — Le Sac reste la vue complète des possessions — ✅ VALIDÉ

Même si certaines ressources sont déjà visibles dans la sidebar :
- le Sac les affiche aussi ;
- le Sac représente la vue détaillée et complète des possessions pertinentes.

La sidebar reste un résumé compact.

---

### R258 — Ticket consommé immédiatement — ✅ VALIDÉ

Le Ticket Shop ne devient pas un objet stockable en V1.

Flux :

`achat → paiement → tirage immédiat → récompense`

Aucun Ticket n'est ajouté au Sac.

---

### R259 — Achat multiple de lots de Primogemmes — ✅ VALIDÉ

Conserver :

`!shop primos <quantité>`

Un lot :
- 50 000 Moras ;
- 160 Primogemmes.

Le prix et la récompense sont multipliés par la quantité.

La propriété legacy `maxPurchasePerCommand: 1` est considérée comme incohérente/obsolète par rapport au comportement réel du code.

---

### R260 — Mission quotidienne achetable depuis Shop et Missions — ✅ VALIDÉ

La même action métier d'achat de mission quotidienne est accessible :
- depuis la Boutique ;
- directement depuis l'écran Missions si aucune mission quotidienne n'a encore été achetée ce jour-là.

Il ne s'agit pas de deux achats distincts.

Standalone :
- l'écran Missions devient le workflow principal de gestion des missions ;
- la Boutique peut conserver une carte/raccourci vers l'achat initial.

Twitch/chat :
- conserver notamment `!shop mission`.

Les missions permanentes B/A/S/Z seront auditées dans le Domaine Missions.

Piste UX à évaluer plus tard :
- onglet Missions quotidiennes ;
- onglet Missions permanentes.

Ne pas figer cette organisation avant audit du vrai système Missions.

---

### R261 — Catégories initiales du Sac — ✅ VALIDÉ

V1 :

- `Tout`
- `Ressources`
- `Collection`

Ne pas créer artificiellement une catégorie vide.

L'architecture doit permettre d'ajouter plus tard d'autres catégories si de vrais objets/consommables persistants apparaissent.

---

### R262 — Quantité visible sur les objets Collection — ✅ VALIDÉ

Chaque carte Collection affiche sa quantité :
- `x1` compris ;
- quantités >1 possibles.

---

### R263 — `Tout` montre réellement tout — ✅ VALIDÉ

L'onglet `Tout` conserve aussi les ressources ayant une quantité égale à zéro.

Exemple :
- particules Pyro = 0 → toujours visibles.

Ne pas masquer les ressources structurelles à zéro.

---

### R264 — Boutique pilotée par catalogue serveur — ✅ VALIDÉ

La Boutique standalone est pilotée par un catalogue serveur dynamique.

Un article peut conceptuellement définir :
- ID stable ;
- nom ;
- description ;
- visuel ;
- prix ;
- monnaie ;
- ordre ;
- disponibilité ;
- visibilité ;
- type d'effet ;
- règles de quantité ;
- autres métadonnées nécessaires.

Les effets sensibles ne sont jamais du code arbitraire stocké en base.

Chaque type d'article appelle un service métier autorisé.

---

### R265 — Probabilités Ticket visibles — ✅ VALIDÉ

La fiche Ticket affiche clairement :
- toutes les récompenses possibles ;
- leurs probabilités.

Les pourcentages sont calculés depuis les poids du catalogue.

Configuration legacy actuelle :
- 5 résultats ;
- poids égaux ;
- 20 % chacun.

---

### R266 — Pas de confirmation avant Ticket — ✅ VALIDÉ

Dans l'UI :
- clic sur `Acheter` = achat immédiat ;
- aucune popup de confirmation préalable.

Même philosophie côté Twitch/chat.

---

### R267 — MAX pour les lots Primos — ✅ VALIDÉ

UI :
- bouton `MAX`.

Twitch/chat :
- `!shop primos max`.

`MAX` représente le nombre entier maximum de lots achetables avec le portefeuille Moras courant.

---

### R268 — Ticket +10 pity 5★ — ✅ VALIDÉ

Conserver la récompense :

`+10 pity 5★`

Règles :
- appliquée via le moteur Gacha central ;
- jamais par écriture directe depuis Shop ;
- plafond 90 ;
- peut donc rendre le prochain 5★ garanti par hard pity.

Le domaine Gacha reste source de vérité sur les invariants de pity.

---

### R269 — Objets non possédés visibles — ✅ VALIDÉ

La Collection montre :
1. tous les objets possédés ;
2. puis tous les objets non possédés.

Les objets non possédés ne sont pas supprimés de la vue.

Obtention :
- hover possible pour afficher une indication courte ;
- clic pour ouvrir la fiche complète.

Pour les objets événementiels, la méthode d'obtention décrit l'événement concerné.

Exemple conceptuel :
`Échanger 80 unités de la monnaie de l'événement du mois concerné.`

Le Domaine Event définira précisément la mécanique événementielle.

---

### R270 — Tri Collection — ✅ VALIDÉ

Ordre par défaut :

1. possédés ;
2. non possédés.

Dans chacun de ces deux groupes :
- ordre alphabétique.

Ne pas utiliser l'ordre Janvier → Décembre comme tri principal.

---

### R271 — Fiche Collection complète — ✅ VALIDÉ

Cliquer sur un objet ouvre une fiche contenant notamment :
- nom ;
- illustration ;
- description ;
- quantité ;
- origine ;
- méthode d'obtention ;
- historique d'obtention.

Le hover reste une version courte de la méthode d'obtention.

#### Historique legacy

Si les dates historiques exactes sont absentes :
- ne jamais inventer d'anciennes dates ;
- créer au cutover une entrée de migration à la date de migration ;
- quantité correspondante = quantité legacy connue ;
- conserver une provenance interne `migration_fallback` ou équivalente.

Les nouvelles acquisitions standalone utilisent leur vraie date.

---

### R272 — Collection publique — ✅ VALIDÉ

La Collection peut être consultée depuis le profil d'un joueur selon confidentialité :
- Public ;
- Amis uniquement ;
- Privé.

Vue publique :
- lecture seule ;
- aucun achat/utilisation ;
- même logique de collection.

---

### R273 — Trois états de visibilité Shop — ✅ VALIDÉ

Le catalogue doit pouvoir représenter :

1. visible + achetable ;
2. visible + indisponible ;
3. complètement masqué.

Un article temporairement indisponible peut donc rester présenté avec action d'achat désactivée.

---

### R274 — Compteur de complétion Collection — ✅ VALIDÉ

Afficher :

`8 / 12`

Le compteur mesure :
- le nombre d'objets distincts possédés ;
- pas le nombre total d'exemplaires.

Ne pas afficher de compteur global d'exemplaires.

---

### R275 — Obtention visible même si l'objet est possédé — ✅ VALIDÉ

Le hover d'obtention fonctionne :
- sur objet possédé ;
- sur objet non possédé.

Le clic ouvre toujours la fiche complète.

---

### R276 — Révélation visuelle après Ticket — ✅ VALIDÉ

Après achat :
- afficher immédiatement la récompense obtenue ;
- animation/feedback court possible ;
- aucun écran de confirmation avant achat.

Le résultat métier est déjà validé/persisté côté serveur avant son affichage.

---

### R277 — Ticket unitaire — ✅ VALIDÉ

V1 :
- un achat = un Ticket ;
- un Ticket = un tirage immédiat.

Pas d'achat multiple de Tickets.

---

### R278 — Historique des achats Shop — ✅ VALIDÉ

Conserver un historique détaillé des achats standalone.

L'écran Boutique affiche quelques achats récents.

Un bouton `Voir tout` ouvre l'écran transversal `Historique` directement sur la catégorie Boutique/Achats.

Exemples d'informations :
- date ;
- article ;
- quantité ;
- coût ;
- récompense/résultat ;
- résultat aléatoire pour Ticket.

Ne pas fabriquer d'historique d'achats legacy absent.

---

### R279 — Mission quotidienne déjà achetée — ✅ VALIDÉ

Après acquisition quotidienne :
- la carte Shop reste visible ;
- elle devient indisponible ;
- afficher un état clair du type `Déjà obtenue aujourd'hui`.

Ne pas la faire disparaître.

---

### R280 — Changement de mission dans l'écran Missions — ✅ VALIDÉ

Standalone :
- le changement/re-roll d'une mission quotidienne appartient principalement à l'écran Missions.

La Boutique :
- fournit l'achat initial ;
- peut conserver un raccourci vers cette mécanique.

Twitch/chat :
- `!shop mission`
- `!shop switch`

restent des points d'entrée pratiques vers les mêmes services métier.

La logique fine de switch reste à recroiser avec le futur Domaine Missions.

---

## 15. Historique transversal — décision renforcée

Il existe un seul écran global `Historique`.

Les domaines ne doivent pas recréer chacun leur propre écran complet.

Principe :
- Banque affiche un aperçu récent ;
- Boutique affiche un aperçu récent ;
- Invocation peut proposer un raccourci ;
- autres domaines futurs peuvent faire de même.

`Voir tout` navigue vers le même écran `Historique`, directement ouvert sur l'onglet/catégorie correspondant au contexte d'origine.

Catégories actuellement prévues :
- Invocations ;
- Bannières ;
- Banque ;
- Boutique / Achats.

D'autres catégories sont ajoutées uniquement lorsqu'elles apportent une utilité réelle.

---

## 16. État

R256 à R280 validées.

Sac :
- Coffre intégré comme Collection ;
- onglets Tout / Ressources / Collection ;
- ressources à zéro visibles ;
- recherche transverse applicable ;
- Collection possédée/non possédée ;
- tri alphabétique avec possédés en premier ;
- compteur de complétion ;
- fiche et méthode d'obtention ;
- Collection publique selon confidentialité.

Shop :
- catalogue serveur dynamique ;
- Primos multi-lots + MAX ;
- Ticket immédiat, unitaire, probabilités visibles ;
- `+10 pity` délégué à Gacha ;
- Mission initiale accessible depuis Shop et Missions ;
- changement de mission principalement dans Missions ;
- historique des achats.

Audit restant :
- finir les comportements Shop restants ;
- vérifier présentation/commande `!shop` complète ;
- vérifier `!sac` / `!coffre` cibles ;
- finaliser migration Collection ;
- vérifier les autres consommateurs/producteurs du Coffre ;
- fixer les derniers détails de confidentialité Sac/Ressources ;
- terminer la frontière avec Event ;
- reporter proprement la logique Mission non tranchée au Domaine Missions ;
- déterminer si le domaine peut ensuite être clôturé.

**Domaine toujours EN COURS.**
