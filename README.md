# Postulo

Application web pour suivre ses candidatures de stage, d'alternance ou d'emploi, pensée pour les étudiants.

L'idée de départ : comme beaucoup d'étudiants, je suivais mes candidatures dans un fichier Excel. Au bout de 30 lignes, on ne sait plus qui relancer, on perd les liens des offres et on oublie ce qu'on a dit à qui. Postulo remplace ce fichier par un vrai outil, avec en plus un assistant IA pour préparer les entretiens et rédiger les documents.

## Fonctionnalités

- **Tableau de bord** : candidatures envoyées, taux de réponse, entretiens, offres, activité des 8 dernières semaines, répartition par statut.
- **Suivi des candidatures** : vue liste (recherche + filtres) et vue tableau type Kanban avec glisser-déposer pour changer le statut.
- **Relances** : une candidature sans réponse depuis 7 jours remonte automatiquement dans « À relancer ».
- **Import / export Excel** : import d'un fichier CSV exporté depuis Excel (les colonnes sont reconnues par leur nom), export au format Excel français.
- **Simulation d'entretien** : un recruteur virtuel pose 5 questions adaptées au poste et à l'entreprise, commente chaque réponse puis donne un bilan et une note.
- **Lettre de motivation** générée à partir du profil et de l'offre, modifiable, exportable en PDF.
- **CV** mis en page automatiquement à partir du profil, avec une accroche adaptée à chaque offre, exportable en PDF.

## Stack technique

| Partie | Choix |
|---|---|
| Front | Angular 22 (composants standalone, signals, lazy loading des pages) |
| Données | `localStorage` du navigateur |
| IA | API Claude (Anthropic) appelée depuis une fonction serverless Vercel |
| Hébergement | Vercel |

Quelques choix que j'ai faits :

- **Pas de compte, pas de base distante.** Les candidatures sont des données personnelles : elles restent dans le navigateur de l'étudiant. L'export CSV sert de sauvegarde. Le service `Store` centralise tout l'accès aux données, donc passer à une vraie base (Supabase, Firebase…) ne toucherait qu'un seul fichier.
- **La clé API n'est jamais dans le front.** Le navigateur appelle `/api/assistant`, et c'est la fonction serverless qui parle à l'API Claude. Seul un résumé du profil est envoyé (pas d'e-mail ni de téléphone).
- **Mode hors ligne.** Si l'IA n'est pas configurée ou ne répond pas, l'appli bascule sur une banque de questions et des modèles de lettre. Tout reste utilisable.

## Structure

```
api/
  assistant.ts          fonction serverless (entretien, lettre, accroche)
src/app/
  core/
    models.ts           types Candidature, Profil, statuts
    store.ts            état de l'appli (signals) + persistance
    csv.ts              import / export Excel
    assistant.ts        appels à l'API + bascule hors ligne
    hors-ligne.ts       questions et modèles sans IA
    exemples.ts         données de démo
  pages/
    tableau-de-bord.ts
    candidatures.ts
    entretien.ts
    documents.ts        lettre de motivation + CV
    profil.ts
```

## Lancer le projet

```bash
npm install
npm start            # http://localhost:4200 (assistant en mode hors ligne)
```

Pour tester l'assistant IA en local, il faut la CLI Vercel (qui exécute aussi le dossier `api/`) :

```bash
cp .env.example .env.local   # puis renseigner ANTHROPIC_API_KEY
npx vercel dev
```

## Déploiement

Le projet est prêt pour Vercel (`vercel.json`) : importer le dépôt GitHub dans Vercel, puis ajouter la variable d'environnement `ANTHROPIC_API_KEY` dans les réglages du projet.

## Pistes d'amélioration

- Synchronisation entre appareils avec un compte (Supabase)
- Rappels de relance par e-mail
- Import direct des fichiers `.xlsx`
- Statistiques par source (LinkedIn, Indeed…) pour savoir où candidater
