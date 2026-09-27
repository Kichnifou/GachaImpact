# Pilote Kichnifou — correspondance du snapshot figé

> **Supplanté pour le cutover global par [Migration legacy V1](legacy-migration-v1.md).** Cette matrice décrit le pilote temporaire R916–R926, désormais aligné sur les faits personnels du contrat global R927–R938. Utiliser le contrat canonique et le [runbook](../process/legacy-cutover-runbook.md) pour toute préparation de cutover.

Cette matrice décrit le pilote R916–R926 et le dry-run du snapshot local figé du 26 septembre 2026, hash `1852d7141a121c335c5928a8265c20e840e5c5dd20ccee12b054b99f780806ba`. Le dossier source Streamer.bot reste en lecture seule et autoritatif jusqu'au cutover ; ses modifications après la copie n'invalident pas la copie. Aucun import du Player public n'a été exécuté. Les audits propriétaires, du [XP](../legacy/04-xp-audit.md) au [Giveaway](../legacy/21-giveaway-wish-audit.md), restent les références de chaque domaine.

| Domaine | Source legacy | Cible et règle du pilote | Catégorie |
| --- | --- | --- | --- |
| Progression | `viewers_data`: XP, messages, overflow et dates | `PlayerProgression` et activité, remplacement exact avec provenance XP/date partagée avec le migrateur global | A |
| Ressources | Primos, Moras, particules | `PlayerResourceBalance`, remplacement exact sans mouvement économique fictif ; échange sortant en attente bloque | A |
| Banque | Solde et date d'intérêt | `PlayerBankAccount`, solde remplacé ; date source en provenance, intérêt reprend au prochain reset Paris, sans transaction fictive | A |
| Gacha / pity | Pity, garantie, compteurs historiques et dernier pull | `PlayerGachaState`, remplacement exact des compteurs personnels et preuve du dernier pull legacy ; cible de bannière séparée ci-dessous | A |
| Personnages / constellations | Box, copies, dates, favoris | `PlayerCharacter`, remplacement des possessions avec clés catalogue `legacy:<id>` ; clé absente ou incohérente bloque | A |
| Teams | Team active et sauvegardes | `Team` et membres, remplacement des dix slots et presets ; identité de personnage ambiguë bloque | A |
| Missions | Missions longues et défi quotidien du jour | `PlayerPermanentMissionProgress` et `PlayerDailyChallenge`, remplacement avec provenance ; `PlayerPermanentMissionState` conserve la date Z legacy certaine, sans fabriquer d'instant de déblocage ni rejouer récompense ou rattrapage | A |
| Roue / Quotidiennes | Dates et compteurs | `PlayerWheelStats`, état journalier et `PlayerDailyRewardState`, remplacement avec provenance `dates.lastDailyFirstMessageReward` ; résultat historique inconnu signalé, aucune récompense créée | A |
| Expédition | État, personnage, dates, total | `PlayerExpedition`, remplacement sans RNG, claim ou notification | A |
| Combat | Totaux personnels et compteurs personnage | `PlayerCombatStats` et `PlayerCharacterCombatStats`, remplacement ; rencontre du jour séparée | A |
| Collection / objets | Coffre et Stella | `PlayerItem`, remplacement sans acquisition ni date historique fabriquée | A |
| Statistiques économiques / sociales | Compteurs cumulés personnels | `PlayerEconomyStats` et `PlayerSocialStats`, valeurs historiques explicites sans incrément gameplay | A |
| Concours / C6 personnel | `c6_characters` et Box | `C6CompetitionProgress`, remplacement de la progression du seul pilote ; Concours global séparé | A |
| Cosmétiques de personnages | Box | `CosmeticDefinition` et `PlayerCosmetic`, remise à zéro des possessions et équipements puis dérivation silencieuse des seuls avatars prouvés, sans notification | A |
| Faveur | Statut et dates legacy | `PlayerFavorState` et claim `LEGACY` certain, calendrier de jours métier partagé avec le migrateur global ; aucun grant ni crédit inventé | A |
| Boss | État mensuel partagé | Rencontre globale et joueurs tiers nécessaires ; source conservée, aucune écriture | B |
| Concours | Lobby, tours et classement globaux | État communautaire non rapproché ; source conservée, aucune écriture | B |
| Amitié | `friendships_data` | Relations et demandes vers d'autres viewers non migrés ; 15 relations et 0 demande pour le pilote dans cette copie, aucune création de Player tiers | B |
| Event | Édition et participation partagées | Rapprochement de l'édition globale requis ; source conservée, aucune écriture | B |
| Codes | Claims et catalogue de codes | Rapprochement du catalogue global et de ses éditions requis ; source conservée, aucune écriture | B |
| Votes | Votes de bannière | Rotation communautaire globale non rapprochée ; source conservée, aucune écriture | B |
| Catalogues | Personnages, objets, pools et configurations globaux | Référentiels standalone restent autonomes ; aucune réécriture de catalogue depuis le snapshot | B |
| Combat quotidien actuel | KO et rencontre du jour | Rencontre globale non rapprochée ; source conservée, aucune écriture | B |
| Cible de bannière | `selectedBannerCharacterId` | Rotation globale non rapprochée ; valeur source gardée dans le résumé d'import, pas de cible Player arbitraire | B |
| Giveaway | État legacy | Session et gagnants partagés ; rapprochement réservé à la migration globale | B |

A = `PLAYER_LOCAL_PHYSICAL` : mapping requis et importé en remplacement. B = `DEFERRED_CROSS_PLAYER_OR_GLOBAL` : différé jusqu'au rapprochement global ou des identités. D = `BLOCKED_AMBIGUOUS` : anomalie détectée par le dry-run, qui bloque l'apply. Dans la copie ci-dessus, 15 domaines A, 10 B et 0 D ; aucun A en attente. Les domaines B restent à reprendre lors de la migration générale. Le tri `box.sort`, l'élément du Player, les dates Twitch et `Player.legacyUsername` issu du nom exact du viewer sont également restaurés ; `Player.id` et son `displayName` standalone sont conservés.

Le dry-run est sans écriture DB. La confirmation exige le même hash et un token de prévisualisation signé. Le backend recalcule le rapport, verrouille le Player, enregistre la consommation du token puis effectue le remplacement en transaction sérialisable. Le retry du même aperçu consommé restitue les mêmes listes `imported` et `deferred` sans mutation ; un nouvel aperçu permet un nouveau remplacement, même pour le même hash, y compris les valeurs qui baissent et les possessions disparues. La migration additive 053 lie chaque run pilote à son aperçu et retire l'unicité historique Player/hash. Les tests DB utilisent seulement un schéma privé et un Player privé. Aucun import public n'est déclenché par les migrations.
