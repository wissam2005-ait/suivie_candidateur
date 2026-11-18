import type { Cible, EtapeEntretien, Tour } from './assistant';
import { Profil } from './models';

// Mode sans IA : banque de questions + règles simples.
// Permet d'utiliser l'appli (et de la montrer) même sans clé API.

const NB_QUESTIONS = 5;

function questions(c: Cible): string[] {
  return [
    `Bonjour et merci d'être venu(e). Pour commencer, pouvez-vous vous présenter en deux minutes ?`,
    `Pourquoi avez-vous postulé chez ${c.entreprise}, et pas chez un de ses concurrents ?`,
    `Parlez-moi d'un projet dont vous êtes fier(e). Quel était votre rôle exact et quel a été le résultat ?`,
    `Le poste de ${c.poste} demande d'apprendre vite. Racontez-moi une fois où vous avez dû vous former seul(e) sur un sujet nouveau.`,
    `Décrivez une situation où vous avez été en désaccord avec un membre de votre équipe. Comment l'avez-vous gérée ?`,
    `Où vous voyez-vous dans deux ou trois ans ?`,
    `Quelle est, selon vous, votre principale faiblesse, et que faites-vous pour la corriger ?`,
  ];
}

function analyser(reponse: string): string {
  const mots = reponse.trim().split(/\s+/).filter(Boolean).length;
  const positifs: string[] = [];
  const conseils: string[] = [];

  if (mots < 25) conseils.push('Ta réponse est trop courte : développe avec un exemple concret.');
  else if (mots > 220) conseils.push('Ta réponse est longue : à l\'oral, vise 1 à 2 minutes et va à l\'essentiel.');
  else positifs.push('La longueur est adaptée à l\'oral.');

  if (/\d/.test(reponse)) positifs.push('Tu donnes des éléments chiffrés, c\'est convaincant.');
  else conseils.push('Ajoute un chiffre ou un résultat mesurable (délai, nombre d\'utilisateurs, note…).');

  if (/(par exemple|lors de|pendant mon|quand j'|j'ai (réalisé|développé|mis en place|géré|créé))/i.test(reponse))
    positifs.push('Tu t\'appuies sur une expérience réelle.');
  else conseils.push('Utilise la méthode STAR : Situation, Tâche, Action, Résultat.');

  if (/\bon\b/i.test(reponse) && !/\bj['e ]/i.test(reponse))
    conseils.push('Parle à la première personne (« j\'ai fait ») pour montrer ton rôle.');

  return [...positifs.slice(0, 2), ...conseils.slice(0, 2)].join(' ');
}

export function etapeEntretien(c: Cible, historique: Tour[]): EtapeEntretien {
  const posees = historique.filter((t) => t.role === 'recruteur').length;
  const derniere = [...historique].reverse().find((t) => t.role === 'candidat');
  const retour = derniere ? analyser(derniere.texte) : null;

  if (posees >= NB_QUESTIONS) {
    const reponses = historique.filter((t) => t.role === 'candidat');
    const moyenne = reponses.reduce((s, r) => s + r.texte.split(/\s+/).length, 0) / Math.max(reponses.length, 1);
    const note = Math.max(3, Math.min(9, Math.round(moyenne / 15) + (reponses.some((r) => /\d/.test(r.texte)) ? 2 : 0)));
    return {
      retour,
      question: null,
      note,
      bilan:
        `Entretien terminé. Réponses de ${Math.round(moyenne)} mots en moyenne. ` +
        `Avant le vrai entretien chez ${c.entreprise} : prépare 3 exemples concrets au format STAR, renseigne-toi sur leurs produits récents et prépare 2 questions à poser au recruteur.`,
    };
  }

  const banque = questions(c);
  return { retour, question: banque[posees] ?? banque[banque.length - 1], bilan: null, note: null };
}

export function lettre(p: Profil, c: Cible): string {
  const nom = [p.prenom, p.nom].filter(Boolean).join(' ') || '[Prénom Nom]';
  const exp = p.experiences[0];
  const projet = p.projets[0];
  const competences = p.competences.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 3).join(', ');

  return `Objet : candidature au poste de ${c.poste}

Madame, Monsieur,

${c.entreprise} est une entreprise que je suis depuis un moment, et l'offre de ${c.poste} correspond exactement à ce que je recherche${p.titre ? ` dans le cadre de mon parcours (${p.titre.toLowerCase()})` : ''}.

${exp ? `Lors de mon expérience « ${exp.titre} » chez ${exp.lieu}, ${exp.description.charAt(0).toLowerCase() + exp.description.slice(1)} ` : ''}${projet ? `J'ai aussi mené le projet ${projet.titre} : ${projet.description.charAt(0).toLowerCase() + projet.description.slice(1)} ` : ''}${competences ? `Ces expériences m'ont permis de pratiquer ${competences}.` : ''}

Ce qui me motive chez vous, c'est la possibilité d'apprendre au contact d'une équipe expérimentée tout en étant utile rapidement. Je serais ravi(e) d'échanger avec vous pour vous montrer ce que je peux apporter.

Je vous prie d'agréer, Madame, Monsieur, mes salutations distinguées.

${nom}`;
}

export function accroche(p: Profil, c: Cible): string {
  const competences = p.competences.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 3).join(', ');
  return `${p.titre || 'Étudiant(e)'}, je recherche un poste de ${c.poste}${c.entreprise ? ` chez ${c.entreprise}` : ''}. ${competences ? `À l'aise avec ${competences}, ` : ''}j'aime apprendre vite et livrer du concret.`;
}
