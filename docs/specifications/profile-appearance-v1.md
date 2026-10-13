# Personnalisation du profil V1

## Étude des thèmes — 13/10/2026

Le mandat conditionnait les thèmes à une centralisation raisonnable démontrée. L'audit CSS/portails conclut que les tokens actuels ne suffisent pas sans migration générale dispersée :1356 lignes de couleurs directes App.css et douze autres feuilles, états métier mêlés à décoration. Aucune implémentation de thème ni préférence supplémentaire ; palette actuelle et apparence métier conservées. Le constat est une limite de ce périmètre, pas une interdiction définitive. Preuve datée au [grand audit](../architecture/evidence/documentation-audit-20261013.md).


Le propriétaire unique est AppearanceService. Profil > Personnalisation est réservé au propriétaire et propose Avatars / Titres / Badges. Les règles antérieures d'avatars possédés, de titres de niveaux et de consultation R1052 restent celles du [modèle](v1-data-model.md) et de [l'architecture](../architecture/backend-architecture-v1.md).

## Badges décoratifs — R1079

Dix définitions universelles gratuites : **✦ ✧ ★ ☆ ♥ ♡ ◇ ◈ ☾ ❖**. Aucun badge déséquipe seulement cette famille ; un seul ID BADGE est équipé à la fois, indépendamment de l'avatar et du titre. Aucun rôle, privilège, progression ou récompense. Aucun upload ou texte libre. Les badges ne créent ni PlayerCosmetic, date d'obtention, état Nouveau, ACK de consultation ni notification ; leur disponibilité est dérivée du catalogue canonique actif.

Les dix symboles restent disponibles dans leur onglet même si une recherche Avatars/Titres est conservée ; ce filtre reste disponible au retour dans ces familles. Les contrôles de recherche/tri sont masqués dans Badges. Les cartes proposent Équiper et l'aperçu montre le badge courant à côté du pseudo. Le panneau conserve le style existant des cosmétiques.

Le serveur accepte uniquement une définition BADGE active dont externalKey et symbole correspondent à l'allowlist exacte, ou null. Identité issue de la session ACTIVE et verrou Player ; refus des faux IDs, type erroné, définition inactive, valeur inventée et acteur archivé. Les possessions et équipements Avatar/Titre ne sont pas modifiés. Les CHECK SQL bornent aussi les définitions BADGE au catalogue fixe, sans asset ou Character source.

Le Chat global joint le badge courant de l'auteur dans sa lecture, immédiatement avant le pseudo, y compris sur les messages historiques. Aucun contenu de message n'est réécrit lors d'un changement d'équipement. Une définition inactive produit aucun badge. Les DTO personnels exposent badgeSymbol et equippedBadgeCosmeticId ; aucun changement du rendu MP ou Twitch. Le [Master](../master/PROJECT_MASTER_PLAN.md) porte seul les preuves et l'état de livraison.
