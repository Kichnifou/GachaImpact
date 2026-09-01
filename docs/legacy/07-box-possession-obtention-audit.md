# GachaImpact — Audit legacy Domaine 4 : Box / Possessions / Obtention

Statut : CLÔTURÉ — R117 À R176 VALIDÉS
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

### Complément transverse Expedition — R346 / R349 / R357

Le Domaine Expedition ajoute une exception temporaire aux priorités normales de la Box.

Personnage actuellement en expédition :
- reste à sa position normale ;
- les favoris et le tri continuent de s'appliquer normalement ;
- affiche un badge discret du type `🧭 En expédition`.

Personnage dont les 20 heures sont terminées mais dont la récompense n'a pas encore été récupérée :
- reçoit temporairement la priorité la plus haute de la Box ;
- apparaît avant les favoris ;
- affiche un badge du type `✅ À récupérer`.

Cette priorité spéciale :
- ne modifie pas la préférence de tri enregistrée ;
- ne modifie pas le statut favori ;
- ne contourne pas les onglets, filtres ou recherches ;
- disparaît immédiatement après récupération.

Après récupération :
- le personnage retourne automatiquement à sa position normale selon favoris, rareté et tri actif.

La fiche d'un personnage possédé peut proposer `Envoyer en expédition` uniquement lorsqu'un départ est actuellement autorisé.

La fiche du personnage revenu propose `Récupérer l'expédition`.

La Box publique d'un autre joueur :
- n'expose pas l'état Expedition ;
- n'affiche aucun timer Expedition ;
- n'applique pas la priorité temporaire Expedition ;
- n'affiche aucune action Expedition.

La mécanique détaillée est autoritative dans :
`docs/legacy/12-expedition-audit.md`.

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

# 12. Deuxième passe — migration / invariants / service de possession

## R144 — `characterId` récupérable depuis la clé legacy — ✅ VALIDÉ

Si :
- `characterId` est absent ou invalide ;
- la clé numérique de la Box correspond sans ambiguïté à un personnage valide ;

alors l'importer utilise cette clé comme `characterId`.

Journaliser la récupération dans le rapport de migration.

---

## R145 — Constellation hors bornes — ✅ VALIDÉ

Invariant cible :

`0 <= constellation <= 6`

Migration :
- valeur < 0 → 0 ;
- valeur > 6 → 6 ;
- journaliser la correction ;
- appliquer ensuite la règle de cohérence des copies.

Il n'existe jamais de C7.

---

## R146 — Plusieurs possessions legacy pour le même personnage — ✅ VALIDÉ

Si plusieurs entrées legacy représentent sans ambiguïté le même personnage, fusion conservatrice :

- constellation = valeur valide maximale ;
- copies = valeur maximale, jamais la somme ;
- appliquer ensuite le minimum `constellation + 1` ;
- `firstObtainedAt` = plus ancienne date valide ;
- favori = vrai si au moins une source legacy l'indique.

Journaliser la fusion.

Ne jamais additionner aveuglément les copies.

---

## R147 — Clé Box et `characterId` contradictoires — ✅ VALIDÉ

Si :
- la clé Box est un ID valide ;
- `characterId` est également un ID valide ;
- les deux désignent deux personnages différents ;

ne pas arbitrer automatiquement.

La possession :
- est conservée comme anomalie ;
- reste masquée côté joueur ;
- est signalée dans le rapport Admin/import ;
- conserve les données legacy brutes pour résolution.

---

## R148 — `copies` absentes / nulles / 0 / négatives / invalides — ✅ VALIDÉ

Une valeur legacy invalide est considérée comme 0 pour la réparation.

Puis :

`copiesCible = max(0, constellationCorrigée + 1)`

Aucune possession valide migrée ne peut donc avoir `copies < 1`.

---

## R149 — Entrée Box illisible — ✅ VALIDÉ

Si une entrée Box n'est pas un objet exploitable :
- ne pas créer une possession artificielle ;
- ne pas supprimer silencieusement l'information source ;
- enregistrer joueur, clé et valeur brute dans le rapport d'anomalies.

---

## R150 — Service central de possession personnage — ✅ VALIDÉ

Prévoir une logique métier centrale conceptuelle de type `CharacterOwnershipService`.

Responsabilités fondamentales :
- unicité joueur/personnage ;
- création d'une première possession ;
- `firstObtainedAt` ;
- `copies` ;
- constellation C0..C6 ;
- favori ;
- validation de l'existence/activité du personnage ;
- cohérence fondamentale de la possession.

Producteurs autorisés :
- Gacha/Pull ;
- Stella ;
- Admin ;
- futures récompenses explicitement prévues.

Les autres domaines ne modifient pas directement `copies`, `constellation` ou `firstObtainedAt`.

Team, Expedition, Combat, Infos, Stats, etc. sont consommateurs de la possession.

---

## R151 — Préférences de tri legacy invalides — ✅ VALIDÉ

Valeurs de tri legacy valides :
- `a` ;
- `d` ;
- `c` ;
- `e`.

Valeur absente/invalide :
- fallback alphabétique.

`boxSortDescending` absent/invalide :
- fallback `false`.

État de repli :
`Alphabétique ↑`.

---

## R152 — Favori conservé intérieurement pendant une désactivation — ✅ VALIDÉ

Lorsqu'un personnage favori est désactivé :
- son statut favori peut rester conservé côté serveur ;
- absolument rien concernant ce personnage ne doit être affiché côté joueur tant qu'il est désactivé.

S'il est réactivé :
- il peut retrouver son statut favori historique.

---

## R153 — Matching de `!box favoris` — ✅ VALIDÉ

Cible GachaImpact côté Twitch/chat :
- normalisation casse/accents ;
- correspondance exacte du nom normalisé ;
- pas de nom partiel ;
- pas de fuzzy matching.

L'UI utilise directement l'action favorite sur la carte.

Correction par rapport au legacy :
- le legacy essaie d'abord le nom exact puis accepte également un premier nom contenant le texte saisi ;
- ce fallback partiel n'est volontairement pas conservé dans GachaImpact.

---

## R154 — `!box 6` = constellation C6 — ✅ VALIDÉ

`!box 6` signifie :
- personnages dont la constellation actuelle est C6.

Il n'existe pas de C7.

Un personnage C6 avec 7, 20 ou 50 copies reste :
- C6 ;
- visible dans le filtre C6.

---

## R155 — Réactivation d'un personnage — ✅ VALIDÉ

Lorsqu'un personnage désactivé est réactivé :
- sa possession historique réapparaît automatiquement ;
- constellation conservée ;
- copies conservées ;
- première obtention conservée ;
- favori interne conservé.

Ne pas recréer une possession C0.

Ne pas restaurer automatiquement :
- ancienne Team active ;
- anciennes teams sauvegardées ;
- Expedition annulée.

---

## R156 — Permanence des possessions — ✅ VALIDÉ

Une mécanique normale de gameplay ne supprime jamais un personnage possédé.

Pas de :
- vente de personnage ;
- sacrifice ;
- échange de personnage ;
- suppression volontaire de la Box.

Exceptions uniquement :
- correction Admin exceptionnelle ;
- désactivation globale, qui masque mais ne détruit pas la possession.

---

# 13. Deuxième passe — UX Box / consultation publique

## R157 — Filtre constellation complet — ✅ VALIDÉ

Dans l'UI Box, permettre de filtrer par :

- Toutes ;
- C0 ;
- C1 ;
- C2 ;
- C3 ;
- C4 ;
- C5 ;
- C6.

Les filtres sont combinables avec :
- onglet Tous / 5★ / 4★ ;
- élément ;
- recherche ;
- tri.

---

## R158 — Copies absentes des cartes Box — ✅ VALIDÉ

Le nombre de copies n'est pas affiché directement sur les cartes de la grille.

Les cartes restent centrées sur les informations visuellement utiles :
- personnage ;
- rareté ;
- élément ;
- constellation ;
- favori pour la Box personnelle.

`copies` reste disponible dans la fiche détaillée.

---

## R159 — Favori UI en un clic — ✅ VALIDÉ

Dans la Box personnelle :
- étoile directement accessible sur la carte ;
- clic = ajout/retrait immédiat ;
- aucune confirmation ;
- l'ordre de la Box se met à jour immédiatement selon les règles de favoris.

---

## R160 — Box d'un autre joueur publiquement consultable — ✅ VALIDÉ

La Box fait partie du profil consultable d'un autre joueur, sous réserve des futures règles de confidentialité.

Elle reste consultable même si le propriétaire est hors ligne.

---

## R161 — Fiche publique détaillée — ✅ VALIDÉ

Lorsqu'un visiteur possède l'autorisation de consulter une Box, il peut ouvrir une fiche détaillée raisonnable.

Informations possibles :
- personnage ;
- rareté ;
- élément ;
- constellation ;
- copies ;
- première date d'obtention ;
- favori Oui/Non ;
- futures statistiques propres au personnage définies par les autres domaines, par exemple Combat.

---

## R162 — Favori public uniquement dans la fiche — ✅ VALIDÉ

Dans une Box publique :
- ne pas afficher d'étoile favorite sur les cartes ;
- la fiche détaillée peut afficher explicitement `Favoris : Oui/Non`.

---

## R163 — Les favoris ne modifient pas l'ordre d'une Box publique — ✅ VALIDÉ

La priorité favorite est propre à la Box personnelle.

Dans la Box publique d'un autre joueur :
- ne pas regrouper ses favoris en haut ;
- le statut favorite n'influence pas le tri ;
- il reste consultable uniquement dans la fiche si la confidentialité l'autorise.

---

### Consultation publique — état temporaire

À chaque ouverture d'une Box publique :

- onglet `Tous` ;
- tri `Alphabétique ↑` ;
- aucun filtre.

Les changements de tri/filtres effectués par le visiteur :
- sont temporaires ;
- n'affectent jamais les préférences du propriétaire ;
- sont réinitialisés lors d'une nouvelle ouverture de la Box.

---

## R165 — Onglet Box conservé même si vide — ✅ VALIDÉ

Un profil conserve son onglet/section Box même sans personnage visible.

Afficher un état vide graphique cohérent avec l'interface.

Éviter les emojis décoratifs de type Twitch dans l'UI finale.

---

## R166 — Résumé de collection — ✅ VALIDÉ

Afficher discrètement en haut de la Box :

- total de personnages actifs/visibles ;
- nombre de 5★ ;
- nombre de 4★ ;
- nombre de C6.

Ne pas afficher le total de copies dans ce résumé.

Ces statistiques concernent la collection entière, pas uniquement le résultat des filtres courants.

---

## R167 — Fiche personnage commune Box / Personnages — ✅ VALIDÉ

Utiliser une fiche personnage commune plutôt que deux systèmes divergents.

Informations catalogue communes :
- nom ;
- rareté ;
- élément ;
- arme ;
- région ;
- assets ;
- autres métadonnées.

Si le personnage est possédé, ajouter la section de possession :
- constellation ;
- copies ;
- première obtention ;
- favori ;
- statistiques personnelles futures.

---

## R168 — Filtres UI combinables — ✅ VALIDÉ

L'UI peut combiner simultanément :
- onglet de rareté ;
- élément ;
- constellation ;
- recherche ;
- tri.

Cette logique vaut pour :
- Box personnelle ;
- Box publique autorisée.

---

## R169 — Box consultable hors ligne — ✅ VALIDÉ

La disponibilité d'une Box publique ne dépend pas de la présence en ligne du propriétaire.

---

## R170 — Confidentialité configurable — ✅ VALIDÉ

Direction transversale :
- informations publiques par défaut ;
- futur écran `Paramètres` ;
- onglet `Confidentialité`.

Un joueur pourra choisir selon les catégories :
- `Public` ;
- `Amis uniquement` ;
- `Privé`.

La Box doit respecter ces permissions.

---

## R171 — Copies visibles dans la fiche détaillée — ✅ VALIDÉ

`copies` reste absent des cartes de grille mais apparaît dans la fiche détaillée au même titre que :
- constellation ;
- favori ;
- première obtention.

---

## R172 — Confidentialité transversale — ✅ VALIDÉ

La confidentialité ne concerne pas uniquement la Box.

Le futur système doit pouvoir protéger différentes catégories de données joueur.

Les permissions doivent être appliquées côté serveur, jamais uniquement dans React.

Un appel API direct ne doit pas contourner un réglage privé.

---

## R173 — Confidentialité potentiellement granulaire — ✅ VALIDÉ

Le système doit être capable à terme de protéger des sous-informations distinctes.

Exemples conceptuels :
- Box ;
- date d'obtention ;
- favori ;
- copies ;
- statistiques Combat ;
- ressources ;
- autres catégories futures.

La V1 pourra volontairement exposer un nombre plus réduit de réglages simples.

Ne pas obliger l'UI initiale à proposer des dizaines d'options.

---

## R174 — Section inaccessible conservée avec état de confidentialité — ✅ VALIDÉ

Si une Box ou une autre section est inaccessible :
- conserver l'onglet/la section dans le profil ;
- afficher un état indiquant qu'elle est privée ou réservée aux amis.

Ne pas masquer totalement la fonctionnalité.

Cela distingue clairement :
- Box vide ;
- Box privée ;
- Box amis uniquement.

---

# 14. Décisions techniques prises directement pendant la passe

Conformément à la délégation validée pour les micro-décisions techniques :

- une nouvelle possession commence avec `favorite = false` ;
- les anomalies de migration rares sont journalisées plutôt que silencieusement supprimées ;
- une anomalie d'un joueur ne doit pas bloquer l'import complet des autres possessions valides ;
- les possessions désactivées/non résolues sont filtrées centralement ;
- les compteurs visibles utilisent uniquement les personnages actifs et résolus ;
- les permissions de confidentialité sont vérifiées côté serveur ;
- les filtres publics ne modifient jamais les préférences du propriétaire ;
- Pull, Stella, Admin et futures récompenses autorisées utilisent le service central de possession ;
- les consommateurs comme Team, Expedition ou Combat ne réécrivent pas eux-mêmes les données fondamentales de possession.

Ces choix sont techniques et ne modifient pas le gameplay validé.

---

# 15. Dernières décisions Stella

## R175 — Saisie sécurisée de `!stella` — ✅ VALIDÉ

Côté Twitch/chat, une Stella cible un personnage par son nom exact après normalisation casse/accents.

Autorisé :
- `!stella Skirk`
- variante équivalente après normalisation des accents/casse.

Refusé :
- nom partiel ;
- fuzzy matching ;
- ID technique du personnage.

L'UI sélectionne explicitement le personnage et n'utilise jamais un ID technique visible comme saisie joueur.

Correction par rapport au legacy :
- le legacy accepte actuellement un ID numérique ;
- puis un nom exact ;
- puis un premier nom contenant le texte saisi.

Ces comportements approximatifs/techniques ne sont pas conservés.

---

## R176 — Confirmation UI avant consommation d'une Stella — ✅ VALIDÉ

Twitch/chat :
- la commande explicite `!stella <nom exact>` effectue directement l'action après validation métier.

Standalone :
- demander confirmation avant de consommer la Stella.

Sous C6, la confirmation peut présenter notamment :
- personnage ;
- constellation actuelle → future constellation ;
- copies actuelles → futures copies.

Pour un 5★ déjà C6 :
- indiquer qu'une statistique Concours éligible recevra +1.

La confirmation ne remplace jamais les validations serveur.

L'emplacement final de l'action Stella dans l'UI sera défini avec le domaine Sac / Inventaire.

---

# 16. Vérification finale croisée

Scripts relus :
- `Box.txt` ;
- `Obtention.txt` ;
- `Stella.txt` ;
- `Pull.txt` pour la création/modification de possession ;
- `Infos.txt` pour la consultation publique ;
- consommateurs principaux tels que Team, Expedition et XP.

Constats finaux :
- `Pull` crée une nouvelle possession puis augmente copies/constellation sur les doublons ;
- `Stella` est un mutateur de possession dont plusieurs comportements legacy ont été explicitement corrigés ;
- `Box` gère principalement consultation, favoris et préférences de tri ;
- `Obtention` ne modifie aucune possession ;
- `Infos` consulte la Box ;
- Team / Expedition / Combat / Stats / Concours sont consommateurs des données de possession selon leurs domaines respectifs ;
- aucun autre mutateur métier majeur de possession n'a été identifié pendant cette passe.

Architecture cible :
- toutes les mutations fondamentales de possession passent par le futur service central de possession ;
- les consommateurs ne modifient jamais directement `copies`, `constellation` ou `firstObtainedAt`.

Les détails SQL exacts restent réservés à la Phase 2.

---

# 17. État final du domaine

Décisions :
- R117 à R126 : modèle possession, Box, favoris, tris, fiche et données dérivées ;
- R127 à R143 : Stella, désactivation, migration et interactions possession ;
- R144 à R156 : anomalies legacy, service central, permanence et réactivation ;
- R157 à R169 : UX Box personnelle/publique, filtres, fiche commune et consultation sociale ;
- R170 à R174 : confidentialité transversale ;
- R175/R176 : saisie sécurisée et confirmation Stella.

Corrections legacy principales :
- Stella augmente désormais `copies` ;
- Stella réservée aux 5★ ;
- Stella refusée avant consommation si progression C6 impossible ;
- pas de remboursement Primogemmes C6+ via Stella ;
- `!stella` n'accepte plus ID ou nom partiel ;
- `!box favoris` cible un nom exact normalisé ;
- constellations bornées C0..C6 ;
- anomalies de migration traitées explicitement plutôt qu'ignorées silencieusement ;
- possessions non résolues conservées et mises en quarantaine ;
- personnage désactivé totalement absent de l'expérience joueur sans destruction historique.

Dépendances reportées :
- règles Team → domaine Team ;
- règles Expedition → domaine Expedition ;
- statistiques Combat → domaine Combat ;
- progression Concours détaillée → domaine Concours/C6 ;
- emplacement/gestion complète des Stella dans l'inventaire → domaine Sac / Inventaire ;
- granularité finale confidentialité → domaine Paramètres / Social ;
- SQL exact → Phase 2.

**Domaine Box / Possessions / Obtention : CLÔTURÉ.**