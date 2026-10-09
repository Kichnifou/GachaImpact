# Registre des commandes GachaImpact

**Présentation Boss R1064 :** `!combat boss go` conserve ses owners/formules et affiche `⚔️ joueur inflige dégâts DMG à boss grâce à sa team [élément personnage (Cn) - …] | ❤️ PV restants : PV/max`. Les quatre membres ordonnés proviennent du snapshot de l'attaque exécutée, jamais d'une Team relue après coup ; résultat et gains restent gelés au replay. Continuations explicites entre membres complets et limite 450 Unicode mention Twitch comprise. [Contrat GLOBAL/Boss](../architecture/twitch-global-r1064.md) ; statut réel au [Master](../master/PROJECT_MASTER_PLAN.md).

**Anti-spoiler temporaire avant révélation publique, 06/10/2026 :** Concours Twitch/chat volontairement opaque, réponse unique « 🏆 Concours : prochainement disponible. » avec ou sans arguments. Aucune URL standalone diffusée. L’aide ne donne aucun lieu d’accès ; réintroduction du vrai accès uniquement lors de la révélation publique. Les deux mentions d’interface dans le résumé `!event` sont neutralisées : calendrier non réclamable « indisponible actuellement », messages reçus « N message(s) à lire », sans changer les actions, compteurs ou récompenses. Documentation interne de déploiement/OAuth/CORS inchangée, aucune nouvelle Rxxx.

**Amendement de transport R1048 :** [décision](../specifications/decisions-log.md#fondations-pré-cutover-twitch-et-population-finale--r1048-2026-10-06) et [procédure](../process/twitch-native-foundations.md). Le noyau de commandes reste partagé ; le provisioning d'un nouvel ID couvert laisse passer le premier message/!element. Sans élément : messages, XP jusqu'au niveau 2 et commandes explicitement permises ; prérequis des autres owners conservés. La propriété NATIVE et le désir OFF/CANARY/GLOBAL sont durables, avec kill DB et revalidation transport après restart. Les paragraphes décrivant la mémoire d'armement R1042/R1047 restent historiques.


Statut : sweep métier historique 37 scripts + 17 JSON ; adaptation Chat des 37 sources couverte par R1035–R1039. Recette publique représentative R1038 acquise dans son périmètre ; derniers retours corrigés et étape 29 clôturée par décision propriétaire R1039.

État physique du Chat interne, selon [R884](../specifications/global-chat-v1.md) : `help`, `element` (choix défensif), `banniere`, `select`, `vote`, `pity`, `pull` (tout entier 1..10), `obtention`, `stella`, `passifs`, `roue`, `ami`, `echanger`, `infos`, `liste`, `banque`, `convertir`, `sac`, `coffre`, `shop`, `code`, `event` complet avec Jeux A/B/C, `expedition`, `combat`, `quotis`, `mission`, `faveur` et `top` appellent les propriétaires modernes. `!concours` reste temporairement opaque avant la révélation publique : réponse neutre unique, sans projection ni action Concours. `box` possède maintenant les listes complètes, filtres, pages, favoris et tris textuels R1037 ; `team` consulte et exécute les mutations modernes décidées : apply/add/remove/rename/list/new ; save reste une aide. `!echanger accepter`, `annuler` et `refuser` sans pseudo traitent respectivement toutes les demandes reçues, envoyées et reçues de l'ensemble initial. `legende` consulte désormais le propriétaire Social/Concours en lecture seule, avec les permissions R565 précisées ci-dessous ; `faveur` est READY dans le Chat GachaImpact depuis le Lot 9. `giveaway` et `wish` restent Twitch uniquement. Le `ChatPanel` et les routes Chat navigateur sont actifs. `!clear` est l'exception interne de modération R886, absente de l'aide joueur.

La fondation Twitch runtime phase 1 promue techniquement sur `main` enregistre uniquement des reçus d'observation internes. La phase 2A promue techniquement sur `main` prépare un webhook entrant signé, toujours OFF et sans souscription EventSub. La Phase 2B-1 approuvée et promue techniquement sur `main` prépare seulement l’autorisation Chat et le manager GET/POST EventSub, sans consentement réel déclenché ni souscription publique créée. Le transport 2B-2 a été validé publiquement dans le périmètre porté au Master, puis mis en pause R942 ; il code l’UI pilote, l’activation volontaire après OAuth, le statut Twitch, la désactivation et l’unlink sûr ; production reste OFF après promotion. La souscription écoute tous les chatters de la chaîne Kichnifou : `user_id` n’est pas un filtre auteur. Le webhook n’écrit que des reçus avec hash du texte, aucun GlobalChatMessage standalone. Ces phases historiques n’ajoutaient aucun scope user:write:chat ni commande/réponse générique. R1042 ci-dessous porte leur première exception Kichnifou-only, OFF par défaut, dont la recette propriétaire a validé les commandes listées ; R1043 corrige le seul écart Pull multiple. Les pilotes spécialisés Faveur, Gift et Giveaway ont leurs preuves propres au Master ; seul Giveaway/Wish a un consumer natif et des annonces dédiées, désactivé hors pilote. Streamer.bot reste autoritatif hors ces essais explicitement autorisés ; aucune bascule globale.

### Bridge Twitch natif R1047 — approuvé et promu sur main, sans cutover

Le [registre central](../../server/src/application/chat/chat-command-registry.ts) fait autorité pour racines, aliases et syntaxes. La [classification physique](../../server/src/application/twitch/twitch-command-coverage.ts), contrôlée exhaustivement depuis ce registre par [twitch-command-coverage.test.ts](../../server/tests/twitch-command-coverage.test.ts), revendique exactement **34 entrées Player Twitch : 32 génériques et 2 spécialisées, wish/giveaway**. Aucun oubli ou double owner permis ; une nouvelle entrée Twitch non classée fait échouer le test. Faveur acquisition et Gift restent dédiés ; la consultation faveur est générique. Clear est interne.

R1047 remplace la limite des sept familles canary R1042/R1043 par le résolveur complet partagé avec le standalone. Lectures, sous-commandes, mutations, formulations et erreurs utilisent les mêmes propriétaires. Un argument invalide reçoit la syntaxe/erreur moderne sans effet explicite de commande ; une entrée inconnue/interne/spécialisée n’est pas exécutée par le générique. Les compteurs de messages suivent leur contrat séparé. Les limites produit V1 existantes restent applicables ; avant révélation publique, Concours reste temporairement opaque selon la restriction en tête, sans action ni projection.

**Gates après correction du blocker de review `d1760bcc` :** capability AND armed, mémoire OFF au boot/restart, opérateur Kichnifou allowlisté. La subscription ACTIVE inspectée par le manager fixe ID de subscription, broadcaster, receiver et callback exact ; l’enveloppe et le Shared Chat sont contrôlés contre ce contrat serveur. Le receiver `condition.user_id` n’est pas un filtre auteur. L’acteur est exclusivement `chatter_user_id → TwitchIdentity → Player ACTIVE explicitement allowlisté`, même s’il n’est ni broadcaster ni receiver. Aucun viewer inconnu/inactif n’est provisionné et aucun login/displayName ne résout le Player. Réponse envoyée par le receiver, receipt rattaché au chatter ; reprise response-only par l’opérateur du même transport, avec vérification du viewer actif/allowlisté. POST/DELETE pilot, protections des issues ambiguës et single-replica conservés ; aucune autorité batch permanente ajoutée.

**Intentions figées :** instant de réservation, arguments résolus/lectures nécessaires, cible/quantité dont MAX, slot/Team, banner/édition et contexte. Chaque owner reprend sa clé source TWITCH ; settings et groupes ont leurs preuves durables. Changement de contexte avant engagement : refus sûr, pas de nouvelle résolution. Aucun faux subject Supabase ni message standalone. Le vrai message ID distingue les commandes ; le texte ne participe jamais à la clé. Deux !pull identiques reçus distinctement fonctionnent, y compris sur le code de baseline ; cause live amont probable et non démontrée, aucun workaround serveur.

Réponses Helix au message source, segments ≤500 caractères Unicode ; receipt réservé, envoi SENDING journalisé avant HTTP, SENT conservé, refus certain reprenable response-only, AMBIGUOUS/SENDING bloqué. Retention observation-only ne purge pas les receipts engagés. Ancien Pull R1042/R1043 engagé sans intent récupéré par sa clé ; un ancien receipt non engagé sans intent reste en contrôle opérateur. [Architecture](../architecture/backend-architecture-v1.md#bridge-twitch-natif-complet-r1047--promu-techniquement-sur-main), [runbook](../process/legacy-cutover-runbook.md#post-recette-kichnifou--ordre-obligatoire-avant-31a-r1044r1047).

**Recovery local incident Kichnifou approuvé/promu/déployé (`cf43ddf`) :** seule reprise nouvelle d'un receipt moderne RECEIVED/EXECUTING/no-intent/no-response **pity sans arguments**, par opérateur vérifié et CANARY exacte, absence de toute opération clé/suffixe et de PENDING/outbound incertain. Vrai prepare/execute, même clé/date, aucune nouvelle commande Twitch ni faux résultat. Tout handler mutant ou intent déjà présente est refusé ; la reprise response-only garde son périmètre. [Runbook](../process/legacy-cutover-runbook.md#local-only--récupérer-un-executing-pity-sans-intent), review indépendante acquise ; dry-run public PASS, ancien pity terminal PROCESSED/RESPONSES/une SENT et audit unique, gameplay/compteurs préservés. Ne jamais rejouer le recovery. Kichnifou COMPLETE après smoke/F5/reconnexion ; Ceo au gate identité Web authentifiée, aucun import/liaison encore. Les formulations/gameplay des commandes restent celles de leurs owners.

Les messages ordinaires réutilisent les owners XP/Défis/Missions/quotidien/Event et leur propre plan durable. Giveaway/Faveur déjà natifs restent spécialisés ; les échos de sorties natifs prouvés sont exclus des effets joueur. [Audit de parité](step-29-command-coverage.md#parité-des-messages-ordinaires-twitch-r1047), distinct de la couverture des racines.

**Historique — micro-polish final R1047, 06/10/2026 :** recette publique R1047 et correctifs validés par le propriétaire ; seuls cinq ajustements de présentation/syntaxe sont demandés. Promotion directe review → main explicitement autorisée dans cette mission après contrôles verts, sans nouvelle review indépendante. Déploiement du nouveau checkpoint encore à vérifier ; Streamer.bot reste autoritatif, aucun cutover. Les bridges activés par le propriétaire restent hors périmètre : aucun état de flag changé ni état OFF présumé. Aucun R1046/31A/31B commencé ; [état et preuves au Master](../master/PROJECT_MASTER_PLAN.md). Les premiers quotidiens standalone et le rollover fresh/replay sont acquis ; les annonces Wish restent figées dans leur transaction, sans recalcul ni renvoi de SENT. Le gate Giveaway spécialisé reste indépendant de l’armement générique.

### `!clear` — modération interne R886

Syntaxe exacte : `!clear`. Seul un Player avec attribution active `MODERATOR` ou `ADMIN` peut l'exécuter ; `TESTER` seul est refusé. Le serveur ouvre une nouvelle génération visible du Chat pour tous sans effacer les anciens contenus physiques. La commande n'est pas publiée, aucun `GAME_RESULT` ne suit, et les retries de la même intention sont idempotents. Aucun canal Twitch ni aide joueur ordinaire.

Ce fichier porte le contrat des commandes ; le registre pur partagé alimente le Help textuel et [l’Aide / Guide R1026](../specifications/help-guide-v1.md), sans réimplémenter les domaines. La [matrice de couverture R1038](step-29-command-coverage.md) détaille les 37 sources, leurs variantes, propriétaires, adaptations, abandons et preuves. La recette publique reste distincte des contrôles automatiques.

## Passe finale Twitch / commandes R939–R942

**Méthode propriétaire étape 29 — R1038 amendement de R1036 :** le [protocole canonique](../process/implementation-workflow.md#protocole-propriétaire--étape-29-uniquement-r1036) autorise une mission regroupant les 31 sources restantes, lecture intégrale et choix des formulations sous délégation, sans validation tableau par tableau. Candidat complet et contrôles verts avant push review puis promotion strictement fast-forward du même candidat vers main, sans review ChatGPT intermédiaire. Après publication, vérifier le SHA et le déploiement exacts, puis la courte [recette essentielle](step-29-command-coverage.md#recette-propriétaire-essentielle-après-contrôle-du-sha-et-du-déploiement). Aucune activation Twitch.

**Étape 29 CLÔTURÉE PAR DÉCISION PROPRIÉTAIRE R1039 :** recette publique représentative R1038 et derniers retours explicitement bornés. Correctifs testés automatiquement et promotion du même candidat autorisée sans nouvelle review ou gate manuel. Aucune validation publique individuelle des dernières corrections présumée ; étape 30 ensuite clôturée R1041 ; pilote R1042 candidat non activé (voir Master).

**Préparation de bascule transparente, pas cutover en 29 :** mêmes syntaxes pertinentes, aliases conservés ou migration explicitement approuvée, réponses communes standalone/Twitch lorsque pertinent, mêmes services PostgreSQL/économie/cooldowns, identité Twitch User ID immuable, idempotence ; aucun double traitement/message, réponse ou récompense. Objectif après cutover : état migré reconnu et aucune réinscription manuelle due au changement de backend. Streamer.bot reste autoritatif aujourd'hui. Le propriétaire unique et les gates durables sont désormais définis par R1048. Les recettes compte test Twitch-only puis Kichnifou précèdent 31A Ceo, puis le batch historique strict après validation, selon le [runbook](../process/legacy-cutover-runbook.md).

Twitch et Chat standalone peuvent rester deux flux distincts, sans mirroring obligatoire. Tous les messages Twitch devront pouvoir alimenter en mémoire la future classification, XP et le parser ; seules les commandes nécessaires atteindront les services métier communs. L'adapter Twitch n'exécute aujourd'hui aucune commande et ne répond pas sur Twitch.

**Sorties communes — R1038 :** résultats issus des propriétaires modernes, montants exacts, glyphes et libellés français, noms complets, durées lisibles. Listes demandées complètes réparties en entrées logiques entières, une ligne et au plus 500 caractères Unicode par message, via le pipeline multiparties R1037. Pagination métier conservée (Box, Team 10, Shop 5, Liste 20) ; Top 5 et Event Top 10 restent leurs limites volontaires. Les intentions de mutation et les résultats autoritatifs sont mémorisés pour les retries après commit et avant publication ; aucun gain, toggle ou cooldown répété via un alias. La recette représentative R1038 et la clôture propriétaire R1039 ne valent pas validation publique individuelle des dernières corrections. Streamer.bot demeure autoritatif sur Twitch.

Après validation du transport 2B-2, pause de Twitch avancé et passage aux domaines V1 suivants. R1034 clôture 27 par décision de périmètre : la charge/performance restante est acceptée en observation bêta/situation réelle, non bloquante, sans campagne obligatoire pré-migration ; [l'architecture](../architecture/backend-architecture-v1.md) décrit le trafic/latence/pool/retries à mesurer. Le pilote conserve une écriture Receipt par notification ; sa seule purge codée suit la [politique de rétention](../specifications/data-retention-v1.md). Les commandes ordinaires seront évaluées en mémoire, sans historique Twitch ordinaire persistant lorsque inutile.

## Restitution finale propriétaire — R1039

Ces présentations remplacent les formulations R1038 concernées, sans changer les règles métier.

| Commande | Contrat final |
| --- | --- |
| Quotis | `📅 Quotidiennes : Récompense … \| Roue … \| Shop … \| Combat … \| Boss … \| Expédition … \| Amitié … \| Event … \| Faveur …`. Boss AVAILABLE avec ≥4 éligibles ⏳, moins de 4 ➖, USED/DEFEATED ✅. Expédition RUNNING partie aujourd’hui ✅, départ ancien ⏳, READY ⏳, IDLE départ utilisé ✅ même sans todayReward ; sinon canStartToday ⏳ / ➖. Event ⏳ tant qu’inscription/calendrier/bonus/A/B/C/messages non lus ont une destination dans le prédicat UI commun, sinon ✅. Shop est un libellé Chat ; Défi UI reste inchangé. |
| Échanges | Nom exact avec/sans @, montant/MAX. Projection TradeService read-only : introuvable, indisponible opaque (aucune divulgation de blocage/statut), même élément, demande PENDING, stock acteur nul, stock partenaire nul. Maximum après réservations non expirées ; create reste autoritatif. Cas Mynonyme : aucune particule ❄️ Cryo disponible à échanger chez le partenaire. |
| Expédition | Tentative de départ RUNNING : vrai personnage et remainingSeconds via durationText ; READY : aide !expedition retour. Nom READY exact conserve le claim. Rejeu confirmé conserve branche/ID. |
| Passifs | Alias exact !passif, Help canonique !passifs [element]. |
| Team | !team et !team N : ✅ Team Joueur : emoji Nom (Cn) - ... \| 🧩 Passifs actifs : textes compacts séparés par virgules, ou Aucun passif actif. Paramètres modernes exclusivement ; formatter partagé avec les compositions après mutations. |
| Shop | Racine 🛒 Shop : 📜 Mission [💰 coût] \| 💠 quantité Primos [💰 coût] \| 🎟️ Ticket [💰 coût] \| Achat : !shop article. Projection DailyChallenge.purchaseCost et catalogue Shop/rewardPerUnit ; aucun prix/bundle dupliqué. Pages explicites cinq entrées et actions mission/switch/primos/ticket conservées. |
| Sac | ✅ Joueur, sac : 💠 montant primos (floor(primos/160) voeux) \| 💰 montant moras \| emoji stock. Sept particules même nulles, personnel d’abord puis Pyro/Hydro/Cryo/Electro/Anemo/Geo/Dendro sans doublon ; aucun objet spécial Chat, UI Sac inchangée, Collection via Coffre. Lecture seule. |
| Liste | Help !liste <pyro\|hydro\|cryo\|electro\|anemo\|geo\|dendro\|online> [page] ; element/elements/élément/éléments = helper des sept commandes, sans recherche/mutation. Filtres/pages modernes conservés. |
| Concours | Avant révélation publique, toute invocation avec ou sans arguments répond exactement 🏆 Concours : prochainement disponible. Aucun état projeté ni appel ContestService. |
| Event | Emoji Festival au début, monnaie sans emoji répété ; fin réelle Europe/Paris dd/MM/yyyy HH:mm. Jeu A ✅ ou ⏳, B restants/maximum quotidien (constante métier), C envoyé ✅/à envoyer, Bonus quotidien ✅/à récupérer ; trois syntaxes et boutique/top conservés. Racine consultative. |
| Pull | N tirages = N résultats principaux distincts, monolignes, ordonnés, parties logiques atomiques R1037. [i/N] si N>1, aucun [1/1] ni Invocation ×N. Personnage : 🎉 Joueur obtient étoiles emoji Nom ! Nouveau personnage : C0 / Doublon : passe Cn / Déjà C6 : remboursement réel primos (solde). Ressource : ✅ Joueur obtient +montant 💰 moras ou particules emoji Élément (solde). Pity, 50/50, garantie/Capture, Early/Hard/B2B depuis faits enregistrés. C6 stat/compensation et gains XP intégrés au tirage ; R1040 : seuls les procs Cryo/Electro/Anemo/Dendro effectivement enregistrés figurent en suffixe sur leur tirage. Hydro five_star_chance_bonus et Pyro/Geo secondary_reward_multiplier restent actifs côté moteur et dans le snapshot mais sans suffixe constant ; montant final multiplié affiché directement. Seule typographie/labels compactés si nécessaire pour 500 caractères. Soldes affichés par étape enregistrés en strings dans le snapshot JSON existant, à l’intérieur de la transaction ; aucun calcul depuis le portefeuille live au replay. Aucun nouveau moteur/table/migration/probabilité. Pipeline Mission/Défi conservé, sans fusionner deux Pulls. |

**Micro-polish final R1047 :** Quotis conserve ✅/⏳/➖ et le nombre utile de cœurs, sans changer Aperçu Quotidiennes. Résumé Combat : ⏳ TODO/IN_PROGRESS, ✅ COMPLETED, ➖ BLOCKED ; quatre ennemis avec glyphes séparés par ` - `, multipart uniquement si la longueur l’exige. Boss vivant/vaincu : `🛡️ RES : <glyphe> <élément>`.

Roue, avec nom Player figé et montants autoritatifs : `🎡 La roue tourne pour <nom> et… rien du tout 😭 La roue a choisi le chaos aujourd’hui.` ; particules `+<n> particules <glyphe> <élément> ! Une belle énergie élémentaire apparaît.` ; moras `+💰<n> moras ! Le pactole commence à tomber.` ; primos `JACKPOT 💠 +<n> primos ! La roue bénit officiellement ce moment ✨`. Aucun solde inventé ; déjà utilisée rappelle le résultat réel et demain, replay du propre reçu sans second spin. Présentation commune standalone/Twitch, WheelStore/Economy inchangés.

Les tests Chat et PostgreSQL privés portent les régressions ; preuves exécutées au Master. Streamer.bot reste autoritatif ; aucun parser global/outbound/EventSub/cutover ni migration publique activés ; foundation/rehearsal privée 30 distincte.

## Règle d'audit

Pour chaque commande :
1. lire le commentaire d'en-tête pour obtenir une vue générale ;
2. lire intégralement le code réel ;
3. relever toutes les syntaxes et sous-commandes ;
4. relever préconditions, coûts, cooldowns et permissions ;
5. relever les données lues / écrites ;
6. relever les interactions avec les autres systèmes ;
7. décider ce qui reste disponible par bouton, chat GachaImpact et Twitch ;
8. documenter les réponses / erreurs pertinentes.

### Règles globales des helpers Twitch/chat

Lorsqu'une commande est mal écrite, incomplète ou utilise une syntaxe qui n'est plus l'action cible :
- répondre avec un helper court ;
- indiquer uniquement comment utiliser correctement le système actuel ;
- ne jamais mentionner une migration, un ancien comportement ou le fait qu'une commande « a changé » ;
- ne montrer qu'une seule syntaxe recommandée même si plusieurs alias sont techniquement acceptés ;
- éviter les confirmations en plusieurs messages côté Twitch/chat ;
- structurer les réponses Twitch sur une seule ligne.

## Scripts legacy réellement présents dans le dossier `Commandes`

Ami, Bannière, Banque, Box, Code, Coffre, Combat, Concours, Convertir, Daily, Échanger, Élément, Event, Expedition, Faveur, Gift, Giveaway, Help, Infos, Légende, Liste, Missions, Obtention, Passif, Pity, Pull, Roue, Sac, Select, Shop, Stella, Subscription, Team, Top, Vote, Wish, XP.

Le sweep final confirme 37 scripts legacy.

Trois de ces scripts ne correspondent pas à une commande player-facing canonique :
- `XP` est un orchestrateur de messages / cycle de vie, pas `!xp` ;
- `Gift` est l'action Twitch du Gift Suprême, pas un `!gift` canonique ;
- `Subscription` est un trigger Twitch de Faveur, pas un `!subscription` canonique.

## Modèle d'entrée

### `!commande`
- **Statut audit :** À faire
- **But :**
- **Syntaxes :**
- **Bouton UI équivalent :**
- **Disponible chat GachaImpact :**
- **Disponible Twitch :**
- **Préconditions :**
- **Coûts :**
- **Cooldown :**
- **Données lues :**
- **Données écrites :**
- **Réponses utilisateur :**
- **Erreurs / edge cases :**
- **Interactions :**
- **Décisions de migration :**

---

## `!help`

- **Statut audit :** CLÔTURÉ — Domaine Help / cohérence finale des commandes après R731
- **But :** Orienter le joueur vers les catégories fonctionnelles puis fournir une aide compacte par commande.
- **Syntaxes canoniques :**
  - `!help`
  - `!help <categorie>`
  - `!help <commande>`
- **Catégories :** `progression`, `gacha`, `ressources`, `collection`, `equipe`, `activites`, `social`, `events`, `classements`, `twitch`
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **UI standalone équivalente :** écran `Aide / Guide` R1026, plus riche et distinct du Help textuel
- **Préconditions :** aucune pour l'aide générale
- **Coûts :** aucun
- **Cooldown :** aucun
- **Données lues :** aucune donnée joueur nécessaire
- **Données écrites :** aucune
- **Aide par catégorie :** liste courte des commandes principales disponibles dans la catégorie et sur le canal courant
- **Aide directe :** `!help pull`, `!help team`, `!help banque`, etc. affichent l'usage compact de la commande elle-même
- **Priorité de résolution :** un token correspondant à une vraie commande cible d'abord cette commande ; par exemple `!help box` décrit `!box`
- **Canaux :** le catalogue d'aide est filtré selon chat interne, Twitch et permissions Admin
- **Administration :** les mutations Giveaway Admin ne sont pas affichées dans l'aide joueur normale
- **Twitch spécifique :** la catégorie Twitch présente notamment Faveur/Subscriptions, Gift Suprême, `!wish` et `!giveaway stats`
- **Commandes inexistantes à ne pas inventer :** aucun `!xp`, `!gift` ou `!subscription` canonique
- **Top :** la syntaxe canonique du Taux de 5★ est `!top taux5`; `!top luck` reste un alias historique accepté
- **Helpers :** courts, une seule syntaxe recommandée, une ligne côté Twitch
- **Migration :** aucune donnée Help à migrer
- **Architecture cible :** métadonnées de commandes centralisées ; Help ne duplique jamais les règles métier possédées par les domaines spécialisés

## `!element`

- **Statut audit :** Audité — domaine Élément
- **But :** Choisir définitivement l'élément personnel du joueur.
- **Syntaxes :** `!element pyro|hydro|cryo|electro|anemo|geo|dendro`
- **Bouton UI équivalent :** choix intégré à l'onboarding standalone
- **Disponible chat GachaImpact :** oui, choix permanent défensif via le propriétaire de l’onboarding
- **Disponible Twitch :** oui, mécanisme d'onboarding Twitch
- **Préconditions :** profil existant ; aucun élément déjà choisi
- **Coûts :** aucun
- **Cooldown :** aucun observé
- **Données lues :** profil joueur, `element`
- **Données écrites :** `element`
- **Réponses utilisateur :** confirmation du choix ; aide si élément invalide ; message si élément déjà choisi
- **Erreurs / edge cases :** profil absent ; élément absent/invalide ; tentative de changement après choix
- **Interactions :** onboarding, particules personnelles, conversion, échanges, autres systèmes dépendant de l'élément
- **Décisions de migration :** élément permanent conservé ; standalone = choix obligatoire pendant onboarding ; Twitch conserve `!element`

## `!convertir`

- **Statut audit :** Audité — conversion R1 à R4 validée
- **But :** Convertir les particules de l'élément personnel en Primogemmes.
- **Syntaxes :** `!convertir <montant>`
- **Bouton UI équivalent :** oui, interface réelle `Sac > Ressources` sur les particules personnelles, avec quantité et `MAX` purement local
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **Préconditions :** profil existant ; élément choisi ; montant entier >= 1 ; stock personnel suffisant
- **Coûts :** X particules personnelles
- **Cooldown :** aucun observé
- **Taux :** 1 particule = 1 Primogemme
- **Données lues :** `element`, `particles[element]`, mission quotidienne éventuelle
- **Données écrites :** `particles[element]`, `primogems`, `stats.totalPrimosEarned`, progression mission quotidienne legacy éventuelle
- **Réponses utilisateur :** confirmation avec quantité convertie et nouveau total de Primogemmes
- **Erreurs / edge cases :** profil absent ; élément non choisi ; montant invalide ; stock insuffisant
- **Interactions :** Missions/Daily via `convert_particles`
- **Décisions de migration :** conversion manuelle conservée ; toute quantité entière >= 1 ; une seule logique métier serveur partagée UI/chat/Twitch

**Amendement Chat R1038 :** Alias conv ; montant positif strict sans flottant/exposant, conversion 1:1, quantité et nouveau total depuis le service. Un défi terminé est annoncé depuis son crédit réel.

## `!echanger`

- **Statut audit :** Audité — sous-domaine Échanges finalisé, R5 à R27 validées
- **But :** Échanger des particules avec un joueur d'un autre élément.
- **Syntaxes :**
  - `!echanger`
  - `!echanger <pseudo>`
  - `!echanger <pseudo> <montant>`
  - `!echanger liste`
  - `!echanger accepter`
  - `!echanger accepter <pseudo>`
  - `!echanger annuler`
  - `!echanger annuler <pseudo>`
  - `!echanger refuser`
  - `!echanger refuser <pseudo>`
  - `!echanger accepter|annuler|refuser all` (également `@all`, `tout`, `tous`)
  
- **Bouton UI équivalent :** oui, écran Échanges existant
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **Préconditions :** profils existants ; éléments choisis ; joueurs différents ; éléments différents ; montant réalisable ; aucune demande active entre la paire
- **Coûts :** X particules de l'élément de l'autre joueur contre X particules de son propre élément
- **Cooldown :** aucun observé
- **Données lues :** `element`, `particles`, `tradeRequests`
- **Données écrites legacy :** `particles`, `tradeRequests`
- **`!echanger` sans argument :** ne devra plus proposer que les joueurs avec lesquels un échange est réellement possible ; afficher la quantité échangeable entre parenthèses
- **`!echanger <pseudo>` :** raccourci MAX, demande le maximum actuellement échangeable
- **`!echanger accepter` :** accepter toutes les demandes de la plus ancienne à la plus récente, avec revalidation/réduction dynamique entre chaque opération
- **Refuser tout :** supprime toutes les demandes reçues concernées et libère immédiatement les réservations chez les expéditeurs
- **Réponses utilisateur :** création, liste, acceptation, annulation, erreurs de stock, partenaires réellement compatibles
- **Erreurs / edge cases :** auto-échange ; même élément ; montant invalide ; joueur absent ; élément manquant ; stock insuffisant ; demande déjà existante ; demande réduite automatiquement si le stock destinataire baisse
- **Réservation cible :** uniquement le stock de l'expéditeur est réservé
- **Stock destinataire :** vérifié à la création mais non réservé ; une baisse ultérieure réduit automatiquement le montant courant
- **Montant dynamique :** peut uniquement diminuer ; à 0 la demande disparaît silencieusement ; la réservation libérée redevient immédiatement disponible
- **Acceptation :** pas d'acceptation partielle manuelle
- **Interactions :** réservation de stock ; expiration quotidienne ; notification agrégée des demandes en attente ; historique récent UI ; historique serveur ; réconciliation automatique lors des variations de stock
- **Décisions de migration :** troc X contre X conservé ; une demande par paire ; expiration serveur à 00:00 Europe/Paris ; écran UI reçues/envoyées ; notification agrégée ; source de vérité DB unique
- **Historique futur :** conserver les événements importants d'échange côté serveur à partir de GachaImpact, sans inventer d'historique rétroactif
- **Actions groupées R1038 :** sans pseudo ou avec all/@all/tout/tous, accepter/refuser traite les reçues, annuler les envoyées ; IDs initiaux figés et ordre ancienneté/ID. Une nouvelle demande après le début ne rejoint pas le lot. Échecs indépendants et résultats réels de chaque reçu, sans annulation des demandes reçues.
- **Notifications :** aucune notification individuelle lors d'une acceptation/refus/annulation/expiration ; seule la notification agrégée des demandes en attente est utilisée
- **Historique UI :** environ 3 transactions visibles puis scroll jusqu'à environ 20–30 dernières
- **Migration :** les demandes en attente ne sont pas migrées au cutover
- **Identité cible :** relations basées sur les IDs internes immuables des joueurs
**Amendement Chat R1038 :** Aliases echange/ech. Partenaires compatibles et demandes affichés intégralement en parties logiques ; noms/éléments/quantités du reçu, MAX calculé uniquement par le propriétaire.

## `!banniere`
- **Statut audit :** Audité — domaine Gacha / Invocation clôturé
- **But :** Afficher la bannière active et la cible 5★ personnelle lorsqu'elle est valide.
- **Syntaxe :** `!banniere` ; aliases `!bannière`, `!ban` (nouveau choix propriétaire R1036), casse tolérée ; `!banner` absent. Argument inutile : `Syntaxe : !banniere.`
- **Bouton UI équivalent :** écran Invocation complet
- **Disponible chat GachaImpact :** oui, sous forme compacte
- **Disponible Twitch :** oui
- **Préconditions :** bannière active
- **Coûts :** aucun
- **Données lues :** catalogue personnages, bannière active, cible personnelle
- **Données écrites :** aucune
- **Décisions cible :** bannière hebdomadaire 4×5★ + 6×4★ ; conserver un seul message Twitch contenant tous les personnages et la cible personnelle ; UI standalone beaucoup plus riche

### Sorties Banniere.txt validées et implémentées — étape 29, R1036

- Cible valide : `🎯 Bannières (dd/MM → dd/MM) | ⭐⭐⭐⭐⭐ [les 4 personnages] | ⭐⭐⭐⭐ [les 6 personnages] | 5★ ciblé : [emoji] [personnage]`.
- Cible absente ou hors des 5★ actifs : même bannière suivie de `Utilise !select nom_du_perso pour choisir ton 5★ ciblé.`.
- GACHA_BANNER_UNAVAILABLE : `⚠️ Aucune bannière n’est active pour le moment.`, uniquement pour cette consultation.
- Chaque personnage porte son emoji : Pyro 🔥, Hydro 💧, Cryo ❄️, Electro ⚡, Anemo 🌪️, Geo ☄️, Dendro 🌿. Données réelles et ordre autoritatif conservés, aucun nom hardcodé.
- Période depuis startsAt/endsAt, dates calendaires inclusives Europe/Paris : endsAt exclusive représentée par le dernier instant couvert ; helper temporel moderne partagé.
- Une seule réponse normale 4×5★ + 6×4★, aucune troncature. Consultation sans mutation ni sélection automatique. Pas de JSON legacy runtime, d'erreurs de fichiers, d'auto-création de viewer ou de génération au premier message ; serveur moderne autoritatif.
- Textes/alias approuvés avant code, tests automatiques exécutés ; nouveau rendu et !ban encore à tester par le propriétaire après déploiement. Aucune validation publique présumée.

## `!select`
- **Statut audit :** Audité — domaine Gacha / Invocation clôturé
- **But :** Sélectionner le 5★ ciblé parmi les quatre personnages actifs.
- **Syntaxes :** `!select`, `!select <nom>`
- **Bouton UI équivalent :** sélection visuelle des quatre 5★ + bouton `Changer`
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **Préconditions :** profil valide ; bannière active ; personnage 5★ présent dans la bannière
- **Coûts :** aucun
- **Données lues :** bannière active, cible actuelle
- **Données écrites legacy :** `selectedBannerCharacterId`
- **Décisions cible :** cible librement modifiable ; vidée automatiquement à chaque nouvelle bannière ; aucune pity/garantie reset lors d'un changement

**Amendement Chat R1038 :** Nom exact normalisé (casse/accents), sans matching partiel. ID de cible et disposition initiale figés ; une consultation ne sélectionne rien.

## `!vote`
- **Historique Batch A :** le bouton `Personnages > Catalogue` utilisait `BannerVoteService` via UI, sans parser ni fuzzy textuel dans ce batch initial.
- **État Chat R1038 :** `!vote` appelle ce même propriétaire avec le matching textuel décrit ci-dessous ; unicité Player/rotation commune, Twitch global non activé.
- **Statut audit :** Audité — domaine Gacha / Invocation clôturé
- **But :** Influencer le quatrième personnage 5★ de la bannière suivante.
- **Syntaxes :** `!vote`, `!vote <nom>`
- **Bouton UI équivalent :** vote directement depuis l'écran Personnages ; nombre de votes public sur les 5★ éligibles
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **Préconditions :** personnage 5★ valide ; pas déjà en bannière ; joueur n'ayant pas encore voté cette semaine
- **Coûts :** aucun
- **Données lues/écrites legacy :** `banner_votes.json`, catalogue personnages
- **Décisions cible :** un vote définitif par ID joueur/semaine tous canaux confondus ; résultat pondéré ; conservation du fuzzy matching legacy côté texte ; snapshot + votes individuels historisés à partir de GachaImpact

**Amendement Chat R1038 :** Matching exact, phrase contenant un nom ou typo non ambiguë propre à Vote ; ce matching ne s’étend pas aux mutations des autres domaines. Votes positifs complets et triés ; nom/intention hebdomadaire figés.

## `!pity`
- **Statut audit :** Audité — domaine Gacha / Invocation clôturé
- **But :** Afficher pity 5★, pity 4★, garantie et Capture de brillance.
- **Syntaxe :** `!pity`
- **Bouton UI équivalent :** informations intégrées directement dans l'écran Invocation/sidebar
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **Coûts :** aucun
- **Données lues :** pity 5★/4★, `guaranteedFeatured5`, `captureProgress`
- **Données écrites :** aucune
- **Décisions cible :** progression conservée entre rotations/cibles ; `fiftyFiftyLostStreak` et `captureProgress` sont distincts ; affichage compact `Garantie 5★ : oui/non` + `Capture : X/3` ; le streak n'est pas affiché par `!pity`

**Amendement Chat R1038 :** Pity 5★/4★, garantie et Capture modernes ; aucune copie du score legacy de pertes.

## `!pull`
- **Statut audit :** Audité — domaine Gacha / Invocation clôturé après R116
- **But :** Exécuter une ou plusieurs invocations.
- **Syntaxes :** `!pull`, `!pull <1..10>`
- **Adaptateur Chat interne courant :** tout entier de 1 à 10 accepté par le propriétaire moderne commun ; chaque résultat est restitué dans son ordre, coût global réel et bonus autoritatifs.
- **Bouton UI équivalent :** `Invocation x1` / `Invocation x10`
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **Préconditions :** profil valide ; cible 5★ active ; Primogemmes suffisantes ; bannière serveur valide
- **Coût :** 160 Primogemmes par Pull
- **Maximum :** 10 Pulls par action
- **Pré-paiement :** le coût complet est requis avant l'opération ; un x10 nécessite 1 600 Primogemmes avant tout remboursement/proc interne
- **Pity 5★ :** 0,6 % jusqu'à 73 ; soft pity dès 74 ; garantie 90
- **Pity 4★ :** 1,5 % jusqu'à 8 ; 19,5 % au 9e ; garantie 10
- **Priorité :** 5★ prioritaire si les deux jets réussissent ensemble ; pity 4★ conservée
- **50/50 gagné :** personnage 5★ ciblé
- **50/50 perdu :** un des trois autres 5★ actifs choisi uniformément
- **Garantie :** après perte, prochain 5★ = cible actuelle
- **Capture :** `captureProgress` +1 sur perte, -1 sur victoire, max 3 ; déclenchement à 3/3 puis reset 0
- **Streak :** `fiftyFiftyLostStreak` distinct de Capture ; perte +1, vraie victoire → 0
- **4★ :** tirage uniforme parmi les six personnages actifs
- **Récompense secondaire :** 50 % Moras 5k–15k / 50 % particules 20–80 d'un élément aléatoire
- **Passifs :** team active uniquement ; max deux stacks par élément ; plusieurs procs simultanés possibles
- **Pyro :** ×1,25 / ×1,5 particules secondaires
- **Geo :** ×1,25 / ×1,5 Moras secondaires
- **Hydro :** +0,3 / +0,6 point de chance 5★
- **Cryo :** 1/20 / 1/10 pour +1 XP via moteur XP
- **Electro :** 1/30 / 1/20 pour +2 pity après résolution
- **Anemo :** 1/12 / 1/8 pour remboursement 80 Primogemmes
- **Dendro :** 1/25 / 1/15 pour +40 Primogemmes, +1 000 Moras et +5 particules de chacun des 7 éléments
- **Copies :** C0 première copie ; C6 septième copie ; `copies` continue ensuite
- **C6+ 4★ :** remboursement 80 Primogemmes
- **C6+ 5★ :** remboursement 160 Primogemmes + progression Concours
- **x10 :** dix résultats calculés séquentiellement mais persistés dans une opération atomique avant animation
- **UI :** animation uniquement après persistance serveur ; fermeture/crash n'annule jamais les gains
- **Historique :** historique complet depuis GachaImpact ; bouton Historique ; 10 résultats par page
- **Twitch :** résultat textuel rapide, résultat par résultat
- **Mentions Chat/Twitch R1045 :** entrées soft à 74 et hard à 80 même sans 5★ ; phrases Early 2–35, Back-to-back et Capture selon les faits 5★ enregistrés, sans doublon de labels courts. Implémentation approuvée et promue sur main ; déploiement à vérifier et recette publique restante.
- **Métadonnées R1038 :** pity du tirage et Back-to-back persistés dans le résultat existant pour une restitution stable ; R1045 utilise ces mêmes faits pour les phrases ci-dessus, sans nouvelle persistance ni RNG de présentation. Autres métriques dérivables depuis l'historique
- **Arrondi Pyro/Geo :** entier le plus proche, `.5` vers le haut
- **Interactions reportées :** chaque Pull individuel contribue aux éventuelles missions de type `pulls`, mais les règles et récompenses Missions appartiennent au domaine Missions ; règles Concours détaillées reportées au domaine Concours/C6

**Amendement Chat R1038 :** Chaque résultat [i/N] conserve nom entier, étoiles, élément, Cn, nouveau/double, pity et bonus réels ; le coût reste celui de l’opération, sans en-tête agrégé Chat. Refund C6 80/160, stat et compensation 100 000 Moras au maximum, passifs et XP/overflow selon le propriétaire ; aucun montant ni RNG déduit par le formatter.

## `!box`
- **Statut audit :** Audité — domaine Box / Possessions / Obtention clôturé après R176
- **But :** Consulter et organiser les personnages possédés.
- **Syntaxe Help :** `!box [5|4|6|élément|pN|favoris [personnage]|a|d|c|e]` ; aucun alias racine.
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **Bouton UI équivalent :** écran Box complet
- **Données principales :** possessions joueur, catalogue personnage, favoris, préférences de tri
- **Sous-commandes legacy conservées côté texte :** `!box`, `!box 5`, `!box 4`, `!box 6`, `!box <élément>`, `!box pN`, `!box favoris`, tris textuels
- **UI standalone :** onglets Tous / 5★ / 4★, grille, recherche, filtres combinables élément + constellation C0..C6, et tri
- **Favoris UI personnel :** toujours avant les non-favoris ; pas de limite ; toggle direct en un clic
- **Cartes :** ne pas afficher `copies`
- **Fiche détaillée :** constellation, copies, première obtention, `Favoris : Oui/Non`, futures stats propres au personnage
- **Tri UI persistant :** alphabétique, date d'obtention, constellation, élément
- **Filtres/onglet :** non persistants
- **Box publique :** mêmes outils de consultation mais aucune mutation ; favoris sans priorité d'ordre et sans étoile sur les cartes
- **État public initial :** Tous + Alphabétique ↑ + aucun filtre à chaque ouverture
- **Confidentialité :** accès soumis aux permissions modernes Public / Amis / Privé
- **Présentation Twitch :** peut conserver un format différent de l'UI ; `!box favoris <nom>` cible cependant désormais un nom exact normalisé et ne conserve pas le fallback legacy par nom partiel
- **Données dérivées :** taille Box, nombre de C6 et total copies
- **Personnage désactivé :** invisible/inutilisable côté joueur

### Contrat Chat Box — étape 29, R1037

- `!box` : `✅ P, ta Box [tri ↑/↓] : ⭐⭐⭐⭐⭐ ... | ⭐⭐⭐⭐ ...` ; TOUS les personnages actifs possédés, tri mémorisé dans chaque rareté, 5★ puis 4★. Entrée : emoji élément + nom + `(Cn)`, jamais copies. Vide : `⚠️ P, ta Box est vide pour le moment.`.
- `5` / `4` : `✅ P, Box ⭐⭐⭐⭐⭐ : ...` / quatre étoiles ; aucun résultat : `⚠️ P, tu n’as aucun personnage 5★.` (ou 4★).
- `6` = exactement C6 : `✅ P, Box C6 [tri ↑/↓] : ⭐⭐⭐⭐⭐ ... | ⭐⭐⭐⭐ ...` ; vide : `⚠️ P, tu n’as aucun personnage C6.`.
- Les sept éléments acceptent casse/accents ; exemple `✅ P, Box 🔥 Pyro [tri ↑/↓] : ⭐⭐⭐⭐⭐ ... | ⭐⭐⭐⭐ ...` ; vide : `⚠️ P, tu n’as aucun personnage Pyro.`.
- `pN` entier positif : jusqu’à cinq 5★ puis cinq 4★, compléter les places manquantes avec l'autre rareté, avancer les index entre pages, dix maximum. `✅ P, Box pN [tri ↑/↓] : ...` ; page vide : `⚠️ P, cette page est vide.` ; p invalide = syntaxe canonique.
- `favoris` : `⭐ Favoris de P : ...`, uniquement favoris possédés, alphabétique, liste complète ; vide : `⚠️ P, tu n’as aucun favori. Utilise : !box favoris NomPerso`.
- `favoris <personnage>` : nom exact normalisé/possédé, aucun fallback partiel ; SetBoxCharacterFavorite existant. `✅ P, C ajouté aux favoris.` / `retiré des favoris.` ; introuvable : `⚠️ P, personnage introuvable dans ta Box.`.
- `a/d/c/e` : alphabétique/date d’obtention/constellation/élément. Autre tri = ascendant ; même tri répété = inversion. SetBoxSortPreference existant ; `✅ P, tri de Box enregistré : alphabétique (ascendant).` (label/direction réels). Intentions de mutation mémorisées par message pour que le retry réapplique le même état. Préférence et favoris communs à l'UI, présentation Chat indépendante de la priorité favoris UI ; aucun changement UI.
- Toutes les listes sont complètes, découpage opt-in entre personnages entiers à 500 caractères ; suites `✅ Box suite :` / `⭐ Favoris suite :`. Aucune troncature, « et N autres », coupure de nom, doublon ou perte. Les autres commandes string conservent leur publication existante.

## `!obtention`
- **Statut audit :** Audité — domaine Box / Possessions / Obtention clôturé
- **But :** Afficher la date de première obtention d'un personnage possédé.
- **Syntaxe :** `!obtention <personnage>`
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **Bouton UI équivalent :** aucune commande dédiée nécessaire ; information intégrée à la fiche du personnage dans Box
- **Données lues :** possession, `firstObtainedAt`, catalogue personnage
- **Données écrites :** aucune
- **Décision cible :** la première date est immuable ; date legacy absente/invalide → fallback à la date de migration, traçable intérieurement

**Amendement Chat R1038 :** Nom exact normalisé, première obtention immuable en date française Europe/Paris et glyphe élémentaire.

## `!stella`
- **Statut audit :** Audité — domaine Box / Possessions / Obtention clôturé après R176
- **But :** Utiliser une Masterless Stella Fortuna comme copie synthétique sur un personnage 5★ possédé.
- **Syntaxe cible :** `!stella <nom exact>`
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **UI équivalente :** action future depuis l'inventaire/fiche appropriée ; confirmation obligatoire avant consommation
- **Matching texte :** nom exact après normalisation casse/accents ; pas de nom partiel, fuzzy matching ou ID technique
- **Préconditions cible :** personnage possédé, rareté 5★, Stella disponible
- **Sous C6 :** `copies +1` et `constellation +1`
- **Passage C6 :** initialise le système Concours du 5★
- **Déjà C6 :** `copies +1` + progression Concours
- **4★ :** utilisation interdite
- **Stats Concours toutes max :** utilisation refusée avant consommation
- **Remboursement Primogemmes :** aucun remboursement C6+ via Stella
- **Atomicité :** vérification, consommation et progression doivent former une seule transaction
- **Bug legacy corrigé :** `Stella.txt` n'incrémente actuellement pas `copies` et autorise des 4★ sous C6

**Amendement Chat R1038 :** Nom exact normalisé, consommation/constellation/stat C6 depuis le propriétaire ; max refusé avant consommation, aucun refund supposé.

## `!legende`

- **Statut audit :** CLÔTURÉ — Domaine Concours / C6 après R593
- **But :** consulter les personnages 5★ C6 et leur progression Concours
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui lorsque l'intégration Twitch sera disponible
- **UI équivalente :** consultation des Légendes depuis le profil / les écrans concernés
- **Liste personnelle :** `!legende`
- **Liste d'un joueur :** `!legende <joueur>`
- **Détail d'un personnage :** `!legende <joueur> <personnage>`
- **Cible personnelle explicite :** `me` et `moi`
- **Exemple personnel détaillé :** `!legende moi <personnage>`
- **Liste :** affiche les personnages C6 accessibles de la cible
- **Détail :** cinq statistiques Concours, titres par thème, total concours/victoires et statistiques thématiques utiles
- **Confidentialité :** Public / Amis uniquement / Privé ; clarification propriétaire R565 du 03/10/2026 : Box pour la liste, Box et Statistiques générales pour le détail, accès propriétaire conservé.
- **Tous les canaux :** mêmes permissions et même source métier
- **Refus de permission :** ne révèle ni nombre de C6, ni noms, ni statistiques privées
- **Données catalogue :** jamais recopiées dans la progression C6
- **Personnage désactivé :** progression/historique conservés mais personnage non sélectionnable pour un nouveau concours
- **Vocabulaire player-facing :** ne jamais afficher le terme interne `legacy`

**Amendement Chat R1038 :** Aliases légende/legendes/légendes/leg. Liste personnelle ou tierce entière des C6 5★ actifs ; détail canonique moi/me personnage ou joueur personnage, nom exact. Cinq stats avec thèmes et titres français. Permissions Box pour liste, Box et Statistiques générales pour détail.

## `!concours`

- **Statut audit :** CLÔTURÉ — Domaine Concours / C6 après R593
- **But :** créer, rejoindre, regarder et jouer le Concours global
- **Restriction temporaire pré-révélation :** dans le chat et sur Twitch, `!concours` et toute variante avec arguments répondent exactement `🏆 Concours : prochainement disponible.` Aucun thème, état actif/absent, participation du jour, URL, interface ou lieu d’accès communiqué ; aucun appel ContestService ni mutation. Cette restriction temporaire masque la consultation prévue par R884. L’aide Concours est également neutre ; le vrai accès ne sera réintroduit que lors de la révélation publique explicitement autorisée.
- **Disponible Twitch :** oui lorsque l'intégration Twitch sera disponible
- **UI équivalente :** écran Concours complet
- **Résumé :** `!concours`
- **Historique audité ci-dessous :** les syntaxes d'action décrivent l'ancien contrat Chat/Twitch et le domaine standalone ; elles ne sont plus disponibles dans `INTERNAL_CHAT` selon R884.
- **Créer :** `!concours open <personnage>`
- **Rejoindre / changer avant lancement :** `!concours rejoindre <personnage>`
- **Spectateur actif :** `!concours spectateur`
- **Quitter :** `!concours quitter`
- **Prêt :** `!concours pret`
- **Lancer :** `!concours start`
- **Annuler :** `!concours annuler`
- **Action sûre :** `!concours basique`
- **Action risquée :** `!concours risque`
- **Soutenir :** `!concours soutenir <participant>`
- **Alias :** `participant` / `participer`, `lancer`, `cancel`, `basic`, `risk` / `risqué`
- **Matching Légende :** nom exact après normalisation casse/accents
- **Soutien :** l'aide recommande le nom du participant/bot ; numéro de place 1–4 accepté comme raccourci
- **Lobby :** quatre places ; organisateur participant ; changement de Légende libre ; Ready obligatoire ; lancement manuel par l'organisateur
- **Participation quotidienne :** une par joueur et par journée Europe/Paris, consommée seulement au lancement effectif
- **Bots :** complètent les places vides et occupent de vraies positions de classement
- **Tours :** ordre aléatoire au lancement puis fixe
- **Timeout humain :** 60 s → action basique automatique
- **Inactivité :** trois tours consécutifs sans action humaine → remplacement par bot
- **Soutien :** après round complet, spectateur actif aléatoire ; 30 s ; +1/+2/+3
- **Actions :** basique = points de base ; risque = 0 / base / double à 1/3 chacun
- **Victoire :** premier participant atteignant ou dépassant 50
- **Récompenses :** 800 / 400 / 200 Primogemmes selon rang global ; bots non récompensés
- **Titres :** Bronze 1 victoire, Argent 3, Or 7, Platine 15 ; honorifiques
- **Historique :** public, détaillé, permanent à partir de GachaImpact ; anciens résultats non migrés
- **Confidentialité :** seules les informations nécessaires au match deviennent publiques
- **Atomicité :** lancement, actions, récompenses et résultat autoritaires côté serveur et protégés contre double exécution

## `!top`

- **Statut audit :** CLÔTURÉ — Domaine Top / Classements globaux après R727
- **But :** consulter les classements globaux publics ou son résumé personnel
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **UI équivalente :** écran `Classements`
- **Aide :** `!top`
- **Résumé personnel :** `!top me`
- **Classement :** `!top <métrique>`
- **Résultat chat :** Top 5 compact ; rang personnel ajouté s'il est classé hors du Top affiché
- **Éligibilité globale :** joueur existant avec élément choisi
- **Niveau minimum :** aucun
- **Confidentialité :** seules les données `Public` entrent dans les classements globaux
- **Amis uniquement / Privé :** joueur totalement absent, sans rang réservé
- **Valeur 0 :** exclue
- **Ex æquo :** classement compétition `1er, 1er, 3e`
- **Moras :** patrimoine `portefeuille + Banque`; les deux composantes nécessaires doivent être Public
- **Taux 5★ :** `totalFiveStars / totalPulls × 100`, minimum 100 Pulls ; syntaxe canonique `!top taux5` ; `luck` accepté comme alias historique
- **Pity :** classement du pity 5★ actuel si Public
- **Soldes actuels conservés :** Primogemmes, patrimoine Moras, particules totales et par élément
- **Statistiques économiques cumulatives :** Primogemmes/Moras gagnées et dépensées
- **Collection :** Box, C6, copies depuis les possessions player-facing actives
- **Activité ajoutée :** Combat total, Combat manuel, Expeditions terminées, cœurs envoyés
- **Classements spécialisés :** Event, Boss, Concours et Giveaway restent dans leurs propres domaines
- **Historique/saisons :** aucun pour le Top global V1
- **Récompenses :** aucune ; classement honorifique
- **Architecture :** lecture seule depuis les sources métier canoniques

### Métriques / aliases

Principales métriques legacy conservées :

- `xp`
- `niveau` / `level` / `lvl`
- `messages` / `msg`
- `messages-xp` / `counted`
- `pulls`
- `taux5` → Taux de 5★ ; `luck` accepté comme alias historique
- `5stars` / `5`
- `4stars` / `4`
- `pity`
- `5050` / `50/50`
- `lose5050` / `lost5050`
- `primos`
- `moras`
- `particles` / `particules`
- `pyro`
- `hydro`
- `cryo`
- `electro`
- `anemo`
- `geo`
- `dendro`
- `box`
- `c6`
- `copies`
- `primos-earned`
- `primos-spent`
- `moras-earned`
- `moras-spent`

Nouvelles métriques V1 :

- `combat`
- `combat-manuel`
- `expeditions`
- `coeurs`

L'aide player-facing peut n'afficher que les syntaxes canoniques principales afin de rester compacte.

**Amendement Chat R1038 :** Aliases des métriques du registre conservés, normalisation accents/cœurs ; Top 5 et rang personnel éligible en entrées entières. Privé et valeur zéro exclus ; aucun faux rang.

## `!giveaway`

- **Statut :** implémentation native présente selon R946–R952 ; activation uniquement dans le périmètre pilote autorisé, bridge OFF hors pilote, Streamer.bot reste autoritatif
- **But :** administrer ou consulter le Giveaway Twitch courant
- **Canal joueur :** Twitch
- **UI équivalente :** panneau privé Modération pour Open / Close et lifecycle Twitch ; aucune participation joueur standalone
- **Consultation publique :** `!giveaway stats` ; aliases giveaway/ga, stats/stat, open/ouvrir, close/fermer conservés
- **Syntaxe invalide :** racines exactes `!ga`/`!giveaway` seules ou avec mauvais argument (reroll inclus) → `ℹ️ Commandes giveaway : !giveaway open | !giveaway close | !giveaway stats | Participation : !wish`. Aucune action ; une racine étrangère n’est pas capturée.
- **Messages :** ouverture `🎁 Un cadeau venu de Célestia est apparu ! Utilisez !wish pour tenter votre chance de remporter 1 600 primos à la fin du live.` ; stats ouvert `🎁 Giveaway ouvert | 👥 N participant(s) | Commande : !wish`, fermé avec gagnant `🎁 Giveaway fermé | 👥 N participant(s) | 🏆 Dernier gagnant : ...`, sinon `ℹ️ Aucun giveaway ouvert | 👥 N participant(s)`. Tirage canonique persisté : `🌠 Célestia a choisi <nom> parmi tous les voyageurs ! +💠1 600 primos !`, sans RNG de texte au replay.
- **Ouvrir :** `!giveaway open` — Player ACTIVE lié avec attribution ADMIN ou MODERATOR active, bridge Giveaway actif prouvé
- **Fermer :** `!giveaway close` — Player ACTIVE lié avec attribution ADMIN ou MODERATOR active
- **Reroll :** aucune commande native V1 (R950 supersède R708)
- **Ouverture :** impossible si une session est déjà ouverte
- **Gagnant :** tiré aléatoirement parmi les participants `!wish` éligibles
- **Récompense gagnant :** +1 600 Primogemmes
- **Classement chat :** messages Twitch normaux pendant la session
- **Exclusions compteur :** commandes `!xxx`, bot, système
- **Cooldown Giveaway :** aucun
- **Kichnifou :** ses vrais messages humains comptent normalement
- **Ex æquo :** classement compétition `1er, 1er, 3e`
- **Récompenses chat :** rang 1 +2 000 particules personnelles ; rang 2 +1 500 ; rang 3 +1 000 ; rang >=4 +500
- **Restitution Twitch :** deux messages séparés à la fermeture, chacun sur une seule ligne : tirage puis classement
- **Notifications :** informationnelles pour tous les joueurs récompensés
- **Historique :** aucun écran joueur dédié ; historique serveur/Admin uniquement
- **Atomicité :** fermeture, tirage et récompenses idempotents ; les annonces sortantes ont leurs propres états et retries sûrs

**Amendement Chat R1038 :** Alias ga classifié par le consumer spécialisé derrière ses gates existants ; stats/stat/open/ouvrir/close/fermer. Reroll retiré conformément à R950 ; aucune mutation Admin dans le Help joueur. Twitch uniquement.

## `!wish`

- **Statut :** consommateur Twitch spécialisé présent, inactif tant que le bridge n'est pas autorisé et activé
- **But :** s'inscrire au tirage aléatoire du Giveaway Twitch ouvert
- **Disponible Twitch :** oui
- **Disponible chat GachaImpact :** non
- **UI joueur équivalente :** aucune
- **Précondition :** profil joueur existant avec élément choisi
- **Niveau minimum :** aucun
- **Limite :** une inscription maximum par joueur et par session
- **Classement messages :** `!wish` étant une commande, il ne compte pas dans `messageCounts`
- **Récompense au moment du `!wish` :** aucune
- **Résultat :** le gagnant éventuel est déterminé uniquement lors de la fermeture

## Gift Suprême — Custom Reward Twitch

- **Statut audit :** CLÔTURÉ — Domaine Gift Suprême après R701
- **Déclenchement cible :** redemption de la Custom Reward Twitch `Gift Suprême`
- **Legacy :** l'action/script `Gift.txt` pouvait être assimilé à `!gift`, mais aucune commande joueur `!gift` n'est canonique en V1
- **Coût Twitch :** 10 000 Points de chaîne
- **Saisie :** pseudo du bénéficiaire obligatoire
- **Matching cible :** exact / contains / fuzzy Levenshtein legacy
- **Bénéficiaire :** joueur GachaImpact existant avec élément choisi
- **Gifter :** peut être n'importe quel viewer Twitch, même non-joueur
- **Auto-ciblage :** autorisé
- **Récompense :** +1 600 particules de l'élément personnel du bénéficiaire
- **Twitch :** message public après succès
- **Standalone :** aucun déclenchement ni dépense de Points de chaîne ; notification informationnelle du Gift reçu
- **Custom Reward :** créée/gérée à terme par l'application GachaImpact et identifiée par `reward.id`
- **Succès :** redemption `FULFILLED`
- **Erreur cible :** redemption `CANCELED`, aucun gain, remboursement Twitch
- **Atomicité :** une redemption ID ne peut produire qu'un Gift
- **Historique :** journal serveur/admin des nouvelles redemptions uniquement ; aucun historique player-facing dédié

## `!code`

Extension R1057 déployée : le claim commun peut créditer Stella, points Event et monnaie du Festival actif, en plus des gains classiques. Édition active et inscription existante requises pour la part Event ; aucun auto-enrollment ou rattrapage ultérieur. La réponse annonce seulement les gains réellement accordés, y compris tous les nouveaux paliers payés atomiquement, et signale une part Event ignorée. Découpage Twitch logique acquis à 450 caractères, receipts/replays conservés. [Contrat et état R1057](../architecture/gift-code-enriched-r1057.md).

- **Statut audit :** CLÔTURÉ — Domaine Codes cadeaux après R691
- **But :** consulter et réclamer les Codes cadeaux actuellement disponibles
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui lorsque l'intégration Twitch sera disponible
- **UI équivalente :** écran `Codes` avec zones `Disponibles` / `Récupérés`
- **Liste :** `!code`
- **Réclamation :** `!code <CODE>`
- **Matching :** token normalisé et insensible à la casse
- **Code ponctuel :** une seule réclamation par joueur
- **Code annuel :** une réclamation par joueur et par édition annuelle
- **Codes Event :** douze codes annuels conservés, +1 600 Primogemmes et +200 000 Moras
- **Récompenses Admin V1 :** Primogemmes, Moras et particules des sept éléments
- **UI :** récompenses visibles avant claim ; bouton `Récupérer`
- **Après claim :** code déplacé vers `Récupérés` et notification actionnable résolue
- **Nouveau joueur :** peut voir/réclamer tout code global encore actif
- **Twitch-only :** un profil interne existant peut utiliser Codes même sans élément choisi
- **Rappel Twitch :** premier message éligible peut signaler compactement qu'un nouveau code est disponible, sans spam
- **Event :** peut signaler la disponibilité et ouvrir Codes mais ne possède jamais le claim
- **Admin :** Brouillon → Publication ; programmation, désactivation et statistiques simples
- **Modification :** récompenses/token/type verrouillés après le premier claim
- **Atomicité :** claim + récompenses dans une seule opération serveur idempotente
- **Migration :** conserver les douze définitions Event et tous les `usedCodes` sans repayer les anciens claims
- **État physique :** écran `#codes`, service de claim, notifications et administration ADMIN implémentés ; consultation et claim Chat interne livrés par R1037 réutilisent ce service. Twitch et l’import legacy `usedCodes` restent non implémentés.

### Contrat Chat Codes — étape 29, R1037

- `!code` conserve la découverte moderne : `🎁 Codes disponibles : CODE1, CODE2, ... | Récupérés : N.` ; vide : `🎁 Aucun code cadeau disponible actuellement. Récupérés : N.`. Tous les tokens ; split opt-in seulement entre tokens si nécessaire, suites `🎁 Codes suite :`, aucun « et N autres ».
- `!code <CODE>` insensible à la casse, édition du Player mémorisée pour le retry ; moteur GiftCodeService inchangé, atomique/idempotent, notifications et statistiques autoritatives.
- Succès : `✅ P a utilisé CODE ! +💠1 600 Primogemmes (12 500) | +🪙200 000 Moras (850 000) | +200 particules 🔥 Pyro (1 250) | description éventuelle`. Valeurs d'exemple seulement : récompenses réellement positives et nouveaux totaux du snapshot resources retourné par claim ; description moderne si non vide. Ordre Primogemmes, Moras, puis Pyro/Hydro/Cryo/Electro/Anemo/Geo/Dendro ; aucun montant Festival hardcodé.
- Déjà récupéré : `⚠️ P, tu as déjà utilisé le code CODE.`. Inconnu/expiré/hors fenêtre/désactivé : `⚠️ Ce code cadeau n’est pas disponible.`, sans détail Admin. Replay technique confirmé continue le claim idempotent sans second paiement.
- Ponctuel une fois/Player, annuel une fois/Player/édition, Economy/publication/notification/Admin inchangés ; aucun gift_codes.json runtime. Help `!code [CODE]`, aucun alias racine.

## `!event`

- **Statut audit :** CLÔTURÉ — Domaine Event / monthly après R644
- **But :** consulter et participer au Festival mensuel courant
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui lorsque l'intégration Twitch sera disponible
- **UI équivalente :** `Activités > Événement` avec onglets Jeux / Shop / Classement
- **Résumé :** `!event`
- **Inscription :** `!event go`
- **État personnel :** `!event sac`
- **Boutique :** `!event boutique`
- **Classement :** `!event top`
- **Primogemmes :** `!event primos <quantité|max>`
- **Moras :** `!event moras <quantité|max>`
- **Collection :** `!event collection`
- **Calendrier Noël :** `!event calendrier`
- **Jeu A :** `!event <commande thématique>`
- **Jeu B :** `!event <commande thématique> <code 5 bits>`
- **Jeu C :** `!event <commande thématique> <pseudo> "message"`
- **Avant inscription :** `!event`, `!event boutique` et `!event top` restent consultables
- **Mutations :** inscription obligatoire
- **Inscription :** +1 monnaie saisonnière, une seule fois par édition
- **Jeu A :** trois fenêtres personnelles quotidiennes ; 20 % par tentative ; cooldown serveur 3 s ; une réussite par jour
- **Jeu B :** 32 combinaisons ; trois essais consommables/joueur/jour ; combinaison déjà testée non consommée ; récompense communautaire +1 point/+1 monnaie
- **Jeu B déjà résolu :** nouvelle inscription le même jour reçoit le rattrapage +1 point/+1 monnaie
- **Découvreur Jeu B :** honorifique, aucun bonus économique supplémentaire
- **Jeu C :** un envoi réussi/jour ; cible existante soumise aux règles Social ; expéditeur +1 point/+1 monnaie
- **Visibilité Jeu C dans le Chat :** la commande originale, avec son texte entre guillemets, est publique selon R881 ; le message Event persisté garde sa visibilité propre au domaine.
- **Messages Jeu C UI :** visibles uniquement par le destinataire dans son écran Event et uniquement pour la journée courante
- **Bonus quotidien :** +1 monnaie ; bouton Réclamer UI ; premier message normal éligible chat/Twitch peut effectuer la même réclamation
- **Paliers :** 10/20/30/40/50/60/70/80, récompenses automatiques
- **Boutique :** 1 monnaie = 160 Primogemmes ou 20 000 Moras
- **Collection :** 80 monnaies ; maximum une acquisition par édition annuelle ; anciennes monnaies saisonnières utilisables
- **Classement :** complet en temps réel dans l'UI ; `!event top` = Top 10 ; classement honorifique
- **Historique :** via écran transversal Historique → Event
- **Collection UI :** bouton Event → Sac → Collection
- **Noël :** calendrier 1–25 décembre ; aucun rattrapage ; jours 1–24 = 1–5 monnaies ; jour 25 = 50 ; aucun point
- **Commandes mensuelles :** conservent leurs noms thématiques ; l'aide du mois indique les syntaxes utiles
- **Code cadeau :** Event peut signaler qu'un code est disponible mais la consultation/réclamation appartient au Domaine Codes
- **Rollover :** 00:00 Europe/Paris au changement de mois ; nouvelle inscription requise ; monnaie saisonnière conservée
- **Atomicité :** gains, paliers, Jeu B, calendrier, boutique, Collection et rollover protégés contre concurrence/retry/double exécution
- **Migration :** état actif conservé uniquement lorsqu'il correspond au cutover ; monnaie du snapshot conservée comme solde saisonnier ; aucun historique ou gain absent inventé

**Amendement Chat R1038 :** Les douze mois et noms A/B/C sont dans l’annexe. go déjà inscrit affiche zéro nouveau gain ; sac indique rang et prochain palier ; Top 10 complet. boutique/shop et primos/primo/primogems, moras/mora, montant/MAX. Jeu B sans code liste les 32 codes possibles restants sans révéler la solution ni consommer d’essai ; Jeu C accepte les noms composés et anciens motdoux/motprintemps, sans recopier le contenu privé. Résultats/rewards et contexte thématique initiaux conservés au rejeu, y compris après changement de jour/mois.

## `!team`
- **Statut audit :** Audité — Domaine Team clôturé après R236
- **But :** Consulter, activer et modifier les Teams du joueur.
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **UI équivalente :** écran Équipe complet
- **Équipe active :** une des Teams du joueur, 0 à 4 personnages, sans doublon
- **Team par défaut :** Team 1 pour un nouveau joueur
- **Matching personnage texte :** nom exact après normalisation casse/accents
- **Commandes cibles principales :**
  - `!team`
  - `!team <N>`
  - `!team <N> apply`
  - `!team add <nom>`
  - `!team remove <nom>`
  - `!team remove all`
  - `!team <N> remove`
  - `!team <N> rename "Nom"`
  - `!team rename "Nom"`
  - `!team list`
  - `!team list <page>`
  - `!team new`
- **`apply` :** sélectionne la Team N comme active ; 0..4 autorisé
- **`add` :** ajoute au premier slot vide de la Team active
- **`remove` personnage :** retire de la Team active
- **`remove all` :** vide la Team active sans changer son nom ni son état actif
- **`<N> remove` :** vide la Team N côté Twitch/chat ; ne supprime jamais physiquement l'emplacement
- **`rename` :** nom facultatif, espaces/accents autorisés, cible 20 caractères
- **`list` :** pagination de 10 Teams ; Team active clairement indiquée ; Teams partielles affichées avec leur remplissage
- **Alias accepté :** `liste`, mais les helpers recommandent uniquement `list`
- **`new` :** crée la prochaine Team supplémentaire, vide et non active
- **`save` / `save N` :** aucune mutation cible ; helper vers les commandes actuelles
- **Saved Teams de base :** positions actuelles 1 à 10 non supprimables
- **Positions 11+ :** supprimables depuis l'UI si non actives
- **Réorganisation UI :** drag horizontal dans le bandeau ; drop sur une Team = swap, drop entre deux Teams = insertion, avec renumérotation immédiate
- **Réorganisation personnage :** drag horizontal uniquement à l'intérieur d'une Team
- **Composition dupliquée :** interdite pour les Teams complètes, ordre personnage ignoré
- **Passifs :** dérivés de la Team ; actifs même si composition partielle ; maximum deux stacks par élément
- **Saved Teams :** privées
- **Équipe active :** potentiellement publique selon Public / Amis / Privé
- **Profil public :** numéro/nom/composition/passifs selon permissions
- **UI :** autosave, remplacement direct, picker filtré, sélecteur actif séparé
- **Sidebar :** affiche numéro/nom/composition active ; non éditable dans la V1
- **Personnage désactivé :** actif → retrait ; position 1..10 concernée → composition vidée ; position 11+ concernée → Team supprimée
- **Réponses Twitch :** toujours structurées sur une seule ligne
- **Helpers :** courts, une syntaxe recommandée, aucune référence à une migration
- **Interactions :** Box/Possession, Passifs, Gacha, Combat, confidentialité

**Amendement Chat R1038 :** Consultation N sans activation ; apply/add/remove/rename/list/liste/new raccordés aux services existants. remove all/tout/tous vide l’active ; N remove/delete/supprimer vide N, sans suppression physique. save/save N aide seulement. Rename quoted, 20 caractères, vide pour reset ; liste 10/page avec composition complète. Les six mutations conservent intention/IDs/slot/position et snapshot transactionnel.

## `!passifs`
- **Statut audit :** Audité — Domaine Team clôturé après R236
- **But :** Afficher la table générale des passifs élémentaires et leur détail par élément.
- **Données joueur lues :** aucune
- **Données écrites :** aucune
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **UI équivalente :** présentation contextuelle des passifs dans l'écran Team, avec possibilité de détail
- **Source métier :** règles de passifs validées dans le Domaine Gacha R75–R84
- **Correction cible :** les textes affichés doivent refléter les règles Gacha finales, y compris les corrections apportées aux descriptions legacy
- **Différence avec `!team` :** `!passifs` décrit les règles générales ; Team calcule les passifs réellement actifs pour une composition

**Amendement Chat R1038 :** Table générale des sept éléments indépendante de la composition ; détail avec accents. Plafond moderne de deux stacks, Dendro concerne les sept éléments.

## `!banque`
- **Statut audit :** Audité — Domaine Banque clôturé après R255
- **Statut implémentation :** écran, cache de session et API personnelles, dont historique paginé, réels ; consultation/dépôt/retrait Chat interne livrés par R1037 appellent les mêmes services avec `INTERNAL_CHAT`. Twitch reste non branché.
- **But :** Consulter et transférer les Moras entre portefeuille et Banque.
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **UI équivalente :** écran Banque dédié
- **Syntaxes cibles :**
  - `!banque`
  - `!banque deposer <montant>`
  - `!banque deposer max`
  - `!banque retirer <montant>`
  - `!banque retirer max`
- **Montant :** entier positif ou `max`; pas de `k`, `m`, décimales ou abréviations
- **Dépôt :** portefeuille → Banque
- **Retrait :** Banque → portefeuille
- **Frais :** aucun
- **Cooldown :** aucun
- **Plafond :** aucun en V1
- **Stats :** dépôt/retrait ne modifient pas `totalMorasEarned` / `totalMorasSpent`
- **Intérêt :** 3 % quotidien automatique au reset serveur, arrondi inférieur
- **Intérêt hors ligne :** oui
- **Message consultation :** une seule ligne, conserve emojis legacy, soldes, intérêt estimé et aide dépôt/retrait
- **Format cible :** `🏦 Banque <joueur> : X Moras | 💰 Portefeuille : Y | Intérêt estimé (3%) : +Z | 📥 !banque deposer X | 📤 !banque retirer X`
- **UI :** MAX remplit l'input sans muter, intérêt estimé, compte à rebours, patrimoine total dérivé, cinq opérations récentes et animation légère
- **Historique :** complet et privé dans une modale Banque, paginée côté serveur par dix opérations newest-first
- **Profil :** solde Banque exposable selon Public / Amis / Privé
- **Migration :** wallet/banque/stats exacts ; aucun historique ou intérêt rétroactif inventé
- **Interactions reportées :** `!top moras` / Classements à auditer séparément pour respecter la confidentialité Banque

### Contrat Chat Banque — étape 29, R1037

- Help canonique : `!banque [deposer|retirer <montant|max>]` ; invalidité = `Syntaxe : !banque [deposer|retirer <montant|max>].` ; aucun !bank. Dépôt accepte deposer/depose/déposer/dépose ; retrait retirer/retire/retiré/retirée (retire/retiree normalisés). Entiers strictement positifs ou max, sans abréviation.
- Succès : `✅ P dépose X Moras à la banque. Banque : Y | Sur toi : Z` / `✅ P retire X Moras de la banque. Banque : Y | Sur toi : Z`.
- X est resolvedAmount autoritatif : MAX reste résolu sous les verrous de la transaction Banque ; replay relit resultSummary.resolvedAmount existant, même montant sans double mouvement, aucune migration. Aucun calcul MAX depuis un solde lu dans le dispatcher.
- Portefeuille insuffisant : `⚠️ P, tu n’as pas assez de Moras. Portefeuille : X.` ; Banque insuffisante : `⚠️ P, tu n’as pas assez de Moras en banque. Banque : X.`.
- MAX vide : `⚠️ P, tu n’as aucun Mora à déposer.` / `⚠️ P, tu n’as aucun Mora à retirer.`.
- Règles modernes conservées : aucun frais/cooldown/plafond, atomicité/soldes non négatifs, stats earned/spent neutres, intérêts 3 % au reset serveur Europe/Paris/offline/arrondi inférieur, aucune notification Twitch spontanée. Réponse normale unique.

## `!sac`
- **Statut audit :** Audité — Domaine Sac / Coffre / Shop clôturé après R298
- **But :** Consulter les ressources personnelles dans le Chat ; le Sac UI conserve les objets spéciaux.
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **UI équivalente :** écran Sac
- **Statut implémentation :** écran Sac personnel réel branché sur l'agrégat serveur ; la consultation Chat interne R1038 appelle ce même agrégat. Twitch reste non branché.
- **UI actuelle :** catégories `Tout` / `Ressources` / `Objets` / `Collection`; la carte Moras entière navigue vers Banque et indique discrètement `Accéder à la Banque`; Stella réutilise le flux Box/Team commun.
- **Profil ciblé :** propriétaire uniquement ; pas de `!sac <pseudo>`
- **Contenu :** Primogemmes, invocations possibles dérivées, Moras et sept particules ; objets spéciaux dans l’UI Sac seulement
- **Particules :** élément principal affiché en premier
- **Stella :** visible comme objet spécial si possédée
- **Collection :** non incluse dans la ligne `!sac`; utiliser `!coffre`
- **Mutation :** aucune
- **Réponse Twitch :** une seule ligne
- **Donnée dérivée :** invocations possibles = `floor(primogems / 160)`

**Amendement Chat R1038 :** Les sept stocks de particules, même nuls, avec personnel en premier ; Moras/Primogemmes, voeux entiers ; objets spéciaux omis du Chat depuis R1039. Collection réservée au Coffre.

## `!coffre`
- **Statut audit :** Audité — Domaine Sac / Coffre / Shop clôturé après R298
- **But :** Consulter les objets de Collection possédés.
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **UI équivalente :** Sac → Collection
- **Affichage texte :** objets possédés uniquement
- **Tri :** alphabétique
- **Quantité :** affichée
- **Mutation :** aucune
- **Obtention :** propriété du Domaine Event
- **ID inconnu :** possession conservée sous placeholder
- **Migration :** quantité préservée ; dates absentes → fallback cutover traçable
- **UI standalone :** montre aussi les objets non possédés et leur méthode d'obtention

### Contrat Chat Coffre — étape 29, R1037

- `!coffre`, aucun argument/alias ; syntaxe invalide : `Syntaxe : !coffre.`.
- `🏆 Coffre de P | emoji objet (xN) | ...` ; TOUS les objets Collection possédés de quantité >0, tri alphabétique par displayName, emoji sans influence sur le tri. Aucune acquisition/récompense/mutation.
- Douze clés stables modernes : lanterne_nouvel_an 🎆, coeur_cristallin 💖, bourgeon_eternel 🌱, oeuf_enchante 🥚, fleur_de_printemps 🌸, coquillage_dore 🏝️, etoile_filante ⭐, boussole_antique 🧭, gerbe_de_recolte 🌾, citrouille_hantee 🎃, feuille_ancienne 🍁, flocon_enchante ❄️. Petit mapping Chat externalKey, noms modernes affichés ; inconnu/non mappé conservé : `❔ displayName (xN)`.
- Vide : `ℹ️ P, ton Coffre est vide. Les objets de Collection s’obtiennent avec !event collection.`.
- Split opt-in entre objets entiers à environ 450 caractères, suites `🏆 Coffre suite | ...` ; aucun nom ni (xN) coupé, aucune troncature, doublon ou « et N autres ». L'ordre mensuel legacy n'est pas restauré.

## `!shop`
- **Statut audit :** Audité — Domaine Sac / Coffre / Shop clôturé après R298
- **But :** Consulter et acheter les articles de la Boutique.
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **UI équivalente :** écran Boutique
- **Catalogue :** serveur dynamique
- **Ordre :** `displayOrder`
- **Pagination :** 5 articles par page lorsque nécessaire
- **Syntaxes principales :**
  - `!shop`
  - `!shop <page>`
  - `!shop primos <quantité>`
  - `!shop primos max`
  - `!shop ticket`
  - `!shop mission`
  - `!shop switch`
- **Primos :** 50 000 Moras → 160 Primogemmes par lot ; quantité multiple autorisée
- **Ticket :** 150 000 Moras legacy actuel ; achat/tirage immédiat ; unitaire ; probabilités visibles
- **Ticket pity :** +10 pity 5★ via moteur Gacha, plafond 90
- **Mission :** `!shop mission` partage l'action de l'écran Missions ; coût 10 000 Moras ; mission aléatoire inconnue avant achat ; récompense 800 Primogemmes ; progression à partir de l'attribution
- **Switch :** mission quotidienne incomplète uniquement ; 20 000 Moras puis coût doublé à chaque switch du même jour ; nouvelle mission obligatoirement différente ; progression remise à 0 ; indisponible s'il n'existe aucune alternative active ; aucune confirmation Twitch/chat
- **États article :** achetable / visible indisponible / masqué
- **Limites futures :** supportées par catalogue si nécessaire
- **Stock mondial V1 :** aucun
- **Historique :** journalisé à partir du standalone ; détaillé privé ; `Voir tout` via Historique global
- **Atomicité :** débit + effet + récompense + historique forment une opération atomique/idempotente
- **Banque :** jamais débitée automatiquement
- **Stats :** dépenses Moras réelles → `totalMorasSpent`; gains réels suivent leurs compteurs Earned
- **Réponses Twitch :** une seule ligne

**Amendement Chat R1038 :** Cinq entrées visibles par page, y compris indisponibles. mission/switch raccordés à DailyChallenge avec coût payé et état réel ; primos quantité/MAX et ticket depuis Shop, y compris ticket plafonné. Quantité MAX/item ID figés, coût/gain/solde du reçu stables.

## `!mission`

- **Statut audit :** Clôturé — R299 à R339
- **État physique :** Chat interne raccordé ; projection personnelle canonique, résumé Défi + permanentes, rangs B/A/S/Z, variantes résumé/récap normalisées. Réponses longues en entrées entières via les parties explicites de `GlobalChatService`.
- **But :** Consulter la mission quotidienne et les progressions permanentes du joueur.
- **Syntaxes cible :**
  - `!mission`
  - `!mission B`
  - `!mission A`
  - `!mission S`
  - `!mission Z`
- **Alias de compatibilité accepté :** `!mission resume` peut agir comme `!mission`, mais n'est pas mis en avant dans les helpers
- **Bouton UI équivalent :** `Activités > Missions` avec rangs B / A / S / Z ; l’ancienne quotidienne payante est le `Défi` de Quotidiennes
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** cible oui ; intégration physique non implémentée
- **Consultation d'un autre joueur :** non via commande ; la visibilité publique passe par le profil standalone
- **Activation :** aucune ; les missions permanentes progressent automatiquement dès le provisionnement du joueur
- **Abandon :** supprimé du fonctionnement cible
- **Progression :** B→A→S cumulative
- **Rang Z :** verrouillé jusqu'à complétion de toutes les B/A/S ; l'onglet Z peut être visible mais grisé ; avant déblocage, ne révéler ni intitulés, ni objectifs, ni récompenses
- **Évaluation Z :** à son déblocage, évaluer immédiatement les états/statistiques déjà acquis
- **Récompenses :** automatiques à la complétion
- **Visibilité V1 :** missions/progressions publiques depuis le profil joueur ; le secret du rang Z verrouillé reste absolu
- **Réponses chat/Twitch :** résumé compact ; une réussite est annoncée uniquement lorsqu'elle est la conséquence immédiate d'une action effectuée dans ce même canal
- **Longue réponse :** découper proprement en plusieurs messages d'une ligne si nécessaire plutôt que tronquer silencieusement
- **Twitch :** aucune notification asynchrone de réussite vers un joueur potentiellement absent
- **Interactions :** MissionService, Chat/XP, Gacha, Ressources, Expedition, Combat, Social
- **Décisions cible :** les anciennes syntaxes d'acceptation `!mission B 1` et d'abandon ne font plus partie du fonctionnement standalone

**Amendement Chat R1038 :** Résumé via résumé/resumé/resume/récap/recap ; rangs en entrées entières, accomplis à la fin. Aucun contenu Z verrouillé. Acceptation et abandon legacy ne sont pas restaurés.

## `!faveur`

- **Statut audit :** CLÔTURÉ — Domaine Faveur / Subscription après R672
- **But :** Consulter l'état de la Faveur de l'Astre.
- **Syntaxes :** `!faveur` ; `!faveur <pseudo>` ; `!faveur @pseudo` (résolution existante, pseudos multi-mots inclus)
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui lorsque l'intégration Twitch sera disponible
- **UI équivalente :** informations Faveur dans Profil et Quotidiennes ; aucun écran Faveur complet dédié
- **Acquisition :** uniquement via événements de subscription Twitch compatibles
- **Activation Twitch-only :** élément personnel choisi obligatoire ; aucun seuil de niveau supplémentaire
- **Standalone :** onboarding déjà terminé = élément déjà choisi
- **Durée :** +30 jours par attribution, maximum 180 jours
- **Daily :** +800 Primogemmes une fois par journée active si le joueur se manifeste
- **Temps :** les jours s'écoulent même si le joueur est absent
- **Tier 1 :** +1 600 Primogemmes immédiates
- **Tier 2 :** +9 600 Primogemmes immédiates
- **Tier 3 :** +20 800 Primogemmes immédiates
- **Overflow :** compensation supplémentaire `1600 × jours perdus / 30`
- **Gift :** la Faveur appartient au bénéficiaire ; gifter éligible non anonyme = total Twitch × récompense Tier (1 600 / 9 600 / 20 800), indépendamment des bénéficiaires ; aucun jour pour le gifter
- **Confidentialité :** catégorie dédiée FAVOR, PUBLIC par défaut, Public / Amis ACTIVE / Privé ; propriétaire toujours autorisé. Profil et commande partagent SocialService.favor. Tiers autorisé : uniquement active/daysRemaining/maxDays ; refus sans révéler actif/inactif, durée ou claim.
- **Commande physique Lot 9 :** consultation read-only dans le Chat GachaImpact ; FavorService.getCurrent reste autoritatif. Aucun claimToday, opération Faveur, mouvement Economy, refresh Ressources, catch-up Missions, activité spécifique ou provisionnement. COMMAND et GAME_RESULT suivent le pipeline Chat normal. Aucun transport de commandes Twitch activé.
- **Migration :** préserver les jours restants certains et le claim du jour sans reconstruire les anciens jours absents
- **Atomicité :** attribution, overflow, daily et bonus gifter protégés contre retry et doublons Twitch

**Amendement Chat R1038 :** Lecture seule, permissions FAVOR Public/Amis/Privé, actif/durée uniquement pour tiers ; aucune acquisition ou claim.

## `!roue`

- **Statut audit :** CLÔTURÉ — Domaine Roue / quotidien après R656
- **But :** Effectuer la Roue quotidienne et recevoir immédiatement son résultat.
- **Syntaxe :** `!roue`
- **Bouton UI équivalent :** `Activités > Quotidiennes > Roue` avec roue graphique et bouton `Tourner`
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui lorsque l'intégration Twitch sera disponible
- **Préconditions :** profil joueur valide ; spin du jour encore disponible
- **Cooldown :** une utilisation maximum par journée `Europe/Paris`, tous canaux confondus
- **Distribution :** 2 % rien ; 70 % particules ; 20 % Moras ; 8 % Primogemmes
- **Particules :** 10 % par élément, +500 particules
- **Moras :** +50 000
- **Jackpot :** +1 600 Primogemmes
- **Résultat quotidien :** persisté et consultable jusqu'au reset ; une reconnexion ne reroll pas
- **Après utilisation :** `!roue` rappelle que la Roue est consommée et restitue le résultat du jour lorsqu'il est connu
- **UI :** probabilités consultables ; animation courte/skippable ; résultat, prochain reset, total spins et total jackpots visibles
- **Quotidiennes :** état `À faire` / `Fait aujourd'hui` ; gain du jour affichable après le spin
- **Statistiques :** `totalWheelSpins` +1 par spin valide ; `totalWheelJackpots` +1 uniquement sur jackpot Primogemmes
- **Ressources :** les mutations centrales maintiennent aussi `totalPrimosEarned`, `totalMorasEarned` et `totalMainElementParticlesEarned` lorsque pertinent
- **Atomicité :** spin, verrou quotidien, résultat, récompense et statistiques protégés contre double clic, concurrence inter-canaux et retry
- **Migration :** conserver `lastWheelDate`, `totalWheelSpins`, `totalWheelJackpots` ; ne pas inventer les anciens résultats détaillés

**Amendement Chat R1038 :** Récompense réelle et durées lisibles ; spin déjà consommé par une autre intention = avertissement sans nouveau gain. Rejeu du propre reçu = résultat initial, une seule récompense malgré concurrence UI.

**Correctif post-cutover du 06/10/2026 :** une Roue historique consommée sans résultat connu répond `⚠️ Roue déjà utilisée aujourd’hui · résultat historique indisponible. Prochaine Roue demain.` avant tout appel au spin. Aucun gain inventé ou second tirage. L’appel direct au spin refuse ce cas par une erreur métier contrôlée ; le résultat connu et le lendemain gardent leur comportement normal. Voir [la source Roue](../legacy/17-roue-quotidien-audit.md#correctif-post-cutover--résultat-historique-inconnu-06102026).

## `!quotis`

- **Statut audit :** Principe transverse validé R355 ; contenu enrichi progressivement avec les domaines quotidiens
- **But :** Afficher un résumé compact et dynamique des activités quotidiennes du joueur.
- **Syntaxe :** `!quotis`
- **Bouton UI équivalent :** `Activités > Quotidiennes`
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **Coût :** aucun
- **Données lues :** vrais états quotidiens serveur
- **Données écrites :** aucune
- **Distinction :** `!quotis` n'est pas la mission quotidienne payante ; il est l'équivalent texte compact du hub `Quotidiennes`
- **Réponse :** état dynamique des activités pertinentes, avec présentation compacte
- **Architecture :** chaque activité reste propriétaire de sa logique ; l'écran Quotidiennes et `!quotis` ne font qu'agréger les états
- **Évolution :** neuf rubriques modernes, dont Boss séparé ; états Expédition/Event partagés avec le hub, selon le contrat Quotis ci-dessus.

**Amendement Chat R1038 :** Canonique quotis, aliases quoti/daily. Lectures seules : récompense quotidienne, Roue, Défi, Combat, état/récupération Expédition, cœurs, bonus Festival et Faveur ; aucun claim ni achat.

**Correctif post-cutover du 06/10/2026 :** `!quotis`, `!quoti` et `!daily` affichent tous `Roue ✅` pour une tentative historique consommée, même si son résultat est indisponible. L’existence du spin et le détail de son résultat sont des informations distinctes ; aucun gain n’est reconstruit.

## `!expedition`

- **Statut audit :** Clôturé — R340 à R369
- **But :** Lancer, consulter puis récupérer l'Expedition quotidienne.
- **Syntaxes :**
  - `!expedition`
  - `!expedition <personnage>`
  - `!expedition retour`
  - `!expedition <personnage envoyé>` peut également récupérer l'Expedition lorsqu'elle est prête
- **Bouton UI équivalent :** `Personnages > Box` > fiche d'un personnage possédé ; accès également depuis `Activités > Quotidiennes`
- **Hub Quotidiennes :** états `À faire` / `En cours` / `À récupérer` / `Fait aujourd'hui` ; un départ précédent peut bloquer l'action tout en laissant la quotidienne actuelle encore à faire ; bouton `Accéder` toujours disponible
- **Écran dédié :** aucun
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **Durée :** 20 heures
- **Limite :** un nouveau départ par journée serveur, reset 00:00 Europe/Paris
- **Reset avec Expedition active :** l'Expedition continue normalement et bloque le nouveau départ jusqu'à récupération ; `readyAt` n'est jamais modifié par le reset
- **Personnage éligible :** tout personnage possédé et actif
- **Disponibilité du personnage :** reste utilisable dans Team/Combat/autres systèmes pendant l'Expedition
- **Récupération :** manuelle après `readyAt`
- **Récompenses V1 :** 10 % = 1 600 Primogemmes ; 30 % = 800 particules de l'élément personnel du joueur ; 60 % = 30 000 Moras
- **Tirage :** serveur, uniquement lors de la récupération
- **Statistique :** `totalExpeditionsCompleted +1` uniquement lors d'une récupération réussie
- **Missions :** la récupération réussie produit immédiatement l'événement de progression permanent Expedition
- **Box :** personnage en cours à sa place normale ; personnage prêt temporairement devant les favoris ; retour au tri normal après récupération
- **Badges Box :** `🧭 En expédition` / `✅ À récupérer`
- **Annulation volontaire :** non
- **Notification :** notification UI à `readyAt`, aucune notification Twitch asynchrone
- **Historique player-facing :** aucun en V1
- **Migration :** préserver une Expedition active valide et son `readyAt`; aucune récompense automatique au cutover

**Amendement Chat R1038 :** Alias exp ; nom exact normalisé pour départ, retour ou nom envoyé prêt pour récupération. Branche/ID figés, durée lisible, récompense propriétaire ; départ quotidien/20 h inchangés.

## `!combat`

- **Statut audit :** Clôturé — R370 à R450
- **But :** Consulter puis effectuer le Combat quotidien ; consulter et attaquer le Boss mensuel.
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **Bouton UI équivalent :** `Activités > Combat` ; accès également depuis `Activités > Quotidiennes`
- **Navigation UI :** `Entraînement` ouvert par défaut / `Boss`
- **Mémoires :** chaque mode possède quatre slots persistants indépendants des Teams et indépendants l'un de l'autre

### Syntaxes quotidiennes

- `!combat`
- `!combat info`
- `!combat go`
- `!combat auto`
- `!combat elements`
- `!combat help`

### Consultation quotidienne

- `!combat` affiche les quatre ennemis globaux du jour, l'état quotidien et les actions utiles
- `!combat info` évalue en lecture seule la Team active que `!combat go` utiliserait
- `!combat elements` affiche la matrice élémentaire
- **Reset :** 00:00 `Europe/Paris`
- **Équipe ennemie :** quatre personnages actifs distincts, identiques pour tous les joueurs pendant la journée

### `!combat go`

- valide la Team active
- exige exactement quatre personnages distincts, possédés, actifs et non-KO
- copie la Team active dans les slots persistants du Combat quotidien
- lance immédiatement une tentative `MANUAL`
- ne modifie jamais la Team active
- en cas d'échec de validation, ne modifie pas les slots et ne crée aucune tentative

### `!combat auto`

- sélectionne les quatre meilleurs personnages valides/non-KO
- utilise la même formule autoritative que le vrai Combat
- remplit et mémorise les slots Combat
- lance immédiatement la tentative côté chat/Twitch
- marque cette tentative `AUTO`
- ne modifie jamais la Team active
- une réutilisation ultérieure de la composition sans nouvel Auto devient `MANUAL`

### Règles quotidiennes

- **KO :** uniquement pour le Combat quotidien jusqu'au reset
- **Tentatives :** après défaite, retenter avec d'autres personnages jusqu'à victoire ou impossibilité d'en composer quatre
- **Victoire :** clôt le Combat quotidien du joueur
- **Récompense :** +800 Primogemmes et +20 000 Moras à la première victoire
- **Quotidiennes :** À faire / En cours / Terminé / Bloqué aujourd'hui
- **Formule V1 :** base 50 ; 4★ +3 ; 5★ +6 ; constellation 4★ +0,5/C ; constellation 5★ +1/C ; élément ±4 ; clamp 5–95 %
- **Résumé :** seule la chance finale est visible normalement
- **Détails UI :** base / rareté / constellations / éléments / brut / clamp / final
- **Missions B/A/S :** `totalCombatWins`
- **Mission Z :** 50 `totalManualCombatWins`

### Syntaxes Boss

- `!combat boss`
- `!combat boss go`

### `!combat boss`

Boss vivant :
- affiche nom, PV, résistance et disponibilité de l'attaque
- affiche les dégâts prévus de la Team active si elle est valide
- reste entièrement en lecture seule

Boss vaincu :
- affiche dans un seul message compact le bilan mensuel et la contribution du joueur
- utilise plusieurs messages uniquement si la limite du canal impose une coupure
- réserve le classement et l'historique détaillés à l'interface

### `!combat boss go`

- vérifie que le Boss est vivant et actuel
- vérifie que l'attaque quotidienne est disponible
- valide la Team active complète
- copie la Team active dans les slots Boss
- snapshotte les personnages et constellations
- attaque immédiatement
- ne modifie jamais la Team active
- un refus ne modifie pas les slots et ne consomme pas l'attaque

### Règles Boss

- **Cycle :** un Boss global par mois civil
- **Création :** premier du mois à 00:00 `Europe/Paris`
- **Respawn :** aucun avant le mois suivant
- **Noms :** rotation fixe de douze Boss liée aux mois calendaires
- **Base initiale :** 1 500 000 `baseHp`
- **Variation :** `maxHp` uniforme à ±15 %, arrondi aux 10 000 PV
- **Scaling victoire :** +75 000 `baseHp` par journée restante, hausse mensuelle max +1 500 000
- **Scaling échec :** retirer les PV restants, même sans attaque ; plancher 500 000
- **Attaque :** une par joueur/jour
- **Indépendance :** les KO du quotidien ne s'appliquent pas au Boss
- **Slots Boss :** quatre slots persistants indépendants ; première utilisation vide
- **Auto Boss :** aucun
- **Résistance :** élément mensuel ; personnage correspondant → dégâts ×0,5
- **Dégâts 4★ :** 500 +150 × constellation
- **Dégâts 5★ :** 1 000 +650 × constellation
- **Preview :** total uniquement par défaut ; détail individuel/résistance dans le panneau déroulant
- **Participation :** une attaque valide ayant infligé plus de zéro dégât
- **Récompense :** +16 000 Primogemmes et +500 000 Moras à chaque participant
- **Distribution :** automatique, offline, atomique et idempotente
- **Coup final :** honorifique/statistique, sans bonus économique
- **Classements :** publics
- **Historique :** player-facing avec fiches détaillées par mois
- **Quotidiennes :** rubrique Boss séparée dans le hub moderne et `!quotis`, lue chez MonthlyBoss (attaque du jour et personnages éligibles).

### `!combat stat`

- **Syntaxe canonique :** `!combat stat`
- **Alias accepté :** `!combat stats`
- **Réponse normale :** un seul message compact
- **Coupure :** uniquement si la limite technique du canal l'impose
- **Contenu :** combats, victoires, victoires manuelles, défaites, dégâts/attaques Boss, participations, Boss vaincus, coups finaux, meilleur coup et résumé global public

### Alias

- `help` / `aide`
- `info` / `infos`
- `stat` / `stats`
- `element` / `elements`
- `faiblesse` / `faiblesses`

Les aides ne recommandent qu'une seule syntaxe canonique.

**Amendement Chat R1038 :** info/infos, help/aide, stat/stats, element/elements/faiblesse/faiblesses [élément]. Preview et Team active consultatifs, quatre ennemis entiers, matrice française ; go/auto affichent résultat et récompense propriétaire, KO bloque le jour. Boss : dommages, récompense de victoire, résumé public et contribution propre depuis les vues existantes.

## `!ami`

- **Statut audit :** CLÔTURÉ — R451 à R525
- **État étape 29 :** Recette publique du lot Ami R1035 confirmée par le propriétaire, sauf retrait demandé de la sous-commande liste (R1036). Retrait implémenté/testé, à recetter après déploiement. Twitch natif non activé ; Streamer.bot reste autoritatif. UI et Chat utilisent le propriétaire Friendship existant, réutilisable par le futur adapter Twitch.
- **Résumé :** `!ami`
- **Demandes :** `!ami demandes`, reçues et envoyées séparées, nombre restant indiqué si nécessaire
- **Ajouter :** `!ami ajouter <pseudo>`
- **Accepter :** `!ami accepter <pseudo>`
- **Refuser :** `!ami refuser <pseudo>`
- **Annuler :** `!ami annuler <pseudo>`
- **Retirer :** `!ami retirer <pseudo>`
- **Consulter :** `!ami voir <pseudo>`
- **Polyvalent (R1035 supersède R494 sur ce point) :** `!ami <pseudo>` : aucune relation → ADD ; demande reçue → ACCEPT ; demande envoyée → attente sans mutation ; amis → informations. `!ami voir <pseudo>` reste une consultation pure.
- **Cœur individuel :** `!ami coeur <pseudo>`
- **Cœur global :** `!ami coeur all`
- **Aliases cœur :** `coeur`, `cœur`, `coeurs`, `cœurs` ; `all` et `@all` seulement pour les cœurs, jamais généralisés aux autres commandes. Cibles par pseudo ou `@pseudo`, normalisation existante conservée.
- **ADD réel :** une demande inverse est automatiquement acceptée par le service existant ; relation archivée réactivée avec son vrai niveau/palier, jamais un faux niveau 1.
- **Demandes :** persistantes, paire unique par IDs, transitions explicites et idempotentes
- **Relation :** retrait archivé ; progression restaurée au réajout
- **Cœur :** un par relation, sens et journée Europe/Paris
- **Récompense :** +5 Primogemmes aux deux joueurs
- **Niveau :** partagé, plafonné à 1000 ; total historique non plafonné
- **Résultat individuel :** phrase legacy + niveau/palier + récompense
- **Résultat global :** envoyés/déjà faits/gains, sans liste de pseudos
- **Notifications :** aucune notification dédiée au cœur
- **Missions :** B/A/S comptent les cœurs sortants validés ; Z à la première relation niveau 1000
- **Concurrence :** transaction/idempotence communes à UI, chat interne et Twitch

### Messages Ami validés et implémentés — étape 29

Les placeholders P/C/N désignent le displayName réel de l'acteur/cible et une valeur autoritative. Le palier est `[Amitié Sincère] 💛` avant 100, `[Amitié Fusionnelle] 💖` à 100, `[Amitié Légendaire] 🌟` à 300, `[Amitié Parfaite] 💞` à 1000. Niveau plafonné à 1000, total de cœurs non plafonné. Les 50 friendshipPhrases existantes sont inchangées.

| Situation | Réponse Chat |
| --- | --- |
| Résumé | `ℹ️ P | Amis : N | Cœurs disponibles : N | Demandes : N | Commandes : !ami pseudo · !ami demandes · !ami coeur pseudo · !ami coeur all` |
| Demande créée | `✅ P envoie une demande d’ami à C | C peut accepter avec !ami P` |
| Acceptation, y compris ADD inverse | `🤝 P et C sont maintenant amis ! Niveau d’amitié : N [Palier] emoji` |
| Demande déjà envoyée | `⚠️ P, demande déjà envoyée à C. C doit faire !ami P pour accepter.` |
| Amis, consultation | `🤝 Amitié P ↔ C | Statut : ami | Niveau d’amitié : N [Palier] emoji | 💖💖✨ échangés : Total | Cœur aujourd’hui : disponible` (ou `déjà envoyé`) |
| Voir demande reçue | `📨 P, tu as reçu une demande d’ami de C. Utilise !ami accepter C ou simplement !ami C.` |
| Voir demande envoyée | `📨 P, ta demande d’ami à C est en attente.` |
| Voir sans relation | `ℹ️ P, aucune relation d’amitié avec C.` |
| Demandes | `📨 Demandes d’ami | Reçues : liste ou aucune | Envoyées : liste ou aucune` |
| Ajouter déjà ami | `ℹ️ P, tu es déjà ami avec C.` |
| Accepter/refuser sans demande | `⚠️ P, aucune demande d’ami de C à accepter.` / `à refuser.` |
| Refuser | `✅ Demande d’ami de C refusée.` |
| Annuler | `✅ Demande d’ami envoyée à C annulée.` |
| Annuler sans demande | `⚠️ P, aucune demande d’ami envoyée à C à annuler.` |
| Retirer | `✅ P et C ne sont plus amis.` ; archive/restauration internes conservées |
| Retirer non-ami | `⚠️ P, tu n’es pas ami avec C.` |
| Introuvable | `⚠️ P, le joueur C est introuvable.` |
| Soi-même | `⚠️ P, tu ne peux pas devenir ami avec toi-même.` |
| Interaction indisponible | `⚠️ P, cette interaction avec C est indisponible.` ; ne révèle ni blocage ni privacy |
| Cœur individuel réussi | `💖💖✨ P envoie des cœurs cœurs paillettes à C | phrase legacy | Niveau d’amitié : N [Palier] emoji | +💠5 Primos chacun` |
| Cœur déjà envoyé | `⚠️ P, tu as déjà envoyé des cœurs cœurs paillettes à C aujourd’hui.` |
| Cœur non-ami | `⚠️ P, tu n’es pas encore ami avec C. Utilise : !ami C` |
| Cœur à soi | `⚠️ P, tu ne peux pas t’envoyer des cœurs cœurs paillettes à toi-même.` |
| Cœur indisponible | `⚠️ P, impossible d’envoyer un cœur à C pour le moment.` |
| Cœurs all réussis | `💖💖✨ P envoie des cœurs cœurs paillettes à tous ses amis ! | N envoyé(s), A déjà fait(s), U indisponible(s) | +💠Gain Primos pour P` ; Gain = senderReward, jamais recalculé |
| All déjà faits | `⚠️ P, tu as déjà envoyé des cœurs cœurs paillettes à tous tes amis aujourd’hui.` |
| All sans amis | `⚠️ P, tu n’as aucun ami disponible à qui envoyer un cœur.` |
| All zéro mixte | `⚠️ P, aucun cœur envoyé. Déjà fait aujourd’hui ou aucun ami disponible.` |

**Inventaire legacy / écarts :** Ami.txt avait résumé, pseudo polyvalent, cœur individuel et global, quatre aliases de cœur, @pseudo et @all via normalisation ; `tous`/`tout` étaient aussi présents mais ne sont pas ajoutés au contrat validé all/@all. Résumé legacy sur deux messages remplacé par un seul ; !ami demandes/ajouter/accepter/refuser/annuler/retirer/voir modernes conservés ; sous-commande liste entièrement retirée par R1036. Stockage JSON, auto-création/defaults des profils, absence de refus/retrait explicites et horloge locale legacy ne sont pas transférés : PostgreSQL, notifications Social, privacy/block, archivage restaurable, Missions et Europe/Paris restent autoritatifs. Les écarts de textes et le pseudo autrefois purement consultatif sont résolus selon le choix propriétaire ; aucune nouvelle économie, phrase, action Twitch ou autre fichier legacy traité.

## `!infos`

État physique : Profil UI standalone implémenté pour Aperçu/Team active/Box/Collection/Statistiques et Missions selon permissions. Missions est chargé paresseusement par une route dédiée ; sa lecture tierce consomme Privacy `MISSIONS` sans mutation. `!infos` Chat interne consulte le service Profil et les données d'amitié du demandeur ; Twitch reste non branché.

- **Statut audit :** CLÔTURÉ — R471/R489/R490/R525
- **Syntaxe canonique :** `!infos <pseudo>`
- **Alias accepté :** `!info <pseudo>`
- **Cible personnelle :** `me` et `moi` acceptés
- **Aide :** présente uniquement `!infos`
- **Chat interne/Twitch :** une seule réponse compacte
- **Contenu :** pseudo, niveau, élément, nombre de personnages, Team active remplie, total Pulls, victoires Combat et amitié avec le demandeur
- **Confidentialité :** champ privé omis ; aucune fausse valeur zéro
- **Pity/garantie :** consultables dans l'UI selon confidentialité, pas dans le résumé chat
- **Sections supprimées :** `team`, `box`, `sac`, `pity`, `stats`, `mission`
- **UI standalone :** Profil détaillé en lecture seule selon permissions
- **Titre :** jamais affiché dans les chats

**Amendement Chat R1038 :** Alias info ; joueur/pseudo/@pseudo/me/moi, noms composés. Résumé moderne fixe en entrées entières, glyphes et permissions ; sections historiques restent supprimées.

## `!liste`

État physique : annuaire UI et présence standalone implémentés. `!liste` Chat interne consulte les mêmes données et applique les mêmes permissions ; Twitch reste non branché.

- **Statut audit :** CLÔTURÉ — R462/R464/R472/R523/R524
- **Élément :** `!liste <élément> [page]`
- **Ordre élément :** alphabétique, sans statut de présence
- **Présence :** `!liste online [page]`
- **Ordre online :** En ligne alphabétiques puis Absents alphabétiques
- **Marqueurs :** 🟢 En ligne ; 🟡 Absent
- **Pagination :** vingt joueurs par page
- **Confidentialité :** présence privée/non autorisée totalement absente de `online`
- **Hors ligne :** jamais inclus dans `online`
- **UI standalone :** recherche, filtres et listes détaillées dans Social

**Amendement Chat R1038 :** Page moderne de 20 entière, filtres élément normalisé et online ; aucune présence cachée affichée ni ancien classement par activité.
