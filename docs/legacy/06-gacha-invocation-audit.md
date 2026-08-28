# 06 — Audit legacy : Gacha / Invocation

Statut : AUDIT EN COURS — R54 À R65 VALIDÉS
Date : 2026-08-28

Sources legacy principales :
- `legacy/streamerbot/commands/Banniere.txt`
- `legacy/streamerbot/commands/Select.txt`
- `legacy/streamerbot/commands/Pull.txt`
- `legacy/streamerbot/commands/Pity.txt`
- `legacy/streamerbot/commands/Vote.txt`
- `legacy/streamerbot/commands/XP.txt` pour la génération hebdomadaire de bannière
- `legacy/streamerbot/data/banner_votes.json`
- `legacy/streamerbot/data/genshin_characters.json`
- `legacy/streamerbot/data/viewers_data.json`
- `legacy/streamerbot/data/element_passives.json` pour les interactions à auditer plus tard
- `legacy/streamerbot/data/c6_characters.json` pour les doublons C6 à auditer avec Personnages / Concours

Hors périmètre Gacha :
- `Wish.txt` appartient au système Twitch de Giveaway, pas au système Invocation.
- Le fichier reste conservé dans les sources legacy et sera audité plus tard avec les autres commandes Twitch de giveaway.

---

# 1. Périmètre

Ce domaine couvre :
- génération / rotation de bannière ;
- composition 5★ / 4★ ;
- vote communautaire ;
- sélection personnelle du 5★ ciblé ;
- coût et quantité de pulls ;
- pity 5★ / 4★ ;
- 50/50 ;
- garantie ;
- Capture de brillance ;
- récompenses secondaires ;
- présentation UI de l'Invocation ;
- animation de pull ;
- alimentation future du catalogue de personnages.

Les passifs élémentaires qui modifient le Pull seront audités séparément avant de figer le moteur final.

---

# 2. Corrections de lecture du legacy

## 2.1 Les headers de certains scripts sont périmés

`Banniere.txt` et `Pull.txt` parlent encore par endroits de 3 personnages 5★ et/ou 5 personnages 4★.

Le code réel de génération dans `XP.txt` fait aujourd'hui :
- 3 personnages 5★ aléatoires ;
- + 1 personnage 5★ issu du système de vote / fallback ;
- 6 personnages 4★ aléatoires.

La bannière réelle actuelle contient donc :
- **4 personnages 5★** ;
- **6 personnages 4★**.

Règle d'audit appliquée : code réel > commentaire d'en-tête.

## 2.2 `Wish.txt` n'est pas une commande Gacha

`Wish.txt` gère l'inscription au Giveaway Twitch.

Décision :
- ne pas le supprimer ;
- ne pas l'inclure dans le domaine Invocation ;
- conserver un backlog explicite « commandes Twitch de giveaway » à traiter plus tard.

---

# 3. Bannière hebdomadaire

## R54 — Rotation automatique — ✅ VALIDÉ

La bannière GachaImpact tourne automatiquement chaque **lundi à 00:00 `Europe/Paris`**.

Le changement ne dépend d'aucun message, login ou ouverture du jeu.

À la rotation :
- l'ancienne bannière se termine ;
- les personnages précédemment en bannière deviennent inéligibles pour la nouvelle semaine selon R56 ;
- le résultat des votes de la semaine écoulée est utilisé pour le 4e 5★ ;
- une nouvelle bannière est générée ;
- le cycle de vote suivant commence ;
- les cibles personnelles devenues obsolètes sont vidées selon R59.

Cette opération est une mécanique serveur planifiée et doit être robuste/idempotente.

---

## R55 — Composition de bannière — ✅ VALIDÉ

Composition V1 :
- **4 × 5★** ;
- **6 × 4★**.

Construction des 5★ :
- 3 tirés aléatoirement parmi les personnages éligibles ;
- 1 issu du vote communautaire pondéré ;
- fallback aléatoire si aucun vote exploitable.

Construction des 4★ :
- 6 personnages tirés aléatoirement parmi les 4★ éligibles.

---

## R56 — Pas deux semaines consécutives — ✅ VALIDÉ

Un personnage présent sur la bannière de la semaine N ne peut pas apparaître sur celle de la semaine N+1.

Cette règle s'applique :
- aux 5★ ;
- aux 4★.

Le personnage redevient éligible à partir d'une rotation ultérieure.

---

# 4. Vote communautaire

## R57 — Tirage pondéré — ✅ VALIDÉ

Le personnage communautaire n'est pas automatiquement celui qui possède le plus de votes.

Chaque vote constitue un poids dans un tirage aléatoire pondéré parmi les personnages encore éligibles.

Exemple :
- A : 5 votes ;
- B : 1 vote ;
- C : 1 vote ;

=> A possède 5 chances sur 7, B 1 sur 7, C 1 sur 7.

Si aucun vote valide n'est exploitable :
- le 4e 5★ est choisi aléatoirement parmi les candidats éligibles.

---

## R58 — Un vote définitif par semaine — ✅ VALIDÉ

Un joueur peut voter :
- une seule fois par semaine ;
- uniquement pour un personnage 5★ ;
- uniquement pour un personnage qui n'est pas déjà dans la bannière actuelle.

Une fois donné :
- le vote ne peut pas être changé jusqu'à la rotation suivante.

L'objectif est de conserver du poids au choix du joueur.

UI future :
- présentation claire des personnages éligibles ;
- affichage du vote personnel ;
- possibilité d'afficher les scores actuels ;
- aucune ambiguïté sur le caractère définitif du vote pour la semaine.

---

# 5. Sélection personnelle du 5★ ciblé

## R59 — Sélection et changement de cible — ✅ VALIDÉ

Le joueur doit sélectionner un 5★ parmi les **4 personnages 5★ actifs** avant de pouvoir invoquer.

Règles :
- une seule cible active à la fois ;
- changement libre à tout moment hors opération de Pull en cours ;
- pity / garantie / Capture ne sont pas réinitialisées lors d'un changement de cible ;
- au changement hebdomadaire de bannière, l'ancienne cible est automatiquement vidée ;
- le joueur doit choisir une nouvelle cible parmi les quatre nouveaux 5★ avant de pouvoir Pull.

Ne jamais sélectionner automatiquement un personnage à la place du joueur.

### Direction UI validée

À l'arrivée sur une nouvelle bannière sans cible :
- présenter les 4 personnages 5★ disponibles comme choix principal ;
- inspiration UX possible : sélection de personnage proche de la logique des bannières nostalgiques de Genshin, sans copier aveuglément leur interface.

Après sélection :
- afficher la bannière principale avec un grand artwork du 5★ ciblé ;
- conserver un bouton **Changer** permettant de rouvrir la sélection à tout moment ;
- afficher également les 6 personnages 4★ de la semaine, par exemple via de petites vignettes/portraits de visage en bas de la bannière ;
- le prototype Codex peut servir d'inspiration visuelle mais n'est jamais une source de vérité métier.

Chat/Twitch :
- `!select <nom>` reste l'équivalent naturel de la sélection.

---

# 6. Pull : coût et quantité

## R60 — Coût et x1/x10 — ✅ VALIDÉ

Coût V1 :
- **160 Primogemmes par Pull**.

UI :
- bouton `Invocation x1` ;
- bouton `Invocation x10` ;
- x10 = 1 600 Primogemmes ;
- aucune remise x10.

Chat/Twitch :
- `!pull` = 1 Pull ;
- `!pull N` accepte de 1 à 10 ;
- maximum 10 par commande.

La même logique serveur doit exécuter les pulls quel que soit le canal.

---

# 7. Pity

## R61 — Pity 5★ — ✅ VALIDÉ

Courbe V1 conservée depuis le code réel legacy :
- pity 1 à 73 : **0,6 %** par Pull ;
- pity 74 : **6,6 %** ;
- chaque Pull suivant ajoute **+6 points de pourcentage** ;
- pity 90 : **100 %** ;
- obtention d'un 5★ : pity 5★ remise à 0.

Les passifs pouvant modifier cette chance seront audités séparément.

---

## R62 — Pity 4★ — ✅ VALIDÉ

Courbe V1 :
- pity 1 à 8 : **1,5 %** ;
- pity 9 : **19,5 %** ;
- pity 10 : **100 %** ;
- obtention d'un 4★ : pity 4★ remise à 0.

---

## R63 — Priorité du 5★ — ✅ VALIDÉ

Les jets 5★ et 4★ sont calculés indépendamment dans le legacy.

Si les deux réussissent sur le même Pull :
- le résultat 5★ est prioritaire.

Le 5★ ne remet pas la pity 4★ à zéro.

La progression 4★ est donc conservée si le Pull est remplacé par un résultat 5★.

---

## R64 — Pity / garantie traversent les rotations — ✅ VALIDÉ

Les états personnels suivants sont conservés :
- pity 5★ ;
- pity 4★ ;
- garantie 5★ ;
- état de Capture de brillance.

Ils traversent :
- les rotations hebdomadaires ;
- les changements de cible 5★.

La bannière active change ; la progression personnelle de pity/garantie ne repart pas à zéro.

---

# 8. Récompense secondaire

## R65 — Pull sans 4★/5★ — ✅ VALIDÉ

Lorsque le Pull ne produit ni 4★ ni 5★ :

50 % :
- Moras aléatoires entre **5 000 et 15 000**.

50 % :
- particules d'un élément aléatoire ;
- quantité aléatoire entre **20 et 80**.

Les passifs Pyro / Geo / autres pouvant modifier ces valeurs sont reportés à l'audit des passifs.

Toutes les mutations de ressources passent dans la cible par le moteur central Ressources validé dans le domaine précédent.

---

# 9. Animation d'Invocation UI

## Direction validée

Le standalone doit profiter de l'interface graphique pour proposer une vraie séquence de révélation, contrairement au chat Twitch.

Référence d'intention fournie :
`https://www.youtube.com/watch?v=Zea_pd2AXEY`

Objectif :
- s'inspirer du rythme et de la montée en tension d'une invocation Genshin ;
- ne pas chercher à reproduire exactement les assets/effets de HoYoverse ;
- créer une animation web réaliste pour les moyens du projet.

### Comportement cible UI

Avant l'animation :
- le serveur calcule, valide et persiste l'intégralité du Pull/x10 ;
- l'animation ne décide jamais du résultat.

Animation :
- séquence visuelle courte de lancement ;
- signal de rareté avant la révélation ;
- effet clairement **doré** lorsqu'au moins un 5★ est présent dans le résultat ;
- possibilité d'un code visuel distinct pour un résultat 4★ ;
- révélation des récompenses une par une ;
- révélation 5★ plus spectaculaire ;
- en x10, progression résultat par résultat ;
- possibilité de passer/skip l'animation ;
- récapitulatif final de l'ensemble du Pull/x10.

Sécurité :
- fermer la page, skip ou cliquer rapidement ne doit jamais rejouer/modifier le Pull ;
- la transaction existe déjà côté serveur avant la présentation.

### Twitch / chat

Ne pas tenter d'animation.

Pour un multi-pull :
- conserver une restitution textuelle rapide, résultat après résultat ;
- même résultat serveur que l'UI ;
- présentation adaptée aux limites du chat.

---

# 10. Synchronisation automatique du catalogue Genshin

## Direction produit validée

L'objectif est d'éviter l'ajout manuel permanent des nouveaux personnages jouables Genshin.

Le backend devra pouvoir effectuer périodiquement un **job externe de synchronisation de catalogue**.

Ce job est séparé du reset critique du jeu :
- une API/site externe indisponible ne doit jamais empêcher un reset GachaImpact ;
- le job peut réessayer ultérieurement.

### Fonctionnement cible

1. récupérer les personnages connus depuis plusieurs sources externes ;
2. comparer avec le catalogue GachaImpact via identifiants stables et noms normalisés ;
3. détecter les nouveaux candidats ;
4. vérifier qu'ils sont réellement sortis/jouables ;
5. vérifier que les données essentielles sont présentes ;
6. récupérer/normaliser les informations françaises ;
7. importer automatiquement si les critères sont satisfaits ;
8. le personnage apparaît naturellement dans l'écran **Personnages** ;
9. en cas de données insuffisantes ou contradictoires, ne pas importer et réessayer lors d'un prochain cycle, sans demander une validation manuelle obligatoire.

### Garde-fous anti-leaks / données prématurées

Ne pas importer un personnage uniquement parce qu'il apparaît sur une source bêta/leak.

Conditions minimales avant import automatique :
- personnage officiellement jouable/sorti ou release confirmée et date de sortie atteinte ;
- nom fiable ;
- rareté connue ;
- élément connu ;
- identité suffisamment stable pour éviter un doublon ;
- absence de contradiction critique entre les meilleures sources disponibles.

Si l'élément, la rareté ou les informations essentielles manquent :
- ne pas importer encore.

La date de release doit être vérifiée sur le web avant activation automatique.

### Hiérarchie de sources — direction actuelle à réévaluer au moment de l'implémentation

La fraîcheur des sites change avec le temps. Ne jamais figer définitivement un fournisseur sans revalidation.

Ordre conceptuel recommandé :

**Niveau 1 — confirmation de sortie officielle**
- annonces officielles HoYoverse / Genshin Impact / HoYoLAB ;
- archives fiables des annonces officielles, par exemple KQM `GINews`, si l'accès direct officiel est difficile à automatiser.

**Niveau 2 — données structurées et détaillées**
- Honey Hunter, en privilégiant les données live et non bêta ;
- Gachabase, en distinguant strictement les versions live des endpoints/pages bêta ;
- `genshin-db` / `genshin-db-api` lorsqu'il est à jour sur la version courante.

**Niveau 3 — validation/localisation complémentaire**
- sources francophones récentes et fiables ;
- traduction officielle française lorsqu'elle est disponible ;
- données multilingues de `genshin-db` lorsque sa version couvre le personnage.

Au 2026-08-28 :
- Odette et Alyosha sont déjà présents dans plusieurs sources récentes ;
- les annonces archivées de la version 7.0 confirment Odette 5★ Cryo et Alyosha 4★ Electro ;
- Honey Hunter dispose de données live 7.0 pour les deux ;
- `genshin-db` annonce encore une couverture 6.7 dans son README actuel et ne doit donc pas être la seule source primaire pour les toutes dernières sorties à cette date.

### Français

Si une source structurée principale est en anglais :
- rechercher le nom/localisation française officielle ;
- préférer les données in-game françaises d'une source multilingue fiable ;
- utiliser les autres sources FR comme validation complémentaire ;
- ne pas inventer une traduction.

### Données propres à GachaImpact

Une source Genshin externe peut fournir des faits Genshin, mais ne doit pas inventer nos champs métier internes.

Exemples potentiels :
- classe GachaImpact ;
- passif GachaImpact ;
- règles d'éligibilité propres au jeu.

Le traitement automatique de ces champs reste à spécifier avant l'implémentation finale du catalogue auto-synchronisé.

---

# 11. Vue Admin / Modérateur — direction validée

Prévoir une interface d'administration séparée du gameplay normal.

Besoins identifiés :

### Catalogue personnages
- consulter le catalogue ;
- voir l'origine / date de synchronisation des données externes si utile ;
- ajouter un personnage ;
- modifier/corriger un personnage ;
- supprimer/désactiver facilement un personnage importé incorrectement.

### Joueurs / ressources
- rechercher un ou plusieurs joueurs ;
- ajouter/retirer des ressources ;
- ajouter/retirer/corriger des personnages possédés ou autres données si nécessaire ;
- effectuer des corrections administratives sans éditer directement la DB à la main.

Architecture :
- opérations protégées par rôle/permission ;
- journalisation des changements administratifs importants ;
- réutiliser les services métier centraux lorsque possible afin de ne pas contourner les invariants du jeu.

Les permissions exactes et l'UX Admin seront spécifiées plus tard.

---

# 12. Principes UX transversaux rappelés

Le prototype Codex n'est pas une source métier.

Cependant, le standalone doit exploiter son UI pour améliorer fortement les limites du Twitch legacy :
- informations autrefois séparées en plusieurs commandes peuvent être regroupées proprement dans des écrans/onglets ;
- les commandes Twitch restent plus concises et choisissent les informations essentielles ;
- l'UI peut proposer une richesse visuelle et une navigation impossible dans un chat Twitch.

Cette philosophie s'applique à Invocation mais aussi au Sac, aux Statistiques, aux profils et aux autres systèmes futurs.

---

# 13. Décisions validées à ce checkpoint

- R54 : rotation automatique chaque lundi 00:00 Europe/Paris ;
- R55 : 4 × 5★ + 6 × 4★ ;
- R56 : aucun personnage 5★ ou 4★ deux semaines consécutives ;
- R57 : 4e 5★ issu d'un tirage pondéré par votes ;
- R58 : un vote définitif par semaine ;
- R59 : choix libre parmi les 4 5★, changement libre, cible vidée à chaque rotation ;
- R60 : 160 Primogemmes par Pull, UI x1/x10, chat 1..10, aucune remise ;
- R61 : pity 5★ 0,6 % jusqu'à 73, soft pity +6 points/pull à partir de 74, garantie 90 ;
- R62 : pity 4★ 1,5 % jusqu'à 8, 19,5 % au 9e, garantie 10 ;
- R63 : priorité 5★ si les deux jets réussissent, pity 4★ conservée ;
- R64 : pity / garantie / Capture traversent rotations et changements de cible ;
- R65 : récompense secondaire 50 % Moras 5k–15k / 50 % particules 20–80 d'un élément aléatoire ;
- animation UI de Pull avec anticipation de rareté et révélation progressive ;
- Twitch conserve une sortie textuelle rapide ;
- synchronisation automatique future du catalogue sans validation manuelle obligatoire, avec garde-fous anti-leaks ;
- vue Admin/Modérateur prévue pour corrections catalogue et données joueurs ;
- `Wish.txt` reclassé Giveaway Twitch, à auditer plus tard.

---

# 14. Questions / audit restant

Prochaine passe prioritaire :
- 50/50 exact ;
- personnage obtenu lorsqu'un 50/50 est perdu ;
- garantie `guaranteedFeatured5` ;
- compteur `fiftyFiftyLostStreak` ;
- Capture de brillance ;
- interaction exacte entre garantie normale et Capture ;
- statistiques associées ;
- comportement multi-pull lorsque plusieurs 5★ arrivent dans un x10.

À auditer ensuite :
- distribution exacte des 4★ parmi les six personnages actifs ;
- passifs élémentaires affectant le Pull ;
- doublons / C0→C6 / au-delà C6 ;
- historique d'invocations souhaité dans la nouvelle UI ;
- modèle de catalogue auto-synchronisé et gestion des champs internes GachaImpact.
