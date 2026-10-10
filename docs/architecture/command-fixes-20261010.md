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

Les snapshots cohérents avant/après doivent expliquer les écarts du jeu vivant par opérations, receipts, owners et unicité ; les 44 historiques, exclusions/quarantaines et choix R1055 sont protégés. Publication GitHub, review indépendante du SHA, déploiements exacts et postflight sont ajoutés après exécution, sans anticipation de succès.
