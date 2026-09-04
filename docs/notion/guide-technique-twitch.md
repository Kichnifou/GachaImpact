🛠️ GachaImpact — Documentation Technique Twitch

📘 Référence des commandes et mécaniques Twitch de GachaImpact

Cette documentation détaille les commandes disponibles, leurs syntaxes, conditions, coûts, limites, resets, probabilités, récompenses et comportements particuliers.

Pour une découverte progressive du jeu, utiliser plutôt le Guide de démarrage Twitch.

📌 Principes généraux
🌐 Une seule progression, plusieurs interfaces

Lorsqu'un joueur utilise également l'application GachaImpact, Twitch et le jeu standalone utilisent le même profil et les mêmes données.

Une action effectuée sur Twitch est donc immédiatement prise en compte dans GachaImpact.

Exemples :

un Pull Twitch modifie la même pity que dans l'application ;
une Roue effectuée sur Twitch est consommée dans l'application ;
une récompense quotidienne récupérée dans l'application ne peut pas être récupérée une seconde fois sur Twitch ;
un cœur envoyé depuis Twitch est également considéré comme envoyé dans l'application.
🕛 Heure serveur

Les resets journaliers utilisent :

00:00 — Europe/Paris

Les activités quotidiennes utilisent toutes cette même journée serveur, sauf mécanique explicitement fondée sur une durée réelle comme l'Expedition.

🔁 Protection contre les doubles actions

Toutes les opérations importantes doivent être protégées contre :

double envoi de commande ;
retry ;
double clic ;
action simultanée Twitch / application ;
événements Twitch reçus plusieurs fois.

Une même action valide ne doit jamais attribuer deux fois une récompense.

💬 Format des réponses Twitch

Les réponses Twitch doivent rester aussi compactes que possible.

Règles générales :

une seule ligne lorsque possible ;
ne pas envoyer plusieurs confirmations inutiles ;
en cas d'erreur, afficher directement la syntaxe recommandée ;
ne pas détailler les règles internes inutiles au joueur ;
ne pas envoyer de notification Twitch asynchrone à un joueur qui n'est plus présent.

Certaines réponses exceptionnellement longues peuvent être découpées lorsqu'une limite technique du chat l'impose.

⏰ Resets et limites temporelles
Système	Reset / durée
Récompense quotidienne	Tous les jours à 00:00
Roue	Tous les jours à 00:00
Combat quotidien	Tous les jours à 00:00
KO Combat	Tous les jours à 00:00
Cœurs d'amitié	Tous les jours à 00:00
Mission quotidienne	Tous les jours à 00:00
Switch de mission	Coût remis à zéro chaque jour
Nouveau départ Expedition	Tous les jours à 00:00
Expedition en cours	Durée réelle de 20 h
Attaque Boss	Tous les jours à 00:00
Boss	Nouveau Boss chaque mois
Faveur — claim	Une fois par journée active
Concours	Une participation/joueur/jour
Event — activités quotidiennes	Tous les jours à 00:00
Event	Nouvelle édition chaque mois
Vote Bannière	Une fois par rotation hebdomadaire
Giveaway	Une inscription par session
👤 Profil Twitch et progression
Création du profil

Un viewer Twitch peut être enregistré automatiquement lorsqu'il commence à parler dans le chat.

Ce profil Twitch peut exister avant qu'un compte standalone complet ne soit créé.

Les deux identités pourront ensuite être reliées sans recréer la progression.

💬 XP Twitch

Il n'existe aucune commande !xp.

L'XP Twitch est attribuée automatiquement à partir des messages normaux éligibles.

Longueur du message	XP
≤ 100 caractères	+1
101–200	+2
> 200	+3
Cooldown

2 secondes

Le cooldown appartient au joueur.

Si Twitch et le chat GachaImpact sont reliés au même joueur, ils partagent ce cooldown.

Messages comptabilisés

Un vrai message joueur augmente le compteur global de messages.

Une commande !xxx :

compte comme message global ;
ne donne pas d'XP ;
n'augmente pas le compteur de messages ayant donné de l'XP.

Les réponses du bot et messages système ne comptent jamais comme messages du joueur.

📈 Niveaux

Le niveau est calculé depuis l'XP.

Progression

30 XP = 1 palier de niveau

Niveau maximum affiché

100

Après le niveau 100, l'XP continue cependant à progresser et permet d'obtenir de nouveaux paliers de récompense.

🎁 Récompense de niveau

Pour chaque niveau franchi :

💎 +800 Primogemmes

🪙 +10 000 Moras

À partir du niveau 5 :

✨ +80 particules de l'élément personnel

À partir du niveau 10 :

✨ +40 particules d'un autre élément aléatoire

Si plusieurs niveaux sont franchis en une seule opération, chaque niveau traversé donne sa récompense.

🌈 !element

Permet de choisir l'élément personnel du joueur.

Syntaxe

!element pyro

!element hydro

!element cryo

!element electro

!element anemo

!element geo

!element dendro

Préconditions
profil existant ;
aucun élément déjà sélectionné.
Coût

Aucun.

Cooldown

Aucun.

Comportement

Le choix est permanent.

L'élément détermine notamment :

les particules personnelles ;
la conversion ;
les échanges ;
certaines récompenses ;
différentes mécaniques liées au compte.

Une tentative de changement après le choix doit être refusée.

🎁 Récompense quotidienne générale

Cette récompense ne possède pas de commande Twitch dédiée.

Elle est récupérée automatiquement lors du premier message normal éligible de la journée.

Préconditions Twitch
profil activé ;
élément personnel choisi ;
récompense pas encore récupérée aujourd'hui.
Récompense

💎 +160 Primogemmes

✨ +160 particules personnelles

🪙 +10 000 Moras

Reset

Tous les jours à 00:00 Europe/Paris.

Règles
un seul claim par jour, tous canaux confondus ;
aucune accumulation ;
un jour manqué est perdu ;
une récupération faite dans l'application empêche automatiquement le claim Twitch du même jour.
🆘 !help

Commande centrale d'aide.

Syntaxes

!help

!help <categorie>

!help <commande>

Catégories

progression

gacha

ressources

collection

equipe

activites

social

events

classements

twitch

Exemples

!help gacha

!help ressources

!help pull

!help combat

Coût

Aucun.

Cooldown

Aucun.

Comportement

Lorsqu'un terme correspond à une vraie commande, l'aide de cette commande est prioritaire.

Exemple :

!help box

affiche l'aide de !box.

Les commandes administratives ne sont pas affichées dans l'aide joueur normale.

❌ Il n'existe pas de commande canonique !xp, !gift ou !subscription.

✨ Gacha / Invocation
🌠 !banniere

Affiche la bannière actuellement active.

Syntaxe

!banniere

Coût

Aucun.

Contenu

La bannière hebdomadaire contient :

4 personnages 5★
6 personnages 4★

La réponse Twitch affiche également la cible 5★ personnelle lorsqu'elle existe.

🎯 !select

Sélectionne le personnage 5★ ciblé.

Syntaxes

!select

!select <personnage>

Préconditions
profil valide ;
bannière active ;
personnage demandé présent parmi les 5★ de la bannière.
Coût

Aucun.

Cooldown

Aucun.

Comportement

La cible peut être changée librement pendant la bannière.

Changer de cible :

ne reset pas la pity ;
ne reset pas la garantie ;
ne reset pas la Capture.

La cible est remise à zéro lorsqu'une nouvelle bannière commence.

🗳️ !vote

Permet d'influencer une future bannière.

Syntaxes

!vote

!vote <personnage>

Préconditions

Le personnage doit :

être 5★ ;
être éligible au vote ;
ne pas déjà faire partie de la bannière actuelle.

Le joueur ne doit pas avoir déjà voté pendant la rotation.

Limite

1 vote par joueur et par semaine/rotation

Tous les canaux partagent le même vote.

Coût

Aucun.

Modification

Le vote est définitif une fois enregistré.

📈 !pity

Affiche l'état personnel de l'Invocation.

Syntaxe

!pity

Contenu
pity 5★ ;
pity 4★ ;
garantie 5★ ;
Capture de brillance.

Le streak de défaites 50/50 existe techniquement mais n'est pas affiché dans la réponse normale de !pity.

Coût

Aucun.

🌠 !pull

Effectue des invocations.

Syntaxes

!pull

!pull <1..10>

Exemples :

!pull

!pull 5

!pull 10

Coût

💎 160 Primogemmes par Pull

Pulls	Coût
1	160
5	800
10	1 600

Le coût complet doit être disponible avant le lancement.

Un !pull 10 exige donc 1 600 Primogemmes avant tout remboursement obtenu pendant les dix résultats.

Maximum

10 Pulls par commande

⭐ Probabilité 5★

Jusqu'à la pity 73 :

0,6 %

À partir de la pity 74 :

Soft Pity

Hard Pity :

5★ garanti au plus tard au 90e Pull

⭐ Probabilité 4★

Jusqu'à la pity 8 :

1,5 %

Au 9e :

19,5 %

Au 10e :

4★ garanti

Si un jet 5★ et un jet 4★ réussissent simultanément :

le 5★ est prioritaire et la pity 4★ reste conservée.

🎯 50/50

Lorsqu'un 5★ apparaît sans garantie :

Victoire

Le joueur obtient sa cible actuelle.

Défaite

Il obtient uniformément l'un des 3 autres 5★ de la bannière.

Après une défaite :

le prochain 5★ est garanti comme étant la cible actuelle.

✨ Capture de brillance

La Capture possède une progression de :

0 à 3

Défaite 50/50

+1

Victoire 50/50

-1

minimum 0.

Lorsque la Capture atteint son déclenchement, elle garantit le personnage ciblé puis revient à 0.

🎁 Récompense secondaire d'un Pull

Lorsqu'aucun personnage correspondant n'est obtenu dans la résolution secondaire :

50 %

🪙 5 000 à 15 000 Moras

50 %

✨ 20 à 80 particules

d'un élément aléatoire.

🌈 Passifs de Team appliqués aux Pulls

Seuls les personnages de la Team active comptent.

Maximum :

2 stacks par élément

Plusieurs passifs de différents éléments peuvent se déclencher sur le même Pull.

Élément	1 stack	2 stacks
🔥 Pyro	×1,25 particules secondaires	×1,5
🪨 Geo	×1,25 Moras secondaires	×1,5
💧 Hydro	+0,3 point % de chance 5★	+0,6
❄️ Cryo	1/20 → +1 XP	1/10
⚡ Electro	1/30 → +2 pity 5★	1/20
🌪️ Anemo	1/12 → remboursement 80 Primogemmes	1/8
🌿 Dendro	1/25 → jackpot Dendro	1/15
Jackpot Dendro

💎 +40 Primogemmes
🪙 +1 000 Moras
✨ +5 particules de chacun des 7 éléments

Les passifs Pyro et Geo utilisent un arrondi à l'entier le plus proche, avec .5 arrondi vers le haut.

📦 Copies et constellations
Nombre de copies	Constellation
1	C0
2	C1
3	C2
4	C3
5	C4
6	C5
7	C6

Après C6, le compteur de copies continue à augmenter.

Doublon 4★ déjà C6

💎 +80 Primogemmes

Doublon 5★ déjà C6

💎 +160 Primogemmes

et progression du système Concours.

Si les statistiques Concours concernées sont déjà maximales, la compensation prévue par le système s'applique.

📦 Collection / Box
📦 !box

Affiche les personnages possédés.

Syntaxes principales

!box

!box 5

!box 4

!box 6

!box <element>

!box p1

!box favoris

!box favoris <personnage>

Filtres

!box 5

→ 5★

!box 4

→ 4★

!box 6

→ C6

Exemple élément :

!box cryo

Pagination

!box p1

!box p2

etc.

Chaque page contient jusqu'à 10 personnages.

Favoris

Afficher :

!box favoris

Ajouter ou retirer :

!box favoris <personnage>

Le nom du personnage doit correspondre exactement après normalisation casse/accents.

Tri

Les raccourcis suivants sont conservés :

!box a

!box d

!box c

!box e

Ils correspondent aux tris de Box existants :

alphabétique ;
date d'obtention ;
constellation ;
élément.

Répéter le même tri permet d'inverser son ordre ascendant/descendant.

🗓️ !obtention

Affiche la date de première obtention d'un personnage.

Syntaxe

!obtention <personnage>

Préconditions
personnage existant ;
personnage possédé.
Coût

Aucun.

La première date d'obtention ne change jamais après la première copie.

🌟 !stella

Utilise une Masterless Stella Fortuna.

Syntaxe

!stella <nom exact>

Préconditions
personnage possédé ;
personnage 5★ ;
Stella disponible.
Effet sous C6
copies +1
constellation +1

Si cette utilisation atteint C6, la progression Concours du personnage est initialisée.

Déjà C6
copies +1
progression Concours
Interdictions

Une Stella ne peut pas être utilisée sur un personnage 4★.

Si le 5★ C6 possède déjà toutes ses statistiques Concours au maximum :

l'utilisation est refusée avant consommation de la Stella.

Différence avec un doublon Pull

Une Stella :

ne donne pas de remboursement Primogemmes C6+ ;
compte comme copie synthétique ;
déclenche normalement la progression de constellation/Concours.
👥 Teams
👥 !team

Gère les Teams du joueur.

Consultation

!team

Voir une Team précise :

!team <N>

Activer une Team

!team <N> apply

La Team peut être partielle et contenir de 0 à 4 personnages.

Ajouter un personnage

!team add <personnage>

Le personnage est ajouté au premier emplacement libre de la Team active.

Retirer un personnage

!team remove <personnage>

Vider la Team active

!team remove all

La Team reste existante et active, mais sa composition devient vide.

Vider une autre Team

!team <N> remove

Sur Twitch, cette action vide la composition.

Elle ne supprime pas l'emplacement de Team.

Renommer

Team active :

!team rename "Nom"

Team précise :

!team <N> rename "Nom"

Nom

Maximum cible :

20 caractères

Espaces et accents autorisés.

Lister les Teams

!team list

Pagination :

!team list <page>

10 Teams par page

L'alias liste peut être accepté, mais list est la syntaxe recommandée.

Nouvelle Team

!team new

Crée la prochaine Team disponible.

La nouvelle Team :

est vide ;
n'est pas automatiquement activée.
Contraintes
4 personnages maximum ;
aucun doublon dans une Team ;
uniquement des personnages possédés et actifs ;
deux Teams complètes de composition identique sont interdites, indépendamment de l'ordre des personnages.
🌈 !passifs

Affiche les règles générales des passifs élémentaires.

Syntaxe

!passifs

Données joueur nécessaires

Aucune.

Coût

Aucun.

La commande explique les passifs disponibles.

Les passifs réellement actifs sont déterminés depuis la Team active.

🎒 Ressources
🎒 !sac

Affiche les ressources personnelles.

Syntaxe

!sac

Contenu
Primogemmes ;
nombre d'invocations possibles ;
Moras du portefeuille ;
particules des 7 éléments ;
objets spéciaux persistants.

Les particules correspondant à l'élément personnel sont affichées en priorité.

Invocations possibles

Calcul :

floor(Primogemmes / 160)

Consultation d'un autre joueur

Non.

Il n'existe pas de :

!sac <pseudo>

🧰 !coffre

Affiche les objets de Collection possédés.

Syntaxe

!coffre

Affichage
objets possédés uniquement ;
quantité ;
tri alphabétique.

Le Coffre est distinct de la Box de personnages.

✨ !convertir

Convertit les particules personnelles en Primogemmes.

Syntaxe

!convertir <montant>

Préconditions
élément choisi ;
montant entier ≥ 1 ;
stock suffisant.
Taux

✨ 1 particule personnelle

=

💎 1 Primogemme

Cooldown

Aucun.

Limite

Uniquement le stock réellement disponible.

🔄 !echanger

Permet d'échanger des particules entre joueurs de différents éléments.

Syntaxes

!echanger

!echanger <pseudo>

!echanger <pseudo> <montant>

!echanger liste

!echanger accepter

!echanger accepter <pseudo>

!echanger annuler

!echanger annuler <pseudo>

Préconditions
les deux joueurs existent ;
chacun possède un élément ;
joueurs différents ;
éléments différents ;
aucune autre demande active entre cette paire ;
montant réalisable.
Principe

L'échange est toujours :

X contre X

Chaque joueur donne à l'autre les particules correspondant à son élément personnel.

!echanger <pseudo>

Sans montant explicite :

raccourci MAX

Le système utilise le maximum actuellement échangeable.

Réservation

Lors de la création :

le stock de l'expéditeur est réservé ;
le stock du destinataire est vérifié mais reste libre.

Si le destinataire dépense ensuite une partie de son stock :

le montant de la demande peut automatiquement diminuer.

Il ne remonte jamais automatiquement ensuite.

À 0 :

la demande disparaît.

!echanger accepter

Sans pseudo :

accepte toutes les demandes reçues, de la plus ancienne à la plus récente.

Chaque demande est revalidée avant exécution.

Expiration

Toutes les demandes encore ouvertes expirent au reset :

00:00 Europe/Paris

🏦 Banque
🏦 !banque

Gère les Moras placées en Banque.

Consulter

!banque

Déposer

!banque deposer <montant>

ou

!banque deposer max

Retirer

!banque retirer <montant>

ou

!banque retirer max

Montants acceptés
entier positif ;
ou max.

Pas de :

10k
2m
décimales.
Frais

Aucun.

Plafond

Aucun.

Cooldown

Aucun.

💰 Intérêt bancaire

Taux :

3 % par jour

Calcul :

00:00 Europe/Paris

Base :

solde présent dans la Banque exactement au moment du reset.

Arrondi :

entier inférieur.

Les intérêts continuent même lorsque le joueur est absent.

Ils sont directement crédités sur le solde Banque.

🛒 Boutique
🛒 !shop

Affiche et utilise la Boutique.

Consultation

!shop

Pagination :

!shop <page>

Lorsque nécessaire :

5 articles par page

💎 Achat de Primogemmes
Syntaxes

!shop primos <quantite>

!shop primos max

Prix d'un lot

🪙 50 000 Moras

Récompense

💎 160 Primogemmes

Plusieurs lots peuvent être achetés dans une même action.

max achète le nombre maximal de lots possible.

🎟️ Ticket
Syntaxe

!shop ticket

Prix

🪙 150 000 Moras

Fonctionnement

Le Ticket est :

acheté ;
consommé ;
tiré immédiatement.

Aucune confirmation intermédiaire.

Un Ticket est utilisé à la fois.

🎲 Probabilités du Ticket

Les 5 récompenses initiales possèdent un poids identique.

Donc :

20 % chacune.

Probabilité	Récompense
20 %	💎 +1 600 Primogemmes
20 %	✨ +1 000 particules personnelles
20 %	✨ +800 particules d'un autre élément aléatoire
20 %	⭐ +10 pity 5★
20 %	🪙 +50 000 Moras
Bonus pity

Le +10 passe par le moteur Gacha.

La pity reste plafonnée à :

90

📜 Mission quotidienne Boutique
Achat

!shop mission

Prix

🪙 10 000 Moras

Limite

Une mission quotidienne active maximum.

Récompense

💎 +800 Primogemmes

Pool initial

Trois objectifs de même poids :

Objectif	Valeur
Messages éligibles	10
Pulls	5
Particules converties	320

La progression commence uniquement après l'attribution de la mission.

🔄 Switch de mission
Syntaxe

!shop switch

Première utilisation du jour

🪙 20 000 Moras

Chaque switch supplémentaire double le coût.

Exemple :

20 000 → 40 000 → 80 000 → 160 000…

Conditions
mission actuelle incomplète ;
au moins une autre mission active disponible ;
nouvelle mission obligatoirement différente.
Effet

La progression de la mission précédente est perdue et la nouvelle repart à 0.

Reset du coût :

00:00 Europe/Paris

📜 !mission

Affiche les Missions.

Syntaxes

!mission

!mission B

!mission A

!mission S

!mission Z

Alias accepté :

!mission resume

mais non recommandé dans l'aide.

Missions permanentes

Les missions permanentes :

sont activées automatiquement ;
ne doivent pas être acceptées ;
ne peuvent pas être abandonnées ;
progressent au fil du gameplay ;
donnent automatiquement leur récompense à la complétion.

Progression :

B → A → S

Rang Z

Le rang Z se débloque après complétion des B/A/S nécessaires.

Avant le déblocage :

intitulés cachés ;
objectifs cachés ;
récompenses cachées.

Lors du déblocage, les objectifs déjà satisfaits grâce aux statistiques historiques du joueur peuvent immédiatement être validés.

📋 Quotidiennes
📋 !quotis

Affiche le résumé dynamique des activités du jour.

Syntaxe

!quotis

Coût

Aucun.

Mutation

Aucune.

La commande lit simplement les états des autres systèmes.

Elle peut notamment représenter :

Roue ;
Combat ;
Expedition ;
cœur Ami ;
Event ;
Shop / Mission ;
autres activités quotidiennes actives.

!quotis n'est pas la mission quotidienne payante.

🎡 Roue
🎡 !roue

Effectue la Roue quotidienne.

Syntaxe

!roue

Limite

1 fois par jour

Tous les canaux partagent cette limite.

Reset

00:00 Europe/Paris

🎲 Probabilités
Résultat	Probabilité	Récompense
Rien	2 %	—
Particules	70 %	+500
Moras	20 %	+50 000
Jackpot Primogemmes	8 %	+1 600

Pour les particules :

Pyro : 10 %
Hydro : 10 %
Cryo : 10 %
Electro : 10 %
Anemo : 10 %
Geo : 10 %
Dendro : 10 %

Total :

70 %

Résultat persistant

Le résultat du jour est conservé jusqu'au reset.

Retaper !roue après utilisation :

ne reroll pas ;
rappelle que la Roue est déjà consommée ;
restitue le résultat lorsqu'il est connu.
🧭 Expedition
🧭 !expedition
Syntaxes

!expedition

!expedition <personnage>

!expedition retour

Une commande avec le nom du personnage déjà envoyé peut également récupérer l'Expedition lorsqu'elle est prête.

Départ

!expedition <personnage>

Préconditions
personnage possédé ;
personnage actif ;
aucune Expedition non récupérée empêchant le départ ;
départ du jour encore disponible.
Durée

20 heures

Cette durée est indépendante du reset journalier.

Limite de départ

1 nouveau départ par journée serveur

Un reset à minuit n'annule jamais une Expedition déjà en cours.

Disponibilité du personnage

Le personnage envoyé reste utilisable dans :

Team ;
Combat ;
Boss ;
autres activités.
🎁 Récompense Expedition

Le tirage est effectué uniquement lors de la récupération.

Probabilité	Récompense
10 %	💎 +1 600 Primogemmes
30 %	✨ +800 particules personnelles
60 %	🪙 +30 000 Moras

Aucune récompense n'est déterminée ou versée au moment du départ.

⚔️ Combat quotidien
⚔️ !combat

Commande centrale du Combat.

Syntaxes quotidiennes

!combat

!combat info

!combat go

!combat auto

!combat elements

!combat help

👀 !combat

Affiche :

les 4 ennemis du jour ;
l'état personnel ;
les actions utiles.

L'équipe ennemie est la même pour tous les joueurs pendant la journée.

Reset :

00:00 Europe/Paris

ℹ️ !combat info

Simule en lecture seule le résultat attendu avec la Team active.

Aucune tentative n'est consommée.

La Team et les slots Combat ne sont pas modifiés.

⚔️ !combat go
Conditions

La Team active doit contenir exactement :

4 personnages valides

Ils doivent être :

distincts ;
possédés ;
actifs ;
non-KO.
Effet

La Team active est copiée dans les slots Combat.

La tentative démarre immédiatement en mode :

MANUAL

La Team active elle-même n'est jamais modifiée.

🤖 !combat auto

Sélectionne automatiquement les quatre meilleurs personnages disponibles.

Effet
calcule avec la même formule que le Combat réel ;
remplit les slots Combat ;
lance directement une tentative ;
tentative marquée AUTO.

Relancer plus tard manuellement cette même composition sans réutiliser Auto produit une tentative MANUAL.

🧮 Formule Combat

Base :

50 %

Bonus par personnage :

4★

+3

5★

+6

Constellation :

4★

+0,5 par constellation

5★

+1 par constellation

Relation élémentaire :

±4

Résultat final :

minimum 5 %

maximum 95 %

💀 KO

Après une défaite, les personnages concernés peuvent devenir KO pour le Combat quotidien.

Le KO :

ne concerne pas la Team générale ;
ne concerne pas le Boss ;
dure jusqu'au reset quotidien.
🎁 Victoire quotidienne

Première victoire :

💎 +800 Primogemmes

🪙 +20 000 Moras

Une victoire clôt l'activité quotidienne.

👹 Boss mensuel
Consultation

!combat boss

Attaque

!combat boss go

👀 !combat boss

Lorsque le Boss est vivant, affiche notamment :

nom ;
PV ;
résistance ;
disponibilité de l'attaque quotidienne ;
dégâts prévus de la Team active lorsqu'elle est valide.

Lecture seule.

⚔️ !combat boss go
Limite

1 attaque par joueur et par jour

Conditions
Boss vivant ;
Boss du mois actuel ;
attaque quotidienne disponible ;
Team active complète et valide.
Effet

La Team est copiée vers les slots Boss et les dégâts sont appliqués.

La composition et les constellations utilisées sont mémorisées pour cette attaque.

👹 Règles du Boss
Nouveau Boss

Premier jour du mois à :

00:00 Europe/Paris

Respawn

Aucun.

Une fois vaincu, le Boss reste vaincu jusqu'au mois suivant.

PV initiaux

Base historique :

1 500 000 PV

Le système adapte ensuite progressivement la difficulté en fonction des performances des mois précédents.

Variation mensuelle :

±15 %

arrondie aux 10 000 PV.

Résistance

Chaque Boss possède un élément de résistance.

Un personnage de cet élément inflige :

×0,5 dégâts

💥 Dégâts Boss
4★

500 + 150 × constellation

5★

1 000 + 650 × constellation

🎁 Récompense Boss

Une attaque valide ayant infligé plus de 0 dégât suffit pour devenir participant.

Si le Boss meurt :

💎 +16 000 Primogemmes

🪙 +500 000 Moras

pour chaque participant.

La récompense est distribuée automatiquement, même aux joueurs hors ligne.

Coup final

Honorifique.

Pas de bonus économique particulier.

📊 !combat stat
Syntaxe

!combat stat

Alias :

!combat stats

Contenu

Peut afficher notamment :

combats ;
victoires ;
victoires manuelles ;
défaites ;
dégâts Boss ;
attaques Boss ;
participations ;
Boss vaincus ;
coups finaux ;
meilleur coup ;
statistiques globales publiques pertinentes.
💖 Social / Amitié
💖 !ami

Commande centrale du système d'amitié.

Résumé

!ami

Liste

!ami liste

Pagination :

!ami liste <page>

Demandes

!ami demandes

!ami demandes <page>

Ajouter

!ami ajouter <pseudo>

Accepter

!ami accepter <pseudo>

Refuser

!ami refuser <pseudo>

Annuler sa demande

!ami annuler <pseudo>

Retirer un ami

!ami retirer <pseudo>

Une relation supprimée peut conserver sa progression afin de la restaurer si les joueurs redeviennent amis.

Consulter

!ami voir <pseudo>

Alias :

!ami <pseudo>

💖 Cœurs quotidiens

Individuel :

!ami coeur <pseudo>

Tous les cœurs disponibles :

!ami coeur all

Limite

1 cœur par ami, par sens et par jour

Un joueur A peut envoyer un cœur à B, et B peut également en envoyer un à A le même jour.

Récompense

Chaque cœur réussi donne :

💎 +5 Primogemmes à l'expéditeur

💎 +5 Primogemmes au destinataire

Niveau d'amitié

Niveau partagé.

Maximum :

1000

Le compteur historique total de cœurs peut continuer au-delà.

👤 !infos

Affiche un résumé public d'un joueur.

Syntaxe

!infos <pseudo>

Alias accepté :

!info <pseudo>

Cible personnelle :

me

ou

moi

Informations possibles

Selon confidentialité :

pseudo ;
niveau ;
élément ;
nombre de personnages ;
Team active ;
total Pulls ;
victoires Combat ;
relation d'amitié avec le demandeur.

Une donnée privée est simplement omise.

Elle n'est jamais remplacée par une fausse valeur 0.

👥 !liste

Permet de rechercher des joueurs par élément ou présence.

Par élément

!liste pyro

!liste cryo

etc.

Pagination :

!liste pyro 2

Ordre :

alphabétique

Présence

!liste online

Pagination :

!liste online 2

Marqueurs

🟢 En ligne

🟡 Absent

Les joueurs réellement hors ligne ne sont pas inclus.

Une présence privée n'est pas affichée.

🎉 Event mensuel
🎉 !event

Commande centrale de l'Event du mois.

Résumé

!event

Inscription

!event go

Ressources personnelles

!event sac

Boutique

!event boutique

Classement

!event top

Acheter des Primogemmes

!event primos <quantite>

!event primos max

Acheter des Moras

!event moras <quantite>

!event moras max

Collection

!event collection

Noël

!event calendrier

📝 Inscription Event

!event go

Récompense d'inscription :

+1 monnaie saisonnière

Une seule fois par édition mensuelle.

Une nouvelle inscription est nécessaire à chaque nouvel Event.

🎮 Jeu A

Commande thématique différente selon le mois.

Le !event du mois donne sa syntaxe.

Fonctionnement
jusqu'à 3 fenêtres personnelles quotidiennes ;
20 % de réussite par tentative ;
cooldown serveur : 3 secondes ;
une réussite maximale par jour.
🧩 Jeu B

Jeu coopératif global.

Combinaisons

32 possibilités

Tentatives

3 essais consommables par joueur et par jour

Une combinaison déjà testée par quelqu'un d'autre :

ne consomme pas d'essai.

Lorsqu'une solution est trouvée :

chaque participant éligible concerné reçoit :

+1 point

et

+1 monnaie Event

Le découvreur n'obtient pas de bonus économique supplémentaire.

💌 Jeu C

Interaction sociale quotidienne.

Commande thématique :

!event <commande> <pseudo> "message"

Limite

1 envoi réussi par jour

Récompense expéditeur

+1 point

+1 monnaie Event

Le destinataire peut consulter son message dans l'interface Event.

🎁 Bonus quotidien Event

Une fois par jour :

+1 monnaie Event

Il peut être récupéré via l'interface ou automatiquement par le premier message normal éligible.

Tous les canaux partagent le même claim.

🏅 Paliers Event

Progression automatique à :

10 points
20 points
30 points
40 points
50 points
60 points
70 points
80 points

Les récompenses correspondantes sont attribuées automatiquement.

🛒 Boutique Event
Primogemmes

1 monnaie Event = 160 Primogemmes

Moras

1 monnaie Event = 20 000 Moras

🎁 Collection Event

Prix :

80 monnaies Event

Limite :

une acquisition du même objet par édition annuelle

Le même objet saisonnier peut donc être acquis à nouveau lors d'une nouvelle année.

🎄 Calendrier de Noël

Commande :

!event calendrier

Disponible :

1er au 25 décembre

Pas de rattrapage.

Jours 1 à 24

Récompense :

1 à 5 monnaies Event

25 décembre

50 monnaies Event

Aucun point Event n'est donné par le calendrier.

🎟️ Codes cadeaux
🎟️ !code
Voir les Codes actifs

!code

Réclamer

!code <CODE>

Matching

Insensible à la casse.

Code ponctuel

1 claim par joueur

Code annuel

1 claim par joueur et par édition annuelle

Le même token peut donc redevenir réclamable l'année suivante.

Codes Festival

Les douze Codes annuels Festival conservent la récompense :

💎 +1 600 Primogemmes

🪙 +200 000 Moras

Condition particulière Twitch

Un profil Twitch déjà existant peut utiliser les Codes même s'il n'a pas encore choisi son élément.

🌟 Faveur de l'Astre
🌟 !faveur

Commande de consultation.

Syntaxes

!faveur

!faveur <pseudo>

Coût

Aucun.

Mutation

Aucune.

La commande elle-même ne réclame pas la récompense quotidienne.

🟣 Attribution par abonnement Twitch

La Faveur est alimentée par les événements d'abonnement Twitch compatibles.

Durée par attribution

+30 jours

Maximum

180 jours

Les jours passent selon le calendrier même si le joueur est absent.

Une attribution reçue aujourd'hui commence ses nouvelles journées à partir du lendemain.

💎 Bonus immédiat Subscription
Tier	Bonus
Tier 1	+1 600 Primogemmes
Tier 2	+4 800
Tier 3	+9 600

Lorsque le plafond de 180 jours empêche d'ajouter toute la durée prévue, une compensation supplémentaire est calculée sur les jours perdus.

🎁 Daily Faveur

Pendant chaque journée active où le joueur se manifeste :

💎 +800 Primogemmes

Une seule fois par jour.

Si le joueur ne se manifeste pas :

la journée de Faveur est quand même consommée ;
aucune récompense +800 n'est donnée.
🎁 Gift Sub

Lorsqu'un abonnement est offert :

la Faveur appartient au bénéficiaire ;
le gifter éligible reçoit également un bonus.

Bonus gifter :

💎 +1 600 Primogemmes par sub offert

🎁 Gift Suprême

Gift Suprême n'est pas une commande.

Il utilise une Custom Reward Twitch.

Coût

🟣 10 000 Points de chaîne

Saisie

Le viewer indique le pseudo du bénéficiaire.

Bénéficiaire

Doit être :

un joueur GachaImpact existant ;
avec élément personnel choisi.

Le gifter peut être un simple viewer qui ne joue pas lui-même.

Auto-ciblage

Autorisé.

Le viewer peut se choisir lui-même si son profil est éligible.

Récompense

✨ +1 600 particules de l'élément personnel du bénéficiaire

Succès

La redemption Twitch est :

FULFILLED

Échec

En cas de cible invalide ou d'échec métier :

CANCELED

Aucune récompense n'est donnée et Twitch peut rembourser les Points de chaîne.

Une redemption ne peut jamais distribuer deux fois son Gift.

🏅 Légendes
🏅 !legende

Affiche les personnages 5★ C6 et leur progression Concours.

Personnel

!legende

Autre joueur

!legende <joueur>

Personnage précis

!legende <joueur> <personnage>

Cible personnelle :

me

ou

moi

Informations

Peut afficher :

cinq statistiques Concours ;
titres ;
nombre de Concours ;
victoires ;
statistiques thématiques.

La consultation respecte les paramètres de confidentialité.

🎭 Concours
🎭 !concours

Activité multijoueur pour les personnages 5★ C6.

Résumé

!concours

Créer

!concours open <personnage>

Rejoindre

!concours rejoindre <personnage>

Spectateur

!concours spectateur

Quitter

!concours quitter

Ready

!concours pret

Lancer

!concours start

Annuler

!concours annuler

Action sûre

!concours basique

Action risquée

!concours risque

Soutenir

!concours soutenir <participant>

🎮 Lobby Concours

Nombre de places :

4

L'organisateur est lui-même participant.

Les places encore vides sont complétées par des bots au lancement.

Les bots occupent de vraies positions dans le classement.

⏳ Ready et lancement

Les humains doivent être Ready.

Le lancement est manuel par l'organisateur.

La participation quotidienne n'est consommée que lorsque le Concours démarre réellement.

🔄 Tours

Ordre :

aléatoire au lancement ;
puis fixe.

Timeout humain :

60 secondes

Sans action :

action basique automatique.

Après 3 tours consécutifs sans action humaine :

le joueur est remplacé par un bot.

🎲 Actions
Basique

Gain normal de points.

Risque

Trois résultats de même probabilité :

0 ;
valeur normale ;
valeur double.

Soit :

1/3 chacun

👀 Soutien

Après un round complet, un spectateur actif peut être sélectionné.

Temps :

30 secondes

Bonus possible :

+1 / +2 / +3 points

🏆 Victoire Concours

Premier participant atteignant ou dépassant :

50 points

🎁 Récompenses Concours
Rang	Récompense
1er	+800 Primogemmes
2e	+400
3e	+200

Les bots ne reçoivent jamais de récompense économique.

🏅 Titres Concours
Titre	Victoires
Bronze	1
Argent	3
Or	7
Platine	15

Titres honorifiques.

🏆 Classements globaux
🏆 !top
Aide

!top

Résumé personnel

!top me

Classement

!top <metrique>

La réponse Twitch affiche généralement :

Top 5

Si le joueur est classé mais se trouve hors Top 5, son rang personnel peut être ajouté.

Conditions d'éligibilité
profil existant ;
élément choisi ;
valeur > 0 ;
donnée concernée rendue publique.

Une statistique privée ou Amis uniquement n'occupe aucune position cachée dans le classement.

📊 Métriques principales
Progression

!top xp

!top niveau

!top messages

!top messages-xp

Gacha

!top pulls

!top taux5

!top 5stars

!top 4stars

!top pity

!top 5050

!top lose5050

Ressources

!top primos

!top moras

!top particles

!top pyro

!top hydro

!top cryo

!top electro

!top anemo

!top geo

!top dendro

Collection

!top box

!top c6

!top copies

Économie cumulée

!top primos-earned

!top primos-spent

!top moras-earned

!top moras-spent

Activité

!top combat

!top combat-manuel

!top expeditions

!top coeurs

🍀 Taux 5★

Syntaxe canonique :

!top taux5

Calcul :

nombre de 5★ / nombre total de Pulls × 100

Condition :

minimum 100 Pulls

Alias historique accepté :

!top luck

mais non recommandé dans l'aide.

💰 Classement Moras

La valeur utilisée est le patrimoine total :

Moras portefeuille + Moras Banque

Les deux informations nécessaires doivent être publiques.

👥 Ex æquo

Classement compétition.

Exemple :

1er, 1er, 3e

Les classements globaux sont purement honorifiques.

Aucune récompense n'est distribuée.

🎊 Giveaway Twitch
🎟️ !wish

Inscription au Giveaway ouvert.

Syntaxe

!wish

Préconditions
Giveaway ouvert ;
profil joueur existant ;
élément choisi.
Limite

1 inscription par joueur et par session

Coût

Aucun.

Récompense immédiate

Aucune.

!wish est une commande et ne compte donc pas dans le classement de messages du Giveaway.

📊 !giveaway stats

Consultation publique de la session.

Syntaxe

!giveaway stats

Disponible à tous.

🎁 Gagnant Giveaway

À la fermeture, un participant est choisi aléatoirement.

Récompense :

💎 +1 600 Primogemmes

💬 Classement du chat Giveaway

Pendant la session, les vrais messages Twitch sont comptés.

Exclus :

commandes !xxx ;
bot ;
système.
🎁 Récompenses messages
Rang	Récompense
🥇 1	+2 000 particules personnelles
🥈 2	+1 500
🥉 3	+1 000
4+ éligible	+500

Ex æquo :

classement compétition.

🔐 Administration Giveaway

Les commandes suivantes sont réservées aux rôles autorisés.

🟢 !giveaway open

Ouvre une nouvelle session.

Impossible si un Giveaway est déjà ouvert.

🔴 !giveaway close

Ferme le Giveaway.

Déclenche :

le tirage du gagnant ;
la récompense gagnant ;
le calcul du classement messages ;
les récompenses correspondantes.

La restitution Twitch utilise deux messages distincts :

résultat du tirage ;
classement chat.
🔄 !giveaway reroll

Disponible uniquement après fermeture.

Tire un nouveau gagnant.

L'ancien gagnant :

conserve sa récompense.

Le nouveau gagnant reçoit également :

💎 +1 600 Primogemmes

Chaque reroll est lui aussi protégé contre les doubles traitements.

👮 Administration Twitch / Modération

Les droits sensibles ne reposent jamais sur le simple pseudo écrit dans une commande.

Ils utilisent les rôles serveur :

Administrateur ;
Modérateur lorsque l'action le permet.

L'administrateur initial du projet dispose des droits nécessaires, puis d'autres comptes pourront être promus via le système de permissions.

Actions administratives sensibles

Les actions telles que :

correction de ressources ;
correction de personnages ;
gestion du catalogue ;
configuration de systèmes ;
administration Giveaway ;
gestion des Codes ;
corrections joueur ;

doivent être journalisées.

La majorité de ces actions seront effectuées depuis l'interface Admin GachaImpact plutôt que par commandes Twitch.

❌ Commandes qui n'existent volontairement pas
!xp

N'existe pas.

L'XP vient automatiquement des messages.

!gift

N'existe pas.

Gift Suprême utilise une Custom Reward Twitch.

!subscription

N'existe pas.

Les abonnements sont traités automatiquement via les événements Twitch.

📚 Index complet des commandes Twitch
Commande	Domaine
!help	Aide
!element	Progression
!quotis	Quotidiennes
!roue	Activités
!expedition	Activités
!combat	Combat
!banniere	Gacha
!select	Gacha
!vote	Gacha
!pity	Gacha
!pull	Gacha
!box	Collection
!obtention	Collection
!stella	Collection
!team	Équipe
!passifs	Équipe
!sac	Ressources
!coffre	Collection
!convertir	Ressources
!echanger	Ressources / Social
!banque	Ressources
!shop	Boutique
!mission	Missions
!ami	Social
!infos	Social
!liste	Social
!event	Event
!code	Codes cadeaux
!faveur	Twitch / Faveur
!legende	Concours
!concours	Concours
!top	Classements
!wish	Giveaway
!giveaway	Giveaway / Admin
📌 Mémo des principaux coûts
Action	Coût
1 Pull	160 Primogemmes
10 Pulls	1 600 Primogemmes
Boutique → 160 Primogemmes	50 000 Moras
Ticket	150 000 Moras
Mission quotidienne	10 000 Moras
Premier switch Mission	20 000 Moras
Collection Event	80 monnaies Event
Gift Suprême	10 000 Points Twitch
Conversion particules	1 particule = 1 Primogemme
Banque	Aucun frais
Échange	X particules contre X
🎁 Mémo des principales récompenses quotidiennes
Activité	Récompense
Récompense quotidienne	+160 Primogemmes +160 particules +10 000 Moras
Roue	Variable
Combat gagné	+800 Primogemmes +20 000 Moras
Expedition	Variable
Cœur	+5 Primogemmes aux deux joueurs
Mission quotidienne	+800 Primogemmes
Faveur active	+800 Primogemmes
Event Daily	+1 monnaie Event
Boss	+16 000 Primogemmes +500 000 Moras si vaincu et participation valide
⚠️ Règles Twitch importantes à retenir

Une action = une seule récompense, même si plusieurs canaux essaient de l'exécuter simultanément.

Tous les resets journaliers principaux utilisent 00:00 Europe/Paris.

Aucune notification Twitch asynchrone n'est envoyée à un joueur absent.

Les commandes Twitch et l'interface GachaImpact utilisent les mêmes règles serveur.

!help est la référence rapide côté chat ; cette page est la référence technique complète.

Il n'existe volontairement aucun !xp, !gift ou !subscription.