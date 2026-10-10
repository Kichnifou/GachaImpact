# Correctifs consolidés V1 — 10/10/2026

Mandat propriétaire A–J, après la passation f10d335 ; aucune nouvelle Rxxx ni extension au tirage R1053. Le [Master](../master/PROJECT_MASTER_PLAN.md) porte la publication et la prochaine reprise. Les contrats de texte restent dans le [registre](../commands/command-reference.md), le cycle dans le [workflow](../process/implementation-workflow.md).

## Comportements et limites

| Lot | Résultat |
| --- | --- |
| A | Ticket Moras : remboursement au montant réel de l’effet persistant ; prix 150 000, wallet, RNG, autres résultats et receipts inchangés. |
| B | Nom complet exact normalisé du catalogue actif pour le détail personnel, pseudo exact pour un tiers ; vraie collision refusée avant lecture privée, demander moi/@. BOX pour liste, BOX + GENERAL_STATISTICS pour détail, propriétaire autorisé. Cinq stats avec emojis ; Concours reste opaque. |
| C | new/create textuels : première Team vide par position, nom conservé, activation dans la transaction ; sinon création suivante active. UI explicite toujours non active. Verrou Player + isolation Serializable/retry, clé BusinessOperation et état figé. Ajout sur slot devenu occupé refusé ; retrait gardé par ID attendu. Anciennes intentions/replays compatibles. Consultation N sans activation, save aide seulement. Confirmation/composition/passifs fusionnées et découpage entre membres complets. |
| D | Modale en quatre lignes, seule grille scrollable, contrôles fixes, useModalDialog, pending verrouillé. |
| E | Description conversion issue de targetSnapshot/progress réels, sans changer l’élément, le compteur ni la récompense. |
| F | Racine : comptes B/A/S/Z sans Défi ; resume et aliases : tous les objectifs accessibles non terminés, y compris non commencés. Z verrouillé secret. |
| G | Fenêtres Event affichées h/à, mêmes instants Paris, aucune réécriture/reroll. |
| H | Trois aliases quotis : durée restante RUNNING du service autoritatif après le marqueur ; mêmes règles aujourd’hui/veille. Faveur retirée du seul résumé. |
| I | Combat go Twitch : Team une seule fois, noms/éléments/constellations et ordre du snapshot, séparateur tiret ; gains, KO, MANUAL/AUTO/Boss et anciens résultats gelés conservés. |
| J | Outils opérateurs existants réutilisés en lecture seule ; aucun endpoint ou auth ajouté. Configuration, DB, processus servi, transport et résultats utilisateur distingués. |

## Contrôles locaux

- verify:full 8/8 et verify:quick 5/5 : 1 390 tests frontend, 2 176 backend non-DB, builds, TypeScript, lint et diff-check. Rapports complets conservés dans le répertoire privé du lot.
- PostgreSQL isolé, fichier par fichier : Team 20 PASS (réutilisation, création, clés concurrentes, conflit ajout/retrait, replays après édition) ; Défi 11 PASS (cible/progression persistées réelles) ; Shop 10 PASS (cinq résultats Ticket et replay sans reroll) ; Combat 9 PASS ; pilote Twitch 28 PASS au passage complet final, sans exclusion. Total 78 PASS. Avertissement pg de requêtes concurrentes sur un client déjà occupé conservé dans les logs, sans assertion métier échouée au passage final.
- Tests de format/aliases/confidentialité/limites et mutation Team : nouvelle suite `command-fixes-20261010.test.ts`, suites existantes adaptées aux contrats actuels. Aucun test exclu présenté comme réussi.
- Test navigateur synthétique privé du vrai GameShell avec index.css/App.css chargés : 1366×768, 1920×1080, 2560×1440, 390×844 ; 80 personnages, grille pleine/filtrée/vide, scroll avant/après, recherche/élément, sélection/confirmation, focus/Tab/Escape/pending. Quatre états de viewport PASS, huit captures, zéro erreur JS et zéro requête extérieure. Captures desktop/mobile inspectées ; aucun résultat visuel humain public revendiqué.

La review indépendante du premier SHA publié `9b23ed90f6c2ac9fb02126761c166648eadf2f0c` a confirmé un P2 : règle globale tardive supplantant la grille mobile, filtre Élément masqué par le débordement de la modale (select jusqu’à x427, panneau jusqu’à x370 à 390px). Correction : règle mobile réaffirmée après le style global ; nouveau contrôle navigateur des bornes de recherche/select/fermeture/confirmation, quatre viewports à nouveau PASS. La première preuve d’absence d’overflow document ne suffisait pas à exclure un contrôle coupé ; le verdict final doit porter sur le delta publié corrigé.

Le premier passage pilote Twitch a atteint la borne 60 s du scénario existant de quatorze commandes/redélivraisons ; son travail asynchrone tardif a perturbé le compteur du test suivant (26 PASS, 2 FAIL). Seule sa borne privée passe à 180 s, toutes les assertions conservées. Nouveau passage complet : 28/28 PASS en 299 s ; aucun échec initial effacé ou déclaré PASS. Après correction CSS : navigateur quatre tailles PASS et verify:quick 5/5.

## Sauvegarde et preuves runtime

Backup applicatif public complet créé en lecture seule le 10/10/2026 à 06:40:50 UTC : 4 368 066 octets, SHA-256 `5aa87c843f51160156138475716cba80e1a400b89f35f34a1498a6e146d73fb9`. Archive listée, entièrement décodée hors ligne et fsync ; aucune restauration en production. Managed auth/storage et grants de rôles exclus selon le périmètre applicatif existant.

Les scripts privés snapshot/transport/health/cloudflare existants sont réutilisés. SQL et configuration ne valent pas GET authentifié du processus ; aucune session propriétaire inventée. Helix inspecte réellement la souscription existante ; les résultats runtime ne sont attestés que par receipts/actions réellement observés. Les preuves minimisées et données sensibles restent hors Git.

Préflight frais : snapshot cohérent de 144 tables, 44 historiques protégés, zéro opération PENDING/receipt bloquant/annonce Giveaway incertaine. Les 68 checksums LF versionnés correspondent au registre public, toutes migrations terminées sans rollback ; `prisma migrate status` confirme à jour. Transport inspecté : configuration Railway activée, autorité GLOBAL révision 19, cible historique 43 + compte test séparé, souscription Chat ACTIVE avec callback/broadcaster/receiver canoniques. Il s’agit de DB/configuration/Helix, pas d’un GET authentifié du processus. Aucun changement de version PostgreSQL, extension ou Supabase Auth dans ce lot.

## Déploiement et postflight du candidat approuvé

Publication initiale `9b23ed9` vérifiée sur GitHub : 35 blobs/diff ; finding mobile corrigé dans `81223a9c5fc8ef7432267a0353b879b9c67289c6`, 7 blobs/diff vérifiés. Review indépendante distincte : 157 tests ciblés PASS et inspection des risques métier, puis quatre viewports retestés sur le delta ; **APPROVED du SHA 81223a9**, aucun finding restant. Rapport privé `review-independent-delta.md`, SHA-256 `7457c500dd0de055f8386f18e2f9a0cefbba8fc1a80280f3e1e6f8ee244943fe`. Fast-forward strict depuis main 2aa7dd5, quatre commits antérieurs conservés, push normal et refs communes/divergence 0/0 vérifiés ; aucun historique réécrit.

Railway `365541dd-0fbb-4488-9f19-cdac9423be4d` : SUCCESS du SHA applicatif 81223a9 le 10/10 à 07:05:19 UTC, Online 1/1, zéro crash, pending work ou échec récent. Cloudflare `61dca8e1-9b54-4945-be52-a9fa028a5acc` : SUCCESS du même SHA, production/preview HTTP 200 et CSS/JS identiques octet par octet. Health backend 200 à 07:05:55 UTC (échantillon unique, pas une mesure globale de performance). Logs error du déploiement inspectés : trois messages de chargement Prisma/ligne vide classés stderr ; aucun échec opérationnel établi dans cette fenêtre. Build frontend final PASS avec avertissement existant de chunk supérieur à 500 kB, sans nouvelle dépendance.

Snapshot BEFORE `snapshot-GLOBAL-1791615077280.json` à 06:51:17 UTC, SHA-256 `9a828a7c12d7bded12262e3bdcabe0df9d66101b3b012f9c91ef6805a27ad817` ; AFTER `snapshot-GLOBAL-1791615992146.json` à 07:06:32 UTC, SHA-256 `447ec5f1c7c95fbbf2d9790a97aeab9131d2145453a51511ac9bebbd994f5d78`. Comparaison cohérente RO : **12 339 contrôles PASS**, 143/144 tables exactes. Une ligne player_sessions ne diffère que par last_heartbeat_at (06:50:19 → 07:05:39 UTC), tous les autres champs identiques. Zéro nouvelle opération/mouvement économique. 54 Players, 44 historiques/targets/imports conservés ; identités, choix R1055, Céo ARCHIVED/Ceotryd ACTIVE/NATIVE, StreamElements, exclusions/quarantaines, claims, Event, Boss et Giveaway inchangés. Aucun delta inexpliqué, pending opération, receipt bloquant ni annonce incertaine. Les 68 checksums sont conformes après déploiement ; aucune migration nouvelle.

| Niveau | Preuve réelle et limite |
| --- | --- |
| 1 Configuration | Variables Railway existantes activées, chargées par le contrôleur privé ; aucune variable modifiée. |
| 2 DB | GLOBAL révision 19 et 44 targets contrôlés dans la transaction RO. |
| 3 Processus servi | SHA exact du déploiement SUCCESS, replica Online 1/1 et health public 200. Aucun GET authentifié du statut opérateur. |
| 4 Transport | Souscription Chat ACTIVE inspectée sur Helix, callback/broadcaster/receiver canoniques et capacité reconstruite par les owners avec env Railway/DB. Ce n’est pas une preuve de consommation d’un nouveau webhook par le processus après restart. |
| 5 Résultat utilisateur | Aucun nouveau receipt commande depuis le SUCCESS jusqu’au snapshot ; nouveaux messages non confirmés par une action utilisateur publique dans cette fenêtre. Aucun test économique provoqué pour combler cette limite. |

La clôture documentaire enregistre ces changements d’état réels. Le checkpoint final peut avancer les refs Git sans modifier le code applicatif approuvé ; ses nouveaux déploiements sont contrôlés séparément dans le rapport final. Recette humaine restante limitée aux textes des consultations et à la modale ; les trois parcours nouveaux comptes R1064 restent différés. R1053 non commencé.

## Suivi post-recette A–F du 10/10/2026

Mandat propriétaire de continuité, postérieur à d564e4b : fonctionnement général A–J jugé satisfaisant après recette, six retouches explicitement approuvées. La preuve historique ci-dessus conserve ses faits et fenêtres ; les contrats courants supersèdent seulement les anciennes formulations. Base main/review d564e4b, divergence 0/0, checkout review propre et avancé par ff-only depuis 1fe3008 ; aucune autre modification distante ni Story.

| Lot | Implémentation et contrôle |
| --- | --- |
| A | Cadre du scroll inspiré de Box : fond/bordure arrondie, padding 12 px, espace sous filtres compacts 32 px. Architecture quatre lignes inchangée. Vrais GameShell/CSS, 80 personnages synthétiques, quatre viewports, repos/scroll/sélection ; 12 captures, bornes individuelles, cadre stable, focus/Tab/Escape/pending, aucune erreur JS/requête extérieure. |
| B | banner ajouté au registre partagé de banniere/bannière/ban : identité de définition et résultats vérifiés sur Twitch et Chat interne, syntaxe canonique et absence de collision. |
| C | Syntaxe Jeu C invalide : ⚠️, non-envoi et exemple thématique ; douze noms modernes, formes historiques conservées. Aucun appel recherche/envoi ; syntaxe valide toujours confiée à EventService. |
| D | Résumé inscrit : trois commandes avec ✅/⏳ immédiatement, points/monnaie, palier, bonus, extensions calendrier/messages, Boutique/Top, fin Paris en dernier. Non-inscrit distinct, sac conservé. États A/B/C existants, aucun changement EventService. |
| E | Code : groupes 🎁 Code/🏅 Paliers séparés, récompenses entières avec ·, emojis/+ uniques, pluriels et soldes du résultat. Titres répétés sur suites, description Unicode longue conservée. Aucun changement GiftCodeService/claim/paliers. |
| F | Ticket : réaction historique, joueur mémorisé, récompense réelle et wallet transactionnel. Cinq catégories/pity plafonnée ; aucun RNG dans le formatter. Total secondaire facultatif capturé depuis la vue dans la même transaction, sérialisé dans resultSummary puis relu au retry ; ancien receipt sans champ inchangé, total omis. Autres achats inchangés. |

Validation : verify:quick 5/5 ; verify:full 8/8, 1 390 frontend/126 fichiers et 2 220 backend non-DB/147 fichiers, builds/typecheck/lint/diff-check. Après un dernier ajustement de pluriel du formatter partagé : 195 tests ciblés PASS, incluant les limites Unicode et noms longs. Shop PostgreSQL privé : 11/11 PASS, cinq résultats déterministes, solde secondaire conservé après variation ultérieure, anciens receipts, rollback/concurrence/idempotence. Aucune fixture publique ni exclusion ajoutée. Première passe complète : deux attentes historiques devenues obsolètes (banner absent, ancien libellé wallet) corrigées, puis passage complet vert ; erreurs de fixture/typecheck initiales corrigées, logs conservés. Avertissements existants pg concurrent-query et chunk frontend >500 kB non bloquants.

Publication et revue : candidat **7a5e59990748ec344bc6adce856b6f6107a2303a**, parent d564e4ba1493686715fb295b45ec63d4c0203d5e, 23 fichiers. Diff GitHub et 23 blobs vérifiés exactement par l'implémenteur puis indépendamment. Reviewer distinct /root/independent_review : **APPROVED**, aucun finding établi, 138 tests ciblés PASS et quatre viewports recontrôlés ; transaction/snapshot/replay Ticket et anciens reçus inspectés. Rapport privé local-data/identity-resolutions/post-recipe-20261010/review-independent.md, SHA-256 f2d954d2b69938082f5d132ff0ea5e69c23d3a69af804acaf162f16be943c178. Après fetch/ascendance/candidat/worktree vérifiés, promotion strictement ff-only vers main puis refs distantes communes et divergence 0/0 confirmées.

| Livraison applicative / postflight | Preuve du 10/10/2026 |
| --- | --- |
| Railway | 76c52786-e4d6-48a1-896c-074d1e12b797, SUCCESS à 08:33:41 UTC, commit exact 7a5e599 ; une réplique running, zéro crash, incident ou opération en attente. |
| Cloudflare | e4a05acc-1f89-4041-a61f-48871651031e, check SUCCESS à 08:33:16 UTC au même SHA ; preview/production HTTP 200 et contenus des deux assets CSS/JS strictement identiques. |
| Health | HTTP 200, status ok, échantillon à 08:34:22 UTC ; ce health ne prouve pas l'exécution de commandes Twitch. |
| Logs | Filtre error du déploiement : trois entrées stderr de chargement Prisma/configuration/schéma, aucune erreur applicative établie ; aucun incident actif Railway. |
| Transport | Contrôle SQL/configuration Railway/Helix en lecture seule à 08:34:51 UTC : GLOBAL révision 19, 44 cibles persistées, Chat ACTIVE, propriétaires canoniques cohérents. Aucun statut authentifié du processus déployé ni nouvelle commande publique prouvés. |

Preuves privées dans local-data/identity-resolutions/post-recipe-20261010 : GitHub, review, check-runs, Cloudflare, deploy-app-7a5e599, health et transport horodatés. Première comparaison GitHub corrigée pour la longueur d'abréviation des index (8 distante/7 locale), puis diff exact PASS. Première invocation transport incorrectement paramétrée avec 19 cibles au lieu de la révision 19 ; corrigée à 44, identiques au dernier contrôle précédent, puis PASS. Aucune anomalie de production déduite de ces erreurs de contrôle. Cette clôture documentaire enregistre des changements d'état acquis ; le code applicatif reste celui approuvé, et les builds éventuellement déclenchés par le checkpoint documentaire sont vérifiés séparément dans le rapport final.

Le cycle consolidé et la production vivante d564e4b sont appliqués sans duplication de workflow ni audit global de bruit joueur. Aucun changement de schéma, migration, infrastructure, autorité, auth, économie ou identité ; R1053 non commencé. **Recette humaine des nouvelles présentations encore à confirmer** : banner/event/erreur syntaxe/Team ; Codes et Ticket seulement si observés naturellement, sans achat ni claim rare provoqué.
