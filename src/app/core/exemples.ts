import { Candidature, Profil } from './models';
import { ajouterJours, aujourdhui } from './dates';

// Jeu de données de démo, utile pour présenter l'appli sans saisir 15 lignes à la main.
export function exemplesCandidatures(): Candidature[] {
  const auj = aujourdhui();
  const j = (n: number) => ajouterJours(auj, n);
  const base = (i: number, c: Partial<Candidature>): Candidature => ({
    id: 'demo' + i,
    entreprise: '',
    poste: '',
    contrat: 'Alternance',
    lieu: 'Paris',
    source: 'LinkedIn',
    lien: '',
    contact: '',
    statut: 'envoyee',
    dateCandidature: auj,
    dateRelance: '',
    dateEntretien: '',
    notes: '',
    creeLe: new Date().toISOString(),
    majLe: new Date().toISOString(),
    ...c,
  });

  return [
    base(1, { entreprise: 'Doctolib', poste: 'Développeur front-end Angular', statut: 'entretien', dateCandidature: j(-12), dateEntretien: j(3), contact: 'Julie M. (RH)', notes: 'Entretien technique avec le lead front. Revoir RxJS et les signals.' }),
    base(2, { entreprise: 'BNP Paribas', poste: 'Développeur Java / Spring', statut: 'envoyee', dateCandidature: j(-9), source: 'Site de l\'entreprise' }),
    base(3, { entreprise: 'Capgemini', poste: 'Développeur full-stack', statut: 'refus', dateCandidature: j(-30), source: 'Indeed', notes: 'Refus après test technique. Demander un retour.' }),
    base(4, { entreprise: 'Back Market', poste: 'Développeur web', contrat: 'Stage', statut: 'relancee', dateCandidature: j(-15), dateRelance: j(-1), source: 'Welcome to the Jungle' }),
    base(5, { entreprise: 'Orange', poste: 'Technicien support & réseau', statut: 'offre', dateCandidature: j(-40), lieu: 'Lyon', source: 'Réseau / école', notes: 'Proposition reçue, réponse attendue avant vendredi.' }),
    base(6, { entreprise: 'Alan', poste: 'Développeur TypeScript', statut: 'a_envoyer', dateCandidature: auj, source: 'Welcome to the Jungle', notes: 'Adapter la lettre : insister sur le projet de suivi de candidatures.' }),
    base(7, { entreprise: 'Sopra Steria', poste: 'Développeur .NET', statut: 'envoyee', dateCandidature: j(-3), lieu: 'Toulouse', source: 'Indeed' }),
    base(8, { entreprise: 'Decathlon Digital', poste: 'Développeur front-end', contrat: 'Stage', statut: 'entretien', dateCandidature: j(-20), dateEntretien: j(8), lieu: 'Lille', contact: 'Thomas B.' }),
    base(9, { entreprise: 'Atos', poste: 'Développeur Python', statut: 'refus', dateCandidature: j(-45), source: 'LinkedIn' }),
    base(10, { entreprise: 'Free', poste: 'Développeur web PHP', statut: 'envoyee', dateCandidature: j(-21), source: 'Candidature spontanée' }),
    base(11, { entreprise: 'Thales', poste: 'Développeur C++ embarqué', statut: 'envoyee', dateCandidature: j(-6), lieu: 'Rennes' }),
    base(12, { entreprise: 'Leboncoin', poste: 'Développeur mobile Flutter', statut: 'refus', dateCandidature: j(-25), source: 'Welcome to the Jungle' }),
  ];
}

export function exempleProfil(): Profil {
  return {
    prenom: 'Camille',
    nom: 'Martin',
    titre: 'Étudiante en BTS SIO option SLAM',
    email: 'camille.martin@exemple.fr',
    telephone: '06 12 34 56 78',
    ville: 'Paris',
    linkedin: 'linkedin.com/in/camille-martin',
    github: 'github.com/camille-martin',
    apropos: 'Passionnée par le développement web, je cherche une alternance pour progresser sur des projets concrets au sein d\'une équipe produit.',
    competences: 'Angular, TypeScript, Java, SQL, Git, HTML/CSS, Figma',
    langues: 'Français (natif), Anglais (B2)',
    formations: [
      { titre: 'BTS SIO option SLAM', lieu: 'Lycée Jean Jaurès, Paris', periode: '2025 – 2027', description: 'Développement d\'applications, bases de données, gestion de projet.' },
      { titre: 'Baccalauréat STI2D', lieu: 'Paris', periode: '2025', description: 'Mention bien.' },
    ],
    experiences: [
      { titre: 'Stage développeuse web', lieu: 'Agence Pixel, Paris', periode: 'Mai – juin 2026', description: 'Refonte du site vitrine d\'un client, intégration de maquettes Figma, mise en place d\'un formulaire de contact.' },
    ],
    projets: [
      { titre: 'Postulo', lieu: 'Projet personnel', periode: '2026', description: 'Application Angular de suivi de candidatures avec assistant IA (entretiens, lettres, CV).' },
    ],
  };
}
