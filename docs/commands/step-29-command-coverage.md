# Étape 29 — couverture des 37 sources de commandes

**Correction unique après review de b5256f0, 06/10/2026 :** premier quotidien standalone réellement raccordé après commit du PLAYER normal éligible à `ClaimDailyReward`, source INTERNAL_CHAT, trigger `chat-message:<messageId>`. Owner Player/jour commun UI/standalone/Twitch, renderer `firstDailyMessageResult` commun aux deux chats ; feedback SYSTEM unique `daily-reward:<messageId>`, sans seconde récompense/reply en replay. Échecs secondaires récupérables sans rejeter le Chat accepté ; commandes et absence d'élément exclus. Le scope existant `resources` recharge soldes et carte Récompense. [Chat PostgreSQL privé](../../server/tests-db/global-chat.integration.test.ts) couvre paiement, replay, courses UI/Twitch/Chat, exclusions, reprise après erreur et égalité réelle des textes Twitch/standalone ; [pipeline frontend](../../src/AppBootstrap.revalidation.test.tsx) couvre le refresh. Résultats exécutés et reprise au [Master](../master/PROJECT_MASTER_PLAN.md). R1047 candidat review, Giveaway/Wish non validés publiquement, Streamer.bot autoritatif ; prochaine action : nouvelle review ChatGPT du commit correction.

**Complément post-recette R1047, 06/10/2026 :** le propriétaire valide le générique et « tout le reste » sur `4403eed` ; présentation/Quotis corrigés sur review seulement, Giveaway/Wish non encore validés publiquement. Nouvelle review indépendante → promotion → courte recette, main inchangé et Streamer.bot autoritatif. Relecture intégrale Daily/XP/Expedition/Combat/Shop/Convertir/Event/Giveaway/Wish ; formulations reprises comme présentation, jamais comme moteur ni JSON runtime. Les 32 racines génériques sont parcourues ; passe principale sur les familles signalées, petit complément Concours/Missions/statistiques Combat, rendus déjà acquis conservés. [Matrice post-recette](../../server/tests/chat-post-recipe.test.ts) : neuf rubriques, états Boss/Expédition/Event (dont octobre A/B/C après bonus), premier quotidien, valeurs dynamiques, douze thèmes et erreurs, aide et confidentialité C, parité standalone/Twitch. [Giveaway PostgreSQL](../../server/tests-db/giveaway-native.test.ts) complète le harness existant : gate spécialisé absent/inactif, aliases actifs, même session Admin, Wish sans session/inéligibilité/replay/écho sortant ; texte gelé dans l’annonce existante, aucune activation réelle. Résultats exécutés et parcours opérateur au [Master](../master/PROJECT_MASTER_PLAN.md).

Amendements R1038/R1039 du 04/10/2026. Étape 29 CLÔTURÉE PAR DÉCISION PROPRIÉTAIRE après recette publique représentative R1038 et derniers retours bornés corrigés/testés. Cette annexe détaille l'adaptation Chat, distincte du sweep métier historique 37/37. Les **31 sources restantes ont été lues intégralement, helpers compris**, dont les douze mois d'Event et tous les traitements XP/Gift/Subscription. Les six premiers fichiers conservent leurs livraisons R1035–R1037 ; leurs comportements acquis sont vérifiés en non-régression. Aucune source historique n'est modifiée.

Recette publique représentative R1038 acquise selon le propriétaire hors des retours R1039. Les dernières corrections sont testées automatiquement ; leur clôture et promotion sont autorisées sans nouveau gate manuel, sans prétendre à leur recette publique individuelle. Les résultats exécutés, la publication et la reprise appartiennent au [Master](../master/PROJECT_MASTER_PLAN.md) ; les contrats à la [référence des commandes](command-reference.md).

Les chemins de tests ci-dessous désignent les preuves de comportement, pas un second état d'avancement. `dispatcher`, `familles`, `simples`, `Team` et `Gacha` renvoient respectivement à [chat-command-dispatcher](../../server/tests/chat-command-dispatcher.test.ts), [chat-command-families](../../server/tests/chat-command-families.test.ts), [chat-remaining-commands](../../server/tests/chat-remaining-commands.test.ts), [chat-team-command](../../server/tests/chat-team-command.test.ts) et [chat-gacha-result](../../server/tests/chat-gacha-result.test.ts). Les suites DB sont dans [server/tests-db](../../server/tests-db), exclusivement en schémas privés.

| Source | Entrées / variantes pertinentes | Propriétaire moderne et traitement | Preuves |
| --- | --- | --- | --- |
| Ami.txt | ami ; cœur/coeur/coeurs/cœurs ; all/@all ; demandes/actions/pseudo/voir | Friendship/Social ; R1035 acquis, retrait de `ami liste` R1036 conservé ; aucun nouveau moteur | dispatcher, friendship / social DB |
| Banniere.txt | banniere/bannière/ban ; casse | Gacha ; R1036 acquis, bannière 4×5★ + 6×4★ unique ; `banner` absent, `ban` exclusivement Bannière | dispatcher |
| Banque.txt | banque ; aliases dépôt/retrait ; montant/MAX | Banking ; R1037 acquis, montant autoritatif et reçu stable ; pas d'alias `bank` | dispatcher, banking DB |
| Box.txt | box/5/4/6/élément/pN/favoris/a/d/c/e | Box ; R1037 acquis, noms exacts, toggle/tri figés, listes complètes | dispatcher, Box / Chat DB |
| Code.txt | code [token] | GiftCode ; R1037 acquis, découverte moderne complète, gains positifs et totaux du reçu | dispatcher, gift-code DB |
| Coffre.txt | coffre | Inventory ; R1037 acquis, Collection positive complète et glyphes historiques, tri moderne | simples / dispatcher |
| Combat.txt | combat ; go/auto ; info/infos ; help/aide ; stat/stats ; element/elements/faiblesse/faiblesses [élément] ; boss [go] | Combat/Boss ; adapté : propriétaires existants, chance réelle, Team active et quatre ennemis, récompenses du service, KO quotidien, matrice française, statistiques et résumé Boss public ; mémoires modernes conservées | familles / dispatcher, daily-combat / monthly-boss DB |
| Concours.txt | concours | Contest ; consultation déjà conforme, actions participant/spectateur/annuler/start/basic/risque/soutien abandonnées dans le Chat et renvoyées à l'interface | dispatcher, aucune dépendance mutation dans le contrat |
| Convertir.txt | convertir/conv montant | DailyChallenge/Economy ; adapté : entier positif strict, 1:1, élément personnel, nom/glyphe/total réel ; bonus Défi ajouté seulement depuis son crédit autoritatif | simples, daily-challenge / Chat DB |
| Daily.txt | quotis/quoti/daily | Hub de lectures ; neuf rubriques emoji, Shop uniquement comme libellé Chat, Boss réel, départ Expédition du jour et contenu Event restant selon les prédicats UI communs ; aucune acquisition depuis le résumé | post-recette / familles / dispatcher |
| Echanger.txt | echanger/echange/ech ; pseudo [montant/MAX] ; liste ; accepter/annuler/refuser [pseudo/all/@all/tout/tous] | Trade ; adapté : partenaires réellement compatibles complets, projection sûre read-only d’éligibilité R1039, toutes les demandes, actions groupées par ensemble initial, montant et identités figés ; annulation globale des **envoyées seulement**, refus des **reçues seulement** ; réservation unilatérale moderne conservée | familles, trades DB |
| Element.txt | element ; électro/anémo/géo et casse | ChoosePlayerElement ; adapté : choix permanent, glyphes, déjà choisi ; aucune bascule d'élément | simples / dispatcher |
| Event.txt | event ; go/sac/top/boutique/shop ; primos/primo/primogems/moras/mora montant/MAX ; collection/calendrier ; trois noms propres au mois | Event ; adapté pour les douze thèmes : gains réels, inscription déjà faite, tableau de bord compact R1039, date/heure Paris et essais restants/maximum métier, prochain palier, rang personnel, Top 10 intégral, consultation des codes possibles, envoi exact avec nom composé sans écho du message privé ; paliers et bonus modernes restent chez leur propriétaire | familles (12 mois), Event / Shop / Game B / Game C / calendrier / Chat DB |
| Expedition.txt | expedition/exp ; nom exact ; retour ; nom du personnage envoyé lorsqu'il est prêt | Expedition ; adapté : branche départ/récupération figée, durée lisible, tentative de départ actif enrichie et aide READY R1039, récompense réelle ; 20 h, départ quotidien et récupération manuelle modernes conservés | familles / dispatcher, expedition DB |
| Faveur.txt | faveur [pseudo/@pseudo] | Social/Favor ; consultation déjà conforme, accès FAVOR Public/Amis/Privé, tiers limités à actif/durée ; aucun claim ni acquisition | dispatcher, social-favor DB |
| Gift.txt | événement de redemption Gift Suprême | Gift/Twitch ; **déclencheur**, pas de racine `gift`. Matching dédié, récompenses et gates modernes déjà conformes ; aucune orchestration historique restaurée | gift-supreme-matching / twitch-gift-supreme-redemption |
| Giveaway.txt | giveaway/ga ; stats/stat ; open/ouvrir ; close/fermer | Giveaway/Twitch ; adapté : alias ga dans le classifieur spécialisé, permissions et bridge existants ; reroll supprimé R950, métadonnées corrigées. Podium de clôture limité volontairement selon R712, distinct d'une liste exhaustive | familles / giveaway-native / twitch-giveaway-shutdown |
| Help.txt | help catégorie/commande ; aliases ; catégories historiques utiles | Registre partagé ; adapté : aide canonique et permissions/canaux identiques ; catégories modernes conservées, aucun affichage de mutations Admin ni commande trigger inventée | simples / chat-command-registry / frontend Help |
| Infos.txt | infos/info pseudo/@pseudo/me/moi ; noms composés | Social ; adapté : résumé fixe moderne et glyphes, sections masquées omises ; sous-sections historiques team/box/sac/pity/stats/mission supprimées par R489/R522. La source porte un **joueur**, aucun usage personnage inventé | dispatcher, social / Chat DB |
| Legende.txt | legende/légende/legendes/légendes/leg ; [joueur] [personnage] ; moi/me personnage | Social/C6 ; adapté : liste C6 5★ active complète, détail exact, cinq stats/thèmes/titres et totaux réels ; Box pour liste, Box + Statistiques générales pour détail. Forme personnelle détaillée canonique `moi personnage` | familles / dispatcher, social DB |
| Liste.txt | liste online/élément concret [page] ; helper element/elements/élément/éléments R1039 | Social ; adapté : page moderne de 20 entièrement rendue, présence uniquement autorisée, aucun ancien tri par activité ni indication de présence masquée | familles, social DB |
| Missions.txt | mission [B/A/S/Z/résumé/resumé/resume/récap/recap] | PermanentMission/DailyChallenge ; adapté : résumé moderne, rangs en entrées complètes, accomplis à la fin ; Z verrouillé ne révèle aucun contenu. Acceptation B1 et abandon historiques supprimés, accomplissement automatique conservé | dispatcher / familles, permanent-missions DB |
| Obtention.txt | obtention nom exact normalisé | Box ; adapté : première date immuable, glyphes et date française Europe/Paris ; aucune nouvelle date déduite | dispatcher |
| Passif.txt | passifs/passif [élément] | TeamPassives ; adapté : référence générale des sept passifs et détail, niveaux modernes, bonus Dendro sur les sept éléments ; indépendants de la Team possédée | simples |
| Pity.txt | pity | Gacha ; adapté : pity 5★/4★, garantie et Capture modernes ; ancien score de pertes non recopié | simples / dispatcher |
| Pull.txt | pull [1..10] | PerformGachaPull ; adapté : R1039 : N parties principales distinctes, [i/N] seulement si N>1, soldes par étape persistés/rejoués, noms/étoiles/éléments/Cn, Early/Hard/B2B/pity/garantie/Capture, refunds C6 80/160, progression et compensation C6, passifs et rewards XP réellement produits ; aucun RNG dans le renderer | Gacha / dispatcher, gacha / Chat DB |
| Roue.txt | roue | Wheel ; adapté : gain réellement attribué, glyphes et 50 000 Moras ; distinction spin, déjà consommé et replay du propre reçu, y compris concurrence UI | familles, vertical-slice DB |
| Sac.txt | sac | Inventory ; adapté : toutes les ressources, sept stocks même nuls, personnel en premier, voeux entiers, aucun objet spécial Chat R1039 ; Collection via Coffre | simples / dispatcher |
| Select.txt | select [nom exact normalisé] | GachaTarget ; adapté : sélection exacte et intention figée, déjà ciblé ; consultation des quatre choix conservée | dispatcher, gacha DB |
| Shop.txt | shop [page] ; primos montant/MAX ; ticket ; mission ; switch | Shop + DailyChallenge ; adapté : racine compacte Mission/Primos/Ticket depuis propriétaires R1039, pages explicites visibles même indisponibles cinq/page, achat et Ticket autoritatifs, mission/switch raccordés aux services existants ; coût et résultat conservés, ancien switch identique à 10 % abandonné | familles, shop / daily-challenge DB |
| Stella.txt | stella nom exact normalisé | Box/C6 ; adapté : stock réellement consommé, Cn, stat C6/progression/max ; 5★ uniquement et refus au maximum avant consommation, aucun remboursement inventé | Gacha / dispatcher, box DB |
| Subscription.txt | événements sub/resub/gift | Favor/Twitch ; **déclencheur**, pas de racine `subscription`. Services actuels de droits, bonus et calendrier conservés ; tiers/gifter/overflow modernes, aucune copie du traitement quotidien XP | twitch-favor-* / social-favor DB |
| Team.txt | team [N] ; [N] apply/remove/rename ; add nom ; remove nom/all/tout/tous ; rename "Nom" ; list/liste [page] ; new ; save aide | Team ; adapté : consultation N sans activation, composition - et passifs compacts modernes R1039, mutations décidées raccordées, retrait N vide sans supprimer, nouvelle sauvegarde inactive, noms exacts et rename moderne ; `save` reste un helper. Intentions et snapshots des six mutations transactionnels | Team / dispatcher, team DB |
| Top.txt | top [métrique/me] ; tous les aliases du registre, accents/cœurs | Ranking ; adapté : Top 5 + propre rang éligible en entrées entières ; zéro/privé exclus, Taux de 5★ dès 100 Pulls, patrimoine Moras moderne ; pas de faux rang privé | ranking-service, ranking DB |
| Vote.txt | vote [nom/phrase] | BannerVote ; adapté : liste complète des votes positifs triés, matching propre à Vote (exact/phrase/typo non ambiguë), un vote hebdomadaire ; intention/nom figés, résultat sans compteur mutable d'autres joueurs | dispatcher, banner-votes DB |
| Wish.txt | wish | Giveaway/Twitch ; **Twitch uniquement**, inscription au tirage sans gain immédiat, élément choisi selon contrat moderne ; pas de participation standalone ni niveau historique réintroduit | familles / giveaway-native |
| XP.txt | activité normale et traitements historiques transversaux | Progression/Chat + services temps/bonus/domaines ; **déclencheur**, pas de racine `xp`. XP/rewards modernes, level-up/overflow, banque, votes/rotation, missions, Event, Faveur et concours déjà chez leurs propriétaires ; commandes et réponses jeu exclues de l'XP, aucun ancien orchestrateur multi-fichiers restauré | progression / GlobalChat / favor-calendar / permanent-missions / Event / gacha DB |

Régressions finales R1039 : [chat-owner-recipe](../../server/tests/chat-owner-recipe.test.ts), suites Gacha/Team/familles/simples/dispatcher ; PostgreSQL Gacha (soldes séquentiels/retry de publication x1/x3/x10), Échanges (diagnostics sûrs/read-only) et GlobalChat (atomicité/IDs/complétions).

## Les douze jeux mensuels

Les moteurs A/B/C restent uniques. Les noms suivants routent vers la configuration du Festival courant ; casse, accents et ligatures pertinentes sont normalisés. Leurs clés techniques Festival ne deviennent pas des aliases de jeu.

| Mois | Jeu A | Jeu B + code 5 bits | Jeu C + pseudo et message entre guillemets |
| --- | --- | --- | --- |
| Janvier | feu | coffre | vœu / voeu |
| Février | cœur / coeur | cadeau | mot doux / motdoux |
| Mars | pousse | racine | graine |
| Avril | œuf / oeuf | panier | chocolat |
| Mai | fleur | bouquet | mot printanier / motprintemps |
| Juin | pêche | trésor | lettre |
| Juillet | étoile | constellation | vœu / voeu |
| Août | expédition | ruine | carnet |
| Septembre | récolte | grenier | panier |
| Octobre | fantôme | crypte | sort |
| Novembre | feuille | relique | murmure |
| Décembre | cadeau | hotte | carte |

Jeu A : créneaux et cooldown serveur, 20 % ; +1 point/+1 monnaie uniquement si réussi. Jeu B : trois essais, un code déjà testé ne consomme rien, solution cachée avant découverte, gain collectif puis rattrapage à l'inscription. Jeu C : un envoi réussi, permissions de contact et anti-auto-ciblage conservés, gain pour l'expéditeur seulement ; le contenu privé n'est pas recopié dans la réponse du jeu. Le calendrier garde ses jours 1–25 et les cases manquées ne sont pas rattrapées.

## Parité des messages ordinaires Twitch R1047

Le relevé croise XP.txt (orchestrateur, Execute et helpers pertinents), les audits XP/Event et les owners physiques modernes. La qualification décrit le mécanisme legacy, pas une décision de supprimer un effet joueur. Gate pilote inchangé ; une absence d’identité reste sans mutation selon la mission. Les branches `!` comptent comme messages totaux, sans XP/countées ; bot/système natif prouvé exclu avant tout effet.

| Trigger legacy | Classification / état R1047 | Propriétaire et preuve |
| --- | --- | --- |
| XP longueur, cooldown 2 s, totalMessages/countées, dernière activité, niveaux/overflow | TO_IMPLEMENT → implémenté | progressPlayerMessage partagé Chat/Twitch ; PrismaPlayerXpService, PlayerActivityRecorder ; tests twitch-native-bridge privés |
| Première récompense quotidienne sur message normal | TO_IMPLEMENT → implémenté ; standalone raccordé après review b5256f0 | ClaimDailyReward/PrismaDailyRewardStore ; claim Player/jour partagé UI/standalone/Twitch, trigger original restitué, aucune seconde récompense ; global-chat.integration / twitch-native-bridge DB |
| Mission messages et missions longues | TO_IMPLEMENT → intégration implémentée | PrismaDailyChallengeStore et PermanentMissionService existants ; même transaction progression, feedback de vraie complétion |
| Bonus quotidien Event R602 | TO_IMPLEMENT → implémenté | EventService.claimDailyBonus, jour/édition préparés, snapshot durable et source TWITCH |
| Messages sociaux Event R612/R613, anciens et éventuellement vus dans l’UI | TO_IMPLEMENT → implémenté | EventChatPresence, IDs figés, clé de livraison par message ; viewedAt et changements de jour ne perdent pas le backlog |
| Annonce mensuelle et dernier jour R641/R643 | TO_IMPLEMENT → implémenté | Clés Notification event-delivery partagées avec EventLifecycleNotificationReconciler ; aucune répétition transcanal |
| Compteur Giveaway ; wish/stat/giveaway | ALREADY_NATIVE | GiveawayService/TwitchGiveawayConsumer ; message ID et protections spécialisés conservés, exclusion des échos génériques avant compteur |
| Faveur présence/quotidien et événements Sub/Gift/Resub | ALREADY_NATIVE | Consumers Twitch Faveur ; R1047 ne duplique pas l’acquisition |
| Gift Suprême | ALREADY_NATIVE | GiftSupremeService/Runtime ; journal d’annonce complète la provenance des sorties, matching/économie/gates inchangés |
| Intérêts Banque, expiration trades/Défis, cleanup Concours, rotation bannière/votes | ALREADY_NATIVE | Schedulers/catch-ups Banking, Trades, Défis, Contest et Gacha ; aucune orchestration XP.txt restaurée |
| Sync fichiers C6 depuis la Box | ALREADY_NATIVE | Owners possession/C6/Missions modernes atomiques ; plus de resync opportuniste au message |
| Création/defaults de fichiers viewer par pseudo | OBSOLETE_V1 (mécanisme fichier/matching) | Provisionnement/migration et TwitchIdentity immuable propriétaires ; aucune création d’un viewer inconnu dans ce pilote, aucune anticipation 31A/31B ou onboarding |
| Heuristiques de messages système par préfixe/emoji et écriture JSON globale | OBSOLETE_V1 (mécanisme legacy) | Provenance des sorties natives et transactions/receipts modernes ; un message joueur avec emoji reste ordinaire |

L’exhaustivité des **commandes** est une preuve générée depuis le registre, dans [twitch-command-coverage.test.ts](../../server/tests/twitch-command-coverage.test.ts), avec la [revendication physique](../../server/src/application/twitch/twitch-command-coverage.ts) ; ce document n’entretient pas une seconde liste de racines. Chaque famille est exercée par le résolveur partagé, avec aliases/parser et suites standalone communes, cas invalides et owners/source/intent PostgreSQL représentatifs. Outbound, spécialisation et gates ne valent toujours pas validation publique.

**Diagnostic !pull identique :** deux événements distincts de même texte passent sur le code de baseline 7118740 et sur R1047, PostgreSQL réel privé ; deux effets/réponses et replay sans doublon. Aucune correction de déduplication textuelle justifiée. La cause live est probablement amont, non démontrée faute de delivery live inspectée ; non bloquante, workaround utilisateur existant accepté sans modification serveur.

## Recette propriétaire essentielle après contrôle du SHA et du déploiement

Référence historique R1038 : recette publique représentative acquise selon déclaration propriétaire R1039. Ce tableau ne crée pas un nouveau gate de clôture 29 ; dernières corrections automatisées, déploiement du nouveau SHA à vérifier séparément. Prochaine étape 30, non commencée.

Sans données artificielles publiques, effectuer uniquement les actions pertinentes avec les stocks, personnages et activités réellement disponibles. Les mutations consomment leurs coûts habituels. Les preuves de concurrence, rollback, MAX et limites utilisent les fixtures privées ; il n'est pas demandé de reproduire toutes les variantes.

| Famille | Commandes essentielles dans le Chat standalone |
| --- | --- |
| Help / aliases | `!help conv`, `!help team`, `!help ga` ; vérifier la syntaxe canonique et la restriction Twitch |
| Gacha / Collection | `!banniere`, `!select NomExact`, `!pity`, `!pull 10` si souhaité ; `!obtention NomExact`, `!box 6`, `!leg moi NomC6`, `!stella NomExact` si souhaité |
| Team / passifs | `!team`, `!team liste`, `!team N apply`, `!team rename "Nom"`, `!passifs` |
| Ressources / Boutique | `!sac`, `!coffre`, `!banque`, `!conv 1`, `!shop` ; `!shop mission` ou `!shop switch` seulement si souhaité |
| Échanges / Social | `!ech`, `!ech liste`, échange avec partenaire consentant puis `!ech accepter Pseudo` ; `!info Pseudo`, `!liste geo`, `!ami` |
| Quotidiennes / Combat | `!daily`, `!roue`, `!mission B`, `!combat info`, `!combat go` si souhaité ; `!combat boss` |
| Expédition | `!exp` ; départ `!exp NomExact`, puis `!exp retour` après les 20 h |
| Event / Codes | `!event`, `!event sac`, `!event top`, noms des jeux indiqués par l'aide du mois ; `!code` puis token disponible si souhaité |
| Consultations | `!faveur`, `!concours`, `!top xp` |

Twitch est une recette séparée, **non activée par ce lot**. Ni `!ga` ni le Help ne donnent une autorisation d'activation, d'outbound, de cutover ou de migration.
