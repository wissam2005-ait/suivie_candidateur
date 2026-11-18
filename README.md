# Postulo

Application web pour suivre ses candidatures de stage, d'alternance ou d'emploi, pensée pour les étudiants.

L'idée de départ : comme beaucoup d'étudiants, je suivais mes candidatures dans un fichier Excel. Au bout de 30 lignes, on ne sait plus qui relancer, on perd les liens des offres et on oublie ce qu'on a dit à qui. Postulo remplace ce fichier par un vrai outil, avec en plus un assistant IA pour préparer les entretiens et rédiger les documents.

## Fonctionnalités

- **Tableau de bord** : candidatures envoyées, taux de réponse, entretiens, offres, activité des 8 dernières semaines, répartition par statut.
- **Suivi des candidatures** : vue liste (recherche + filtres) et vue tableau type Kanban avec glisser-déposer pour changer le statut.
- **Relances** : une candidature sans réponse depuis 7 jours remonte automatiquement dans « À relancer ».
- **Import / export Excel** : import d'un fichier CSV exporté depuis Excel (les colonnes sont reconnues par leur nom), export au format Excel français.
- **Simulation d'entretien** : un recruteur virtuel mène un entretien complet en 6 étapes (présentation, motivation, question métier, question STAR, question piège, « avez-vous des questions ? »). Il relance quand la réponse est vague, note chaque réponse sur 10 et termine par un bilan sur 5 critères. On peut répondre à l'oral (micro) et le recruteur peut lire ses questions à voix haute.
- **Mon pitch** : prépare le discours de présentation pour 4 situations (« Présentez-vous », salon, appel à un recruteur, message LinkedIn), vérifie les points clés (preuve, chiffre, durée) et propose un entraînement à l'oral chronométré avec analyse du débit, des mots parasites et des idées oubliées.
- **CV au format ATS** : modèle optimisé pour les logiciels de tri (une colonne, police standard, intitulés classiques, pas de photo), analyse des mots-clés de l'offre avec score de correspondance, ajout en un clic des compétences manquantes, copie du CV en texte brut pour les formulaires en ligne.
- **CV et lettre de motivation** : 4 modèles assortis (ATS, Classique, Moderne, Épuré), 5 couleurs, 3 densités, aperçu A4 fidèle et export PDF d'une page. La lettre suit la mise en page française (expéditeur, destinataire, lieu et date, objet) et se modifie directement sur la page. Une liste de vérifications signale ce qui manque avant l'envoi (dépassement d'une page, nombre de mots, entreprise citée…).
- **Confort** : plan de route en 5 étapes sur le tableau de bord, profil enregistré automatiquement, thème sombre, animations réduites si le système le demande.

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
- **Mode hors ligne.** Si l'IA n'est pas configurée ou ne répond pas, l'appli bascule sur un moteur à base de règles : questions adaptées au métier (développement, data, réseau, commerce, gestion), relances, analyse des réponses (exemples concrets, chiffres, structure STAR, mots parasites). Tout reste utilisable.
- **Oral dans le navigateur.** La lecture des questions et la dictée utilisent l'API Web Speech (Chrome, Edge) : rien n'est envoyé à un serveur tiers par l'appli.

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
    hors-ligne.ts       moteur d'entretien et modèles sans IA
    oral.ts             synthèse vocale, dictée, analyse de l'oral
    exemples.ts         données de démo
  pages/
    tableau-de-bord.ts
    candidatures.ts
    entretien.ts
    pitch.ts
    documents/          page CV & lettres, modèles cv.ts et lettre.ts
    (core/ats.ts)       mots-clés de l'offre, score ATS, CV en texte brut
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
