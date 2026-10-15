# R1099 — conservation B2 : visibilité et compactage réversible

Mandat propriétaire du 15/10/2026, baseline `33487db1cabc679c98f9bc5e85af5ff7db55030c`, quatre références alignées et arbre initial propre. AssistantIA hors périmètre. R1099 libre. Le mandat délègue le choix technique et autorise qualification, reviews GitHub, promotion stricte et activation des seuls domaines sûrs dans cette mission. Les durées produit restent celles de R1097. État réel de livraison au Master ; une implémentation locale ne vaut ni approbation indépendante ni activation.

## Choix et alternatives

Le moteur R1098, son timer 04:00 Europe/Paris, son singleton, ses tentatives et ses alertes sont étendus. Aucun nouveau service, Cron, achat ou nettoyeur Twitch passif. Les preuves sont parfois l'unique protection économique : les supprimer sur la seule base de leur âge serait incorrect. Une archive dupliquée ajoute du stockage et des FK ; un rollback global effacerait les progrès postérieurs. Ces alternatives sont écartées. Le choix délégué est le filtrage réversible des consultations ordinaires et le compactage strictement sans perte de trois JSON historiques. La récupération de chaque compactage est contenue dans sa propre postimage, sans dépendre de la fraîcheur d'une sauvegarde générale.

La migration additive084 est nécessaire pour une progression durable au-delà de10000lignes et un arrêt immédiat persistant. `retention_progress` contient uniquement domaine, cycle, cutoff, curseur de clés et compteurs bornés ; aucune copie de contenu joueur. `retention_job` reçoit `execution_enabled` faux par défaut et une liste fermée de domaines autorisés par le code. RLS et droits PUBLIC/anon/authenticated révoqués. Aucun modèle économique ni FK métier modifié.

## Inventaire et exécution

Pagination keyset par PK UUID ou tuple `(gift_code_edition_id,player_id)`, borne supérieure et cutoff figés à la première page ; checkpoint et compteurs sous fencing token/bail. Chaque page comporte au plus10000lignes et un témoin. Quantum d'inventaire5s par domaine et budget de cycle90s. Une page inachevée reprend sans recompter ; une erreur reprend la dernière page validée. Un sweep inachevé garde son cutoff même le lendemain. Les insertions à UUID inférieur au curseur sont visitées au sweep suivant, pas promises dans un snapshot global inexistant. Les évolutions d'état entre pages sont conservatrices, revérifiées au moment de toute mutation.

Modes `DISABLED`, `DRY_RUN`, `EXECUTE`. L'exécution exige simultanément `RETENTION_EXECUTE_DOMAINS`, `retention_job.execution_enabled` et l'appartenance à `enabled_domains`, plus le token/bail valide. Liste fermée : `twitch_terminal,gacha,arcade`. L'admission distingue version2/mode : un cycle R1098 ou DRY_RUN déjà réussi peut être qualifié puis exécuté le même jour, sans attendre une nuit ni contourner les trois tentatives/backoff15min de chaque phase. Un crash ne remet pas ce compteur à zéro.

Writer : au plus50clés sélectionnées et5tentatives expirées par transaction, statement_timeout3s, lock_timeout250ms, transaction5s, quantum15s par domaine. Verrou singleton pendant le lot, aucun verrou maintenu entre lots. L'arrêt durable attend au plus le lot en cours puis interdit le suivant ; il ne révoque pas rétroactivement un commit terminé. Âge, terminaison, format et relations sont relus sous verrou de ligne. Transformation et curseur sont atomiques. Échec SQL : rollback du lot, rapport ERROR avec derniers compteurs validés ; aucun retry interne sans borne. Un domaine en échec rend le cycle PARTIAL et laisse les autres indépendants.

L'inventaire EXECUTE dispose de35s du budget90s ; DRY_RUN garde90s. Le reste est réservé aux writers. Une clé technique `execute:rotation` dans retention_progress garde le prochain domaine prioritaire. Sa mise à jour est clôturée au token/bail **avant** chaque writer : une interruption ou une opération lente ne fait pas systématiquement repartir au premier domaine, y compris au cycle du lendemain. Les domaines désautorisés sont ignorés. Les budgets sont des échéances vérifiées entre opérations PostgreSQL courtes, pas une interruption arbitraire au milieu d'un commit. Tests de charge simulée sur vrai registre PostgreSQL : inventaires constamment PARTIAL, trois writers visités ; forte consommation du premier writer, priorité Twitch/Gacha/Arcade sur trois jours successifs. Ce mécanisme corrige le finding d'équité de la première review GitHub.

Les compteurs historiques B1 `technicallyEligible=0` / `B2_UNQUALIFIED` continuent de décrire la **suppression irréversible** des détails des tables principales. Ils ne qualifient pas les compactages sans perte : ceux-ci disposent d'un rapport `transformations` séparé, avec scannés/expirés/protégés/compactés, octets JSON logiques et `pg_column_size` avant/après. `destructiveActions=0` reste exact.

## Matrice de traitement

| Domaine | Consultation ordinaire | Stockage / preuves |
| --- | --- | --- |
| Twitch terminé30jours | Aucune consultation joueur générale de ces reçus | `commandPilot.intent.reads` via codec Brotli R1097 existant ; enveloppe Event, réponses et tous les autres champs intacts |
| Twitch passif24h | Inchangé | Propriétaire TTL existant seul |
| Chat1mois | Fenêtre, polling, unread et parent de réponse filtrés | Contenu, mentions, pointeurs, signalements et snapshots conservés ; retrait physique bloqué |
| Banque1mois | Liste, total et récents filtrés | Opérations, mouvements, soldes et replay intacts |
| Boutique/Échanges3mois | Listes et récents/exécutions filtrés | Achats, demandes en cours, réservations, remboursements et preuves intacts |
| Codes1mois | Liste des claims affichés filtrée | Claims et calcul de disponibilité restent durables, aucun second gain permis |
| Event1an | Liste des éditions terminées filtrée | Participations, points, claims et distributions conservés ; édition ACTIVE expirée reste protégée |
| Boss1an | Historique/classement des périodes mensuelles bornés | Résumé mensuel conservé un an après sa période ; attaques/preuves intégrales conservées, aucun retrait de détail individuel livré |
| Combat1an | État courant existant ; pas de nouvel historique ancien à masquer | Tentatives/récompenses/statistiques durables ; aucun retrait physique livré |
| Concours1an | Historique et accès au détail terminé filtrés | Classements, récompenses et participants conservés |
| Notifications résolues1an | Déjà absentes de la liste normale UNREAD/READ | Déduplication/anti-résurrection conservées, non résolues protégées |
| Gacha1an | Historique/total filtrés | Snapshot original intégral compressé si gain réel ; RNG/Team inline ou v2, états, rareté relationnelle et résumé d'opération conservés |
| MP1an | Fenêtre, archives, recherche, dates, previews et badges filtrés | Contenu, replies, preuves de modération et pointeurs conservés ; nouveau `contentPurgedAt` bloqué tant que récupération continue non qualifiée |
| Arcade1an | Sessions/records/état courant inchangés | Réponse de reçu intégrale compressée si gain réel, fingerprint/opération/session/récompenses intacts |
| Catalogue3mois | Aucun changement à la revue/provenance active | Séparation de logs supprimables non qualifiée ; aucune suppression |

Mois/années et égalité : conventions PostgreSQL Paris R1098 conservées. Boss expose des **résumés de périodes mensuelles**, distincts des attaques datées individuellement : à mi-octobre2027, octobre2026 reste consultable, septembre2026 disparaît. Ce n'est pas un filtre instantané sur `BossAttack.createdAt`. La politique d'expiration de ces attaques reste inventoriée séparément ; aucune destruction n'en résulte.

`retentionVisiblePage` applique le même prédicat au total et aux IDs. Les lectures récentes/chat/MP n'utilisant pas de total emploient le parcours limité sans COUNT ; pas de matérialisation de snapshots/contenus complets. DTO, autorisations, modération et replay restent dans leurs propriétaires. Filtrer une consultation ne réduit aucun octet stocké.

## Formats, gain et reprise métier

Twitch exige le schéma pilote connu, `RESPONSES`, réponses toutes SENT avec messageId, état PROCESSED/date connue. EXECUTING/PENDING/SENDING/FAILED/AMBIGUOUS, versions inconnues et enveloppes invalides restent inchangés. Lecteurs Brotli R1097 réutilisés, aucun champ Event retiré.

Gacha/Arcade utilisent `{retentionEncoding:'lossless-brotli-v1',envelope}` ; codec R1097 avec checksum/borne, seuil2Kio, gain logique minimal20%+256octets, limite du codec16Mio et limite de lecture du writer1Mio. Tous les champs originaux sont gardés, y compris inconnus ; un format métier invalide n'est pas transformé. Gacha exige opération gacha.pull COMPLETED, joueur ACTIVE, compte x1/x10 et totalité des résultats cohérente, états enregistrés et Team lisible ; Arcade exige opération COMPLETED/joueur ACTIVE et références terminales connues. L'exclusion conservative d'une ancienne invitation ne force jamais sa conversion.

Le roundtrip JS est suivi d'une comparaison **SQL JSONB** à la valeur originale sous verrou : les nombres au-delà de la précision JavaScript refusent la transformation. Après UPDATE sous savepoint, `pg_column_size` doit diminuer strictement, sinon rollback de ce changement. Le gain du datum/TOAST est distinct d'un gain disque de relation ou de base : aucun VACUUM FULL, rewrite ni baisse physique immédiate promis. Les snapshots Gacha naturels petits peuvent légitimement ne produire aucun gain.

Lecteurs compatibles : replay Gacha, historique et résolution Team développent le snapshot avant toute lecture ; Arcade développe le reçu avant replay. Les récompenses ne sont jamais recalculées. Un format inconnu/corrompu échoue fermé. **Ne jamais revenir à un serveur sans ces lecteurs après production d'un wrapper**, même si le writer est arrêté.

## Sauvegarde et récupération

[Preuve agrégée](evidence/r1099-restoration.json) : export cohérent sous RepeatableRead/exported snapshot du SQL public83migrations, schéma natif et séquences,159tables/63420lignes ; données conservées comme chaînes JSON originales (aucun arrondi JS), gzip puis AES256GCM, clé WindowsCurrentUser DPAPI, archive privée ignorée. Restauration réelle sur PostgreSQL17.6 Windows loopback, clients natifs17.11. Empreintes typées export/restauration égales pour toutes les tables,780contraintes équivalentes après parsing PostgreSQL de5CHECK dont la parenthésation textuelle diffère, ACL/RLS concordantes. Aucun test gameplay sur les joueurs restaurés, seulement validation en lecture. Jeux synthétiques de qualification dans d'autres schémas privés.

L'instant exact du premier snapshot n'a pas été enregistré séparément : il précède l'écriture de l'archive et la validation20:57:50UTC du15/10 ; ne pas annoncer une fraîcheur plus précise. Les essais `pg_dump` données/COPY avaient échoué (SSL EOF/timeouts), aucune sauvegarde revendiquée sur ces essais. Les objets Supabase Storage ne sont pas exportés : aucun traitement livré ne les touche. Les contrôles ACL comparés couvrent précisément les droits SELECT anon/authenticated et les flags RLS des159tables ; pas un audit de tous les privilèges de tous les rôles. La clé DPAPI exige le même utilisateur Windows ; archive/clé hors GitHub, aucune restauration globale publique autorisée. Conserver le couple privé et sa preuve d'intégrité ; un futur export doit enregistrer son instant de snapshot. Le clone plaintext temporaire est arrêté/nettoyé à la clôture.

Cette sauvegarde ponctuelle **ne qualifie aucune récupération externe continue**. Aucun writer DELETE, retrait irréversible de champ ou effacement nouveau de contenu Chat/MP n'est livré/activable. Le blocage est technique, sans achat imposé ; aucun arbitrage propriétaire n'est inventé. Un futur retrait irréversible exige sa propre récupération ciblée/continue et une qualification séparée.

Récupération des compactages : `restoreStoredDetail` verrouille exactement la ligne/colonne autorisée, exige SHA256 de la postimage courante, développe son contenu intégral puis ne réécrit que cette colonne. Une postimage périmée est refusée ; les progrès ultérieurs ailleurs restent intacts. Pas d'import de sauvegarde joueur ni d'appel gameplay. Commandes depuis `server`, avec DATABASE_URL fourni par l'environnement privé :

```powershell
node node_modules/tsx/dist/cli.mjs scripts/retention-maintenance.mts stop
node node_modules/tsx/dist/cli.mjs scripts/retention-maintenance.mts restore <domaine> <UUID> <SHA256-postimage>
```

Le hash se calcule sur `JSON.stringify` de la valeur Prisma de la colonne, en mémoire privée, sans logger le payload. Le script ne démarre aucun runtime/scheduler/HTTP. L'arrêt durable conserve tous les lecteurs ; `RETENTION_MODE=DISABLED` peut ensuite arrêter le timer au redéploiement. Une erreur de commande ne journalise pas de credential ni de contenu.

## Ordre de livraison et preuves

Qualification privée et non-DB, publication review, deux reviews indépendantes du vrai SHA GitHub, correction/re-review puis FF strict main. Déploiement compatible en DRY_RUN et migration084 canonique via Prisma predeploy seulement. Postflight SQL/HTTP/cohortes historiques. Activer la liste DB des domaines qualifiés **pendant DRY_RUN**, puis leurs variables Railway EXECUTE/liste explicite, redéployer le même SHA et observer le rattrapage borné. Aucune donnée ancienne artificielle ni action économique publique. En l'absence de détail réellement expiré/transformable, zéro compactage public est le résultat attendu ; qualification synthétique et activation vérifiée ne valent pas économies publiques mesurées. Première vraie nuit séparée du rattrapage, date/observations au Master.

Contrôles, findings intermédiaires, reviews, métriques et SHA de livraison seront consignés dans la preuve de qualification et le Master. Sources revues : AGENTS/Guide/workflow, politique canonique, R1097/R1098 et preuves, architecture/modèle/schéma, décisions et ordre de roadmap ; seules les sources réellement changées sont actualisées. Aucun changement de gameplay, durée, économie, infrastructure payante ou historique documentaire R1098 et antérieur.
