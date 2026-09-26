# Pilote Kichnifou — correspondance du snapshot figé

Cette matrice décrit le candidat `review` R916–R926 et le dry-run du snapshot local figé du 26 septembre 2026, hash `1852d7141a121c335c5928a8265c20e840e5c5dd20ccee12b054b99f780806ba`. Le dossier source Streamer.bot reste en lecture seule et autoritatif jusqu'au cutover ; ses modifications après la copie n'invalident pas la copie. Aucun import du Player public n'a été exécuté. Les audits propriétaires, du [XP](../legacy/04-xp-audit.md) au [Giveaway](../legacy/21-giveaway-wish-audit.md), restent les références de chaque domaine.

| Domaine | Source legacy | Cible et règle du pilote | Catégorie |
| --- | --- | --- | --- |
| Progression | `viewers_data`: XP, messages, overflow | `PlayerProgression`, remplacement exact | A |
| Ressources | Primos, Moras, particules | `PlayerResourceBalance`, remplacement exact et mouvement d'ajustement `MIGRATION` ; échange sortant en attente bloque | A |
| Banque | Solde et date d'intérêt | `PlayerBankAccount`, solde remplacé ; date source en provenance, intérêt reprend au prochain reset Paris, sans transaction fictive | A |
| Gacha / pity | Pity, garantie, compteurs historiques | `PlayerGachaState`, remplacement exact des compteurs personnels ; cible de bannière séparée ci-dessous | A |
| Personnages / constellations | Box, copies, dates, favoris | `PlayerCharacter`, remplacement des possessions avec clés catalogue `legacy:<id>` ; clé absente ou incohérente bloque | A |
| Teams | Team active et sauvegardes | `Team` et membres, remplacement des dix slots et presets ; identité de personnage ambiguë bloque | A |
| Missions | Missions longues et défi quotidien du jour | `PlayerPermanentMissionProgress` et `PlayerDailyChallenge`, remplacement avec provenance ; aucune récompense, opération ou rattrapage rejoué | A |
| Roue / Quotidiennes | Dates et compteurs | `PlayerWheelStats`, état journalier et `PlayerDailyRewardState`, remplacement ; résultat historique inconnu signalé | A |
| Expédition | État, personnage, dates, total | `PlayerExpedition`, remplacement sans RNG, claim ou notification | A |
| Combat | Totaux personnels et compteurs personnage | `PlayerCombatStats` et `PlayerCharacterCombatStats`, remplacement ; rencontre du jour séparée | A |
| Collection / objets | Coffre et Stella | `PlayerItem`, remplacement ; `ItemAcquisition` de provenance au cutover sans date historique fabriquée | A |
| Statistiques économiques / sociales | Compteurs cumulés personnels | `PlayerEconomyStats` et `PlayerSocialStats`, valeurs historiques explicites sans incrément gameplay | A |
| Concours / C6 personnel | `c6_characters` et Box | `C6CompetitionProgress`, remplacement de la progression du seul pilote ; Concours global séparé | A |
| Cosmétiques de personnages | Box | `CosmeticDefinition` et `PlayerCosmetic`, dérivation silencieuse des avatars, retrait des possessions disparues sans notification | A |
| Boss | État mensuel partagé | Rencontre globale et joueurs tiers nécessaires ; source conservée, aucune écriture | B |
| Concours | Lobby, tours et classement globaux | État communautaire non rapproché ; source conservée, aucune écriture | B |
| Amitié | `friendships_data` | Relations et demandes vers d'autres viewers non migrés ; 15 relations et 0 demande pour le pilote dans cette copie, aucune création de Player tiers | B |
| Event | Édition et participation partagées | Rapprochement de l'édition globale requis ; source conservée, aucune écriture | B |
| Codes | Claims et catalogue de codes | Rapprochement du catalogue global et de ses éditions requis ; source conservée, aucune écriture | B |
| Votes | Votes de bannière | Rotation communautaire globale non rapprochée ; source conservée, aucune écriture | B |
| Catalogues | Personnages, objets, pools et configurations globaux | Référentiels standalone restent autonomes ; aucune réécriture de catalogue depuis le snapshot | B |
| Combat quotidien actuel | KO et rencontre du jour | Rencontre globale non rapprochée ; source conservée, aucune écriture | B |
| Cible de bannière | `selectedBannerCharacterId` | Rotation globale non rapprochée ; valeur source gardée dans le résumé d'import, pas de cible Player arbitraire | B |
| Faveur | Statut legacy | Pas de cible Player physique | C |
| Giveaway | État legacy | Pas de cible Player physique | C |

A = `PLAYER_LOCAL_PHYSICAL` : mapping requis et importé en remplacement. B = `DEFERRED_CROSS_PLAYER_OR_GLOBAL` : différé jusqu'au rapprochement global ou des identités. C = `DEFERRED_NOT_PHYSICAL` : cible absente. D = `BLOCKED_AMBIGUOUS` : anomalie détectée par le dry-run, qui bloque l'apply. Dans la copie ci-dessus, 14 domaines A, 9 B, 2 C et 0 D ; aucun A en attente. B et C restent à reprendre lors de la migration générale.

Le dry-run est sans écriture DB. La confirmation exige le même hash et un token de prévisualisation signé, valide et non encore consommé. Le backend recalcule le rapport, verrouille le Player, enregistre la consommation du token puis effectue le remplacement en transaction sérialisable. Le replay du même hash ne réécrit rien ; un snapshot ultérieur remplace aussi les valeurs qui baissent ou les possessions disparues. Les tests DB utilisent seulement un schéma privé et un Player privé. L'application de la migration 049 sur DEV ne déclenche aucun import public.
