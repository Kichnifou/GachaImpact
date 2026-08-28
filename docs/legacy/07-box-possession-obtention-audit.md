# GachaImpact — Audit legacy Domaine 4 : Box / Possessions / Obtention

Statut : AUDIT EN COURS — R117 À R143 VALIDÉS
Date : 2026-08-28

## 0. Périmètre réel du domaine

Sources legacy principales actuellement auditées :
- `Box.txt`
- `Obtention.txt`
- `Stella.txt`
- structure `box` de `viewers_data.json`
- `boxFavorites`
- options `boxSort` / `boxSortDescending`
- interactions déjà identifiées avec Gacha, Team, Expedition, Combat futur et Concours/C6.

Correction de périmètre :
- `Liste.txt` ne fait pas partie du domaine Box ;
- `!liste <élément>` liste des joueurs selon leur élément, pas leurs personnages possédés ;
- ce script sera réaudité plus tard dans un domaine utilitaire/social/joueurs.

Le domaine est donc renommé conceptuellement :
**Box / Possessions / Obtention**.

---

# 1. Source de vérité : catalogue vs possession

## R117 — Box et Personnages sont deux vues différentes — ✅ VALIDÉ

L'écran `Personnages` montre le catalogue global :
- tous les personnages connus et actifs ;
- possédés en affichage normal ;
- non possédés en affichage grisé ;
- recherche / filtres / tris ;
- intégrations futures comme le vote Gacha ou les Objectifs.

L'écran `Box` montre uniquement les personnages possédés et actifs côté joueur.

Les deux vues reposent sur les mêmes personnages du catalogue.

Données de catalogue :
- nom ;
- élément ;
- rareté ;
- artwork/assets ;
- arme ;
- région ;
- autres métadonnées propres au personnage.

Données de possession joueur/personnage :
- constellation ;
- copies ;
- date de première obtention ;
- favori ;
- futures statistiques personnelles du personnage.

Ne jamais dupliquer un même personnage en deux entités différentes uniquement parce qu'il apparaît dans Box et Personnages.

## R118 — Une seule possession par couple joueur/personnage — ✅ VALIDÉ

Un joueur possède au maximum une entrée de possession pour un personnage donné.

Conceptuellement :
`playerId + characterId` est unique.

Première acquisition :
- création de la possession.

Acquisitions suivantes :
- mise à jour de cette même possession.

---

# 2. Copies / constellation / Stella

## R119 — Une Stella compte comme une copie synthétique — ✅ VALIDÉ / BUG LEGACY À CORRIGER

Dans le système cible, utiliser une Masterless Stella Fortuna sur un personnage 5★ représente l'équivalent d'une nouvelle copie de ce personnage.

Conséquences :
- `copies +1` dans tous les cas où la Stella est effectivement consommée ;
- si `constellation < 6`, `constellation +1` ;
- si le passage atteint C6 sur un 5★, initialiser normalement son système Concours ;
- si le 5★ est déjà C6, `copies +1` et déclencher la progression Concours C6 correspondante.

Le legacy augmente actuellement la constellation sans augmenter `copies`.
Ce comportement est considéré comme une erreur à corriger.

Définitions cibles :
- `copies` = nombre de copies réelles ou équivalentes obtenues ;
- `constellation` = niveau réel actuel C0..C6.

Les deux données restent distinctes et autoritatives.

## R127 — Une Stella ne donne jamais le remboursement de doublon C6+ — ✅ VALIDÉ

Même si la Stella compte comme copie synthétique pour `copies` et la constellation/Concours :
- elle ne donne pas +160 Primogemmes sur un 5★ C6 ;
- elle n'émule pas le remboursement économique attaché à un doublon provenant d'un Pull.

Le remboursement C6+ reste une règle du Gacha / Pull.

## R128 — Stella réservée exclusivement aux 5★ — ✅ VALIDÉ / CHANGEMENT PAR RAPPORT AU LEGACY

Une Masterless Stella Fortuna ne peut être utilisée que sur un personnage 5★ possédé.

Refus :
- tout personnage 4★, quelle que soit sa constellation ;
- personnage non possédé ;
- autres conditions invalides.

Le legacy autorise actuellement une Stella sur un 4★ inférieur à C6.
Cette possibilité est supprimée dans GachaImpact.

## R129 — Refus si un 5★ C6 n'a plus aucune progression Concours possible — ✅ VALIDÉ

Si un 5★ est déjà C6 et que toutes ses statistiques Concours sont au maximum :
- l'utilisation de Stella est refusée avant toute consommation ;
- aucune Stella n'est perdue ;
- `copies` reste inchangé ;
- aucune compensation +100 000 Moras n'est accordée.

L'opération Stella cible doit être transactionnelle :
1. vérifier toutes les préconditions ;
2. seulement ensuite consommer la Stella ;
3. mettre à jour possession et progression Concours dans la même transaction.

---

# 3. Date de première obtention

## R120 — `firstObtainedAt` est la toute première acquisition — ✅ VALIDÉ

`firstObtainedAt` représente la première fois où le joueur est devenu propriétaire du personnage.

Cette date ne change jamais lors :
- d'un doublon ;
- d'une Stella ;
- d'une montée de constellation ;
- d'un doublon C6+.

Elle est consultable depuis la Box / fiche du personnage possédé.

## R135 — Date legacy inconnue : fallback au moment de la migration — ✅ VALIDÉ / EXCEPTION DE MIGRATION

Si une possession legacy n'a pas de `firstObtainedAt` valide :
- attribuer comme date de repli le timestamp du cutover/import de migration ;
- ne pas laisser la possession sans date.

Cette valeur est une approximation volontaire.

## R138 — Conserver la provenance interne de la date fallback — ✅ VALIDÉ

La migration doit permettre de distinguer :
- date historique legacy réelle ;
- date artificielle attribuée au moment de la migration.

Le nom de colonne/champ exact n'est pas figé.

L'UI n'est pas obligée d'exposer cette provenance au joueur.

---

# 4. Favoris

## R121 — Favoris réservés aux personnages possédés — ✅ VALIDÉ

Les favoris appartiennent uniquement à la Box.

Un personnage non possédé ne peut pas être marqué favori depuis l'écran `Personnages`.

Les favoris :
- sont visibles dans la Box ;
- ne sont pas affichés comme favoris dans l'écran catalogue `Personnages`.

## R122 — Pas de limite de favoris — ✅ VALIDÉ

Le joueur peut marquer autant de personnages possédés comme favoris qu'il le souhaite.

## R130 — Tous les favoris sont épinglés avant les non-favoris — ✅ VALIDÉ

Dans l'onglet `Tous`, la priorité globale est :
1. favoris 5★ ;
2. favoris 4★ ;
3. non-favoris 5★ ;
4. non-favoris 4★.

Un 4★ favori apparaît donc avant un 5★ non favori.

Le tri actif détermine l'ordre à l'intérieur de chaque groupe.

## R133 — Le favori est lié à la possession — ✅ VALIDÉ

Dans le futur modèle, le statut favori appartient conceptuellement à la relation joueur/personnage.

Un favori ne doit pas pouvoir exister sans possession correspondante.

Migration :
- favori legacy + possession valide → favori conservé ;
- ID de favori legacy orphelin → ne jamais créer une fausse possession ;
- signaler l'anomalie dans le rapport d'import.

## R137 — Priorité favoris dans tous les onglets Box — ✅ VALIDÉ

Onglet `Tous` :
- favoris d'abord ;
- non-favoris ensuite.

Onglet `5★` :
- favoris 5★ ;
- autres 5★.

Onglet `4★` :
- favoris 4★ ;
- autres 4★.

Toujours avec le tri actif à l'intérieur des groupes.

### Présentation Twitch `!box favoris`

Le comportement legacy côté Twitch reste indépendant de l'UI standalone.

`!box favoris` conserve son tri/format actuel, notamment alphabétique.

L'UI standalone utilise les nouvelles règles de favoris épinglés.

---

# 5. Tri / onglets / présentation Box

## R123 — Tri persistant, filtres temporaires — ✅ VALIDÉ

Tri mémorisé entre sessions :
- alphabétique ;
- date d'obtention ;
- constellation ;
- élément.

Pas de tri `copies` prévu actuellement.

Les filtres temporaires ne sont pas mémorisés entre sessions.

Dans l'onglet `Tous` :
- les 5★ sont avant les 4★ à l'intérieur de chacun des groupes favoris/non-favoris ;
- le tri actif s'applique séparément à chaque rareté.

## R136 — État initial Box — ✅ VALIDÉ

Pour un nouveau joueur / sans préférence enregistrée :
- onglet : `Tous` ;
- tri : alphabétique ascendant.

## R131 — L'onglet Tous / 5★ / 4★ n'est pas persistant — ✅ VALIDÉ

Les onglets sont considérés comme un filtre de consultation.

Si le joueur quitte la Box dans `4★`, puis revient plus tard :
- l'onglet revient sur `Tous` ;
- le tri précédemment choisi reste mémorisé.

## R124 — Pagination 5+5 réservée au chat/Twitch — ✅ VALIDÉ

Le comportement legacy `!box p1`, `p2`, etc. reste une optimisation de présentation Twitch/chat.

L'UI standalone :
- ne reproduit pas artificiellement ce 5+5 ;
- utilise une vraie grille ;
- onglets ;
- recherche ;
- filtres ;
- tri ;
- scroll/pagination UI selon besoin.

---

# 6. Fiche personnage possédé

## R125 — `!obtention` reste chat, la date est intégrée à la fiche UI — ✅ VALIDÉ

Twitch/chat :
- conserver `!obtention <personnage>`.

Standalone :
- afficher l'information directement dans la fiche du personnage possédé.

Exemples :
- date de première obtention ;
- constellation ;
- copies ;
- favori.

La fiche pourra plus tard recevoir des statistiques propres au personnage définies par d'autres domaines, par exemple Combat :
- plus gros dégâts infligés ;
- victoires ;
- défaites ;
- autres métriques à définir pendant l'audit Combat.

---

# 7. Données dérivées de la collection

## R126 — Compteurs de collection dérivés — ✅ VALIDÉ

Ne pas maintenir inutilement des compteurs redondants si la possession est source de vérité.

Conceptuellement :
- nombre de personnages possédés = nombre de possessions actives/visibles ;
- nombre de C6 = possessions actives avec constellation C6 ;
- total copies = somme des `copies` des possessions actives/visibles.

---

# 8. Désactivation / archivage d'un personnage

## R134 — Personnage désactivé = totalement invisible et inutilisable côté joueur — ✅ VALIDÉ

Un personnage désactivé est considéré, côté expérience joueur, comme s'il n'existait plus dans le jeu.

Il doit être :
- invisible dans Personnages ;
- invisible dans Box ;
- inutilisable en Team ;
- sans passif actif ;
- inutilisable en Expedition ;
- inutilisable en Combat ;
- absent des votes ;
- absent des bannières ;
- absent des fiches player-facing et autres usages.

Les données historiques et relations existantes restent conservées côté serveur/admin.

## R139 — Désactivation : retirer le personnage des Teams — ✅ VALIDÉ

Lorsqu'un personnage est désactivé :
- le retirer de la Team active des joueurs ;
- le retirer également des teams sauvegardées concernées ;
- il ne revient pas automatiquement dans ces compositions s'il est réactivé plus tard.

## R140 — Désactivation pendant une Expedition active — ✅ VALIDÉ

Si un personnage est désactivé pendant son Expedition :
- annuler immédiatement cette Expedition ;
- aucune récompense ;
- la tentative quotidienne du joueur n'est pas consommée ;
- le joueur peut choisir un autre personnage.

## R141 — Historiques : placeholder pour personnage désactivé — ✅ VALIDÉ

Les anciennes lignes d'historique ne doivent pas être supprimées.

Côté joueur :
- remplacer l'identité visuelle/nom du personnage désactivé par un placeholder du type `Personnage indisponible`.

Côté serveur/Admin :
- conserver l'ID réel et la relation historique.

## R142 — Statistiques visibles excluent les personnages désactivés — ✅ VALIDÉ

Les statistiques player-facing de collection tiennent uniquement compte des personnages actifs/visibles.

Lors d'une désactivation :
- ces valeurs diminuent automatiquement car elles sont dérivées.

Lors d'une réactivation :
- elles reviennent automatiquement.

---

# 9. Migration / cutover de la Box

## R132 — Réparer seulement le minimum certain de `copies` — ✅ VALIDÉ

Au cutover :

`copiesCible = max(copiesLegacy, constellation + 1)`

Exemple :
- legacy : C4 / copies 3 ;
- cible : C4 / copies 5.

Ne jamais reconstruire des copies supplémentaires au-delà du minimum mathématiquement certain.

## R143 — Possession sans personnage catalogue : conserver mais masquer — ✅ VALIDÉ

Si une possession legacy référence un `characterId` introuvable dans le catalogue :
- ne jamais supprimer la possession ;
- conserver ses données dans l'import ;
- la considérer comme possession non résolue ;
- la masquer côté joueur ;
- la signaler dans le rapport de migration/Admin.

Si le personnage est retrouvé/corrigé plus tard :
- rattacher la possession à son catalogue au lieu de la recréer.

---

# 10. Idée future : système d'Objectifs

Direction à conserver pour un futur domaine transversal.

Un joueur pourra définir des objectifs personnels dans plusieurs catégories.

Exemples :
- obtenir un personnage précis depuis l'écran Personnages ;
- atteindre X Moras ;
- choisir si un objectif Moras inclut ou non la Banque ;
- atteindre X Primogemmes ;
- autres catégories à définir plus tard.

UX envisagée :
- écran `Objectifs` dédié ;
- un personnage objectif présent en bannière peut afficher une petite indication discrète, par exemple 🎯 ;
- lorsqu'un objectif est atteint, il est automatiquement considéré comme terminé/retiré ;
- notification possible lors de l'accomplissement.

La liste exacte des objectifs et leur historique éventuel seront définis plus tard.

---

# 11. Corrections / anomalies legacy déjà identifiées

1. `Liste.txt` était mal classé dans le domaine Box :
   - il liste des joueurs par élément ;
   - à reporter dans un domaine utilitaire/social.

2. `Stella.txt` :
   - n'incrémente pas `copies` ;
   - autorise actuellement les 4★ sous C6 ;
   - peut consommer une Stella avant de découvrir qu'une progression C6 est impossible ;
   - doit être remplacé par une opération transactionnelle selon R119/R127/R128/R129.

3. Favoris legacy :
   - stockés séparément dans `boxFavorites` ;
   - cible : propriété/relation cohérente de possession.

4. Dates d'obtention manquantes :
   - cible migration : fallback au timestamp de cutover selon R135/R138.

5. Possession sans personnage catalogue :
   - cible : conserver et signaler, jamais supprimer.

---

# 12. État des décisions

R117 à R143 validées.

---

# 13. Audit restant du domaine

Prochaine passe :
- vérifier les données legacy Box sur plusieurs profils ;
- rechercher constellation hors bornes ;
- rechercher copies nulles/0/négatives ou inférieures au minimum possible ;
- vérifier doublons de `characterId` et clés de Box incohérentes ;
- vérifier `boxFavorites` invalides/orphelins ;
- détailler les règles de migration de chaque anomalie certaine ;
- vérifier les dépendances Team / Expedition / Stella autour de la possession ;
- déterminer les dernières informations de fiche Box réellement possédées par ce domaine ;
- vérifier si d'autres scripts mutent directement la Box et doivent utiliser un futur service central de possession.

Ne pas figer le schéma SQL exact avant la fin de cette passe.
