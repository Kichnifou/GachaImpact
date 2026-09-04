# 20 — Audit Gift Suprême / récompense Points de chaîne Twitch

> Domaine 17 de l'audit GachaImpact.  
> Statut : **CLÔTURÉ — décisions produit R692 à R701 validées ; clôture technique finalisée**.  
> Ce document est la source spécialisée validée du domaine Gift Suprême / Points de chaîne Twitch.  
> L'état global du projet et la prochaine reprise exacte restent la responsabilité du Master.

---

# 1. Objectif du domaine

Auditer puis spécifier la mécanique **Gift Suprême**.

Cette mécanique est volontairement très limitée :

- elle naît d'une récompense personnalisée de Points de chaîne Twitch ;
- le viewer qui dépense ses Points de chaîne saisit le nom d'un autre viewer ;
- le joueur ciblé reçoit une récompense GachaImpact ;
- il n'existe pas d'équivalent d'achat dans le standalone.

Le domaine couvre notamment :

- `legacy/streamerbot/commands/Gift.txt` ;
- la récompense Twitch `Gift Suprême` ;
- la récupération du texte saisi par le viewer ;
- la résolution du joueur cible ;
- la récompense de particules ;
- l'intégration future Twitch EventSub ;
- l'idempotence des redemptions ;
- la gestion des erreurs ;
- la possibilité ou non d'annuler/rembourser les Points de chaîne ;
- la restitution Twitch / standalone ;
- la migration / absence d'historique legacy.

Le domaine ne doit pas créer une monnaie de Points de chaîne dans GachaImpact.

Les Points de chaîne restent entièrement gérés par Twitch.

---

# 2. Sources inspectées

Sources repository :

- `legacy/streamerbot/commands/Gift.txt`
- `legacy/streamerbot/data/viewers_data.json`
- `docs/legacy/05-element-resources-audit.md`
- `docs/legacy/03-command-data-matrix.md`
- `docs/master/PROJECT_MASTER_PLAN.md`
- `docs/commands/command-reference.md`
- `docs/specifications/decisions-log.md`

Source visuelle fournie par le propriétaire :

- configuration Twitch actuelle de la récompense personnalisée `Gift Suprême`.

Documentation technique vérifiée :

- Twitch EventSub — `channel.channel_points_custom_reward_redemption.add`
- Twitch API — Custom Rewards / Update Redemption Status
- scopes Twitch `channel:read:redemptions` / `channel:manage:redemptions`

---

# 3. Configuration Twitch actuelle fournie

La récompense personnalisée Twitch actuelle est :

**Gift Suprême**

Prix :

**10 000 Points de chaîne**

La saisie de texte viewer est obligatoire.

Description fournie :

> Saisis le nom du viewer à qui tu veux donner le Gift Suprême.  
> Le Gift Suprême est un total de 1600 particules de l'élément du viewer saisi.

Le comportement décrit par l'interface Twitch correspond bien au vrai `Gift.txt`.

---

# 4. Comportement réel de `Gift.txt`

Le script est prévu pour être appelé depuis une récompense de Points de chaîne Twitch.

Il lit :

- `userName` : viewer ayant utilisé la récompense ;
- `rawInput` / `input0` : texte saisi dans la récompense Twitch.

Le gifter n'a pas besoin d'exister comme joueur GachaImpact dans le script legacy.

Le texte saisi sert uniquement à rechercher le **joueur cible**.

---

# 5. Récompense réelle

Constante legacy :

`GiftParticlesReward = 1600`

La cible reçoit :

**+1 600 particules de SON élément personnel**

Exemples :

- cible Cryo → +1 600 Cryo ;
- cible Pyro → +1 600 Pyro.

L'élément du gifter n'intervient jamais.

Le Gift ne donne actuellement :

- ni Primogemmes ;
- ni Moras ;
- ni XP ;
- ni personnage ;
- ni Faveur.

---

# 6. Préconditions de la cible

Le legacy exige :

- que le viewer cible existe ;
- qu'il ait choisi un élément.

Si la cible n'existe pas :

- aucun gain.

Si la cible n'a pas d'élément :

- aucun gain.

Cette règle est cohérente avec la règle centrale d'activation Twitch déjà validée :

**élément choisi = joueur Twitch activé**

Le Gift génère directement des particules de l'élément personnel ; une cible sans élément ne permet de toute façon pas de déterminer la récompense.

---

# 7. Le gifter peut être extérieur au jeu

Le legacy ne cherche jamais un profil GachaImpact pour le viewer qui dépense ses Points de chaîne.

Conséquence :

- un viewer Twitch qui ne joue pas à GachaImpact peut utiliser ses Points de chaîne ;
- il peut offrir le Gift à un joueur GachaImpact valide.

Cette propriété paraît volontairement compatible avec le caractère communautaire du Gift.

Elle devra être explicitement confirmée en décision produit.

---

# 8. Résolution du pseudo legacy

`Gift.txt` accepte :

- pseudo exact ;
- pseudo avec `@` ;
- pseudo contenu dans une phrase ;
- fallback fuzzy via distance de Levenshtein.

Seuils legacy :

- pseudo <= 4 caractères : distance max 1 ;
- <= 8 caractères : distance max 2 ;
- plus long : distance max 3.

Cette tolérance réduit les erreurs de saisie mais peut devenir dangereuse pour une récompense payée avec 10 000 Points de chaîne :

un fuzzy match incorrect peut créditer la mauvaise personne.

La cible V1 doit décider si elle :

- conserve cette tolérance ;
- exige un pseudo exact normalisé ;
- ou utilise une résolution exacte d'abord puis refuse plutôt que de deviner.

---

# 9. Bug statistique transverse

`Gift.txt` ajoute les particules directement au stock.

Il ne met pas à jour :

`stats.totalMainElementParticlesEarned`

alors que les particules accordées sont précisément celles de l'élément personnel de la cible.

Le Domaine Ressources a déjà validé la correction :

toute particule personnelle générée comme récompense par le jeu doit maintenir le compteur central correspondant.

Cible :

- Gift → service Ressources central ;
- +1 600 particules personnelles ;
- +1 600 dans le compteur de particules personnelles gagnées.

Ce correctif est technique et ne nécessite pas de nouveau Rxxx.

---

# 10. Aucun état Gift persistant legacy

Le script ne stocke pas :

- historique des Gifts ;
- nombre de Gifts envoyés ;
- nombre de Gifts reçus ;
- redemption ID Twitch ;
- date ;
- gifter ;
- cible ;
- transaction Gift spécifique.

Seul le nouveau solde de particules subsiste.

Il ne faut donc pas inventer un historique Gift ancien lors de la migration.

À partir de GachaImpact, conserver un journal minimal des redemptions traitées est cependant nécessaire pour :

- idempotence ;
- audit ;
- support ;
- diagnostic.

---

# 11. Faisabilité Twitch sans Streamer.bot — CONFIRMÉE

Twitch expose actuellement EventSub :

`channel.channel_points_custom_reward_redemption.add`

Cet événement est déclenché lorsqu'un viewer utilise une récompense personnalisée de Points de chaîne.

Le payload fournit notamment :

- `event.id` : identifiant de redemption ;
- `user_id` / `user_login` / `user_name` : viewer ayant payé ;
- `user_input` : texte saisi par le viewer ;
- `reward.id` ;
- `reward.title` ;
- `reward.cost` ;
- `status` ;
- `redeemed_at`.

La subscription EventSub peut être filtrée par `reward_id`.

Cela correspond exactement aux informations nécessaires pour remplacer le trigger Streamer.bot actuel.

Scope :

`channel:read:redemptions`

ou :

`channel:manage:redemptions`

selon le niveau de contrôle souhaité.

Conclusion :

**le Gift Suprême peut rester dans GachaImpact après suppression de Streamer.bot.**

---

# 12. Architecture cible Twitch

Conceptuellement :

```text
Twitch
  -> redemption Gift Suprême
  -> EventSub
  -> TwitchBridge
  -> résolution reward_id
  -> lecture user_input
  -> résolution joueur cible
  -> GiftService
  -> ResourceService
  -> +1600 particules personnelles
  -> message/résultat
```

Le frontend standalone n'intervient pas dans l'achat.

Le navigateur ne reçoit jamais le pouvoir de simuler une redemption Twitch.

---

# 13. Identifier la récompense par `reward.id`

La cible ne doit pas déclencher Gift uniquement parce que le titre Twitch vaut :

`Gift Suprême`

Le lien doit être configuré avec l'identifiant Twitch stable de la Custom Reward :

`reward.id`

Le titre peut changer sans casser l'intégration.

Prévoir une configuration Admin / serveur du type :

`giftSupremeRewardId`

ou une relation équivalente avec la future intégration Twitch.

---

# 14. Idempotence indispensable

EventSub peut redélivrer un événement.

La clé naturelle est :

`redemption event.id`

Une même redemption ne doit jamais produire deux Gifts.

L'opération cible doit être idempotente :

1. recevoir redemption ;
2. vérifier que son ID n'a pas déjà été traité ;
3. résoudre la cible ;
4. créditer +1 600 ;
5. enregistrer le traitement ;
6. répondre / notifier.

Le crédit Ressources + l'enregistrement de la redemption traitée forment une seule opération transactionnelle logique.

---

# 15. Particularité importante : récompense Twitch actuelle créée manuellement

La récompense montrée par le propriétaire existe déjà dans l'interface Twitch.

Twitch permet à une application autorisée **d'écouter** les redemptions de Custom Rewards via EventSub.

En revanche, l'API Twitch précise qu'une application ne peut modifier le statut d'une redemption que pour une récompense créée par cette même application.

Conséquence possible pour la récompense actuelle créée manuellement :

- GachaImpact peut recevoir l'événement et distribuer le Gift ;
- mais l'application GachaImpact ne doit pas supposer qu'elle pourra automatiquement marquer cette redemption `FULFILLED` ou `CANCELED`.

Cette distinction est importante en cas d'erreur de cible.

---

# 16. Deux stratégies possibles pour la Custom Reward Twitch

## Stratégie 1 — conserver la récompense créée manuellement

Avantages :

- aucun changement visible nécessaire dans Twitch ;
- EventSub peut servir de trigger ;
- mécanique GachaImpact simple.

Limite :

- si la cible est invalide, GachaImpact ne doit pas promettre un remboursement automatique des Points de chaîne via l'API.

La gestion Twitch de la redemption reste alors externe / manuelle.

## Stratégie 2 — recréer Gift Suprême via l'application GachaImpact

L'application GachaImpact crée officiellement la Custom Reward Twitch avec :

- titre ;
- coût 10 000 ;
- prompt ;
- saisie texte obligatoire ;
- file de redemptions appropriée.

Avantage :

GachaImpact peut ensuite gérer le statut d'une redemption qu'il a créée.

Une redemption invalide peut être mise :

`CANCELED`

ce qui rembourse les Points de chaîne selon l'API Twitch.

Une redemption réussie peut être marquée :

`FULFILLED`

si la configuration choisie utilise la file de redemptions.

Cette option donne une intégration beaucoup plus propre.

La décision finale doit tenir compte du souhait du propriétaire de conserver la récompense Twitch actuelle ou d'accepter de la recréer une fois lors du futur branchement Twitch.

---

# 17. Gestion d'une cible invalide

Cas :

- texte vide ;
- joueur introuvable ;
- cible sans élément ;
- saisie ambiguë.

Aucun crédit GachaImpact ne doit être appliqué.

Si la Custom Reward est gérée par l'application et que Twitch permet donc la mise à jour du statut :

- recommandation technique : `CANCELED` ;
- remboursement des Points de chaîne.

Si la récompense reste manuelle :

- informer clairement le viewer dans Twitch ;
- ne pas prétendre qu'un remboursement automatique a été exécuté ;
- la redemption Twitch pourra nécessiter une gestion manuelle selon son statut/configuration.

---

# 18. Restitution après succès

Le legacy envoie un message Twitch public :

`🎁 <gifter> offre un Gift Suprême à <target> ! +1600 particules <élément> (<total>)`

La cible V1 peut conserver ce principe.

Le message est une restitution du résultat autoritatif.

Il ne constitue pas la mutation elle-même.

Une notification standalone personnelle au bénéficiaire peut également être envisagée si le compte possède un accès standalone, mais ce choix reste produit.

---

# 19. Standalone

Le Gift Suprême est une mécanique **Twitch-only pour l'activation**.

Dans le standalone :

- aucun bouton `Acheter Gift Suprême` ;
- aucune dépense de Points de chaîne ;
- aucune imitation de la boutique Twitch.

En revanche, lorsque le backend reçoit une redemption Twitch :

- le solde du joueur cible est le même solde GachaImpact ;
- les nouvelles particules sont donc visibles immédiatement dans le standalone ;
- une éventuelle notification peut refléter le Gift reçu.

Twitch reste seulement le canal d'entrée économique de cette action.

---

# 20. Migration

Il n'existe aucun historique Gift exploitable à migrer.

Migrer normalement :

- les stocks de particules existants ;
- les statistiques legacy existantes selon les règles Ressources déjà validées.

Ne pas reconstruire :

- anciens gifters ;
- anciens bénéficiaires ;
- dates ;
- redemptions ;
- nombre de Gifts.

Le journal Gift natif commence à partir du branchement GachaImpact.

---

# 21. Décisions techniques acquises

Sans consommer de Rxxx :

- Gift est déclenché uniquement par une vraie redemption Twitch reçue par le backend ;
- identification de la reward par Twitch `reward.id`, pas par simple titre ;
- identification du gifter par Twitch User ID ;
- identification de la cible par player ID après résolution de la saisie ;
- un événement Twitch ne crée pas automatiquement la cible joueur ;
- la cible doit posséder un élément ;
- la récompense passe par le ResourceService central ;
- +1 600 particules personnelles maintiennent `totalMainElementParticlesEarned` ;
- une redemption est traitée au maximum une fois grâce à son `event.id` ;
- aucune opération standalone ne peut fabriquer une redemption ;
- aucun historique legacy Gift n'est inventé ;
- les éventuelles erreurs de remboursement Twitch dépendent de la capacité de l'application à gérer la Custom Reward concernée.

---

# 22. Décisions produit validées

## R692 — Prix Twitch — ✅ VALIDÉ A

Conserver :

**10 000 Points de chaîne Twitch**

Le coût reste entièrement géré par Twitch.

GachaImpact ne possède aucun solde de Points de chaîne interne.

---

## R693 — Récompense du bénéficiaire — ✅ VALIDÉ A

Le Gift Suprême conserve :

**+1 600 particules de l'élément personnel du bénéficiaire**

Exemples :

- cible Hydro → +1 600 Hydro ;
- cible Cryo → +1 600 Cryo.

La mutation passe par le service Ressources central et maintient également :

`totalMainElementParticlesEarned`

---

## R694 — Le gifter n'a pas besoin d'être joueur GachaImpact — ✅ VALIDÉ A

N'importe quel viewer Twitch peut utiliser la Custom Reward Gift Suprême.

Il n'est pas nécessaire :

- qu'il possède un profil GachaImpact ;
- qu'il ait choisi un élément ;
- qu'il possède un compte standalone.

Seul le bénéficiaire doit être un joueur GachaImpact valide possédant un élément.

Cette règle conserve le comportement communautaire du legacy.

---

## R695 — Conserver le matching fuzzy legacy — ✅ VALIDÉ B

La résolution du bénéficiaire conserve les possibilités actuelles :

1. pseudo exact normalisé ;
2. pseudo avec `@` ;
3. pseudo identifiable dans le texte saisi ;
4. fallback fuzzy par distance de Levenshtein.

Seuils conservés :

- pseudo <= 4 caractères : distance maximale 1 ;
- pseudo <= 8 caractères : distance maximale 2 ;
- pseudo plus long : distance maximale 3.

La cible réellement résolue côté serveur est celle qui reçoit la récompense.

Le standalone n'intervient pas dans cette saisie.

---

## R696 — Message public Twitch après succès — ✅ VALIDÉ A

Après un Gift Suprême réussi, conserver un message public Twitch compact.

Exemple :

`🎁 Axel offre un Gift Suprême à Bob ! +1 600 particules Hydro`

Ce message intervient uniquement après validation et crédit serveur.

Il ne constitue jamais la source de vérité économique.

---

## R697 — Notification standalone informationnelle — ✅ VALIDÉ A ENRICHI

Lorsqu'un joueur reçoit un Gift Suprême, créer une notification standalone personnelle.

Exemple :

`🎁 Gift Suprême reçu`

`Axel t'a offert +1 600 particules Hydro.`

La récompense a déjà été créditée lorsque cette notification est créée.

Elle ne possède donc :

- aucun bouton `Récupérer` ;
- aucune action économique ;
- aucune possibilité de payer une seconde fois.

Cette notification est classée :

**informationnelle**

et non :

**actionnable**

Elle reste disponible afin que le joueur puisse découvrir le Gift lorsqu'il ouvre ultérieurement le standalone, même si le Gift a été reçu auparavant via Twitch.

Elle suit ensuite les règles générales des notifications informationnelles : lecture, suppression manuelle et nettoyage normal après lecture.

---

## R698 — Custom Reward créée par l'application GachaImpact — ✅ VALIDÉ A

Lors de la future intégration Twitch, remplacer la Custom Reward actuellement créée manuellement par une Custom Reward créée par l'application GachaImpact.

Configuration cible :

- nom : `Gift Suprême` ;
- coût : 10 000 Points de chaîne ;
- texte utilisateur obligatoire ;
- description cohérente avec la mécanique ;
- redemption placée dans un état permettant au backend de la valider ou l'annuler.

Le Twitch Reward ID retourné devient la référence configurée côté backend.

GachaImpact écoute ensuite uniquement les redemptions correspondant à cet ID.

### Standalone

Aucun bouton permettant de dépenser des Points de chaîne ou de déclencher directement Gift Suprême n'est créé.

L'utilisation de la reward reste exclusivement dans l'interface Twitch.

Le standalone peut uniquement :

- refléter les ressources reçues ;
- afficher la notification du bénéficiaire.

---

## R699 — Redemption invalide annulée et remboursée — ✅ VALIDÉ A

Si la redemption ne peut pas produire un Gift valide :

- aucune particule n'est créditée ;
- la redemption est marquée `CANCELED` ;
- Twitch rembourse les Points de chaîne.

Cas notamment :

- texte vide ;
- aucune cible résolue ;
- joueur cible inexistant ;
- cible sans élément exploitable ;
- autre erreur métier empêchant le Gift.

Une redemption réussie est marquée :

`FULFILLED`

après la mutation économique réussie.

---

## R700 — Auto-ciblage autorisé — ✅ VALIDÉ A

Le viewer qui dépense ses Points de chaîne peut saisir son propre pseudo.

S'il correspond à un joueur GachaImpact valide avec élément choisi :

- le Gift est accepté ;
- il reçoit lui-même les +1 600 particules.

Aucune restriction spécifique `gifter != cible`.

---

## R701 — Aucun historique Gift player-facing dédié — ✅ VALIDÉ A

La V1 ne crée pas d'écran Historique Gift.

Le serveur conserve néanmoins les informations minimales nécessaires pour :

- idempotence ;
- audit ;
- support ;
- diagnostic.

Pour les nouveaux Gifts GachaImpact, conserver notamment :

- redemption Twitch ID ;
- reward ID ;
- Twitch User ID du gifter ;
- joueur bénéficiaire ;
- élément récompensé ;
- montant ;
- timestamp ;
- résultat `FULFILLED` / `CANCELED` ;
- éventuelle raison d'échec.

Les anciens Gifts Streamer.bot ne sont pas reconstruits.

---

# 23. Règle transversale Notifications précisée

Trois formes doivent désormais être distinguées.

## Notification actionnable

Signale une action encore réellement disponible pour le joueur.

Exemples :

- code cadeau à récupérer ;
- récompense ou élément explicitement à réclamer ;
- état métier attendant une action.

Elle est automatiquement résolue lorsque :

- l'action est accomplie ;
- l'action expire ;
- l'action devient impossible.

Cette résolution fonctionne quel que soit le canal utilisé.

## Notification informationnelle

Informe d'un événement déjà accompli.

Exemple :

- Gift Suprême déjà reçu et déjà crédité.

Elle ne disparaît pas simplement parce que l'effet métier est déjà appliqué.

Elle reste visible jusqu'à lecture ou suppression selon les règles générales des Notifications.

## Feedback éphémère

Animation/toast servant uniquement à restituer immédiatement une action déjà visible à l'écran.

Il n'a pas nécessairement besoin d'être ajouté au panneau Notifications.

Lors du sweep final, chaque notification prévue par les domaines audités devra être classée dans l'une de ces catégories et les incohérences documentaires devront être corrigées.

---

# 24. Intégration Twitch cible

L'application utilise :

`channel:manage:redemptions`

La configuration cible de Gift Suprême doit notamment avoir :

- `cost = 10000` ;
- saisie utilisateur obligatoire ;
- file de redemption non automatiquement considérée terminée avant validation GachaImpact.

Flux :

1. viewer utilise Gift Suprême sur Twitch ;
2. Twitch crée une redemption ;
3. EventSub transmet `channel.channel_points_custom_reward_redemption.add` ;
4. backend vérifie le `reward.id` ;
5. backend déduplique avec le redemption ID ;
6. backend résout le bénéficiaire depuis `user_input` ;
7. si valide : crédit atomique +1 600 particules personnelles ;
8. création de la notification informationnelle ;
9. redemption Twitch → `FULFILLED` ;
10. message public Twitch.

En cas d'échec métier :

1. aucun crédit ;
2. redemption → `CANCELED` ;
3. aucun Gift reçu ;
4. retour d'erreur adapté.

L'application ne crée jamais une redemption à la place du viewer.

---

# 25. Atomicité / idempotence

La redemption ID Twitch est l'identifiant externe autoritatif de l'opération.

Une même redemption ne peut être traitée économiquement qu'une seule fois.

Doivent être sûrs :

- retry EventSub ;
- redelivery ;
- crash serveur après réception ;
- plusieurs instances backend ;
- doublon de callback.

Sur succès, l'ensemble logique comprend :

- validation de la redemption ;
- cible résolue ;
- crédit des particules ;
- statistique `totalMainElementParticlesEarned` ;
- journal Gift ;
- notification informationnelle.

Un retry ne peut jamais produire +3 200 particules.

---

# 26. Migration

Aucun historique Gift détaillé legacy n'existe.

Ne pas inventer :

- anciens gifters ;
- anciens bénéficiaires ;
- nombre de Gifts ;
- anciennes dates ;
- anciennes redemptions.

Les stocks de particules déjà présents dans les profils restent migrés normalement via le Domaine Ressources.

Le journal natif Gift commence uniquement à partir de l'intégration GachaImpact.

Aucune récompense n'est générée par la migration.

---

# 27. Critères d'acceptation

Le Domaine Gift Suprême est prêt pour la V1 si les tests peuvent prouver notamment que :

1. la Custom Reward coûte 10 000 Points de chaîne ;
2. son texte utilisateur est obligatoire ;
3. une vraie redemption Twitch peut déclencher GachaImpact ;
4. aucune action standalone ne peut créer une redemption ;
5. un gifter non-joueur peut utiliser la reward ;
6. une cible doit correspondre à un joueur GachaImpact existant ;
7. une cible doit posséder un élément ;
8. le matching exact / contains / fuzzy legacy est conservé ;
9. un Gift valide donne exactement +1 600 particules personnelles ;
10. `totalMainElementParticlesEarned` augmente correctement ;
11. le gifter peut se cibler lui-même ;
12. une redemption réussie produit le message Twitch public ;
13. le bénéficiaire reçoit une notification standalone informationnelle ;
14. cette notification reste visible même si la récompense était déjà créditée avant l'ouverture du standalone ;
15. la notification ne contient aucun second claim ;
16. une cible invalide ne reçoit rien ;
17. une redemption invalide est `CANCELED` ;
18. une redemption annulée bénéficie du remboursement Twitch prévu ;
19. une redemption valide est `FULFILLED` ;
20. le même redemption ID traité plusieurs fois ne paie qu'une fois ;
21. aucun historique Gift legacy absent n'est inventé ;
22. aucun historique player-facing Gift dédié n'est requis.

---

# 28. Conclusion du domaine

**Domaine Gift Suprême / Points de chaîne Twitch : CLÔTURÉ après R701.**

La mécanique reste volontairement Twitch-only pour son déclenchement.

Le standalone partage uniquement :

- le même joueur ;
- les mêmes ressources ;
- la notification informationnelle du bénéficiaire.

Le domaine ne doit être rouvert que si :

- Twitch modifie réellement son API Channel Points ;
- le branchement Twitch réel révèle une contrainte nouvelle ;
- le sweep final révèle une dépendance oubliée ;
- une décision produit est explicitement révisée.

---

# 29. Sweep final obligatoire

Même après clôture de Gift Suprême et des audits restants, le sweep exhaustif final des 36 scripts `.txt` et 17 JSON reste obligatoire avant le modèle de données cible final et la V1.
