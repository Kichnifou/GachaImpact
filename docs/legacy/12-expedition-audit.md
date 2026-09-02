# 12 — Audit legacy Expedition

Statut : CLÔTURÉ — R340 À R369 VALIDÉS / DÉRIVÉS
Date : 2026-09-01

## 1. Périmètre

Domaine audité :
- commande `!expedition` ;
- départ quotidien ;
- durée / état temporel ;
- personnage envoyé ;
- récupération manuelle ;
- récompense ;
- statistiques Expedition ;
- interaction Missions ;
- intégration Box ;
- intégration au futur écran transversal `Quotidiennes` ;
- notifications ;
- migration/cutover ;
- Twitch / chat interne / UI.

Ne pas redécider les règles déjà validées dans Box, Ressources, Missions, Team ou Notifications.

---

## 2. Sources legacy principales

### Code
- `legacy/streamerbot/commands/Expedition.txt`

### Données / consommateurs connexes
- `legacy/streamerbot/data/viewers_data.json`
- `legacy/streamerbot/commands/XP.txt`
- `legacy/streamerbot/commands/Missions.txt`
- `legacy/streamerbot/commands/Daily.txt`

### Documents transverses à respecter
- `docs/legacy/05-element-resources-audit.md`
- `docs/legacy/07-box-possession-obtention-audit.md`
- `docs/legacy/11-missions-daily-audit.md`
- `docs/specifications/decisions-log.md`

---

## 3. Réalité du legacy

Le vrai `Expedition.txt` gère une seule expédition active par joueur.

Départ :
- commande `!expedition <NomPersonnage>` ;
- le personnage doit être possédé ;
- une seule nouvelle expédition peut être lancée par date civile ;
- le script stocke l'état dans `viewer["expedition"]`.

État legacy observé :
- `active`
- `characterId`
- `characterName`
- `element`
- `startedAt`
- `readyAt`
- `lastStartedDate`

Durée :
- 20 heures.

Tant qu'une expédition est active :
- aucune autre expédition ne peut être lancée ;
- le script affiche le temps restant si nécessaire.

Récupération :
- `!expedition retour`
- ou `!expedition <NomDuPersonnageDéjàEnvoyé>`.

La récupération n'est possible qu'après `readyAt`.

Important :
le personnage envoyé n'est pas retiré de la Team, n'est pas rendu indisponible dans les autres systèmes et n'est pas verrouillé par le script Expedition.

---

## 4. Récompenses legacy réelles

Le code réel utilise un jet uniforme de 1 à 10 :

- roll 1 → 1 600 Primogemmes = 10 % ;
- rolls 2 à 4 → 800 particules = 30 % ;
- rolls 5 à 10 → 30 000 Moras = 60 %.

Legacy :
- les particules utilisent l'élément du personnage envoyé ;
- les Primogemmes incrémentent `totalPrimosEarned` ;
- les Moras incrémentent `totalMorasEarned` ;
- les particules incrémentent `totalMainElementParticlesEarned` uniquement si leur élément correspond à l'élément personnel du joueur.

La cible standalone modifie la règle de l'élément des particules selon R344.

---

## 5. Statistique de complétion legacy

Au retour réussi :
1. récompense attribuée ;
2. `totalExpeditionsCompleted +1` ;
3. état Expedition réinitialisé.

Le simple départ ne compte donc pas comme une expédition terminée.

Le simple passage de `readyAt` ne compte pas non plus dans le legacy.

Cette intention est conservée et clarifiée par R362.

---

## 6. Frontière avec Missions

Le Domaine Missions est clôturé.

La mission permanente Expedition repose sur l'événement autoritatif correspondant à une expédition réellement récupérée avec succès.

Expedition produit l'événement métier.

`MissionService` :
- consomme cet événement ;
- fait progresser la mission permanente concernée ;
- ne réimplémente jamais le calcul temporel ou le tirage Expedition.

---

## 7. Règles Box déjà acquises avant ce domaine

Le Domaine Box avait déjà fixé :
- seuls les personnages possédés et actifs sont utilisables ;
- un personnage désactivé est invisible et inutilisable ;
- une désactivation administrative pendant une Expedition active annule immédiatement l'Expedition ;
- cette annulation ne donne aucune récompense ;
- cette annulation ne consomme pas la tentative quotidienne ;
- le joueur peut alors choisir un autre personnage.

Ces règles restent prioritaires.

---

# 8. Décisions standalone validées — R340 à R369

## R340 — Durée

Conserver une durée d'expédition de :
- 20 heures.

`readyAt` est calculé côté serveur.

Aucun timer navigateur n'est autoritatif.

## R341 — Un départ par journée serveur

Conserver :
- un nouveau départ maximum par journée serveur ;
- reset de la possibilité de départ à 00:00 `Europe/Paris`.

La limite porte sur le départ, pas sur la récupération.

Les départs manqués ne se cumulent pas.

## R342 — Récupération manuelle

Après 20 heures, l'expédition ne donne pas automatiquement sa récompense.

État :
- avant `readyAt` → en cours ;
- après `readyAt` → prête à récupérer.

Le joueur doit effectuer une vraie action de récupération :
- bouton depuis la fiche du personnage dans la Box ;
- `!expedition retour` ;
- ou syntaxe texte de compatibilité conservée selon R347.

La récompense et `totalExpeditionsCompleted` ne sont déclenchés qu'à cette récupération réussie.

Aucune notification Twitch asynchrone n'est envoyée.

## R343 — Récompenses V1

Conserver pour la V1 :
- 10 % → 1 600 Primogemmes ;
- 30 % → 800 particules ;
- 60 % → 30 000 Moras.

Ces valeurs pourront être revues uniquement lors d'un équilibrage économique global.

## R344 — Élément des particules

Changement par rapport au legacy :

Les 800 particules obtenues par Expedition sont toujours :
- les particules de l'élément personnel du joueur.

Elles ne dépendent plus de l'élément du personnage envoyé.

Conséquence :
- ce gain alimente toujours le compteur autoritatif des particules principales gagnées ;
- le personnage choisi n'a pas d'impact économique sur le type de particules reçu.

## R345 — Le personnage reste utilisable

Un personnage en Expedition ne devient pas indisponible.

Il peut continuer à être :
- dans la Team active ;
- dans une Team sauvegardée ;
- utilisé en Combat ;
- utilisé par les autres systèmes qui l'autorisent ;
- bénéficiaire/producteur de passifs selon leurs propres règles.

Expedition ne crée aucun verrou global sur la possession.

## R346 — Sélection et intégration dans la Box

Il n'existe pas de picker Expedition séparé reproduisant la Box.

Le workflow standalone principal passe directement par la vraie Box.

Pour démarrer :
1. ouvrir la Box ;
2. cliquer un personnage possédé et actif ;
3. ouvrir sa fiche ;
4. cliquer `Envoyer en expédition`.

La fiche d'un autre personnage n'affiche pas d'action Expedition lorsque :
- une Expedition est déjà active ;
- ou le départ de la journée a déjà été consommé.

Le hub `Quotidiennes` redirige vers la vraie Box.

Si l'architecture frontend permet de réutiliser exactement le même composant Box dans une modale/drawer sans dupliquer écran ni logique, cette présentation est autorisée.

Sinon :
- navigation/deep-link vers la Box.

Ne jamais créer une deuxième implémentation fonctionnelle de la Box uniquement pour Expedition.

### Priorité temporaire dans la Box

Pendant les 20 heures :
- le personnage reste à sa position normale selon favoris + tri.

Lorsque `readyAt` est atteint et que la récompense n'est pas encore récupérée :
- le personnage reçoit une priorité temporaire supérieure à toutes les priorités normales ;
- il est affiché avant les favoris.

Cette priorité temporaire respecte malgré tout les filtres :
- un 4★ n'apparaît pas dans l'onglet 5★ ;
- un personnage exclu par une recherche ne force pas son apparition ;
- l'ordre spécial s'applique uniquement à l'intérieur des résultats où le personnage doit normalement apparaître.

Après récupération :
- la priorité temporaire disparaît ;
- le personnage reprend immédiatement sa position normale selon favoris, rareté et tri actif.

## R347 — Syntaxes texte de récupération

Conserver les deux possibilités legacy de récupération :
- `!expedition retour`
- `!expedition <NomDuPersonnageEnvoyé>`

Démarrage :
- `!expedition <NomPersonnage>` lorsqu'aucune Expedition n'est active.

Le helper recommandé peut continuer à privilégier la syntaxe la plus claire sans retirer la compatibilité de récupération par nom.

## R348 — Aucun écran Expedition dédié / écran Quotidiennes transversal

Ne pas créer d'écran standalone `Expedition`.

Expedition vit principalement dans :
- la Box ;
- la fiche du personnage ;
- le hub transversal `Quotidiennes`.

Créer un véritable écran `Quotidiennes` distinct de Missions.

Ce hub regroupe les activités quotidiennes et offre pour chacune un bouton `Accéder` vers son véritable écran propriétaire.

Direction actuelle :
- Roue → écran Roue ;
- Combat → écran Combat ;
- Expedition → Box ;
- Ami cœur → liste d'amis ;
- Event → écran Event ;
- Shop → Boutique ;
- autres activités quotidiennes futures pertinentes → écran propriétaire correspondant.

Le hub affiche l'état réel du jour mais ne duplique jamais la logique métier des domaines.

Cette décision remplace la partie de R299 qui plaçait le suivi quotidien général dans l'onglet Quotidienne de Missions.

L'écran Missions conserve :
- onglet `Quotidienne` = mission quotidienne payante ;
- onglet `Permanentes` = B/A/S/Z.

`!quotis` devient l'équivalent texte compact du hub `Quotidiennes`.

### Direction Social à recroiser plus tard

Pour `Ami cœur`, direction UX à conserver pour l'audit Ami/Social :
- liste d'amis ;
- icône cœur par ami ;
- clic → cœur rouge ;
- feedback temporaire `Cœur envoyé !` ;
- cœur reste rouge jusqu'au reset ;
- bouton global pour envoyer à tous.

Les edge cases métier seront fixés dans le Domaine Ami/Social.

## R349 — État Expedition privé dans la Box

La Box publique d'un autre joueur ne révèle pas l'état Expedition.

Dans la Box du propriétaire :
- badges Expedition ;
- priorité temporaire du personnage prêt ;
- actions Envoyer/Récupérer ;
- timer restant.

Dans une Box publique :
- tri normal ;
- aucune action Expedition ;
- aucune priorité Expedition ;
- aucun timer Expedition requis.

## R350 — Statut quotidien accompli au départ

Dans le hub `Quotidiennes`, Expedition est considérée comme effectuée pour la journée dès qu'un départ valide est lancé.

La récupération ultérieure est une action nécessaire pour obtenir la récompense, mais ne détermine pas si le départ quotidien a été effectué.

Une occasion de départ non utilisée est perdue au changement de journée.

Aucun cumul de tentatives quotidiennes.

## R351 — Une Expedition prête bloque un nouveau départ

Tant qu'une Expedition n'a pas été récupérée :
- elle reste l'unique Expedition active ;
- un nouveau départ est impossible, même si `readyAt` est passé.

Le joueur doit d'abord récupérer l'expédition prête.

## R352 — Tirage au moment de la récupération

Le résultat aléatoire n'est pas pré-tiré au départ.

Flux :
`départ → attente 20h → prête → récupération → tirage serveur → récompense`.

Le tirage est effectué une seule fois côté serveur pendant la transaction de récupération.

Retry, double clic ou concurrence UI/Twitch ne peuvent jamais produire plusieurs résultats.

## R353 — Migration d'une Expedition active

Lors du cutover, préserver une Expedition legacy active si ses données sont suffisamment certaines.

Importer notamment :
- personnage ;
- `startedAt` ;
- `readyAt` ;
- date du dernier départ.

Si `readyAt` est déjà dépassé au moment de la migration :
- état cible = prête à récupérer ;
- aucune récompense automatique ;
- priorité Box appliquée ;
- récupération normale nécessaire.

Si le personnage est invalide/désactivé :
- appliquer la règle Box déjà validée d'annulation ;
- aucune récompense ;
- tentative quotidienne non consommée.

Ne jamais déclencher une récompense simplement parce que l'import charge une Expedition.

## R354 — `!expedition` sans argument devient contextuel

La commande sans argument affiche l'état utile plutôt qu'un simple helper statique.

Cas :
- aucun départ effectué et aucune Expedition active → aide compacte pour démarrer ;
- Expedition en cours → personnage + temps restant ;
- Expedition prête → indiquer qu'elle est revenue et peut être récupérée ;
- départ quotidien déjà utilisé et aucune Expedition active → indiquer que le prochain départ sera disponible après le prochain reset.

Les réponses Twitch/chat restent courtes et sur une seule ligne.

## R355 — Écran Quotidiennes transversal

Validation explicite de la nouvelle architecture :

Créer un écran `Quotidiennes` dédié, distinct de l'écran Missions.

Il sert de hub de navigation et de suivi des états quotidiens.

Chaque activité possède :
- un état du jour ;
- un bouton `Accéder` ;
- une redirection vers le véritable écran propriétaire.

Pour Expedition :
- `Accéder` → Box.

`!quotis` est la version texte compacte de ce hub.

Cette décision remplace uniquement l'ancienne localisation du suivi quotidien général issue de R299/R311.
Elle ne modifie pas la mission quotidienne payante ni les permanentes.

## R356 — Notification UI lorsque l'Expedition est prête

À `readyAt` :
- créer/mettre à jour une notification standalone indiquant que le personnage est revenu ;
- la notification peut ouvrir directement la Box / fiche du personnage concerné ;
- aucune récompense n'est tirée par la notification ;
- aucune récupération automatique ;
- aucun message Twitch asynchrone.

## R357 — Badges Box

Pendant une Expedition :
- badge discret du type `🧭 En expédition`.

Lorsque l'Expedition est prête :
- badge du type `✅ À récupérer`.

## R358 — Pas d'annulation volontaire

Le joueur ne peut pas annuler volontairement une Expedition déjà lancée.

Aucun bouton/commande d'annulation V1.

La seule annulation spéciale actuellement prévue est celle provoquée par une désactivation administrative du personnage.

## R359 — Récupération depuis la fiche / fiche maintenue ouverte

Dans la Box personnelle, la fiche du personnage revenu propose :
- `Récupérer l'expédition`.

Séquence transactionnelle :
1. revalider l'état et `readyAt` ;
2. verrouiller/idempotence ;
3. tirer le résultat serveur ;
4. créditer la récompense ;
5. incrémenter `totalExpeditionsCompleted` ;
6. produire l'événement Mission correspondant ;
7. clôturer l'Expedition ;
8. retirer la priorité spéciale Box ;
9. afficher le résultat.

Après récupération :
- conserver la fiche ouverte ;
- afficher brièvement le résultat dans cette fiche.

## R360 — Feedback visuel de récupération

Prévoir un feedback/une petite animation directement dans la fiche.

Exemples :
- `💠 +1 600 Primogemmes`
- `✨ +800 particules <élément personnel>`
- `🪙 +30 000 Moras`

Pas besoin d'un écran ou d'une cinématique Expedition dédiée.

## R361 — Pas d'historique player-facing Expedition V1

Ne pas ajouter Expedition à l'écran global Historique en V1.

Le serveur peut conserver les informations techniques nécessaires pour :
- audit ;
- idempotence ;
- statistiques ;
- diagnostic.

## R362 — Définition autoritative de `totalExpeditionsCompleted`

Une Expedition est comptabilisée comme terminée uniquement lors d'une récupération réussie.

Donc :
- départ → +0 ;
- 20 heures écoulées → +0 ;
- état prêt à récupérer → +0 ;
- récupération réussie → +1.

Cette même mutation produit l'événement consommé par la mission permanente Expedition.

L'incrément est atomique et idempotent.

## R363 — Tous les personnages possédés et actifs sont éligibles

Tout personnage peut être envoyé s'il est :
- possédé ;
- actif dans le catalogue.

Aucune condition supplémentaire de :
- rareté ;
- constellation ;
- Team ;
- favori ;
- élément ;
- niveau ;
- Combat.

Le choix est principalement personnel/esthétique puisque R344 rend la récompense de particules indépendante de l'élément du personnage.

## R364 — États Expedition dans le hub Quotidiennes

La carte Expedition du hub `Quotidiennes` doit distinguer l'état opérationnel de l'Expedition et le fait que le départ quotidien actuel ait ou non été effectué.

États principaux :

### À faire
Aucune Expedition active ne bloque le joueur et aucun départ n'a encore été effectué pour la journée serveur actuelle.

### En cours
Une Expedition est active et `readyAt` n'est pas encore atteint.

Afficher notamment :
- personnage concerné si utile ;
- temps restant ;
- bouton `Accéder`.

Si cette Expedition a été démarrée pendant la journée actuelle :
- le départ quotidien est déjà considéré comme effectué selon R350.

Si cette Expedition vient d'une journée précédente :
- indiquer qu'il s'agit d'un départ précédent ;
- le départ de la journée actuelle reste à faire après récupération.

### À récupérer
`readyAt` est atteint mais le joueur n'a pas encore récupéré la récompense.

Si le départ appartient à une journée précédente :
- indiquer que le départ quotidien actuel reste encore à faire après récupération.

### Fait aujourd'hui
Le départ de la journée actuelle a été effectué et aucune action Expedition prioritaire n'est actuellement en attente.

Le hub ne doit jamais réduire tous ces cas à un simple booléen fait/pas fait lorsqu'une information opérationnelle plus utile existe.

## R365 — Bouton Accéder toujours disponible

La carte Expedition du hub `Quotidiennes` conserve un bouton `Accéder` quel que soit son état.

Comportement :
- `À faire` → ouvrir la Box ;
- `En cours` → ouvrir la Box et, lorsque l'architecture le permet proprement, la fiche du personnage concerné ;
- `À récupérer` → ouvrir directement la Box / fiche du personnage concerné ;
- `Fait aujourd'hui` → ouvrir la Box normalement.

Le hub ne récupère jamais lui-même la récompense.

Il redirige vers la vraie Box.

## R366 — Passage à l'état prêt pendant que la Box est ouverte — ✅ DÉRIVÉ / TECHNIQUE

Lorsque `readyAt` est atteint pendant que le joueur est connecté :

- l'état serveur devient immédiatement récupérable ;
- les clients ouverts reçoivent l'état actualisé ;
- la Box se met à jour sans rechargement manuel ;
- le personnage passe temporairement devant les autres selon R346 ;
- son badge devient `✅ À récupérer` ;
- si sa fiche est déjà ouverte, l'action devient `Récupérer l'expédition` ;
- la notification UI R356 est créée/mise à jour normalement.

Ne pas ouvrir automatiquement une modale ou interrompre le joueur avec une popup forcée.

Aucune récompense n'est encore tirée.

## R367 — Reset quotidien pendant une Expedition — ✅ DÉRIVÉ / TECHNIQUE

Le reset de 00:00 `Europe/Paris` :

- n'annule jamais une Expedition active ;
- ne modifie jamais son `startedAt` ;
- ne modifie jamais son `readyAt` ;
- ne déclenche aucune récompense ;
- ouvre simplement une nouvelle journée de départ.

Une Expedition précédente encore active ou prête continue cependant à bloquer tout nouveau départ selon R351.

Après récupération :
- si aucun départ n'a encore été effectué pour la journée serveur actuelle → nouveau départ immédiatement autorisé ;
- si le départ de la journée actuelle a déjà été consommé → attendre le prochain reset.

Exemple :
- lundi 22h → départ ;
- mardi 00h → reset sans modification de l'Expedition ;
- mardi 18h → récupération ;
- mardi 18h01 → nouveau départ autorisé.

## Edge cases migration supplémentaires — ✅ DÉRIVÉ / TECHNIQUE

Lors de la migration :

- `readyAt` invalide mais `startedAt` fiable → reconstruire `readyAt = startedAt + 20h` ;
- `startedAt` et `readyAt` tous deux fiables → préserver les valeurs historiques ;
- `characterId` valide mais nom/élément legacy incohérents → le catalogue rattaché au `characterId` fait autorité ;
- personnage introuvable/invalide → ne jamais inventer une possession ; annuler conservativement l'Expedition et journaliser l'anomalie ;
- `active = false` avec anciennes dates résiduelles → ne jamais reconstruire artificiellement une Expedition ;
- `active = true` sans personnage identifiable et sans dates suffisamment fiables → annulation conservatrice, aucune récompense ;
- aucune réparation ou normalisation de migration ne déclenche `totalExpeditionsCompleted` ;
- aucune réparation de migration ne tire une récompense.

## R368 — Visibilité des statistiques Expedition reportée

`totalExpeditionsCompleted` reste une statistique autoritative conservée côté serveur.

Le Domaine Expedition ne décide pas si cette statistique globale est :
- publique ;
- réservée aux amis ;
- privée ;
- affichée ou non sur un profil.

Cette décision appartient au futur domaine transversal :
**Profil / Statistiques / Confidentialité**.

Révision Social R473/R486/R487 :
- l'état de l'Expedition actuelle est `Privé` par défaut ;
- sa rubrique peut être réglée Public/Amis uniquement/Privé ;
- personnage envoyé, timer et état `À récupérer` ne sont exposés que si cette rubrique l'autorise ;
- la visibilité de la Box seule ne révèle jamais implicitement l'état Expedition.

## R369 — Clôture du Domaine Expedition

Le Domaine Expedition est considéré comme clôturé après R369.

Sont maintenant cadrés :
- durée ;
- départ quotidien ;
- reset ;
- personnage éligible ;
- disponibilité du personnage ;
- intégration Box ;
- intégration Quotidiennes ;
- récupération manuelle ;
- récompenses ;
- tirage ;
- notifications ;
- statistiques ;
- progression Missions ;
- confidentialité de l'état courant ;
- commandes ;
- migration ;
- atomicité/idempotence.

Les futurs domaines peuvent recroiser Expedition si nécessaire, mais ils ne doivent pas réimplémenter sa logique.

Prochain domaine :
**Combat**.

---

# 9. Architecture cible provisoire

```text
Quotidiennes UI / Box / chat / Twitch
                |
                v
        ExpeditionService
        ├── start(...)
        ├── getState(...)
        └── claim(...)
                |
      ┌─────────┼──────────┐
      v         v          v
Resource    Mission     Notification
Service     Service       Service
```

Le nom exact des classes/tables/événements sera défini en Phase 2/3.

---

# 10. Règles techniques dérivées

- `readyAt` est un timestamp serveur autoritatif ;
- le frontend n'est jamais source de vérité du timer ;
- le tirage est exclusivement serveur ;
- la récupération est atomique/idempotente ;
- aucun double gain en cas de double clic/retry/concurrence multi-canal ;
- les gains Primos/Moras/particules passent par l'économie centrale ;
- les 800 particules sont toujours de l'élément personnel du joueur ;
- `totalMainElementParticlesEarned` augmente donc de 800 sur ce résultat ;
- `totalExpeditionsCompleted` augmente une seule fois au claim réussi ;
- Expedition n'altère pas la Team ;
- Expedition ne rend pas le personnage indisponible ;
- un personnage désactivé n'est jamais proposé dans la Box comme candidat ;
- les données Expedition sont privées par défaut et ne deviennent visibles que par leur rubrique de confidentialité dédiée, jamais implicitement par la seule visibilité de la Box ;
- la priorité `À récupérer` est une priorité UI temporaire, pas une modification persistante du tri utilisateur ;
- la priorité `À récupérer` ne contourne jamais les filtres/recherches ;
- le hub Quotidiennes appelle/redirige vers les vrais domaines au lieu de les réimplémenter.

---

# 11. État final

Décisions R340 à R369 validées / dérivées.

**Domaine Expedition : CLÔTURÉ.**

Sont cadrés :
- durée 20 h ;
- un départ maximum par journée serveur ;
- reset 00:00 Europe/Paris ;
- récupération manuelle ;
- récompenses V1 ;
- particules de l'élément personnel ;
- personnage restant utilisable ;
- Box comme interface principale ;
- priorité temporaire `À récupérer` ;
- badges Expedition ;
- écran transversal Quotidiennes ;
- états détaillés dans Quotidiennes ;
- bouton Accéder permanent ;
- notification UI au retour ;
- absence de notification Twitch asynchrone ;
- absence d'annulation volontaire ;
- tirage au claim ;
- `totalExpeditionsCompleted` au claim uniquement ;
- progression Mission immédiate ;
- aucun historique player-facing V1 ;
- migration des Expeditions actives ;
- edge cases de corruption/migration ;
- confidentialité de l'état courant.

Report explicite :
- visibilité publique des statistiques globales Expedition → futur domaine Profil / Statistiques / Confidentialité.

Prochain domaine d'audit :
**Combat**.
