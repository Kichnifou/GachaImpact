# 06 — Audit legacy : Gacha / Invocation

Statut : AUDIT EN COURS — R54 À R95 VALIDÉS — CŒUR DE PULL QUASI FINALISÉ
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
- la transaction existe déjà côté serveur avant la présentation ;
- un x10 est entièrement calculé et persisté côté serveur avant le début de l'animation ;
- les 10 résultats sont calculés séquentiellement pour respecter pity, garantie, Capture et passifs ;
- leur persistance est atomique : soit l'ensemble du x10 est enregistré, soit aucun état partiel ne reste appliqué ;
- si le client crash ou est fermé pendant l'animation, toutes les récompenses déjà validées côté serveur restent acquises ;
- après reconnexion, Box, ressources, pity et historique reflètent immédiatement le résultat réel déjà enregistré.

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

# 13. 50/50 / Garantie / Capture de brillance

## R66 — Perte du 50/50 — ✅ VALIDÉ

Lorsqu'un vrai 50/50 est perdu :
- le joueur n'obtient pas un personnage issu d'un pool standard externe ;
- le résultat est choisi aléatoirement parmi les **3 autres personnages 5★ actifs de la bannière**.

Exemple :
- bannière : Skirk / Xiao / Jean / Nomade ;
- cible : Skirk ;
- 50/50 gagné → Skirk ;
- 50/50 perdu → Xiao, Jean ou Nomade, avec tirage uniforme parmi les trois.

---

## R67 — Garantie normale — ✅ VALIDÉ

Après une vraie perte de 50/50 :
- `guaranteedFeatured5 = true` ;
- le prochain 5★ obtenu est obligatoirement le personnage actuellement ciblé ;
- la garantie est ensuite consommée et repasse à `false`.

La garantie :
- traverse les rotations de bannière ;
- traverse les changements de cible ;
- s'applique toujours à la cible actuelle au moment où le 5★ est obtenu.

L'utilisation d'une garantie normale ne remet pas la progression Capture à zéro.

---

## R68 — Progression Capture de brillance — ✅ VALIDÉ / MODIFIÉ PAR RAPPORT AU LEGACY

La progression métier cible est distincte du streak statistique.

Nouvelle donnée conceptuelle :

`captureProgress`

Valeurs :
- 0 à 3.

Lors d'une vraie perte de 50/50 :
- `captureProgress +1` ;
- maximum 3/3.

Lors d'une vraie victoire de 50/50 :
- `captureProgress -1` ;
- minimum 0/3.

Exemples :
- 0/3 + victoire → 0/3 ;
- 1/3 + victoire → 0/3 ;
- 2/3 + victoire → 1/3.

Lors de l'utilisation d'une garantie normale :
- `captureProgress` ne change pas.

À 3/3 :
- la prochaine Capture disponible garantit le personnage ciblé ;
- après déclenchement réel de la Capture : `captureProgress = 0`.

---

## R69 — Une victoire 50/50 ne reset plus automatiquement la Capture — ✅ VALIDÉ

Le comportement legacy qui ramenait la progression de Capture directement à zéro après une victoire naturelle est remplacé.

Nouvelle règle :
- une victoire naturelle retire exactement 1 point de progression ;
- jamais moins de 0.

Cette règle remplace l'ancienne logique de reset complet.

---

## R70 — Plusieurs 5★ dans un même x10 — ✅ VALIDÉ

Un x10 est composé de 10 Pulls métier traités séquentiellement.

Chaque résultat peut modifier l'état utilisé par le suivant.

Exemple possible dans un même x10 :
1. 5★ #1 → perte du 50/50 ;
2. garantie activée ;
3. 5★ #2 → personnage ciblé via garantie ;
4. si `captureProgress` était déjà suffisamment avancée, un 5★ ultérieur peut ensuite déclencher la Capture.

Le calcul serveur respecte strictement l'ordre réel des dix Pulls.

---

## R71 — Statistiques 50/50 et Capture — ✅ VALIDÉ / BUG LEGACY CORRIGÉ

Le legacy augmente parfois `fiftyFiftyWon` lorsqu'une Capture de brillance se déclenche, alors qu'aucun vrai 50/50 n'a été tiré.

Ce comportement est considéré comme une incohérence statistique legacy.

Cible GachaImpact :

`fiftyFiftyWon`
- compte uniquement les vrais 50/50 aléatoires gagnés.

`fiftyFiftyLost`
- compte uniquement les vrais 50/50 aléatoires perdus.

Ajouter conceptuellement :
`capturesTriggered`
- nombre de Captures de brillance réellement déclenchées depuis GachaImpact.

Migration :
- migrer les anciens compteurs tels quels ;
- ne pas reconstruire rétroactivement les Captures historiques impossibles à prouver ;
- `capturesTriggered` démarre à 0 lors du passage vers GachaImpact.

---

## R72 — Affichage Garantie / Capture — ✅ VALIDÉ

L'interface doit pouvoir afficher simultanément les deux états.

Exemple :

`Garantie 5★ : oui`
`Capture : 3/3`

ou :

`Garantie 5★ : non`
`Capture : 1/3`

Ne pas ajouter automatiquement un texte supplémentaire du type :
- « prochain 5★ = garantie » ;
- « 5★ suivant = Capture ».

L'état doit rester compact et lisible.

---

## R73 — `fiftyFiftyLostStreak` et `captureProgress` sont deux concepts distincts — ✅ VALIDÉ

`fiftyFiftyLostStreak` :
- représente uniquement le nombre de **vrais 50/50 perdus consécutivement** ;
- une vraie victoire de 50/50 remet le streak à 0 ;
- une garantie normale n'est ni une victoire ni une perte de 50/50 ;
- une Capture n'est ni une victoire ni une perte de 50/50.

`captureProgress` :
- pilote réellement la mécanique de Capture ;
- suit les règles R68/R69.

Le streak ne doit plus piloter directement la Capture.

Migration :
- le legacy ne possède qu'un seul champ servant historiquement aux deux concepts ;
- lors du cutover, la valeur legacy de `fiftyFiftyLostStreak` sert de point de départ à la fois au streak courant et à `captureProgress` ;
- `captureProgress` reste bornée à 0..3 ;
- après migration, les deux valeurs évoluent indépendamment selon leurs règles propres.

---

## R74 — Garantie / Capture utilisent toujours la cible actuelle — ✅ VALIDÉ

Si un joueur :
1. perd un 50/50 en ciblant A ;
2. change ensuite sa cible vers B ;

sa garantie suivante concerne **B**.

Même principe après une rotation hebdomadaire :
- ancienne cible vidée ;
- pity / garantie / Capture conservées ;
- nouvelle cible choisie ;
- les mécanismes utilisent cette nouvelle cible.

---

# 14. Passifs élémentaires appliqués au Pull

## R75 — Origine et stacks — ✅ VALIDÉ

Seuls les personnages de la **team active** activent leurs passifs élémentaires.

Règles :
- maximum 2 stacks par élément ;
- 3 ou 4 personnages du même élément n'apportent pas davantage ;
- plusieurs éléments différents peuvent être actifs simultanément.

Exemple :
- 1 Pyro + 1 Hydro + 1 Electro + 1 Anemo → quatre passifs niveau 1 ;
- 3 Hydro + 1 Pyro → Hydro niveau 2 + Pyro niveau 1.

---

## R76 — Pyro / Geo — ✅ VALIDÉ

Pyro :
- 1 stack → récompense secondaire en particules ×1,25 ;
- 2 stacks → ×1,5.

Geo :
- 1 stack → récompense secondaire en Moras ×1,25 ;
- 2 stacks → ×1,5.

Ces multiplicateurs s'appliquent uniquement à la **récompense secondaire normale du Pull**.

Ils ne multiplient pas :
- remboursement C6 ;
- jackpot Dendro ;
- récompenses d'autres systèmes ;
- autres crédits indépendants du Pull secondaire.

---

## R77 — Hydro — ✅ VALIDÉ

Hydro augmente directement la probabilité 5★ :

- 1 stack → +0,3 point de pourcentage ;
- 2 stacks → +0,6 point de pourcentage.

Exemple :
- 0,6 % → 0,9 % avec 1 Hydro ;
- 0,6 % → 1,2 % avec 2 Hydro.

La probabilité finale ne peut jamais dépasser 100 %.

---

## R78 — Cryo — ✅ VALIDÉ

Cryo :
- 1 stack → 1 chance sur 20 d'obtenir +1 XP par Pull ;
- 2 stacks → 1 chance sur 10.

Correction architecture :
- le legacy modifie directement le champ XP ;
- GachaImpact doit passer par le moteur XP central.

Ainsi un +1 XP obtenu via Cryo peut correctement déclencher :
- level-up ;
- récompense ;
- overflow niveau 100 ;
- notification/tutoriel associé.

---

## R79 — Electro — ✅ VALIDÉ / COMPORTEMENT AMÉLIORÉ

Electro :
- 1 stack → 1/30 de +2 pity 5★ ;
- 2 stacks → 1/20.

Contrairement à l'ordre legacy :
- le proc Electro est appliqué **après la résolution du Pull**.

Conséquence :
si Electro proc sur un Pull qui donne un 5★ :
- la pity du 5★ est d'abord remise à 0 ;
- le bonus Electro est ensuite appliqué ;
- nouvelle pity = 2.

Le passif ne doit donc plus être perdu silencieusement.

---

## R80 — Anemo — ✅ VALIDÉ

Anemo :
- 1 stack → 1/12 de récupérer 80 Primogemmes ;
- 2 stacks → 1/8.

Le proc peut se produire sur n'importe quel Pull :
- récompense secondaire ;
- 4★ ;
- 5★.

Le crédit passe par le moteur Ressources central.

---

## R81 — Dendro — ✅ VALIDÉ / TEXTE LEGACY À CORRIGER

Dendro :
- 1 stack → 1/25 ;
- 2 stacks → 1/15.

Lors du proc :
- +40 Primogemmes ;
- +1 000 Moras ;
- +5 particules **de chacun des sept éléments**.

Le texte legacy parlant de « particules aléatoires » est incorrect.

Cible :
- conserver la mécanique réelle ;
- corriger le texte/description.

Le proc peut se produire quel que soit le résultat principal du Pull.

---

## R82 — `fiftyFiftyLostStreak` devient une statistique indépendante — ✅ VALIDÉ

Le streak mesure les pertes consécutives de **vrais 50/50**.

Il peut dépasser 3.

Exemple :
- trois vrais 50/50 perdus → streak 3 ;
- garanties/Capture intermédiaires ne changent pas le streak ;
- vrai 50/50 suivant encore perdu → streak 4 ;
- première vraie victoire suivante → streak 0.

Il n'a plus de rôle direct dans le déclenchement de la Capture.

---

## R83 — Plusieurs passifs peuvent proc simultanément — ✅ VALIDÉ

Les passifs probabilistes sont indépendants.

Un même Pull peut théoriquement déclencher simultanément :
- Cryo ;
- Electro ;
- Anemo ;
- Dendro.

Il n'existe pas de règle « un seul passif par Pull ».

---

## R84 — Passifs calculés pour chaque Pull d'un x10 — ✅ VALIDÉ

Un x10 produit dix Pulls métier.

Les passifs sont :
- testés ;
- appliqués ;
- journalisés

pour chaque Pull individuel.

Exemple :
un Anemo à 1/8 dispose de dix tirages indépendants dans un x10.

---

# 15. Copies / Constellations / C6

## R85 — Copies et Constellations — ✅ VALIDÉ

Progression :

- 1re copie → C0 / copies = 1 ;
- 2e copie → C1 ;
- ...
- 7e copie → C6 / copies = 7 ;
- 8e copie et suivantes → constellation reste C6 mais `copies` continue d'augmenter.

`firstObtainedAt` reste la date de toute première obtention.

---

## R86 — Remboursement C6+ — ✅ VALIDÉ / VALEURS MODIFIÉES

À partir de la 8e copie :

Personnage 4★ déjà C6 :
- **+80 Primogemmes**.

Personnage 5★ déjà C6 :
- **+160 Primogemmes**.

Ces valeurs remplacent les anciens remboursements legacy 40 / 80.

Le crédit :
- passe par le moteur Ressources ;
- alimente correctement les statistiques de Primogemmes gagnées ;
- possède une cause métier dédiée de remboursement doublon C6+.

---

## R87 — Doublon 5★ C6+ et Concours — ✅ VALIDÉ

Chaque nouvelle copie d'un personnage 5★ déjà C6 déclenche également la progression du domaine C6 / Concours.

Principe actuel :
- sélectionner aléatoirement une statistique encore inférieure à 20 ;
- +1 sur cette statistique.

Statistiques concernées :
- Force ;
- Intelligence ;
- Beauté ;
- Charisme ;
- Popularité.

Si les cinq statistiques ont déjà atteint 20 :
- compensation actuelle : +100 000 Moras.

Le domaine Gacha déclenche cette progression.
Le domaine Concours restera propriétaire de ses règles détaillées lors de son audit dédié.

---

## R88 — Déblocage Concours au C6 — ✅ VALIDÉ

Lorsqu'un personnage 5★ atteint C6 pour la première fois :
- créer/initialiser son état Concours ;
- les cinq statistiques commencent à 1.

À partir de la copie suivante :
- appliquer la progression R87.

Direction UI future :
- la section/fenêtre **Concours** ne doit apparaître pour un joueur que lorsqu'il possède au moins un personnage 5★ C6.

Le détail UX sera conçu pendant l'audit Concours.

---

# 16. Exécution x10 / Historique / Statistiques de Pull

## R89 — x10 calculé et persisté avant animation — ✅ VALIDÉ

Lors d'un `Invocation x10` :

1. vérifier les 1 600 Primogemmes ;
2. créer l'opération serveur ;
3. calculer séquentiellement les 10 Pulls ;
4. appliquer pity, 50/50, garantie, Capture, passifs, doublons et ressources dans l'ordre ;
5. enregistrer l'intégralité de l'opération ;
6. seulement ensuite transmettre les résultats à l'UI pour animation.

Atomicité :
- le x10 est une seule opération économique atomique ;
- aucun état partiel ne doit rester si la transaction serveur échoue avant validation.

Après validation serveur :
- les récompenses sont définitivement acquises ;
- fermer/crasher l'UI pendant l'animation ne les annule pas ;
- à la reconnexion, l'état du joueur et l'historique montrent les dix résultats déjà obtenus.

L'animation est uniquement une représentation d'un résultat déjà persisté.

---

## R90 — Distribution des 4★ — ✅ VALIDÉ

Lorsqu'un Pull produit un personnage 4★ :
- choisir uniformément l'un des 6 personnages 4★ actifs.

Il n'existe pas :
- de cible 4★ ;
- de 50/50 4★ ;
- de protection anti-répétition entre plusieurs 4★ obtenus.

Un même personnage 4★ peut donc apparaître plusieurs fois successivement.

---

## Anomalie de robustesse legacy — bannière invalide — À CORRIGER

La bannière cible doit toujours contenir :
- exactement 4 personnages 5★ valides ;
- exactement 6 personnages 4★ valides.

Une génération invalide ne doit pas devenir active.

Ne pas reproduire les fallbacks legacy qui remplaceraient silencieusement un personnage garanti par une récompense secondaire lorsque le catalogue de bannière est incomplet.

En cas d'échec de génération :
- conserver un état serveur sûr ;
- journaliser l'erreur ;
- alerter l'administration ;
- ne pas publier une bannière corrompue.

---

## R91 — Historique complet des Pulls — ✅ VALIDÉ

À partir du lancement de GachaImpact, conserver l'historique complet des Pulls côté serveur.

L'historique doit pouvoir représenter suffisamment d'informations pour reconstruire/auditer un Pull, notamment conceptuellement :
- joueur ;
- timestamp ;
- opération x1/x10 ;
- ordre du Pull dans l'opération ;
- pity ;
- résultat ;
- rareté ;
- personnage ou ressource obtenue ;
- 50/50 gagné/perdu ;
- garantie ;
- Capture ;
- passifs déclenchés ;
- doublon / constellation ;
- autres événements importants.

Ne pas figer ici le schéma SQL exact.

### UI Historique

L'écran Invocation possède un bouton **Historique**.

Ouverture :
- fenêtre/panneau superposé ;
- **10 résultats par page** ;
- première page = 10 Pulls les plus récents ;
- page suivante = les dix précédents ;
- pagination côté serveur.

Conserver l'historique complet depuis GachaImpact sans purge automatique annuelle par défaut.

Si la volumétrie devient un jour réellement problématique :
- les anciens Pulls pourront être archivés techniquement ;
- ils devront rester consultables ;
- ne pas supprimer l'historique joueur uniquement pour économiser de l'espace prématurément.

Le legacy ne possède pas l'historique détaillé complet de chaque Pull.
Ne pas inventer les Pulls antérieurs au cutover.

---

## R92 — Migration des statistiques Gacha legacy — ✅ VALIDÉ

Migrer telles quelles :
- `totalPulls` ;
- `totalFiveStars` ;
- `totalFourStars` ;
- `fiftyFiftyWon` ;
- `fiftyFiftyLost` ;
- `fiftyFiftyLostStreak`.

Ne pas reconstruire rétroactivement.

La statistique historique `fiftyFiftyWon` peut contenir l'anomalie legacy liée aux Captures.

À partir de GachaImpact :
- les nouvelles valeurs suivent les règles corrigées.

Initialisation cible :
- `fiftyFiftyLostStreak` reprend la valeur legacy actuelle ;
- `captureProgress` reprend également la progression legacy actuelle, dans la limite 0..3 ;
- `capturesTriggered = 0`, faute d'historique fiable permettant de le reconstruire.

---

## R93 — `lastPullWasFiveStar` devient dérivable — ✅ VALIDÉ

Le legacy conserve `lastPullWasFiveStar` pour détecter un back-to-back.

Dans GachaImpact :
- l'information devient dérivable depuis l'historique du dernier Pull ;
- ne pas maintenir durablement un deuxième état redondant.

Migration :
- le champ legacy peut servir de valeur transitoire au cutover afin de conserver le contexte du tout premier Pull GachaImpact ;
- après création de l'historique natif, utiliser l'historique comme source de vérité.

---

## R94 — Early / Back-to-back / Hard — ✅ VALIDÉ

Conserver les petits événements de Pull.

### Early
Legacy :
- 5★ obtenu avec pity comprise entre 2 et 35.

### Back-to-back
- 5★ obtenu immédiatement après un autre 5★.

### Hard
Nouvelle catégorie :
- 5★ obtenu à partir de **80 de pity**.

Utilisation :
- côté Twitch/chat : conserver ou enrichir les petites mentions textuelles ;
- côté UI : aucun affichage permanent nécessaire.

Idée UI future facultative :
- petite mention temporaire ;
- effet doré / brillant / multicolore ;
- animation spéciale légère.

Ne pas considérer cette idée visuelle comme obligatoire pour la V1.

Statistiques futures dérivables depuis l'historique :
- nombre d'Early ;
- nombre de Back-to-back ;
- nombre de Hard ;
- meilleur Early ;
- pity moyenne ;
- autres statistiques similaires.

Le passage en soft pity n'a pas besoin d'une information permanente supplémentaire dans l'UI.

---

## R95 — Arrondi Pyro / Geo — ✅ VALIDÉ

Lorsqu'un multiplicateur produit une valeur décimale :
- arrondir à l'entier le plus proche ;
- une valeur exactement à `.5` est arrondie vers le haut.

Exemples :
- 34,4 → 34 ;
- 34,5 → 35 ;
- 34,6 → 35.

Ne pas dépendre implicitement du comportement `Math.Round` legacy « au pair ».

---

# 17. Décisions validées à ce checkpoint

- R54 à R65 : bannière, vote, sélection, coût, pity et récompenses secondaires ;
- R66 : perte 50/50 = un des trois autres 5★ actifs ;
- R67 : garantie normale sur la cible actuelle ;
- R68/R69 : `captureProgress` +1 sur perte, -1 sur victoire, reset uniquement après Capture ;
- R70 : plusieurs 5★ d'un x10 interagissent séquentiellement ;
- R71 : `fiftyFiftyWon/Lost` uniquement pour de vrais 50/50 + nouveau `capturesTriggered` ;
- R72 : affichage compact Garantie oui/non + Capture X/3 ;
- R73 : séparation `fiftyFiftyLostStreak` / `captureProgress` ;
- R74 : garantie et Capture suivent la cible actuelle ;
- R75 : passifs issus uniquement de la team active, maximum deux stacks ;
- R76 : Pyro/Geo x1,25/x1,5 sur récompenses secondaires correspondantes ;
- R77 : Hydro +0,3/+0,6 point de chance 5★ ;
- R78 : Cryo +1 XP avec 1/20 ou 1/10 via moteur XP ;
- R79 : Electro +2 pity après résolution du Pull ;
- R80 : Anemo remboursement 80 Primogemmes ;
- R81 : Dendro +40 primos/+1000 Moras/+5 de chaque particule ;
- R82 : streak de pertes pur et potentiellement >3 ;
- R83 : plusieurs passifs peuvent proc ensemble ;
- R84 : passifs calculés individuellement pour chaque Pull d'un x10 ;
- R85 : copies continuent après C6 ;
- R86 : remboursement C6+ = 80 primos 4★ / 160 primos 5★ ;
- R87 : doublon 5★ C6+ progresse une statistique Concours ;
- R88 : C6 5★ initialise les cinq stats Concours à 1 et débloque la section Concours ;
- R89 : x10 calculé/persisté atomiquement avant animation ;
- R90 : 4★ uniforme parmi les six actifs ;
- R91 : historique complet permanent depuis GachaImpact, 10 résultats par page ;
- R92 : statistiques legacy migrées telles quelles ;
- R93 : `lastPullWasFiveStar` devient dérivable ;
- R94 : Early / Back-to-back / Hard conservés ;
- R95 : arrondi `.5` vers le haut pour Pyro/Geo.

Autres directions déjà validées :
- animation UI ;
- Twitch textuel ;
- catalogue Genshin auto-synchronisé ;
- garde-fous anti-leaks ;
- français ;
- Admin/Modérateur ;
- `Wish.txt` reporté au Giveaway Twitch.

---

# 18. Audit restant

Le cœur de `Pull.txt` est désormais quasi entièrement spécifié.

Dernière passe Gacha avant de décider une éventuelle clôture du domaine :
- relire `Banniere.txt`, `Vote.txt`, `Select.txt` et `Pity.txt` pour leurs derniers edge cases ;
- vérifier les interactions restantes entre génération hebdomadaire, votes et catalogue auto-synchronisé ;
- vérifier les cas catalogue insuffisant pour produire 4×5★ + 6×4★ ;
- vérifier les détails de présentation chat/Twitch qui appartiennent réellement au Gacha ;
- vérifier s'il reste des champs Gacha legacy non classés.

Le fonctionnement détaillé du Concours reste reporté au domaine Concours/C6 même si ses hooks Gacha sont désormais identifiés.