import { Candidature, CONTRATS, STATUTS, Statut, TypeContrat } from './models';
import { aujourdhui } from './dates';
import { nouvelId } from './store';

// Colonnes du fichier : mêmes intitulés qu'un tableau Excel "classique" de suivi
const COLONNES: [keyof Candidature, string][] = [
  ['entreprise', 'Entreprise'],
  ['poste', 'Poste'],
  ['contrat', 'Contrat'],
  ['lieu', 'Lieu'],
  ['source', 'Source'],
  ['statut', 'Statut'],
  ['dateCandidature', 'Date de candidature'],
  ['dateRelance', 'Date de relance'],
  ['dateEntretien', 'Date d\'entretien'],
  ['contact', 'Contact'],
  ['lien', 'Lien'],
  ['notes', 'Notes'],
];

function echapper(v: string): string {
  return /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Export CSV au format Excel français (séparateur ; et BOM UTF-8 pour les accents). */
export function versCsv(liste: Candidature[]): string {
  const entete = COLONNES.map(([, t]) => t).join(';');
  const lignes = liste.map((c) =>
    COLONNES.map(([cle]) => {
      const v = cle === 'statut' ? STATUTS.find((s) => s.id === c.statut)?.label ?? c.statut : String(c[cle] ?? '');
      return echapper(v);
    }).join(';'),
  );
  return '﻿' + [entete, ...lignes].join('\r\n');
}

function decouper(texte: string, sep: string): string[][] {
  const lignes: string[][] = [];
  let ligne: string[] = [];
  let champ = '';
  let entreGuillemets = false;

  for (let i = 0; i < texte.length; i++) {
    const ch = texte[i];
    if (entreGuillemets) {
      if (ch === '"' && texte[i + 1] === '"') { champ += '"'; i++; }
      else if (ch === '"') entreGuillemets = false;
      else champ += ch;
    } else if (ch === '"') entreGuillemets = true;
    else if (ch === sep) { ligne.push(champ); champ = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texte[i + 1] === '\n') i++;
      ligne.push(champ); champ = '';
      if (ligne.some((x) => x.trim())) lignes.push(ligne);
      ligne = [];
    } else champ += ch;
  }
  ligne.push(champ);
  if (ligne.some((x) => x.trim())) lignes.push(ligne);
  return lignes;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// Excel enregistre souvent les dates en JJ/MM/AAAA
function dateIso(v: string): string {
  v = v.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (!m) return '';
  const annee = m[3].length === 2 ? '20' + m[3] : m[3];
  return `${annee}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function statutDepuis(v: string): Statut {
  const n = norm(v);
  const trouve = STATUTS.find((s) => norm(s.label) === n || s.id === n);
  if (trouve) return trouve.id;
  if (n.includes('refus') || n.includes('negati')) return 'refus';
  if (n.includes('entretien')) return 'entretien';
  if (n.includes('relanc')) return 'relancee';
  if (n.includes('offre') || n.includes('accept')) return 'offre';
  return 'envoyee';
}

export function depuisCsv(texte: string): Candidature[] {
  texte = texte.replace(/^﻿/, '');
  const premiereLigne = texte.split(/\r?\n/)[0] ?? '';
  const sep = (premiereLigne.match(/;/g)?.length ?? 0) >= (premiereLigne.match(/,/g)?.length ?? 0) ? ';' : ',';
  const [entete, ...lignes] = decouper(texte, sep);
  if (!entete) return [];

  // On retrouve chaque colonne par son nom, peu importe l'ordre dans le fichier
  const index = new Map<keyof Candidature, number>();
  entete.forEach((titre, i) => {
    const t = norm(titre);
    const col = COLONNES.find(([cle, label]) => norm(label) === t || norm(cle) === t);
    if (col) index.set(col[0], i);
    else if (t.includes('entreprise') || t.includes('societe')) index.set('entreprise', i);
    else if (t.includes('poste') || t.includes('intitule')) index.set('poste', i);
    else if (t.startsWith('date') && !index.has('dateCandidature')) index.set('dateCandidature', i);
  });
  if (!index.has('entreprise')) throw new Error('Colonne « Entreprise » introuvable dans le fichier.');

  const val = (l: string[], cle: keyof Candidature) => {
    const i = index.get(cle);
    return i === undefined ? '' : (l[i] ?? '').trim();
  };

  const maintenant = new Date().toISOString();
  return lignes
    .filter((l) => val(l, 'entreprise'))
    .map((l) => {
      const contrat = CONTRATS.find((c) => norm(c) === norm(val(l, 'contrat'))) ?? 'Alternance';
      return {
        id: nouvelId(),
        entreprise: val(l, 'entreprise'),
        poste: val(l, 'poste'),
        contrat: contrat as TypeContrat,
        lieu: val(l, 'lieu'),
        source: val(l, 'source'),
        statut: statutDepuis(val(l, 'statut')),
        dateCandidature: dateIso(val(l, 'dateCandidature')) || aujourdhui(),
        dateRelance: dateIso(val(l, 'dateRelance')),
        dateEntretien: dateIso(val(l, 'dateEntretien')),
        contact: val(l, 'contact'),
        lien: val(l, 'lien'),
        notes: val(l, 'notes'),
        creeLe: maintenant,
        majLe: maintenant,
      };
    });
}

export function telecharger(nom: string, contenu: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  a.click();
  URL.revokeObjectURL(url);
}
