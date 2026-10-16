# R1100 — suppression de compte : repli désactivé

Mandat du 16/10/2026, bootstrap `a55aaa798e51d0355c2d0d1c1d4a02259bc1aad2`, main/review et références origin alignées, arbre initial propre. R1100 était disponible. Le propriétaire autorise le cycle complet et un repli désactivé si l'accès privilégié Auth indispensable manque. Aucun compte public ne peut servir à la QA.

## État livré et prérequis

**Livraison partielle : interface préparée, suppression réelle NON implémentée, NON qualifiée et NON activable.** Aucun effacement, anonymisation, révocation Auth/Twitch ou nettoyage de cache n'a lieu. Aucun succès de suppression n'est affiché. Une variable d'environnement ou une clé ajoutée ne peut pas activer ce candidat.

Le `.env` serveur local ne fournit que les paramètres publics Supabase, sans credential Admin Auth. L'inventaire Railway, valeurs expurgées, expose `SUPABASE_STORAGE_SECRET_KEY`, mais pas de credential explicitement établi pour l'administration Auth. Son nom ne prouve pas une restriction technique au Storage ; inversement son existence ne démontre ni un accès utilisable par cette mission ni le contrat d'administration Auth. Cette clé n'a pas été extraite, réaffectée ou testée par un appel destructif. **L'absence d'accès Admin Auth établi, et non une prétendue impossibilité technique de cette clé, motive le repli.**

Reprise nécessaire : établir/configurer l'accès Admin Auth côté serveur par les mécanismes sécurisés existants (aucun secret dans un chat/Git/frontend), puis implémenter et qualifier la procédure complète décrite ci-dessous. Ajouter une clé seule ne termine pas R1100. Aucun nouveau GO générique n'est requis par le mandat ; les gates techniques demeurent obligatoires.

## Comportement physique

Menu → Compte : section finale et AppButton danger « Supprimer mon compte », texte d'effacement définitif et indisponibilité explicite. Pendant le Tutoriel interactif, l'ouverture est désactivée. Modale avec avertissement propriétaire, saisie SUPPRIMER, Annuler et Supprimer définitivement rouge **toujours désactivé, sans handler**. Focus initial, boucle Tab, Échap, clic extérieur et restitution du focus via la primitive existante. La modale possède son propre défilement borné à la hauteur utile ; elle reste accessible sur petite hauteur mobile.

Pas de collecte de mot de passe, preuve de réauthentification ou requête d'effacement dans ce repli. Aucun appel Supabase Admin, DB, Twitch, Storage, aucun changement AuthProvider/cache/provisionnement. `POST /api/v1/me/account/deletion` utilise le guard Bearer existant : 401 sans identité vérifiée, 503 `ACCOUNT_DELETION_UNAVAILABLE`/no-store sinon, sans utiliser le body, un playerId ou provisionner un Player. Les doubles requêtes reçoivent le même refus sans effet. Ce refus ne constitue pas la future validation de réauthentification.

## Alternatives et analyse préalable

Cascade Player rejetée : elle peut détruire des faits appartenant à des tiers et manque les identités sans FK. Renommer/archiver seul rejeté : contenus personnels, sessions, Auth et récupération Twitch subsisteraient. Une procédure dédiée courte, reprenable et bloquante reste la cible ; aucun framework générique ni modification du moteur R1099.

Audit préliminaire indépendant en lecture seule, non exhaustif et **insuffisant pour autoriser un effacement** :

- `PrismaTwitchPlayerStore.resolve` peut recréer un Player absent ; partager le verrou `twitch-provision:${twitchUserId}` et empêcher les restaurations/imports obsolètes sans conserver inutilement une identité permanente.
- `targeted-player-rows.ts` protège les tiers lors d'un remplacement personnel ; son allowlist n'est pas un inventaire complet d'effacement. Classifier toutes les FK réelles et dépendances indirectes avant transaction.
- Identifiants sans FK : `migration_mappings.target_id`, `friendships.legacy_left_player_id`, faits sociaux historiques et métadonnées de migration.
- Contenus indirects : result_summary des opérations, snapshots Gacha, reçus/états Arcade, payload_minimal Twitch/recoveryDeferred, signalements Chat/MP/context_snapshot, notifications d'autres destinataires, population des tirages Event, concours, distribution/annonces Giveaway, invocations partagées et votes externes.
- Décoder d'abord les compactages lossless R1099 et le codec Twitch avant recherche/neutralisation. Le texte d'une chaîne compressée ne permet pas de prouver l'absence d'identité.
- Préserver conversations, ressources et progression des tiers ; retirer contenus personnels et identités des historiques partagés. Une référence Player neutralisée restant recoupable ne peut pas être déclarée irréversiblement anonyme.
- Examiner aussi Storage, snapshots/sauvegardes privés et callbacks différés. Aucune archive locale ou publique n'a été supprimée par cette mission.

## Cible future, non implémentée

Identité cible exclusivement issue de la session vérifiée ; preuve serveur d'une authentification récente et fiable auprès de Supabase, distincte de SUPPRIMER. Acceptation irréversible sous coordination, blocage immédiat des anciens JWT/mutations/provisionnement, effacement transactionnel classifié, révocation et suppression Auth officielle, reprise des interruptions et contrôle final avant succès. Refus des responsabilités globales indispensables non transférées. Réinscription vierge sans restauration historique.

La documentation officielle [deleteUser](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser) exige une clé privilégiée strictement serveur et distingue suppression physique et soft-delete. Le [contrat des sessions](https://supabase.com/docs/guides/auth/sessions) rappelle qu'un JWT peut rester valide après révocation/suppression ; une vérification métier immédiate reste nécessaire. `reauthenticate()` destiné au changement de mot de passe ne doit pas être supposé fournir à lui seul une preuve autoritative pour l'API métier. Changelog consulté ; aucun SDK ni mécanisme Auth ajouté dans ce repli.

## Qualification et limites

Tests ciblés : ouverture, danger, indisponibilité malgré SUPPRIMER, zéro requête d'effacement, Tutoriel, annulation/focus/clavier ; intégration Compte existante ; route 401, refus 503, body arbitraire et requêtes simultanées sans provisionnement. Suites générales/builds et qualification visuelle : preuves consignées au Master avant publication.

**Non exécutés / non revendiqués** : tous les scénarios d'effacement PostgreSQL, suppression Auth mockée, révocation Twitch, mauvais mot de passe, ancien JWT après effacement, reprise d'effacement partiel, réinscription vierge et purge de JSONB/Storage. Ils exigent l'implémentation future et des comptes intégralement synthétiques en schémas privés. Aucun test mutatif PostgreSQL ni migration nécessaires au repli sans accès DB ; aucune donnée métier publique utilisée pour QA.

Modèle V1, schéma Prisma/migrations, politique et moteur R1099 inchangés. Sources examinées : AGENTS/Guide, Master/workflow/handoff, roadmap, modèle/schéma/backend, rétention, navigation/layout, migration et contrats Auth/Twitch/Social/MP pertinents ; audits legacy et preuves R1097–R1099 préservés. La reprise s'appuie sur le Master, sans tracker concurrent.
