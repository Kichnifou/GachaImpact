# Anniversaires post-V1 — R1106

Mandat propriétaire du17/10/2026, lotF. État réel de review/promotion/migration/déploiement exclusivement au Master.

## Enregistrement et confidentialité

POST /api/v1/me/birthday : corps strict {day,month,confirmation:true}, identité authentifiée uniquement, pas de cible ni année acceptée. Date réelle validée sur une année bissextile de référence. Sous verrou Player de mutation, première écriture unique ; même date relue sans modifier registeredAt/curseur, toute autre date refusée BIRTHDAY_IMMUTABLE. Les comptes inactifs/récupérations non autoritaires ne mutent pas. L’API ne retourne que jour/mois.

BIRTHDAY est PRIVATE par défaut dans la politique version4, y compris amis ; seuls PUBLIC/PRIVATE sont sauvegardables (garde serveur et CHECK SQL). Aucun override ancien réinitialisé. Le profil serveur utilise Access PRIVATE ou ALLOWED(day/month|null) et n’effectue la lecture date que si autorisée ; annuaire, classements, identités, Chat/Twitch inchangés sans date. Pas d’âge/année ni log de corps de requête. R1108 : lien bleu discret sous l’avatar propre non renseigné, date discrète en lecture seule ensuite ; bloc sous Faveur retiré. Calendrier mois/jours sur référence2000 permettant29février, navigation clavier, aucune alerte irréversible dans ce premier dialogue. Confirmer ouvre un second dialogue avec avertissement, Retour et Confirmer définitivement ; seul ce dernier appelle le serveur. Pending/double-clic/erreur/retry et fermeture au changement de compte conservés ; paramètres de confidentialité existants.

## Attribution serveur

Le jour dépend uniquement d’Europe/Paris. Une occurrence avant la date d’enregistrement n’est pas un anniversaire manqué ; le jour même est éligible, aucune année antérieure. birthdayLastRewardYear est initialisé à l’année précédente si l’occurrence est aujourd’hui/future, sinon l’année courante. 29février devient28février seulement les années non bissextiles.

BirthdayScheduler réutilise le processus Railway existant : startup, minuit Paris, reprise15min, single-flight et arrêt attendu avant déconnexion DB. Lecture légère des Players ACTIVE enregistrés et encore dus, paginée100UUID ; aucune lecture navigateur/polling global/claim/présence/Twitch nécessaire. Erreur journalisée par code neutre, reprise au cycle suivant. Chaque année manquée est traitée atomiquement séparément, depuis le curseur durable, avec reprise après redémarrage.

Sous verrou Player commun, BirthdayService vérifie de nouveau ACTIVE puis preuve SYSTEM birthday.grant:Player:année. Crédit50000Primogemmes et200000Moras par PrismaEconomyService, deux ResourceMovement exacts, BusinessOperation COMPLETED, notification BIRTHDAY_REWARD unique et curseur annuel dans la même transaction. Le moteur Missions reste actif : un seuil réel de Moras peut produire une récompense Mission distincte, avec son propre reçu/notification, sans modifier les montants anniversaire. Pas de date personnelle dans les snapshots/payloads économiques (année d’attribution seulement).

Même clé annuelle après concurrence/retry/restart : pas de second crédit/notice ; une preuve déjàcomplétée permet de restaurer le curseur sans recréer ni réactiver une notice lue/archivée. Une preuve non complétée ou incohérente refuse. Aucun compte ARCHIVED/supprimé ne reçoit de nouveau gain ; SUSPENDED attend son retour ACTIVE. Erasure remet les quatre scalaires NULL avec les protections anti-restauration existantes.

## Schéma et qualification

Migration additive087 : quatre scalaires nullable Player, CHECK date complète/réelle et niveau BIRTHDAY, index partiel des candidats. Aucun nouveau service payant/table/FK/JSON, aucune population de date pour les vrais joueurs. Les migrations restent suivies par Prisma.

Fixtures privées et horloge injectable ; scénarios saisie/retry/concurrence, dates invalides/29février, minuit/DST, workers, rattrapage, rollback deuxième crédit, inactifs, confidentialité/DTO, corps strict et suppression effective. UI confirmation/pending/erreur/tiers, rendu compilé aux1920×1080,1366×768,390×844,390×600. [Preuve](evidence/post-v1-birthdays.json) et Master distinguent contrôles acquis, exclus, review et recette humaine. Aucun crédit ni naissance de QA sur compte réel.

Les copies de profil conservées dans les snapshots de commandes sont également traitées : account-deletion-scrub retire birthday par ID du Player présenté, y compris dans un reçu appartenant à un autre Player, sans toucher à sa propre date ni aux montants/années économiques. Les quatre scalaires Birthday sérialisés d’un Player supprimé sont neutralisés.
