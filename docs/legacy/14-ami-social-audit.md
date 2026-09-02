# Audit legacy — Ami / Social

> Domaine 11 de l'audit legacy GachaImpact.  
> État au checkpoint : **EN COURS — décisions R451 à R493 cadrées**.  
> Prochaine reprise : **R494**.

---

# 1. Périmètre

Ce document cadre la reconstruction standalone du domaine Ami / Social à partir :

- du vrai code Streamer.bot ;
- des JSON legacy réellement persistés ;
- des consommateurs XP et Missions ;
- du prototype frontend existant ;
- des décisions transverses déjà prises pour le profil, la confidentialité, le chat interne, Twitch et les notifications.

Le domaine couvre notamment :

- demandes d'ami ;
- relations d'amitié ;
- cœurs quotidiens ;
- niveaux d'amitié ;
- présence et dernière activité ;
- espace Social ;
- profil joueur ;
- confidentialité ;
- messages privés internes ;
- avatars et titres ;
- commandes `!ami`, `!infos` / `!info` et `!liste` ;
- migration des données sociales.

Le domaine n'est pas encore clôturé. Les règles détaillées des MP, les dernières syntaxes de commandes, les cas de concurrence et la migration finale restent à auditer à partir de R494.

---

# 2. Sources vérifiées

## 2.1 Sources legacy principales

- `legacy/streamerbot/commands/Ami.txt`
- `legacy/streamerbot/data/friendships_data.json`
- `legacy/streamerbot/data/viewers_data.json`
- parties pertinentes de `legacy/streamerbot/commands/XP.txt`
- parties pertinentes de `legacy/streamerbot/commands/Missions.txt`
- `legacy/streamerbot/data/long_missions.json`
- `legacy/streamerbot/commands/Liste.txt`
- `legacy/streamerbot/commands/Infos.txt`
- `legacy/streamerbot/commands/Daily.txt`

## 2.2 Sources documentaires recroisées

- `.chatgpt/CHATGPT_GUIDE.md`
- `docs/master/PROJECT_MASTER_PLAN.md`
- `docs/specifications/decisions-log.md`
- `docs/commands/command-reference.md`
- `docs/legacy/02-current-player-model.md`
- `docs/legacy/04-xp-audit.md`
- `docs/legacy/08-team-audit.md`
- `docs/legacy/10-sac-coffre-shop-audit.md`
- `docs/legacy/11-missions-daily-audit.md`
- `docs/legacy/12-expedition-audit.md`
- `docs/legacy/13-combat-audit.md`

## 2.3 Prototype frontend relu

Le prototype React / TypeScript / Vite a été relu afin de conserver la cohérence visuelle et structurelle avec ce qui existe déjà, notamment :

- `src/App.tsx` ;
- `src/types.ts` ;
- `src/data/mockData.ts` ;
- `src/components/GameHeader.tsx` ;
- `src/components/Navigation.tsx` ;
- `src/components/PlayerSidebar.tsx` ;
- `src/components/ChatPanel.tsx` ;
- `src/components/OnlinePlayersPanel.tsx` ;
- les écrans et composants principaux existants.

Le prototype reste une maquette visuelle et non une source de vérité métier.

Constats utiles :

- l'avatar actuel est seulement une initiale colorée ;
- cette initiale est répétée dans la sidebar, le chat et le panneau de présence ;
- le panneau `Joueurs connectés` utilise des données fictives ;
- le type actuel ne connaît que `En ligne` et `Récent` ;
- aucun véritable écran Social ou Profil public n'existe ;
- aucune route Social n'existe dans `ScreenId` ;
- le chat global interne est déjà matérialisé visuellement ;
- le panneau Notifications du header peut accueillir les futures notifications sociales et cosmétiques.

La cible devra donc utiliser une identité joueur commune et réutilisable dans les différentes vues : avatar, pseudo, titre lorsque la vue l'autorise, niveau, élément et présence.

---

# 3. Réalité du legacy

## 3.1 Demandes d'ami

Le vrai code de `Ami.txt` permet :

- `!ami <pseudo>` pour créer une demande ;
- la même syntaxe pour consulter une amitié existante ;
- l'acceptation implicite lorsqu'une demande inverse existe déjà.

Le legacy ne propose pas :

- d'acceptation explicite ;
- de refus ;
- d'annulation par l'expéditeur ;
- de retrait d'ami ;
- d'expiration ;
- de limite du nombre d'amis.

La cible ne doit pas reproduire ces manques comme des règles voulues.

## 3.2 Relation d'amitié

Une amitié est stockée une seule fois pour la paire de joueurs :

- clé formée à partir des deux pseudos normalisés et triés ;
- tableau `users` contenant les deux joueurs ;
- statut `friends` ;
- niveau commun ;
- compteur commun `sparkleHearts` ;
- date de création ;
- dernière date de cœur envoyée par chacun des deux joueurs.

La relation est commune, mais l'identité repose encore sur les pseudos. La cible utilisera deux `playerId` immuables et une contrainte d'unicité sur la paire canonique.

## 3.3 Cœurs quotidiens

Chaque joueur peut envoyer un cœur à chacun de ses amis une fois par date locale et par direction.

Un envoi individuel :

- augmente le niveau commun de 1 ;
- augmente `sparkleHearts` de 1 ;
- écrit la date d'envoi du joueur ;
- donne 5 Primogemmes à l'expéditeur ;
- donne 5 Primogemmes au destinataire ;
- augmente `totalPrimosEarned` des deux joueurs ;
- augmente `totalFriendHeartsSent` de l'expéditeur ;
- envoie un message public aléatoire.

`!ami coeur all` parcourt toutes les relations éligibles et applique les mêmes mutations.

Problèmes techniques legacy :

- `DateTime.Now` dépend de l'horloge locale du PC ;
- les fichiers joueurs et amitiés sont sauvegardés successivement ;
- il n'existe pas de transaction englobant progression sociale et récompenses ;
- une panne intermédiaire peut désynchroniser les JSON ;
- aucune vraie idempotence multi-canal n'existe.

## 3.4 Niveau et paliers

Le niveau commence à 1 et augmente de 1 par cœur reçu dans la relation, quelle que soit la direction.

Paliers legacy :

| Niveau | Palier |
|---:|---|
| 1 à 99 | Amitié Sincère |
| 100 à 299 | Amitié Fusionnelle |
| 300 à 999 | Amitié Légendaire |
| 1000 et plus | Amitié Parfaite |

Le legacy continue à augmenter le niveau réel au-delà de 1000 mais limite seulement l'affichage à 1000.

## 3.5 Affichage de `!ami`

Sans argument, `!ami` peut produire deux messages successifs :

- une liste d'amis ;
- puis les demandes reçues et l'aide des commandes.

La liste :

- suit l'ordre du `JObject` ;
- n'est pas triée ;
- n'est pas paginée ;
- marque les amis auxquels le cœur du jour a déjà été envoyé ;
- peut devenir trop longue.

Les demandes sortantes ne sont pas affichées dans ce résumé.

## 3.6 `!liste`

`!liste <élément>` n'est pas un système de présence en ligne.

La commande :

- filtre les joueurs par élément ;
- trie selon `dates.lastSeen` ;
- affiche au maximum 40 pseudos ;
- ne modifie aucune donnée.

Le `lastSeen` legacy est mis à jour lors du traitement des messages Twitch. Il ne prouve pas qu'un joueur possède actuellement une session GachaImpact ouverte.

## 3.7 `!infos`

Le legacy autorise notamment :

- `!infos me` ;
- `!infos <pseudo>` ;
- `!infos <pseudo> team` ;
- `!infos <pseudo> box` ;
- `!infos <pseudo> sac` ;
- `!infos <pseudo> pity` ;
- `!infos <pseudo> stats` ;
- `!infos <pseudo> mission`.

Le code expose ces informations sans contrôle de confidentialité. La Box peut être découpée en plusieurs messages de 450 caractères.

Cette exposition ne devient pas la règle cible.

## 3.8 Consommateurs XP et Missions

`Ami.txt` produit `totalFriendHeartsSent` pour l'expéditeur.

XP et Missions consomment :

- `totalFriendHeartsSent` pour les objectifs B/A/S de cœurs envoyés ;
- l'existence d'au moins une relation de niveau 1000 pour la mission Z `Amitié parfaite`.

Seuils legacy conservés :

| Rang | Cœurs envoyés cumulés |
|---:|---:|
| B | 10 |
| A | 40 |
| S | 200 |

La mission Z vise une Amitié Parfaite.

---

# 4. État réel des données legacy

Au checkpoint :

- 88 amitiés actives ;
- 21 demandes en attente ;
- 23 joueurs présents dans au moins une amitié ;
- maximum observé : 18 amis pour un joueur ;
- niveau minimal observé : 5 ;
- niveau maximal observé : 188 ;
- aucune Amitié Légendaire ;
- aucune Amitié Parfaite ;
- 8 958 cœurs cumulés dans les relations ;
- 8 346 cœurs dans la somme des `totalFriendHeartsSent` individuels ;
- écart historique : 612.

Les 88 relations sont structurellement cohérentes :

- clé compatible avec la paire triée ;
- deux joueurs distincts ;
- statut `friends` ;
- joueurs existants ;
- dates de cœur structurées pour les deux membres ;
- relation observée `level = sparkleHearts + 1`.

Les 21 demandes :

- ciblent des joueurs existants ;
- ne sont pas des demandes vers soi-même ;
- ne dupliquent pas une amitié existante ;
- ne contiennent pas de paire dupliquée observée ;
- peuvent être anciennes, car le legacy ne les expire jamais.

L'écart de 612 ne permet pas de reconstruire avec certitude l'expéditeur de chaque ancien cœur. La migration préservera séparément :

- le total commun exact porté par chaque relation ;
- le compteur individuel exact actuellement connu de chaque joueur.

Aucune réattribution inventée ne sera réalisée.

---

# 5. Décisions R451 à R459 — cœur Ami

## R451 — Workflow complet des demandes

La cible ajoute :

- accepter une demande reçue ;
- refuser une demande reçue ;
- annuler une demande envoyée ;
- les actions équivalentes dans l'UI et les chats ;
- l'acceptation rapide lorsqu'un joueur répond par une demande réciproque.

Le chat interne et Twitch appellent le même service métier que l'UI.

## R452 — Demandes persistantes

Une demande d'ami n'expire pas automatiquement.

Elle reste jusqu'à :

- acceptation ;
- refus ;
- annulation par l'expéditeur.

Les demandes legacy encore ouvertes sont donc migrables sans inventer de date d'expiration.

## R453 — Retrait et réajout

Retirer un ami archive la relation au lieu de détruire son historique.

Si les deux joueurs redeviennent amis :

- niveau restauré ;
- total de cœurs restauré ;
- métadonnées utiles restaurées ;
- verrou d'envoi du jour conservé afin d'empêcher un retrait/réajout exploitant les récompenses.

Une mission déjà terminée n'est jamais révoquée.

## R454 — Identité, reset et idempotence

Décision technique actée sans arbitrage produit :

- relation rattachée aux `playerId` ;
- paire unique et canonique ;
- un cœur par relation, par expéditeur et par journée serveur ;
- reset à 00:00 `Europe/Paris` ;
- progression, récompenses, statistiques et événements Missions dans une transaction idempotente.

## R455 — Récompense sans plafond

Chaque cœur valide conserve le legacy :

- +5 Primogemmes pour l'expéditeur ;
- +5 Primogemmes pour le destinataire.

Il n'existe pas de plafond économique quotidien en plus de la limite d'un cœur par relation et par sens.

## R456 — Envoyer à tous

`Envoyer à tous` :

- traite toutes les relations actuellement éligibles ;
- reste atomique et idempotent ;
- ne duplique aucun gain en cas de retry ;
- produit un seul retour compact dans le chat interne ou Twitch ;
- ne produit pas plusieurs messages normaux successifs.

## R457 — Niveau plafonné à 1000

Le niveau d'amitié réel est plafonné à 1000.

Le compteur historique total de cœurs continue d'augmenter après l'atteinte d'Amitié Parfaite.

Les paliers restent :

- Sincère : 1–99 ;
- Fusionnelle : 100–299 ;
- Légendaire : 300–999 ;
- Parfaite : 1000.

## R458 — Missions Ami

Les missions B/A/S utilisent le nombre cumulatif de cœurs sortants validés :

- un envoi individuel valide compte pour 1 ;
- `Envoyer à tous` compte le nombre exact de relations traitées ;
- un retry idempotent ne recompte rien ;
- un cœur entrant ne compte pas comme cœur envoyé par le destinataire.

La mission Z se termine dès qu'une relation atteint pour la première fois le niveau 1000.

## R459 — Migration conservatrice

La migration conserve :

- relations ;
- demandes valides ;
- niveaux ;
- cœurs communs ;
- dates connues ;
- compteurs individuels `totalFriendHeartsSent`.

L'écart historique de 612 cœurs n'est pas reconstruit ni attribué artificiellement.

---

# 6. Décisions R460 à R467 — espace Social et présence

## R460 — Écran Social unique

L'UI standalone utilise un écran Social unique avec :

- `Amis` ouvert par défaut ;
- `Demandes` ;
- `Joueurs` ;
- `Messages`.

## R461 — Tri des amis

Tri par défaut :

1. joueurs en ligne ou absents ;
2. joueurs hors ligne ;
3. ordre alphabétique dans chaque groupe.

Le joueur peut aussi choisir notamment :

- alphabétique ;
- niveau d'amitié ;
- cœur disponible.

Le dernier tri choisi est mémorisé. La recherche par pseudo fonctionne en temps réel selon la normalisation transverse.

## R462 — Trois états de présence

Présence standalone :

- `En ligne` ;
- `Absent` lorsqu'une session reste ouverte sans activité récente ;
- `Hors ligne` lorsque toutes les sessions sont fermées.

La cible indicative pour `Absent` est 10 minutes d'inactivité. Une courte tolérance technique évite les faux passages hors ligne pendant une microcoupure.

## R463 — Dernière activité configurable

La dernière activité possède une visibilité :

- Public ;
- Amis uniquement ;
- Privé.

La valeur par défaut est publique selon la politique générale retenue, sous réserve du tableau final des valeurs de confidentialité.

## R464 — Panneau Joueurs connectés

Le petit panneau ouvert depuis le chat affiche uniquement :

- joueurs `En ligne` ;
- joueurs `Absents`.

Il ne mélange pas les joueurs hors ligne récemment actifs. L'écran Social permet de rechercher les autres joueurs.

## R465 — Aucune notification de cœur

Un cœur reçu ne crée aucune notification dédiée.

Les gains restent :

- appliqués économiquement ;
- visibles dans le solde ;
- auditables dans l'historique économique approprié.

## R466 — MP selon confidentialité

Les messages privés internes utilisent un réglage :

- Public ;
- Amis uniquement ;
- Privé.

La valeur par défaut au moment de la migration est `Public`.

Les MP sont strictement internes à GachaImpact et indépendants de Twitch.

## R467 — Aucun plafond d'amis

La cible ne fixe aucun nombre maximal d'amis.

Les contraintes techniques de pagination, recherche et performance ne deviennent pas une limite produit artificielle.

---

# 7. Décisions R468 à R477 — profil, confidentialité et MP

## R468 — Profil complet

Le profil standalone propose les sections :

- Aperçu ;
- Team ;
- Box ;
- Collection ;
- Statistiques ;
- Missions ;
- autres rubriques autorisées par les réglages de confidentialité.

Les données ne sont pas dupliquées : le profil réutilise les vues et services autoritatifs des domaines concernés.

## R469 — Confidentialité par catégorie

La confidentialité est réglable par catégorie et non par un unique interrupteur global.

Valeurs possibles :

- Public ;
- Amis uniquement ;
- Privé.

Les permissions sont toujours appliquées côté serveur.

## R470 — Identité toujours visible

Les informations suivantes restent visibles lorsqu'un compte est recherché :

- pseudo ;
- avatar ;
- niveau ;
- élément.

La dernière activité reste soumise à son réglage de confidentialité.

Le futur système d'avatars doit proposer des avatars initiaux puis des avatars déblocables. Les titres suivent la même logique de récompenses cosmétiques.

## R471 — `!infos` compact dans les chats

Distinction obligatoire :

- UI standalone : profil graphique détaillé selon confidentialité ;
- chat interne : `!infos <pseudo>` renvoie un résumé compact ;
- Twitch : même résumé compact dans un seul message.

Les anciennes sections détaillées `team`, `box`, `sac`, `pity`, `stats` et `mission` ne sont plus exposées par la commande cible.

La commande ne liste jamais une Box complète.

## R472 — Conservation de `!liste`

Les chats conservent :

- `!liste <élément>` pour l'annuaire élémentaire ;
- `!liste online` pour la présence GachaImpact réelle.

La restitution reste compacte et soumise aux règles de visibilité applicables.

## R473 — Toutes les catégories deviennent configurables

Clarification transverse qui remplace les anciennes formulations absolues :

- pity et garantie sont configurables ;
- Sac exact configurable ;
- Saved Teams configurables ;
- slots Combat et Boss configurables ;
- KO et états tactiques configurables ;
- Expedition active configurable ;
- les autres informations de gameplay suivent la même architecture.

Les catégories sensibles sont `Privé` par défaut à la migration, mais le propriétaire peut ensuite choisir `Public` ou `Amis uniquement`.

Une donnée privée reste autoritative et disponible au propriétaire ; elle n'est jamais supprimée ni confondue avec une donnée vide.

## R474 — Statistiques publiques par défaut

Les statistiques cumulatives non sensibles sont publiques par défaut dans une rubrique configurable, notamment :

- messages et XP ;
- Pulls et raretés obtenues ;
- 50/50 ;
- Combat ;
- Expedition ;
- cœurs ;
- progression générale.

Les soldes actuels et historiques détaillés appartiennent à leurs propres catégories de confidentialité.

## R475 — Demande de conversation pour un non-ami

Lorsque les MP du destinataire sont `Public`, le premier message d'un non-ami crée une demande de conversation.

Le destinataire peut :

- accepter ;
- ignorer/refuser ;
- bloquer.

Les amis déjà acceptés n'ont pas cette étape.

## R476 — Historique après retrait d'ami

Retirer un ami n'efface pas rétroactivement la conversation.

L'historique reste lisible par les deux comptes. Les nouveaux messages suivent les réglages de confidentialité et de blocage en vigueur au moment de l'envoi.

## R477 — Blocage social complet

Bloquer un joueur empêche entre les deux comptes :

- nouvelles demandes d'ami ;
- nouveaux MP ;
- autres interactions sociales directes ;
- exposition de la présence ;
- exposition de la dernière activité.

Le blocage ne modifie pas les historiques métier déjà acquis et ne détruit aucune donnée de l'autre joueur.

---

# 8. Décisions R478 à R485 — avatars et titres

## R478 — Catalogue officiel d'avatars

Les joueurs utilisent uniquement des avatars fournis par GachaImpact.

La V1 ne permet pas d'importer une image personnelle. Cela évite les problèmes de modération, de stockage et de cohérence visuelle.

## R479 — Avatar élémentaire par défaut

L'avatar initial correspond à l'élément permanent du joueur.

Le joueur peut ensuite choisir quand il le souhaite n'importe quel avatar qu'il a débloqué.

Si un profil Twitch-only ou migré ne possède exceptionnellement pas encore d'élément, l'initiale colorée reste le fallback jusqu'au choix de l'élément.

## R480 — Sources variées de cosmétiques

Avatars et titres peuvent être débloqués par :

- niveaux ;
- Missions ;
- Amitié ;
- Combat ;
- événements ;
- objets ;
- achats avec des ressources exclusivement virtuelles ;
- autres accomplissements déclarés par le catalogue.

Ces cosmétiques ne donnent aucun avantage de puissance.

## R481 — Rétroactivité démontrable

Au cutover, les règles de déblocage sont évaluées à partir des données legacy fiables :

- états exacts ;
- statistiques cumulatives ;
- relations ;
- accomplissements prouvables.

Une récompense est accordée rétroactivement seulement si sa condition est démontrable. Aucun exploit historique absent des données n'est inventé.

## R482 — Déblocage permanent

Un avatar ou titre débloqué reste définitivement possédé, même si sa condition initiale n'est plus vraie.

Exemple : retirer une Amitié Parfaite ne retire pas le cosmétique déjà obtenu.

## R483 — Un titre, visible uniquement sur le Profil

Le joueur peut :

- équiper un titre ;
- changer de titre ;
- n'en afficher aucun.

Le titre équipé apparaît uniquement sur la page Profil.

Il n'apparaît pas :

- dans la liste d'amis ;
- dans le panneau de présence ;
- dans le chat interne ;
- dans les messages ou commandes Twitch.

## R484 — Avatars selon le canal

L'avatar GachaImpact équipé apparaît dans l'UI standalone, notamment :

- Profil ;
- sidebar/identité personnelle lorsque prévu ;
- chat interne ;
- espace Social ;
- panneaux et listes de joueurs.

Twitch continue à afficher l'avatar Twitch réel du compte. GachaImpact ne tente pas de le remplacer.

Aucun titre n'est ajouté dans les chats.

## R485 — Notification de déblocage

Un nouveau cosmétique produit une notification UI persistante selon les règles générales des notifications.

Si le déblocage résulte immédiatement d'une action dans le chat interne ou sur Twitch :

- le résultat peut mentionner le déblocage ;
- la mention est intégrée au message de résultat existant ;
- aucun second message normal n'est produit uniquement pour le cosmétique.

---

# 9. Décisions R486 à R493 — réglages et consultation

## R486 — Confidentialité par rubriques cohérentes

Les paramètres ne sont ni un interrupteur unique ni une matrice par champ atomique.

Rubriques prévues :

- Team active ;
- Saved Teams ;
- Box ;
- Collection ;
- monnaies ;
- Sac ;
- Banque ;
- pity/garantie ;
- statistiques ;
- Missions ;
- Expedition ;
- Combat quotidien ;
- Boss mensuel ;
- dernière activité ;
- historiques.

Une rubrique peut être divisée en sous-rubriques lorsqu'une vraie différence de confidentialité le justifie.

## R487 — Valeurs initiales prudentes

Les comptes migrés et les nouveaux comptes reçoivent la même politique initiale :

- identité toujours visible ;
- rubriques sociales générales publiques lorsqu'elles ne sont pas sensibles ;
- données économiques détaillées, presets et états tactiques sensibles privés ;
- toutes les rubriques configurables modifiables ensuite par leur propriétaire.

Le tableau exhaustif des valeurs initiales sera figé avant la clôture du domaine.

## R488 — Réutilisation des écrans en lecture seule

Lorsqu'une rubrique est visible pour un visiteur :

- le standalone réutilise l'écran ou la vue réelle du domaine ;
- la vue est en lecture seule ;
- les actions de mutation sont absentes ;
- les permissions sont contrôlées avant la récupération des données ;
- une section privée est distincte d'une section vide.

## R489 — Résumé fixe de `!infos`

Le résumé compact cible contient, lorsqu'elles sont autorisées :

- pseudo ;
- niveau ;
- élément ;
- nombre de personnages, jamais leur liste ;
- remplissage de la Team active ;
- total de Pulls ;
- victoires Combat ;
- niveau d'amitié avec le demandeur s'ils sont amis.

Aucun titre n'est ajouté. La réponse tient dans un seul message normal.

## R490 — Alias `!info`

Décision évidente prise directement :

- `!infos` reste la syntaxe canonique documentée ;
- `!info` est accepté comme alias ;
- les aides ne présentent que `!infos`.

## R491 — Profils accessibles depuis l'identité

Dans l'UI standalone, avatar et pseudo ouvrent le profil depuis les emplacements pertinents :

- chat interne ;
- liste d'amis ;
- demandes ;
- panneau de présence ;
- annuaire ;
- futurs classements.

Le propriétaire ouvre son propre profil avec accès à sa personnalisation et à ses réglages.

## R492 — Section Personnalisation

Le Profil possède une section `Personnalisation` avec :

- onglet `Avatars` ;
- onglet `Titres` ;
- aperçu ;
- états possédé/verrouillé ;
- recherche et filtres adaptés ;
- action `Équiper`.

## R493 — Secret configurable par cosmétique

Chaque cosmétique verrouillé peut être déclaré :

- visible avec sa condition exacte ;
- visible sous forme de silhouette/mystère ;
- totalement secret jusqu'au déblocage.

Cette propriété appartient au catalogue serveur.

---

# 10. Invariants techniques déjà acquis

- le pseudo n'est jamais une clé primaire ;
- les relations, demandes, blocages et conversations utilisent des IDs immuables ;
- les permissions sont évaluées côté serveur ;
- aucune donnée privée n'est envoyée au client puis seulement masquée ;
- une donnée privée et une donnée vide sont deux états différents ;
- les mutations sociales et économiques sont atomiques et idempotentes ;
- les actions UI, chat interne et Twitch appellent les mêmes services métier ;
- la restitution dépend du canal d'origine ;
- aucune notification Twitch asynchrone ;
- les réponses Twitch restent compactes et sur une seule ligne ;
- les réponses normales ne sont pas artificiellement séparées en plusieurs messages ;
- une coupure n'est admise que pour une limite technique réelle ;
- les collections et longues listes de l'UI utilisent recherche, filtres, tri et pagination/virtualisation adaptés ;
- le catalogue d'avatars/titres utilise des IDs stables et des règles de déblocage pilotées par les données ;
- les déblocages cosmétiques sont permanents et idempotents.

---

# 11. Modèle conceptuel provisoire

Ce modèle reste conceptuel tant que l'architecture backend/DB n'est pas figée.

## Relations

Une relation sociale doit pouvoir représenter :

- paire canonique de joueurs ;
- état actif ou archivé ;
- niveau plafonné ;
- total de cœurs cumulés ;
- dates de création, acceptation, retrait et réactivation ;
- dernier jour de cœur par direction ;
- métadonnées de migration.

## Demandes

Une demande doit conserver :

- expéditeur ;
- destinataire ;
- état ;
- dates utiles ;
- cause/canal ;
- clé d'idempotence lorsqu'elle provient d'une commande ou requête réessayable.

## Présence

Séparer :

- session connectée ;
- activité récente de l'application ;
- dernier message interne ;
- dernier message Twitch legacy/futur ;
- dernière activité de jeu ;
- visibilité publique de la dernière activité.

Le `lastSeen` legacy est conservé comme activité Twitch historique. Il ne devient pas une fausse session standalone.

## Confidentialité

Chaque rubrique configurable possède :

- propriétaire ;
- catégorie stable ;
- valeur Public/Amis/Privé ;
- valeur initiale versionnée ;
- métadonnées utiles de modification.

## Cosmétiques

Prévoir conceptuellement :

- catalogue Avatar/Titre ;
- règle de déblocage ;
- niveau de secret ;
- possession joueur ;
- source et date de déblocage ;
- équipement courant ;
- statut actif/retiré du catalogue ;
- preuve de déblocage migrée ou native.

## MP et blocages

Prévoir conceptuellement :

- conversations ;
- participants ;
- demandes de conversation ;
- messages ;
- états lu/non lu ;
- blocages ;
- modération et audit nécessaires ;
- politique de conservation à décider.

---

# 12. Points encore ouverts — reprise R494

Le prochain lot doit reprendre à R494, sans redemander R451 à R493.

Points restant notamment à cadrer :

- syntaxes finales de `!ami` dans le chat interne et sur Twitch ;
- contenu compact et pagination de `!ami` ;
- résultat exact de `!ami coeur <pseudo>` et `!ami coeur all` ;
- concurrence demande réciproque / acceptation / refus / annulation ;
- concurrence d'envoi de cœurs individuels et groupés ;
- historique économique des cœurs sans notification dédiée ;
- tableau exact des valeurs initiales de confidentialité ;
- détails des MP : texte, longueur, conservation, suppression locale, non-lus et notifications ;
- modération, signalement, blocage et éventuel déblocage ;
- visibilité et comportement d'une conversation après changement de confidentialité ;
- sémantique exacte des timestamps de présence et dernière activité ;
- migration de `lastSeen` et distinction des activités futures ;
- formats finaux de `!infos` / `!info` et `!liste` ;
- premier catalogue d'avatars/titres et règles administratives ;
- migration et attribution rétroactive des cosmétiques ;
- dernière passe producteurs/consommateurs ;
- clôture du Domaine Ami / Social.

---

# 13. État du domaine

**Domaine Ami / Social : EN COURS — R451 À R493.**

Prochaine décision : **R494**.

Le checkpoint ne clôture pas le domaine.
