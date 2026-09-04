# 09 — Audit legacy Banque

Statut : CLÔTURÉ — R237 À R255 VALIDÉS
Date : 2026-08-31

## 1. Périmètre

Domaine audité :
- solde bancaire Moras ;
- portefeuille Moras ↔ banque ;
- dépôt ;
- retrait ;
- consultation ;
- intérêt quotidien ;
- commandes Twitch/chat ;
- direction UI standalone ;
- visibilité/confidentialité ;
- migration legacy ;
- frontière avec le moteur central de ressources.

Ne pas redécider les règles déjà validées dans les domaines XP et Ressources.

---

## 2. Sources legacy principales

### Code
- `legacy/streamerbot/commands/Banque.txt`
- `legacy/streamerbot/commands/XP.txt` pour l'ancien déclenchement de l'intérêt quotidien

### Données
- `legacy/streamerbot/data/viewers_data.json`
  - `moras`
  - `bank.moras`
  - `bank.lastInterestDate`
  - `stats.totalMorasEarned`
  - `stats.totalMorasSpent`

### Documentation déjà validée
- `docs/master/PROJECT_MASTER_PLAN.md`
- `docs/legacy/05-element-resources-audit.md`
- `docs/legacy/04-xp-audit.md`
- `docs/legacy/03-command-data-matrix.md`

---

## 3. Structure legacy observée

Le profil contient conceptuellement :

```json
{
  "moras": 123456,
  "bank": {
    "moras": 500000,
    "lastInterestDate": "2026-08-30"
  }
}
```

`moras` :
- portefeuille disponible pour les dépenses ordinaires.

`bank.moras` :
- solde bancaire séparé.

`bank.lastInterestDate` :
- marqueur utilisé uniquement par le legacy pour éviter plusieurs intérêts le même jour.

La cible standalone n'est pas obligée de conserver ce marqueur sous cette forme si le scheduler serveur possède un mécanisme plus approprié.

---

## 4. Commande legacy `!banque`

Formes principales :

- `!banque`
- `!banque deposer <montant>`
- `!banque retirer <montant>`

Aliases legacy reconnus après normalisation :
- dépôt : `deposer`, `depose`, variantes accentuées équivalentes ;
- retrait : `retirer`, `retire`, variante accentuée équivalente.

Sans argument :
- affiche le solde banque ;
- affiche le portefeuille ;
- rappelle les syntaxes dépôt/retrait.

Le legacy ne crée pas un nouveau viewer si le profil n'existe pas.

---

## 5. Dépôt legacy

Préconditions :
- montant entier strictement positif ;
- portefeuille >= montant.

Effet :

```text
wallet.moras -= montant
bank.moras += montant
```

Le transfert ne modifie pas les statistiques historiques de Moras gagnés/dépensés.

Aucun frais identifié.
Aucun cooldown identifié.
Aucun plafond bancaire identifié.
Aucun minimum autre que `> 0`.

---

## 6. Retrait legacy

Préconditions :
- montant entier strictement positif ;
- banque >= montant.

Effet :

```text
bank.moras -= montant
wallet.moras += montant
```

Le transfert ne modifie pas les statistiques historiques de Moras gagnés/dépensés.

Aucun frais identifié.
Aucun cooldown identifié.
Aucun plafond de retrait identifié.
Aucun minimum autre que `> 0`.

---

## 7. Intérêt quotidien legacy

L'intérêt n'est pas calculé dans `Banque.txt`.

Il est déclenché par `XP.txt` lors du premier message utilisateur du jour qui :
- n'est pas une commande ;
- n'est pas un message système.

Legacy :

```text
si lastInterestDate != aujourd'hui
    interest = bankMoras * 3 / 100
    bankMoras += interest
    stats.totalMorasEarned += interest
    lastInterestDate = aujourd'hui
```

L'arithmétique entière produit un arrondi inférieur.

### Défaut legacy important

Le calcul dépend de l'activité du joueur et du moment de son premier message.

Conséquences possibles :
- joueur hors ligne → pas d'intérêt ce jour-là ;
- dépôt effectué via commande avant le premier message éligible → le nouveau dépôt peut entrer dans la base du calcul du jour ;
- retrait avant le premier message éligible → peut réduire cette base.

Ce comportement legacy est abandonné dans la cible standalone.

---

## 8. Règles déjà validées — ne pas redécider

### Banque / portefeuille
- portefeuille Moras et Banque = deux soldes distincts ;
- dépenses ordinaires depuis le portefeuille uniquement ;
- richesse totale `wallet + bank` = donnée dérivable.

### Transferts
- dépôt/retrait = transfert interne ;
- ne compte ni comme `totalMorasEarned` ni comme `totalMorasSpent` ;
- opérations sûres, atomiques et côté serveur ;
- aucun solde négatif ;
- pas de plafond V1 validé dans le Domaine Ressources ;
- types numériques adaptés aux grosses valeurs.

### Intérêt
- taux : 3 % par jour ;
- exécution automatique au reset serveur 00:00 `Europe/Paris` ;
- joueur hors ligne inclus ;
- base = solde bancaire exactement présent au reset ;
- arrondi inférieur ;
- intérêt crédité directement dans la Banque ;
- intérêt ajouté à `stats.totalMorasEarned`.

Conséquence :
- l'intérêt composé est naturel : l'intérêt crédité fait partie du solde du reset suivant.

---

## 9. Architecture cible héritée du Domaine Ressources

La Banque ne doit pas écrire les Moras hors du moteur central de mutation de ressources.

Conceptuellement :

```text
BankingService
   ↓
Resource mutation / transaction
   ├── wallet Moras
   └── bank Moras
```

Dépôt/retrait :
- transaction unique ;
- décrémente un solde et crédite l'autre atomiquement ;
- aucun état intermédiaire visible.

Intérêt :
- producteur de Moras ;
- crédite la Banque ;
- incrémente `totalMorasEarned` ;
- cause/source métier journalisable.

Le SQL exact reste Phase 2.

---

## 10. Migration legacy

À préserver :
- solde portefeuille `moras` ;
- solde `bank.moras` ;
- statistiques historiques déjà présentes telles que validées dans Ressources.

`bank.lastInterestDate` :
- utile comme provenance legacy ;
- ne doit pas piloter à lui seul le futur scheduler automatique ;
- stratégie exacte de cutover à préciser afin d'éviter un double intérêt ou un intérêt manquant le jour de migration.

Anomalies évidentes :
- solde négatif ;
- type illisible ;
- section `bank` absente ;
- date invalide.

Ces cas techniques seront traités conservativement et journalisés sans solliciter une décision produit pour chaque occurrence.

---

## 11. Décisions finales Banque

### R237 — `MAX` dans l'UI — ✅ VALIDÉ

L'écran Banque propose `MAX` pour :
- dépôt ;
- retrait.

Dépôt MAX :
- tout le portefeuille disponible.

Retrait MAX :
- tout le solde bancaire disponible.

---

### R238 — `max` côté Twitch/chat — ✅ VALIDÉ

Accepter :
- `!banque deposer max`
- `!banque retirer max`

Le montant est résolu transactionnellement au moment de l'opération.

---

### R239 — Écran Banque dédié — ✅ VALIDÉ

Prévoir un véritable écran Banque standalone.

Il présente notamment :
- portefeuille Moras ;
- solde Banque ;
- patrimoine total dérivé ;
- dépôt ;
- retrait ;
- raccourci MAX ;
- intérêt quotidien ;
- intérêt estimé ;
- compte à rebours ;
- historique récent.

L'écran peut être accessible depuis les zones Ressources/sidebar pertinentes sans devenir obligatoirement une entrée majeure permanente de navigation.

---

### R240 — Intérêt estimé visible — ✅ VALIDÉ

Afficher l'intérêt du prochain reset calculé sur le solde bancaire actuel :

`floor(bank × 3%)`

Cette valeur :
- est une estimation ;
- se recalcule immédiatement après dépôt/retrait ;
- ne remplace jamais le calcul autoritaire serveur.

Twitch/chat cible :

`🏦 Banque <joueur> : 10 000 000 moras | 💰 Portefeuille : 2 000 000 | Intérêt estimé (3%) : +300 000 | 📥 !banque deposer X | 📤 !banque retirer X`

Toujours sur une seule ligne.

---

### R241 — Historique Banque récent — ✅ VALIDÉ

L'écran Banque affiche quelques opérations récentes :
- dépôt ;
- retrait ;
- intérêt.

Il ne montre pas toute l'histoire directement.

---

### R242 — Pas de notification d'intérêt — ✅ VALIDÉ

Le crédit quotidien d'intérêt ne génère pas de notification dédiée.

Le joueur constate le changement via :
- nouveau solde ;
- historique Banque.

Aucun message Twitch spontané au reset.

---

### R243 — Historique complet via écran transversal — ✅ VALIDÉ

L'écran Banque propose `Voir tout`.

Cette action ouvre l'écran transversal `Historique` directement filtré sur Banque.

---

### R244 — Message normal `!banque` complet — ✅ VALIDÉ

`!banque` conserve dans sa réponse normale :
- solde Banque ;
- portefeuille ;
- intérêt estimé avec taux ;
- aide dépôt ;
- aide retrait ;
- emojis appropriés du legacy.

Direction :

`🏦 Banque <joueur> : X moras | 💰 Portefeuille : Y | Intérêt estimé (3%) : +Z | 📥 !banque deposer X | 📤 !banque retirer X`

Les erreurs de syntaxe utilisent en plus les helpers globaux courts déjà définis.

---

### R245 — Historique bancaire privé par défaut — ✅ RÉVISÉ PAR R518

La rubrique Historique Banque est `Privé` par défaut, mais configurable :
- Public ;
- Amis uniquement ;
- Privé.

Le réglage du solde Banque et celui de l'historique détaillé restent indépendants.

Lorsqu'il est partagé, l'historique est consultable uniquement en lecture seule selon permissions serveur.

Si l'historique reste privé :
- ne pas exposer dépôts ;
- retraits ;
- intérêts détaillés ;
- chronologie bancaire ;
- donnée dérivée permettant de le reconstruire.

---

### R246 — Patrimoine total — ✅ VALIDÉ

Dans l'écran Banque personnel :

`patrimoine total = portefeuille + banque`

Cette valeur :
- est dérivée ;
- n'est pas une nouvelle ressource ;
- ne doit pas être persistée inutilement.

---

### R247 — Compte à rebours du prochain intérêt — ✅ VALIDÉ

L'écran Banque affiche un compte à rebours dynamique jusqu'au prochain calcul.

Ne pas afficher explicitement `00:00 Europe/Paris` dans l'UI.

Le scheduler serveur reste néanmoins basé sur 00:00 `Europe/Paris`.

---

### R248 — Solde Banque visible selon confidentialité — ✅ VALIDÉ

Le solde Banque peut apparaître sur le profil d'un autre joueur selon ses paramètres :
- Public ;
- Amis uniquement ;
- Privé.

Sécurité des données dérivées :
- si la Banque est masquée, ne pas afficher une valeur totale permettant de la reconstituer par soustraction.

---

### R249 — Compte à rebours uniquement UI — ✅ VALIDÉ

Le compte à rebours n'est pas ajouté au message Twitch `!banque`.

Twitch conserve :
- solde ;
- portefeuille ;
- taux/intérêt estimé ;
- syntaxes utiles.

---

### R250 — Sidebar : portefeuille seulement — ✅ VALIDÉ

La sidebar continue d'afficher le portefeuille Moras.

Ne pas afficher en permanence le solde Banque dans la sidebar.

L'accès à Banque se fait depuis un raccourci/zone Ressources appropriée.

---

### R251 — Formats de montant simples — ✅ VALIDÉ

Côté Twitch/chat :
- entier positif ;
- ou `max`.

Ne pas prendre en charge en V1 :
- `500k` ;
- `2m` ;
- décimales ;
- autres abréviations monétaires.

---

### R252 — Filtres Historique Banque — ✅ VALIDÉ

Dans l'Historique complet Banque, prévoir au minimum :
- Tous ;
- Dépôts ;
- Retraits ;
- Intérêts.

Des filtres temporels pourront être ajoutés plus tard si utiles.

---

### R253 — Solde résultant dans l'historique détaillé — ✅ VALIDÉ

Une entrée détaillée peut afficher le solde bancaire obtenu après l'opération.

Cette information est surtout utile :
- pour compréhension ;
- audit ;
- support.

L'historique récent de l'écran Banque peut rester plus compact.

---

### R254 — Renouvellement automatique du compte à rebours — ✅ VALIDÉ

Lorsque le compte à rebours atteint zéro :
- récupérer l'état serveur actualisé ;
- afficher le nouvel intérêt crédité dans l'historique ;
- mettre à jour le solde ;
- recalculer l'estimation suivante ;
- recommencer le compte à rebours.

Aucune notification/pop-up dédiée.

---

### R255 — Animation légère des transferts — ✅ VALIDÉ

Lors d'un dépôt/retrait dans l'UI :
- animer légèrement les compteurs ;
- rendre compréhensible le déplacement entre portefeuille et Banque ;
- éviter les animations lourdes ou pop-ups inutiles.

---

## 12. Règles techniques / migration finalisées

### Transferts

Dépôt/retrait :
- aucune taxe ;
- aucun cooldown ;
- aucun quota quotidien ;
- aucun plafond V1 ;
- transaction atomique ;
- aucun solde intermédiaire visible ;
- aucun impact sur `totalMorasEarned` / `totalMorasSpent`.

Les achats ordinaires ne débitent jamais automatiquement la Banque.

---

### Intérêt

Règle cible :
- 3 % quotidien ;
- scheduler serveur ;
- reset 00:00 `Europe/Paris` ;
- base exacte du solde au reset ;
- arrondi inférieur ;
- crédit directement en Banque ;
- incrément de `totalMorasEarned` ;
- joueur hors ligne inclus.

Si l'intérêt calculé est 0 :
- crédit 0 ;
- ne jamais fabriquer artificiellement 1 Mora.

---

### Historique standalone

À partir du cutover :
- conserver chaque dépôt ;
- chaque retrait ;
- chaque intérêt.

Une entrée peut conceptuellement contenir :
- type ;
- montant ;
- date serveur ;
- solde bancaire résultant ;
- cause/source technique utile.

Ne pas fabriquer d'historique bancaire legacy absent.

---

### Migration

Importer exactement :
- portefeuille `moras` ;
- `bank.moras` ;
- statistiques historiques économiques déjà présentes.

Ne pas recalculer rétroactivement d'intérêts manquants.

`bank.lastInterestDate` :
- peut être conservé comme provenance legacy ;
- ne pilote pas le futur scheduler.

Premier intérêt standalone :
- au prochain reset normal suivant le cutover.

Objectif :
- aucun double intérêt ;
- aucun intérêt rétroactif inventé ;
- aucun solde historique recalculé sans preuve.

L'import reste rerunnable/idempotent.

---

## 13. Dépendance Top / Classements — ✅ RÉSOLUE PAR R714/R715

Le legacy `!top moras` utilisait uniquement le portefeuille Moras.

La V1 utilise désormais :

`patrimoine Moras = portefeuille + banque`

pour le classement global Moras.

Ce patrimoine reste une donnée dérivée et non une nouvelle ressource persistée.

Confidentialité :

- seuls les joueurs dont les données nécessaires sont `Public` peuvent entrer dans le classement global ;
- le portefeuille/solde de monnaies doit être Public ;
- la Banque doit être Public ;
- si l'une des composantes est `Amis uniquement` ou `Privé`, le joueur est entièrement absent du classement ;
- un joueur absent ne consomme aucun rang ;
- aucune valeur dérivée ne permet de reconstruire un solde Banque non public.

La dépendance reportée du Domaine Banque est donc clôturée.

---

## 14. État final

R237 à R255 validées.

Cœur Banque finalisé :
- portefeuille / Banque ;
- dépôt ;
- retrait ;
- MAX ;
- intérêt automatique ;
- estimation ;
- scheduler ;
- historique ;
- confidentialité ;
- écran standalone ;
- message Twitch ;
- migration ;
- journalisation ;
- dépendance Top résolue par R714/R715.

**Domaine Banque : CLÔTURÉ.**
