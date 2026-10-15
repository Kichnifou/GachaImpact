# Croissance de la base PostgreSQL — mesure du 15/10/2026

**Nature : photographie technique, pas un suivi vivant ni une autorisation de purge.** Projet Supabase connecté `GachaImpact-dev`, ID `rmkpjudimoibyjsjtubh`, comparé à la [mesure du 09/10](../supabase-stabilization-r1065.md#mesures-réelles-et-limites) sur le **même** projet. Lecture SQL agrégée exclusivement, entre 12:04 et 12:15 UTC le 15/10/2026. Aucun contenu des messages, identifiant personnel ni secret exporté ; aucune écriture, DELETE, VACUUM, migration, changement de quota ou restauration.

## Occupation et quota

| Indicateur | 09/10/2026 | 15/10/2026 | Évolution |
| --- | ---: | ---: | ---: |
| Base entière via `pg_database_size(current_database())` | 77 753 491 octets (74,15 Mio) | **120 556 691 octets (114,97 Mio)** | **+42 803 200 octets (+40,82 Mio)** |
| Tables du schéma `public`, index et TOAST inclus | 38 461 440 octets (36,68 Mio), 144 tables | **80 166 912 octets (76,45 Mio)**, 157 tables | **+39,77 Mio**, +13 tables |
| Schéma historique de QA `batch_test_48a470dabadd4583afdb3406545573d0` | 5 685 248 octets, 140 tables | 5 685 248 octets, 140 tables | **0**, présence ancienne non étudiée pour suppression |
| Fichiers Supabase Storage (`storage.objects.metadata.size`) | ancien relevé : 236 490 octets pour deux assets | 236 490 octets / deux objets | Stable pour ces objets, trafic/egress non mesuré |

Le plan Free était documenté comme confirmé par le propriétaire en R1065 ; la documentation fournisseur actuelle indique **500 MB par projet** de taille de base avant lecture seule ([Supabase](https://supabase.com/docs/guides/platform/database-size)). Le rapport `pg_database_size` représente donc environ **24,11 %** de cette borne, avec **379 443 309 octets (~361,87 Mio)** avant 500 MB décimaux, sous réserve du plan/quota effectif dans le dashboard de facturation. Les 500 MB de quota de base ne doivent pas être confondus avec le GB de disque du plan. Seul le fournisseur donne sa jauge exacte. Il ne s'agit pas d'une mesure d'egress, de mémoire ou de latence.

La croissance moyenne **arithmétique** entre ces deux instants vaut environ 7,5 MB décimaux/jour. **Ne pas utiliser ce chiffre comme prévision.** Les séries d'enregistrements ont eu de fortes pointes entre le 09 et le 12/10, période de migration/rattrapages et tests ; le partage entre activité réelle, migrations, index et espace déjà réutilisable n'est pas isolé.

## Relations occupant le plus d'espace

| Relation `public` | 09/10 | 15/10 | Croissance |
| --- | ---: | ---: | ---: |
| `twitch_event_receipts` | 5,49 Mio | **22,34 Mio** | +16,85 Mio |
| `business_operations` | 3,31 Mio | **13,24 Mio** | +9,93 Mio |
| `pull_results` | 5,23 Mio | **11,20 Mio** | +5,97 Mio |
| `resource_movements` | non mesurée individuellement dans la référence | **5,41 Mio** | inconnue |
| `arcade_receipts` | 3,05 Mio | **3,98 Mio** | +0,92 Mio |
| `notifications` | non mesurée individuellement | 1,31 Mio | inconnue |
| `global_chat_messages` | non mesurée individuellement | **0,95 Mio** | inconnue |

Une relation inclut table, index, pages TOAST et espace PostgreSQL réutilisable ; cette valeur **ne mesure pas uniquement les données vivantes immédiatement purgeables**.

Les comptages instantanés réels au 15/10 (pas les estimations `reltuples`) donnent notamment **17 847 opérations**, **11 055 mouvements**, **6 613 résultats Pull**, **5 214 reçus Twitch**, **1 578 reçus Arcade** et **1 240 messages Chat**. Les séries observées montrent pour `business_operations` : 2 521 / 2 968 / 2 545 / 3 322 entrées du 09 au 12 octobre ; 1 308 et 1 341 les 13 et 14, puis 843 sur la journée partielle du 15. Pour `pull_results` : 393 / 1 456 / 516 / 2 006 du 09 au 12, puis 430 / 413 et 350 au 15 partiel. Pas de débit mensuel stable inférable à partir de ces seules journées.

## Rétention et précautions

- Reçus Twitch : **4 504** `channel.chat.message` `PROCESSED`, avec `external_reference` non nulle : **preuves durables**, pas un stock de messages jetables. **707** `RECEIVED` sans référence, dont **223** légèrement au-delà de 24 h, sans `processed_at` ni `FavorGrant` lié ; **91 876 octets** cumulés de payload JSON seulement pour ce groupe. La maintenance TTL R945 est déjà livrée ; une collecte périodique peut dépasser ponctuellement sa borne selon le trafic. Le lot éligible à cette heure est minime, et la disparition de lignes ne réduirait pas automatiquement le fichier PostgreSQL. Aucun nettoyage forcé.
- Historique du Chat : **1 240 entrées**, aucune au-delà de **30 jours** ; Banque **155**, aucune au-delà de 30 jours ; Boutique **194**, aucune au-delà de **90 jours** ; Échanges **65**, aucune au-delà de 90 jours ; Notifications **499**, aucune au-delà de 365 jours. Les bornes SQL glissantes servent ici d'indicateurs : les mois et ans du [contrat canonique](../../specifications/data-retention-v1.md) restent des durées calendaires à interpréter au moment d'une éventuelle implémentation.
- Les gros ensembles `business_operations`, `pull_results` et `resource_movements` portent des reçus, statistiques, historiques de tirage, déduplications ou soldes auditables. **Aucune suppression par ancienneté ne peut être présumée sûre**, même si une table grossit. Les documents spécialisés imposent de vérifier les preuves et la protection anti-double-effet par domaine.
- Les anciennes durées de [rétention validées](../../specifications/data-retention-v1.md) restent un cadre de politique ; leur implémentation générale était déjà reportée par R1034. Le propriétaire confirme désormais : **pas de purge préventive ; n'étudier ou réaliser une purge que si l'occupation ET sa croissance soutenue deviennent réellement préoccupantes**, après audit des références et sauvegarde, avec autorisation spécifique.

## Recommandation de surveillance (non déployée)

**Aucune purge à lancer maintenant.** Relever environ une fois par semaine le même `pg_database_size`, les tailles/compteurs des cinq premières relations, le volume de reçus `PROCESSED` et `RECEIVED`, les éventuels historiques réellement échus et les anomalies d'index/autovacuum. Comparer des périodes normales de bêta plutôt qu'une semaine de migration. Vérifier aussi les usages/quota réels dans le dashboard Supabase et toute réserve de croissance avant le premier tirage Event.

**Seuils proposés pour décision ultérieure, non encore validés comme automatisation :** vers **250 MB (50 %)** et croissance persistante, diagnostic anticipé ; vers **350 MB (70 %)**, étude concrète de conservation/compactage sûr ; **400 MB (80 %)**, priorité d'exploitation avant l'entrée en lecture seule à 500 MB. Une croissance anormalement rapide ou un incident peut justifier un examen bien avant ces seuils.

Séparer trois réponses possibles : (1) conserver et observer ; (2) maintenance PostgreSQL sûre/réutilisation des pages sans destruction de preuves ; (3) purge ou archivage **spécialisé**, avec contrat, sauvegarde, tests et vérification idempotente. Un `VACUUM FULL`, `DELETE` ou nettoyage de schéma privé ne fait **pas** partie du présent mandat.

**État conclusion :** aucune preuve de saturation immédiate, mais une **hausse réelle de 40,82 Mio depuis le 09/10** qui justifie des mesures répétées, plutôt qu'une affirmation « croissance nulle ». Le cœur du volume est majoritairement constitué de données métier durables et d'événements Twitch traités ; le Chat historique n'est pas le facteur dominant.
