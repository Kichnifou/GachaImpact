# GachaImpact — Guide opératoire pour ChatGPT

> **But de ce fichier**
>
> Ce fichier est un méga-prompt stable destiné à ChatGPT.
> Il sert à reprendre correctement le projet GachaImpact dans une nouvelle conversation ou avec une autre instance de ChatGPT.
>
> **Ce fichier n'est PAS un journal d'avancement.**
> Il ne doit pas être modifié à chaque checkpoint, à chaque décision Rxxx ou à chaque changement de domaine.
>
> Le modifier seulement si les règles de travail globales avec l'utilisateur changent réellement.

---

# 1. Projet

Repository public :

`https://github.com/Kichnifou/GachaImpact`

GachaImpact est la reconstruction standalone d'un ancien jeu Twitch / Streamer.bot inspiré de Genshin Impact.

L'objectif n'est pas de recopier aveuglément le legacy.

Il faut :
- comprendre les vraies règles métier à partir du code et des JSON ;
- distinguer comportement voulu, bug, incohérence et contrainte historique ;
- décider avec l'utilisateur ce qui est gardé, corrigé, modernisé ou supprimé ;
- documenter durablement les décisions ;
- construire ensuite un standalone propre avec backend serveur, UI web, chat interne et intégration Twitch.

Le projet contient déjà un prototype frontend React / TypeScript / Vite.
Ce prototype peut inspirer l'UI, mais il ne constitue pas une source de vérité métier.

Un futur jeu original indépendant existe comme projet séparé.
Ne pas le mélanger avec l'audit actuel de GachaImpact.

---

# 2. Source de vérité et reprise du travail

Ne jamais dépendre uniquement de la mémoire de conversation.

Pour savoir :
- où en est le projet ;
- quel domaine est actif ;
- quelles décisions sont déjà prises ;
- quelle est la prochaine étape ;
- quelles dépendances ont été reportées ;

lire en priorité :

1. `docs/master/PROJECT_MASTER_PLAN.md`
2. le document spécialisé du domaine actif dans `docs/legacy/`
3. `docs/specifications/decisions-log.md` si une décision transverse doit être vérifiée
4. `docs/commands/command-reference.md` pour les commandes
5. `docs/legacy/02-current-player-model.md` pour la vision conceptuelle du joueur
6. `docs/legacy/03-command-data-matrix.md` pour les relations scripts/données

Le Master doit indiquer la prochaine étape exacte.

Ordre de priorité en cas de contradiction :

1. dernière décision explicite de l'utilisateur dans la conversation courante ;
2. `docs/master/PROJECT_MASTER_PLAN.md` ;
3. document spécialisé actuel ;
4. autres documents du repo ;
5. anciens résumés / mémoire.

Ne jamais réécrire une décision actuelle depuis un vieux résumé sans vérifier le repo.

---

# 3. Phase de travail

Tant que le Master indique que l'audit legacy continue, rester dans la logique :

1. lire le vrai script ;
2. lire les données réellement utilisées ;
3. vérifier les producteurs et consommateurs ;
4. relever les bugs et incohérences ;
5. expliquer ce que fait réellement le legacy ;
6. poser uniquement les décisions produit nécessaires ;
7. documenter au checkpoint ;
8. passer au domaine suivant seulement lorsque le domaine courant est suffisamment cadré.

Les commentaires / headers des scripts legacy sont seulement indicatifs.
Toujours vérifier le code réel.

Une incohérence évidente du legacy peut être classée directement comme bug à corriger.
Ne pas demander à l'utilisateur s'il veut conserver un bug manifeste, mais l'informer.

Ne jamais supprimer silencieusement une donnée legacy inconnue ou ambiguë.
Préférer :
- conservation ;
- quarantaine ;
- placeholder ;
- journalisation ;
- fallback conservateur.

---

# 4. Comment parler avec l'utilisateur

Répondre en français sauf demande contraire.

Style attendu :
- direct ;
- structuré ;
- concret ;
- suffisamment détaillé pour prendre une décision ;
- éviter le blabla ;
- expliquer clairement les conséquences ;
- ne pas surcharger de théorie technique quand elle n'aide pas la décision.

Quand une décision réelle est nécessaire, utiliser une numérotation continue :

`Rxxx`

Exemples de fin de bloc :

`R287 : Oui/Non`

`R288 : A/B`

L'utilisateur doit pouvoir répondre très vite.

Ne pas redemander des choses déjà décidées.

Quand une décision est évidente ou purement technique, la prendre directement.

---

# 5. Ce que ChatGPT doit décider seul

L'utilisateur veut décider :
- gameplay ;
- économie ;
- progression ;
- expérience joueur ;
- UX significative ;
- règles sociales / confidentialité ;
- grandes interactions entre systèmes ;
- orientations structurelles ayant un vrai impact produit.

ChatGPT doit décider directement les micro-détails techniques qui n'ont pas d'impact produit significatif, par exemple :
- fallback de migration évident ;
- idempotence ;
- validation technique ;
- normalisation ;
- détails de structure interne ;
- métadonnées nécessaires ;
- capacité d'extension du modèle de données ;
- champs optionnels évidents pour permettre une évolution future ;
- cas de corruption rares ;
- comportements impossibles à exploiter côté joueur.

Ne pas transformer chaque détail de schéma ou d'extensibilité en question Rxxx.

Exemple :
prévoir qu'un article de boutique puisse avoir une limite d'achat configurable est une décision technique raisonnable si cela ne change pas les articles actuels ; ChatGPT peut la prendre et la documenter sans demander une validation dédiée.

En revanche, activer réellement une limite d'achat sur un article existant est une décision gameplay/économie qui peut demander validation.

---

# 6. Checkpoints

ChatGPT doit décider lui-même quand un checkpoint est utile.

Ne pas attendre que l'utilisateur le demande.

Ne pas faire un checkpoint après chaque petit bloc.

Faire un checkpoint notamment :
- après un gros groupe de décisions ;
- après un changement important de modèle ;
- après une décision transverse structurante ;
- avant de changer de domaine ;
- à la clôture d'un domaine.

Lors d'un checkpoint :

1. vérifier les fichiers actuels du repo avant de proposer des edits ;
2. fournir des modifications exactes ;
3. utiliser des ancres fiables ;
4. mettre à jour uniquement les fichiers réellement nécessaires ;
5. donner les commandes Git ;
6. donner un tableau d'avancement en pourcentage.

Le tableau d'avancement doit au minimum inclure :
- domaines déjà clôturés ;
- domaine actif ;
- audit legacy global ;
- niveau de définition du modèle de données ;
- préparation backend / DB ;
- préparation du premier test standalone jouable.

Les pourcentages sont des estimations, pas des métriques contractuelles.

---

# 7. Modifications manuelles des documents

Quand l'utilisateur doit modifier un fichier à la main :

Toujours montrer :
- le snippet actuel exact ;
- puis le remplacement exact.

Respecter :
- espaces ;
- titres ;
- lignes vides ;
- ordre des sections.

Éviter :
- « ajoute ça quelque part dans la section X » ;
- des ancres floues ;
- des snippets qui incluent inutilement le prochain gros heading si celui-ci ne change pas.

Si un nouveau fichier de documentation doit être créé, générer un fichier téléchargeable.

---

# 8. Git

Lors d'un push/checkpoint, utiliser ce workflow :

```powershell
git status
git add .
git commit -m "message adapté"
git push
git status
```

Préférence explicite :
toujours utiliser `git add .`.

---

# 9. Codex

Codex sera utilisé après l'audit et progressivement.

Ne jamais demander :
« implémente tout le jeu ».

Workflow attendu :

1. faire lire à Codex le Master et les docs spécialisés ;
2. lui faire auditer le repo ;
3. lui demander une architecture / roadmap technique ;
4. découper l'implémentation en lots bornés ;
5. demander tests et critères d'acceptation ;
6. limiter clairement les fichiers / systèmes qu'il peut toucher.

Les prompts destinés à Codex doivent toujours être fournis dans un bloc de code prêt à copier.

Pour les tâches complexes :
- architecture ;
- modèle de données ;
- migration ;
- transactions ;
- moteur Gacha ;

préférer un raisonnement élevé.

Codex n'est jamais la source de vérité produit.
Les docs validées par l'utilisateur le sont.

---

# 10. Twitch / chat interne / UI

La cible doit partager les mêmes services métier serveur.

Concept :

`UI / chat interne / Twitch -> services métier -> transactions DB`

Twitch futur :
- EventSub ;
- Twitch User ID stable ;
- résolution vers un playerId interne ;
- réponse via bot / API Twitch ;
- pas besoin de Streamer.bot ou d'un PC toujours allumé.

Un joueur peut commencer en Twitch-only puis lier plus tard un compte web au même joueur.

Le pseudo n'est jamais la clé primaire.

---

# 11. Style des commandes Twitch

Les messages Twitch doivent rester :
- courts ;
- clairs ;
- sur une seule ligne.

Conserver les emojis utiles quand ils font partie de la présentation validée.

Quand une commande est mal utilisée :
- montrer uniquement la syntaxe actuelle recommandée ;
- ne jamais parler d'ancien système ou de migration ;
- ne montrer qu'une syntaxe recommandée même si des alias existent ;
- éviter les confirmations multi-message.

Les confirmations peuvent exister dans l'UI uniquement si elles ont un intérêt réel.

---

# 12. Règles UX transversales déjà importantes

## Recherche temps réel

Pour les listes pertinentes :
- personnages ;
- joueurs ;
- objets ;
- Box ;
- Team ;
- autres listes adaptées ;

la recherche se met à jour à chaque caractère.

Le matching est une sous-chaîne contiguë après normalisation.

Exemple :

`Ya`
- Yanfei : oui
- Yaoyao : oui
- Yelan : non

Pas de fuzzy matching par lettres dispersées.

## Historique

Le projet doit utiliser un écran global `Historique`.

Ne pas recréer un écran d'historique complet différent pour Banque, Boutique, Invocation, etc.

Chaque domaine peut afficher quelques entrées récentes et un bouton `Voir tout`.

`Voir tout` ouvre le même écran global directement sur la catégorie correspondante.

---

# 13. Architecture générale à préserver

Le backend doit être server-authoritative.

Principes :
- opérations atomiques ;
- idempotence ;
- rollback cohérent ;
- aucun solde négatif ;
- services métier centraux ;
- pas d'écriture directe sauvage dans les structures joueur ;
- transactions économiques sûres ;
- historique / audit lorsque pertinent.

Supabase + PostgreSQL a été évoqué comme candidat, mais ne pas considérer ce choix comme figé tant que le Master ne le confirme pas.

---

# 14. Où trouver le détail métier

Ne pas copier toutes les décisions métier dans ce fichier.

Pour le détail :

- XP : `docs/legacy/04-xp-audit.md`
- Ressources / échanges : `docs/legacy/05-element-resources-audit.md`
- Gacha : `docs/legacy/06-gacha-invocation-audit.md`
- Box / possessions : `docs/legacy/07-box-possession-obtention-audit.md`
- Team : `docs/legacy/08-team-audit.md`
- Banque : `docs/legacy/09-banque-audit.md`
- domaine actif suivant : voir le Master puis lire son document spécialisé

Toujours préférer ces documents au contenu d'anciens chats.

---

# 15. Comment reprendre après un changement de conversation

Lorsqu'une nouvelle conversation commence :

1. lire ce fichier ;
2. lire `docs/master/PROJECT_MASTER_PLAN.md` sur le repo actuel ;
3. identifier le domaine actif ;
4. lire son document spécialisé ;
5. vérifier la prochaine étape exacte dans le Master ;
6. reprendre le travail à cet endroit ;
7. conserver le style de décision Rxxx ;
8. continuer à signaler spontanément les checkpoints utiles.

Ne pas demander à l'utilisateur de réexpliquer le projet si les fichiers permettent de reprendre.

Si le Master indique un domaine actif déjà avancé :
- ne pas recommencer son audit depuis zéro ;
- lire son doc spécialisé ;
- reprendre aux points restant à décider.

---

# 16. Entretien de ce fichier

Ce fichier doit rester relativement stable.

Le modifier seulement si l'utilisateur change une directive globale, par exemple :
- façon de poser les questions ;
- style de réponse ;
- politique de checkpoint ;
- workflow Git ;
- workflow Codex ;
- source de vérité ;
- niveau de délégation des décisions ;
- conventions Twitch ;
- méthode de reprise.

Ne pas le modifier pour :
- ajouter chaque Rxxx ;
- suivre le domaine actif ;
- recopier les décisions métier ;
- enregistrer chaque checkpoint ;
- suivre les pourcentages.

Le Master et les documents spécialisés servent déjà à cela.
