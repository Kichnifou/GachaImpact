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

## 11. Points UX / commandes restant à décider

Première passe :
- raccourcis MAX côté UI ;
- éventuel `max` côté Twitch/chat ;
- présentation de l'écran Banque ;
- affichage du prochain reset/intérêt estimé ;
- historique visible des opérations bancaires ;
- messages Twitch/chat cibles ;
- exposition du solde bancaire dans le profil sous le système de confidentialité déjà validé.

---

## 12. État

Domaine ouvert.

Aucune nouvelle décision R237+ n'est encore inscrite dans ce document.
