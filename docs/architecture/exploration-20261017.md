# Exploration — contrat du17/10/2026

## Périmètre et frontière de livraison

Mandat propriétaire : jeu complet, entièrement qualifié, mais **review uniquement jusqu'à un nouveau GO humain explicite**. Aucun déploiement backend Exploration ni migration090 sur PostgreSQL public. Main conserve les finitions UI et le correctif Notifications indépendant. Le Master décrit l'état réel ; ce contrat ne vaut pas validation humaine.

## Autorité et partie

Le serveur authentifié résout le Player canonique ACTIVE et son élément permanent sous verrou Player. Les régions proviennent exclusivement des Characters publiés actifs, jamais des candidats/dry runs ; normalisation existante complétée par les aliases/casse/espaces/accents, Horizon exclu. Les dix régions constatées sont Mondstadt, Liyue, Inazuma, Sumeru, Fontaine, Natlan, Snezhnaya, Nod-Krai, Espace et Celestia. Toute nouvelle région publiée active est immédiatement consultable et rejoint la file de décors.

Labyrinthe version1,17×11, arbre creusé par parcours déterministe seedé, départ unique et exactement trois sorties distinctes accessibles. Seed et grille complète persistés. Les récompenses utilisent une **entropie cryptographique indépendante du seed de la grille**, sont tirées avant tout choix et persistées privées. Projection publique de la partie : grille/départ/positions des coffres, jamais seed de récompense, trois résultats cachés ou stock à choisir côté client.

Flèches maintenues, interpolation visuelle, collisions locales conformes à la grille serveur ; Espace ouvre un coffre adjacent. D-pad tactile et bouton Ouvrir, prise en charge simple de manette. Capture clavier limitée au plateau actif. Le client réduit les boucles de son chemin ; OPEN transmet seulement une preuve URDL bornée2048 caractères. Le serveur repart du départ persisté, vérifie chaque pas, les murs et l'adjacence à la sortie choisie. Aucun flux de positions vers le backend.

Une seule partie courante par Player et un seul coffre par partie, contrainte physique partielle et transactions Serializable sous verrou Player. Démarrer, OPEN, Arrêter, Suivant et Abandonner portent une clé UUID figée. BusinessOperation conserve empreinte canonique et réponse originale ; relance identique rend le reçu original, clé différente/après autre coffre/ancienne session refusée. Suivant exige un coffre ouvert, clôt l'ancien labyrinthe et crée immédiatement le suivant dans la même région. Arrêter retrouve la sélection et garde tous les gains/progrès.

## Réserves et économie

Par Player/région :100 coffres de500Primos,200 de20 000Moras,300 de300particules personnelles,400 de100autres particules (un des six autres éléments). Un coffre utile effectivement ouvert consomme une unité, jamais les deux coffres non choisis. Tirage pondéré par les stocks restants ; coffre vide peu fréquent au départ puis croissant avec l'épuisement. Jamais trois vides avant100%. Une catégorie restante peut apparaître dans plusieurs résultats cachés puisque seule une ouverture est possible ; aucune substitution de catégorie après le choix.

À1 000utiles exactement,100% : chaque nouveau labyrinthe a un vide,1–5particules personnelles et1–5autres, positions mélangées. Aucun Primo/Mora ni progression supplémentaire. Aucun plafond quotidien ou limite d'essais. Les compteurs restent entre leurs bornes sous contraintes SQL.

OPEN valide partie/chemin/élément/stock, incrémente le bon compteur, crédite par PrismaEconomyService et journalise le reçu dans la même transaction. Les verrous ressources, mouvements et statistiques économiques habituels restent autoritatifs. Une exception après un crédit annule aussi crédit, compteur, coffre et reçu. Un changement administratif d'élément pendant une partie interdit l'ouverture ; Arrêter/Abandonner restent possibles, sans réécrire le résultat caché.

## Présence et abandon

Présence légère toutes3secondes, sans coordonnées, uniquement dans le contexte Exploration. UUID d'onglet et séquence monotone persistés, événements retardés ignorés. Partie ACTIVE : échéance serveur10s après dernière présence fraîche ; départ explicite abandonne sans gain lorsqu'aucun autre onglet n'est présent. OPENED : le départ laisse une grâce de10s ; retour à temps conserve choix/butin, sinon fin de l'étape sans jamais reprendre un gain ou en accorder un autre. Fermeture brutale couverte par l'échéance persistée ; reprise serveur ne ressuscite aucune partie expirée. Réconciliation à la lecture/action et maintenance partagée ; aucun minuteur par joueur. Les fenêtres de10s se mesurent depuis le dernier signal authentifié reçu par le serveur, seule observation disponible après une fermeture brutale.

## Modèle physique proposé par migration090

- `exploration_region_progress` : PKPlayer/région, quatre compteurs utiles bornés.
- `exploration_sessions` : Player/élément/région, seed/grille, trois récompenses privées, état, résultat ouvert, décor local, présences, échéance et fin. Index unique Player où ended_atNULL.
- `exploration_backgrounds` : candidats/droits/attribution, dimensions, chemin local/hash et approbation.
- `exploration_background_search` : région, jour Paris du dernier essai, bail partagé et résultat de recherche.

RLS activée et aucun droit PUBLIC/anon/authenticated sur les quatre tables. Aucun backfill joueur ou changement d'économie existante. Effacement de compte : trois FKs et quatre colonnes JSON classifiés, progression/sessions appartenant au Player supprimées et reçus BusinessOperation expurgés par le mécanisme existant ; pairs et catalogues de fonds conservés. La signature de coordination Twitch089 déjà absente de l'inventaire précédent est également classifiée, sans prétendre à un essai public de suppression.

## Décors et assets

PNG imposés : coffre `4883370.png` et silhouette noire `63699.png`, copiés dans `/assets/exploration/`. Recompression PNG lossless du coffre21613→21060octets, silhouette4977octets inchangée ; pixels/transparence identiques. Contour blanc dessiné au rendu ; aucun visuel de remplacement. Origine : fichiers fournis par le propriétaire ; aucune licence tierce inventée.

Stock de cinq fonds maximum approuvés par région. Le CatalogueScheduler existant réveille la file après son cycle, sans nouvel hébergement. Un essai par région/jour Paris à partir de03h, rattrapage du jour uniquement ; aucune recherche sur région déjà pleine. Découverte Commons limitée à cinq métadonnées candidates par région ; aucune image issue d'une recherche n'est publiée automatiquement. Import contrôlé : image paysage réelle, hash local, source, licence réutilisable et attribution vérifiées explicitement ; fichier servi localement, aucun hotlink ni téléchargement par labyrinthe. Tirage parmi le stock approuvé à la création, réutilisation autorisée, fond cover/overlay et géométrie fixe. Stock vide/erreur : fond graphique local de secours, jeu disponible.

Références primaires consultées : [API Imageinfo](https://www.mediawiki.org/wiki/API:Imageinfo/en) pour URL/dimensions/extmetadata ; [réutilisation Commons](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia) pour la vérification individuelle des droits et de l'attribution. La recherche n'est jamais une preuve de licence. Aucun stock de50images ni droit sur des captures de jeu n'est prétendu acquis.

## Qualification et recette

Tests purs : déterminisme/topologie/collisions sur1 000seeds, trois sorties et preuves de chemins, quotas épuisés/dernier coffre et triple infini. PostgreSQL réel exclusivement dans `batch_test_<UUID>` via le fixture existant, migration deploy/status répétés et nettoyage ;15/15PASS, concurrence deux onglets, relances, rollback après vrai crédit, reprise serveur, présences/expiration,999→1000, stock de décors et deux imports simultanés du même candidat. Ce dernier cas a révélé une lecture avant verrou en prérevue, corrigée par relecture sous verrou. Effacement de compte16cas qualifiés cumulativement :14dans la passe initiale, deux dépassements du budget de test30s puis deux réussites avec budget120s, sans changer le service. Aucun test public. Full8/8 acquis avant les ultimes retouches UI ; la qualification finale au SHA de reprise reste nécessaire.

## Recette locale et point de reprise

Depuis server/, lancer npm.cmd run exploration:rehearse avec la configuration locale existante. Le lanceur crée un nouveau schéma batch_test_UUID, applique les90migrations avec Prisma deploy/status, copie seulement les catalogues publiés de référence et crée quatre comptes synthétiques. API127.0.0.1:3187, GameShell compilé sur127.0.0.1:5187 ; aucune route de recette enregistrée dans l'application publique. Profils normal(Cryo),999(Cryo),1000(Electro),hydro(Hydro500) : http://127.0.0.1:5187/local-data/exploration-rehearsal/index.html?profile=normal#exploration ; remplacer normal par le profil voulu. Ctrl+C ferme les serveurs et nettoie le seul schéma privé. Les autres écrans emploient des fixtures ; seuls Exploration et les ressources sont reliés aux vrais services privés. L'état de recette est jetable, aucun compte public copié.

Parcours réel automatisé acquis sur les quatre profils : Démarrer, chemin au clavier, Espace/ouverture, Suivant/nouveau seed, Abandonner et gains PostgreSQL réels. Passage999→1000 observé et mode infini conservé à1000. Une première capture a révélé des icônes de butin rendues à leur taille naturelle, corrigées par dimensions explicites de leurs images ; contrôle final repris avant checkpoint. Recherche Commons réellement exécutée : dix régions sans candidat qualifié, zéro image approuvée ; fond de secours utilisé. Import : npm.cmd run exploration:background:import -- --schema batch_test_UUID --candidate UUID --file paysage.png --rights-confirmed ; licence/attribution du candidat, paysage décodable, hash et limites vérifiés, aucune approbation automatique. La commande discover ne collecte que les métadonnées et refuse les schémas publics.

Pause demandée par le propriétaire pour la nuit : le Master décrit les contrôles terminés, les limites et la première action du lendemain. Le checkpoint review n'est pas une livraison B entièrement qualifiée ni un GO de promotion. Recette locale arrêtée à la pause et schéma de QA supprimé ; relancer la commande pour recréer les profils. Avant toute recette privée Prisma, attendre la fin d'un éventuel déploiement public : le verrou de migration Prisma est partagé au niveau base, même entre schémas.
