# Personnalisation du profil V1

## Cadres, intentions et nouveautés — R1095

Avatars/Titres gardent recherche/tris hors catalogue scrollable encadré. Seul Possédé disparaît de leurs cartes et libère le nom ; Badges reste inchangé. Une notification ouvre le sélecteur de la catégorie concernée sur le propre profil via token consommé, même depuis autrui ou l’autre onglet. Fenêtre de chargement fermable ; réponse tardive sans réouverture.

Une arrivée simple ne consulte rien. L’ouverture présente les nouveautés pertinentes et fige leur repère/priorité pendant cette ouverture, même après ACK ; réouverture suivante reflète l’état serveur confirmé. Catégories et filtres conservés, Tutoriel sans consultation, erreur sans faux succès ni boucle ; réouverture permet le réessai. Une nouvelle acquisition reçue pendant l’ouverture est traitée séparément.

## Pseudo de présentation — R1095

Le propre Profil > Aperçu propose un crayon après le symbole d’élément. L’édition compacte est préremplie, confirme explicitement ou annule, accepte Entrée/Échap, garde le focus visible et interdit les doubles envois en attente. Un profil tiers et le Tutoriel n’offrent aucune écriture. Après confirmation, le Profil et l’identité courante sont actualisés sans déconnexion ; les réponses d’une ancienne session ne remplacent pas le Player courant.

`Player.presentationName`, nullable et distinct de `displayName`, porte uniquement cette présentation. La projection commune `presentedName` revient au nom existant en absence de valeur. UUID, Supabase, Twitch User ID/login, `legacyUsername`, rôles, possessions et historique restent inchangés. Les synchronisations Twitch continuent d’écrire leur propre identité ; aucun backfill ni réécriture des snapshots historiques. Les recherches de présentation utilisent le nom actuel ; l’annuaire garde aussi l’ancien nom comme alias de référence. Une résolution textuelle ambiguë ne choisit jamais le premier Player. Les sélections UI/MP/Échanges restent des UUID ; une mention structurée ne remplace pas sa cible si son étiquette change.

`PATCH /api/v1/me/presentation-name` accepte seulement `{ name, expectedRevision }`, résout le Player depuis la session, verrouille cette ligne et revalide ACTIVE. La règle existante de 1 à 40 unités UTF-16 après trim est conservée ; contrôles C0/C1, séparateurs de ligne/paragraphe, contrôles directionnels, espace zéro-largeur et BOM sont refusés. Les caractères Unicode légitimes, dont les jointures d’emoji, restent acceptés et rendus comme texte. Aucun coût, cooldown, privilège ou unicité globale ; la même valeur est un no-op sans changer `updatedAt`. Le compteur `presentationNameRevision` commence à zéro et augmente uniquement lors d’un changement. Le serveur compare `expectedRevision` sous verrou : une intention devenue ancienne, y compris après un retour au même nom (ABA), reçoit un conflit409. Le doublon d’un nom déjà confirmé reste un no-op ; une erreur n’autorise pas une ancienne intention à écraser une écriture plus récente. La migration additive082 garde les valeurs en cas de retrait de l’interface : aucun rollback destructif.

État de livraison, tests, reviews du SHA et recette publique : Master. Ce contrat décrit le comportement cible implémenté localement, pas une validation humaine publique.

## Aperçu équipé — R1090

L’aperçu desktop donne plus de présence au portrait équipé, pseudo, titre, statut et bouton Choisir : avatar proportionnel de 72 à 144 px selon hauteur utile, espacements et textes adaptés. Faible hauteur ≤650 conserve un avatar 32 px et une composition compacte. Les trois onglets utilisent le même aperçu ; dix Badges restent consultables simultanément. Mécanismes Choisir/confirmation/fermeture/reset de R1089 validés par le propriétaire et conservés, avec nouveautés, tutoriel et autorité serveur. Aucun grand fond vide ajouté pour simuler l’agrandissement. Qualification technique au Master ; appréciation esthétique R1090 future.

## Confirmation et réouverture — R1089

Chaque clic Choisir remet recherche vide, tri date d’obtention et ordre plus récents. Il ne réinitialise pas les consultations et priorités de nouveautés R1052. Après confirmation serveur d’un Avatar/Titre, y compris avatar élémentaire et aucun titre, rafraîchir le Profil/Sidebar puis fermer l’ouverture ayant lancé l’action. Une réponse tardive ne ferme pas une nouvelle ouverture ou un autre onglet ; le verrou de requête empêche deux équipements concurrents. Une erreur garde la fenêtre ouverte avec son message et permet le réessai. Fermeture manuelle, focus, Échap et Tutoriel conservés ; Badges reste dans son onglet.

## Présentation — R1087, 14/10/2026

Avatars et Titres montrent l’équipement confirmé et un bouton bleu **Choisir**. Le catalogue correspondant s’ouvre dans une fenêtre dédiée, avec recherche, tri, options élémentaire/sans titre, états et actions existants. Aucun catalogue doublé derrière. Fermeture par Échap, croix ou fond, focus rendu au déclencheur et défilement du fond suspendu. Une fermeture ne confirme pas un équipement ; erreur et attente restent rattachées à l’action.

La consultation R1052 commence seulement à l’ouverture réelle de la liste, selon son filtre ; priorité des nouveautés conservée pour la visite. Le Tutoriel présente la fenêtre sans consultation ni équipement. Un équipement en vol reste unique et sa réponse après démontage n’actualise pas un autre profil. Badges conserve ses dix choix simultanés dans l’onglet, sans fenêtre ni pagination ; Aucun badge et toutes les actions restent visibles en desktop compact. Identité, droits, catalogue et gratuité inchangés. Preuves et état de livraison au Master.

## Étude des thèmes — 13/10/2026

R1081 : le propriétaire accepte l'abandon des thèmes après cet audit. Aucun chantier de thèmes, bouton Soleil ou refonte CSS générale n'est prévu dans le mandat de finitions ni à réintroduire automatiquement dans la pré-release.

Le mandat conditionnait les thèmes à une centralisation raisonnable démontrée. L'audit CSS/portails conclut que les tokens actuels ne suffisent pas sans migration générale dispersée :1356 lignes de couleurs directes App.css et douze autres feuilles, états métier mêlés à décoration. Aucune implémentation de thème ni préférence supplémentaire ; palette actuelle et apparence métier conservées. Le constat est une limite de ce périmètre, pas une interdiction définitive. Preuve datée au [grand audit](../architecture/evidence/documentation-audit-20261013.md).


Le propriétaire unique est AppearanceService. Profil > Personnalisation est réservé au propriétaire et propose Avatars / Titres / Badges. Les règles antérieures d'avatars possédés, de titres de niveaux et de consultation R1052 restent celles du [modèle](v1-data-model.md) et de [l'architecture](../architecture/backend-architecture-v1.md).

## Badges décoratifs — R1079

Dix définitions universelles gratuites : **✦ ✧ ★ ☆ ♥ ♡ ◇ ◈ ☾ ❖**. Aucun badge déséquipe seulement cette famille ; un seul ID BADGE est équipé à la fois, indépendamment de l'avatar et du titre. Aucun rôle, privilège, progression ou récompense. Aucun upload ou texte libre. Les badges ne créent ni PlayerCosmetic, date d'obtention, état Nouveau, ACK de consultation ni notification ; leur disponibilité est dérivée du catalogue canonique actif.

Les dix symboles restent disponibles dans leur onglet même si une recherche Avatars/Titres est conservée ; ce filtre reste disponible au retour dans ces familles. Les contrôles de recherche/tri sont masqués dans Badges. Les cartes proposent Équiper et l'aperçu montre le badge courant à côté du pseudo. Le panneau conserve le style existant des cosmétiques.

Le serveur accepte uniquement une définition BADGE active dont externalKey et symbole correspondent à l'allowlist exacte, ou null. Identité issue de la session ACTIVE et verrou Player ; refus des faux IDs, type erroné, définition inactive, valeur inventée et acteur archivé. Les possessions et équipements Avatar/Titre ne sont pas modifiés. Les CHECK SQL bornent aussi les définitions BADGE au catalogue fixe, sans asset ou Character source.

Le Chat global joint le badge courant de l'auteur dans sa lecture, immédiatement avant le pseudo, y compris sur les messages historiques. Aucun contenu de message n'est réécrit lors d'un changement d'équipement. Une définition inactive produit aucun badge. Les DTO personnels exposent badgeSymbol et equippedBadgeCosmeticId ; aucun changement du rendu MP ou Twitch. Le [Master](../master/PROJECT_MASTER_PLAN.md) porte seul les preuves et l'état de livraison.
