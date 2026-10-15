# Réconciliation documentaire V1 pendant la bêta — 15/10/2026

## Amendement propriétaire ultérieur du 15/10/2026

**Cette photographie était antérieure à la dernière clôture communiquée par le propriétaire.** Il déclare désormais terminés le gameplay/économie/progression/Twitch GLOBAL/standalone, le point rouge Invocation R1096 et la **finition mobile générale**. Il abandonne explicitement les pistes `.exe`/PWA, thèmes supplémentaires et Objectifs personnels ; il confirme la Reward Gift Suprême visible et active côté Twitch, sans revendication d'une nouvelle redemption end-to-end. Les tâches réellement conservées sont : récupération Twitch R1096 avec un ami plus tard, premier tirage Event naturel fin octobre, bêta multijoueur ultérieure, validation finale et décision d'ouverture V1. Les purges historiques ne seront examinées que si taille **et** croissance deviennent préoccupantes : [baseline DB en lecture seule](database-growth-baseline-20261015.md). Les « restant mobile / Objectifs futurs » dans la photographie originale ci-dessous sont **historiques et supersédés**, non des tickets à ouvrir. Le [Master](../../master/PROJECT_MASTER_PLAN.md) conserve l'état vivant.

**Base de lecture :** `256729da6ab44ee01d56bc3a736f2edfa26b4e04` (checkpoint documentaire R1096 ; `main = review`, divergence 0/0). **Nature : preuve datée et bilan de priorités, pas second tracker vivant.** L'état opérationnel et la prochaine action appartiennent uniquement au [Master](../../master/PROJECT_MASTER_PLAN.md).

## Méthode et couverture

- Reprise de l'[audit intégral du 13/10](documentation-audit-20261013.md) : 21 écarts documentaires corrigés dans sa mission, ancienne matrice de toutes les familles conservée sans réécriture. Les dix anciennes assertions `verify:full` y signalées sont depuis classées corrigées et PASS dans [la preuve historique](historical-test-debt-20261013.json) et les livraisons récentes ; ne pas les rouvrir.
- Arbre GitHub actuel : **90 Markdown sous `docs/`**, dont **79 sources de produit/processus GachaImpact** (Master inclus) et **11 documents Story distincts/protégés** ; **35 JSON de preuve** sous `docs/architecture/evidence`. Les 78 Markdown hors Master/Story ont été ouverts et parcourus ; le Master de 7 099 lignes a été lu depuis son blob brut. Les 11 Story n'ont pas été réaudités sur le fond et n'ont pas changé depuis l'audit du 13/10 d'après le diff GitHub.
- Contrôle mécanique des chemins de liens Markdown relatifs sur les 79 sources produit (dont 304 chemins extraits du Master) : **aucun chemin cible inexistant dans les références reconnues**. Limite : extraction simple ; elle n'est pas une validation exhaustive des ancres GitHub, des destinations externes ni du fonctionnement des liens dans le navigateur.
- Confrontation des derniers contrats, de la roadmap, des états R1093–R1096 et de leurs registres de qualification au code versionné / migrations. Les anciennes sections chronologiques des audits gardent le sens de leur date : « futur » dans une section R9xx n'annule pas une livraison R10xx postérieure.
- Aucun test navigateur authentifié, appel économique, mutation Player, suppression/purge, activation Twitch, récupération OAuth réelle ou modification d'infrastructure n'est exécuté dans cet audit documentaire.

## Socles livrés — ne pas recréer

| Ensemble | Synthèse de la preuve |
| --- | --- |
| Auth/Web, PostgreSQL et migration Twitch | Socles réels ; 31A/31B et [GLOBAL R1064](../twitch-global-r1064.md) livrés dans leur périmètre, héritage R1055/identités préservé. |
| Gameplay V1 (Gacha, équipes, économie, missions B/A/S/Z, quotidien/Combat, Boss, social/MP, Concours, Event, Arcade, classements, historiques) | Implémenté par les propriétaires métiers ; adaptations jusqu'à R1095, tests ciblés et postflights historiques, sans revendiquer l'absence de bugs de bêta. |
| Codes enrichis, Auth recovery e-mail, Catalogue Storage/publication, cosmétiques, Roue et Invocations partagées | Livrés selon leurs contrats. L'ancien SMTP intégré restreint est supersédé pour le parcours Brevo hors équipe réellement testé ; Storage/bucket et quotidien/catalogue activés depuis le 11/10. |
| Tutoriel | **115 étapes actives**, 24 chapitres, 21 écrans ; anciens catalogues 116/121 conservés pour compatibilité, R1094 corrigé, texte ciblé R1095. |
| R1095 | **Validé par le propriétaire** après ses tests ; le défaut de point rouge a été traité séparément par R1096. |
| R1096 | **Livré techniquement**, tests/reviews indépendantes, Railway/Cloudflare et postflight confirmés au checkpoint indiqué. Recette utilisateur à distinguer, voir ci-dessous. |

Cette liste ne constitue pas une nouvelle certification de chaque ancien système ni un audit de sécurité/résilience exhaustif. Les preuves spécifiques restent dans le Master, les propriétaires spécialisés et les JSON datés.

## Réellement ouvert — à garder distinct

| Nature | État au 15/10 | Suite justifiée |
| --- | --- | --- |
| Recette propriétaire R1096, indicateur rouge du bouton actif `Arrêter la diffusion` | Code et GameShell qualifiés, **test humain prévu**, pas encore confirmé | Tester normalement la diffusion, sans nouveau lot avant anomalie. |
| R1096 retour OAuth / récupération Twitch avec un joueur issu du legacy | Modèle de sûreté et 30 cas PostgreSQL privés qualifiés ; **pas de liaison réelle publique effectuée en QA R1096** | Observer avec un autre ami volontaire lors d'un parcours normal ; comparer uniquement si données significatives, ne jamais perdre les deux sauvegardes par simplification. |
| Petite finition ergonomique/mobile finale | Des smoke tests en 390×844 et d'autres formats existent ; **la passe mobile générale n'est pas pour autant commencée/validée** | Lot mobile limité après observations et arbitrage propriétaire, préserver les rendus desktop de référence. |
| Bêta multijoueur | **Commencée et en cours**, R1095 acceptée, retours R1096 partiels | Continuer les essais naturels et corrections prouvées ; pas de campagne artificielle de dépenses/combat/relations. |
| Event mensuel, premier tirage réellement déclenché | Service R1053, scheduler et tests privés acquis ; **première clôture naturelle attendue le 01/11/2026 à 00:00 Europe/Paris** | Observation du seul événement réel : résultat, notification, Historique, un reçu/aucun double paiement ; ne pas provoquer de tirage. |
| Finalisation R1054 / ouverture officielle V1 | **Non approuvée par le propriétaire**, distincte de la disponibilité d'une bêta publique | À décider après la bêta et les confirmations pertinentes. Pas de lancement déclaré automatiquement. |

### Limites conditionnelles à ne pas confondre avec un lot oublié

- **Catalogue Mitya/Valeriy :** les derniers contrôles les laissaient incomplet/conflit, faute de sources admissibles ; le moteur de recherche/suivi/publication fonctionne. Leur vraie convergence n'est pas garantie à ce jour et aucune activation forcée n'est autorisée.
- **Qualif PostgreSQL Gacha/GlobalChat élargie :** ancienne couverture globale non revendiquée ; les correctifs ont leurs tests métier, des campagnes ciblées, et `verify:full` R1096 PASS 8/8. Reprendre un audit élargi en présence d'un indice précis de bêta, sans inventer une réussite globale.
- **Historique de purges/rétention :** [politique](../../specifications/data-retention-v1.md) décidée, certaines maintenances implémentées, les purges restantes **différées par décision R1034 au post-V1/besoin réel**, avec protections anti-perte. Ce n'est pas une gate obligatoire pour la V1.
- **Gift Suprême :** core et bridge spécialisés validés historiquement, bridge désactivé après son test initial dans les preuves anciennes. **L'état opérationnel courant de la reward spécialisée n'est pas établi par ce seul audit** ; ne pas déclarer son activation sans preuve actuelle, ni réactiver une reward/Streamer.bot par déduction.
- **E-mails :** Brevo Free et un recovery réel hors équipe sont acquis ; rotation/expiration de la clé SMTP et délivrabilité d'autres types/destinations relèvent du suivi d'exploitation, pas d'un nouveau chantier Auth généralisé.
- **Test historique à très faible hauteur 430 px :** débordement de header établi au baseline du 13/10, mais **non requalifié au HEAD R1096** ; ne pas le déclarer régressé aujourd'hui. Un incident réel pourra justifier une correction locale.

## Orientations futures, facultatives ou explicitement écartées

| Sujet | Décision documentaire |
| --- | --- |
| **Objectifs personnels** | Direction future validée, mais [périmètre V1 à trancher](../../roadmap/implementation-order-v1.md#sujet-hors-séquence-obligatoire) et aucune place obligatoire dans la séquence ; ne pas le qualifier de lot V1 oublié. |
| **PWA / application `.exe`** | Évoquées puis reportées au profit d'un conseil de zoom dans le Tutoriel. Pas de mandat d'installation Windows ni de moteur de résolution virtuelle. |
| **Thèmes graphiques alternatifs** | Étudiés et volontairement écartés par la revue du 13/10 ; CSS non suffisamment centralisé, pas de thème incomplet à ajouter. |
| **Staging payant, nouvelles infrastructures, Supabase Realtime, refonte transport** | Conditionnels au besoin démontré et à l'autorisation ; pas de dépense/activation implicite. |
| **Quarantaines et éléments legacy non importés** | Exclusions protégées, pas des imports silencieux « à finir » ; toute résolution future demande une preuve/autorisation ciblée. |

## Réconciliation des pointeurs documentaires

- **Master :** enregistrer en tête les validations humaines R1095, l'état partiel R1096, la reprise de l'audit et la prochaine action réelle ; conserver les 7 099 lignes historiques exactement, sans remplacer leurs anciens « points courants » datés.
- **Ordre V1 :** ajouter un chapeau de synchronisation après R1096 ; les phrases R1095 devenues historiques ne restent pas la prochaine action. Rectifier la mention ancienne « Tutoriel 116 » en précisant le catalogue actif115 et la compatibilité historique.
- **Invocations partagées :** expliciter R1096 « point rouge + Arrêter la diffusion » au-dessus de la formulation R1095, sans réécrire le comportement historique.
- **README documentation :** pointer ce registre daté en conservant l'audit du 13/10 ; aucun nouveau tracker vivant.
- **AGENTS, Guide, workflow, décisions, contrats métier et preuves antérieures :** vérifiés ; aucune nouvelle décision produit durable ni modification nécessaire pour ce seul audit, les propriétaires existants restant en vigueur.

## Conclusion de la passe

**Aucun grand domaine métier V1 oublié n'a été démontré** par cette confrontation. Cela ne signifie pas « tous les tests humains finis », « aucune dette technique » ou « lancement officiel autorisé ». Restent les recettes R1096, la bêta, une finition mobile ciblée et l'arbitrage final de lancement ; le tirage naturel de novembre est une observation différée. Les aspirations post-V1 et dossiers historiques non réouverts ne doivent pas gonfler artificiellement la liste opérationnelle.

Seul le [Master](../../master/PROJECT_MASTER_PLAN.md) indique désormais la prochaine action concrète.
