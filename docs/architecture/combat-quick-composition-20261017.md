# Combat Entraînement — composition rapide

Mandat du17/10/2026, sous-lot indépendant de R1111 ; aucun changement Boss, Teams ou Profil. État au Master.

## Choix transactionnel autorisé

Quatre mutations indépendantes peuvent laisser une formation partielle ; utiliser une Team violerait l’indépendance demandée. Une opération dédiée remplace les quatre slots sous verrou Player existant, valide le snapshot ordonné (slots/mode/rencontre), puis écrit un reçu BusinessOperation existant lié au payload. Aucun nouveau modèle ou migration. Retry identique : lecture autoritaire sans réappliquer une ancienne formation ; clé réutilisée différemment refusée.

Quatre positions, UUID possédé actif ou null,0–4 caractères distincts ; KO nouveau interdit, KO existant conservable seulement à sa place. Confirmation MANUAL, y compris depuis AUTO. Aucun combat/récompense/Team/Boss modifié. Projection/chance serveur.

Sélecteur Équipe partagé, brouillon épinglé, retrait sans décalage et premier trou rempli, annulation sans mutation. Réponse ambiguë : même clé et brouillon figé pour retry. Conflit : recharger le snapshot tout en conservant le brouillon avant confirmation explicite.

Qualification : UI/API et PostgreSQL privé (atomicité/concurrence/KO/actif/possession/idempotence/indépendance), GameShell compilé et review indépendante du vrai SHA avant main. Aucun essai métier public.
