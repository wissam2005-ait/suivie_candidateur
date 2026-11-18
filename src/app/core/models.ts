export type Statut = 'a_envoyer' | 'envoyee' | 'relancee' | 'entretien' | 'offre' | 'refus';

export type TypeContrat = 'Stage' | 'Alternance' | 'CDD' | 'CDI' | 'Job étudiant';

export interface Candidature {
  id: string;
  entreprise: string;
  poste: string;
  contrat: TypeContrat;
  lieu: string;
  source: string;
  lien: string;
  contact: string;
  statut: Statut;
  dateCandidature: string; // AAAA-MM-JJ
  dateRelance: string;
  dateEntretien: string;
  notes: string;
  creeLe: string;
  majLe: string;
}

export interface LigneParcours {
  titre: string;
  lieu: string;
  periode: string;
  description: string;
}

export interface Profil {
  prenom: string;
  nom: string;
  titre: string;
  email: string;
  telephone: string;
  ville: string;
  linkedin: string;
  github: string;
  apropos: string;
  competences: string;
  langues: string;
  interets: string;
  photo: string; // data URL, optionnelle
  formations: LigneParcours[];
  experiences: LigneParcours[];
  projets: LigneParcours[];
}

export const STATUTS: { id: Statut; label: string }[] = [
  { id: 'a_envoyer', label: 'À envoyer' },
  { id: 'envoyee', label: 'Envoyée' },
  { id: 'relancee', label: 'Relancée' },
  { id: 'entretien', label: 'Entretien' },
  { id: 'offre', label: 'Offre' },
  { id: 'refus', label: 'Refus' },
];

export const CONTRATS: TypeContrat[] = ['Stage', 'Alternance', 'CDD', 'CDI', 'Job étudiant'];

export const SOURCES = [
  'LinkedIn',
  'Indeed',
  'Welcome to the Jungle',
  'Site de l\'entreprise',
  'Candidature spontanée',
  'Réseau / école',
  'Autre',
];

export function labelStatut(s: Statut): string {
  return STATUTS.find((x) => x.id === s)?.label ?? s;
}

export function profilVide(): Profil {
  return {
    prenom: '',
    nom: '',
    titre: '',
    email: '',
    telephone: '',
    ville: '',
    linkedin: '',
    github: '',
    apropos: '',
    competences: '',
    langues: '',
    interets: '',
    photo: '',
    formations: [],
    experiences: [],
    projets: [],
  };
}
