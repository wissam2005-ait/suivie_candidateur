import { Profil } from './models';

// Outils « ATS » : les logiciels de tri de CV (Applicant Tracking Systems) lisent le texte
// du CV et le comparent aux mots-clés de l'offre. On reproduit ce calcul, simplement.

const normaliser = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ');

// Compétences et expressions fréquentes dans les offres pour étudiants (en plusieurs mots ou avec ponctuation)
const EXPRESSIONS = [
  'gestion de projet', 'travail en equipe', 'esprit d equipe', 'relation client', 'service client', 'force de proposition',
  'sens de l organisation', 'esprit d analyse', 'esprit de synthese', 'prise d initiative', 'autonomie', 'rigueur', 'curiosite',
  'communication', 'adaptabilite', 'anglais', 'espagnol', 'allemand', 'pack office', 'microsoft office', 'google workspace',
  'power bi', 'machine learning', 'intelligence artificielle', 'data analyse', 'base de donnees', 'bases de donnees',
  'developpement web', 'front-end', 'back-end', 'full stack', 'full-stack', 'api rest', 'node.js', 'nodejs', 'next.js', 'vue.js',
  'react', 'angular', 'typescript', 'javascript', 'java', 'python', 'php', 'symfony', 'laravel', 'spring', 'c#', '.net', 'c++',
  'html', 'css', 'sass', 'tailwind', 'sql', 'mysql', 'postgresql', 'mongodb', 'nosql', 'git', 'github', 'gitlab', 'docker',
  'kubernetes', 'linux', 'windows server', 'active directory', 'reseau', 'tcp/ip', 'cybersecurite', 'cloud', 'aws', 'azure',
  'devops', 'ci/cd', 'agile', 'scrum', 'jira', 'figma', 'ux', 'ui', 'flutter', 'kotlin', 'swift', 'excel', 'word', 'powerpoint',
  'sap', 'erp', 'crm', 'salesforce', 'seo', 'sea', 'reseaux sociaux', 'marketing digital', 'canva', 'wordpress', 'comptabilite',
  'paie', 'recrutement', 'prospection', 'negociation', 'vente', 'logistique', 'achats', 'tableaux de bord', 'reporting', 'tests unitaires',
  'support technique', 'helpdesk', 'glpi', 'itil', 'virtualisation', 'vmware', 'cisco', 'pandas', 'tableau',
];

const VIDES = new Set(normaliser(`
  avec pour dans sans sous chez entre vers plus moins tres tout tous toute toutes votre vos notre nos leur leurs cette ces cet
  etre avoir faire sera serez sont etes avez aurez vous nous elle elles ils mais donc ainsi aussi alors comme dont quel quelle
  poste postes mission missions profil profils entreprise societe equipe equipes candidat candidate recherche recherchons
  rejoindre rejoignez offre offres contrat stage alternance emploi temps plein partiel duree debut annee annees mois semaine
  experience experiences formation niveau minimum souhaite souhaitee requis requise idealement maitrise connaissance connaissances
  competences competence qualites capacite capacites travail travailler participer participerez assurer assurerez gerer realiser
  mettre place etc bonne bonnes bon bons grand grande nouveau nouvelle nouveaux client clients projet projets afin selon chaque
  premier premiere dernier derniere notamment egalement cadre sein ensemble differents differentes plusieurs autres autre
  paris lyon france remuneration salaire avantages teletravail jours horaires lieu adresse postuler candidature envoyer cv lettre
`).split(/\s+/).filter(Boolean));

/** Mots-clés de l'offre : expressions connues, puis mots qui reviennent souvent. */
export function motsClesOffre(offre: string): string[] {
  const t = ' ' + normaliser(offre).replace(/[^a-z0-9+#./\s-]/g, ' ').replace(/\s+/g, ' ') + ' ';
  const trouves = new Set<string>();

  for (const e of EXPRESSIONS) {
    const motif = new RegExp(`(^|[\\s,(])${e.replace(/[.+#/]/g, (c) => '\\' + c)}(?=[\\s,).;:]|$)`);
    if (motif.test(t)) trouves.add(e);
  }

  const freq = new Map<string, number>();
  for (const mot of t.split(' ')) {
    const m = mot.replace(/^[.-]+|[.-]+$/g, '');
    if (m.length < 4 || VIDES.has(m) || /^\d+$/.test(m)) continue;
    freq.set(m, (freq.get(m) ?? 0) + 1);
  }
  const frequents = [...freq.entries()]
    .filter(([m, n]) => n >= 2 && ![...trouves].some((e) => e.includes(m)))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([m]) => m);

  // on affiche chaque mot-clé tel qu'il est écrit dans l'offre (accents, majuscules)
  const base = normaliser(offre.normalize('NFC'));
  const original = offre.normalize('NFC');
  return [...trouves, ...frequents].slice(0, 24).map((cle) => {
    const i = base.indexOf(cle);
    return i === -1 || base.length !== original.length ? cle : original.slice(i, i + cle.length);
  });
}

export interface AnalyseAts {
  score: number;
  presents: string[];
  manquants: string[];
}

export function analyserAts(offre: string, texteCv: string): AnalyseAts {
  const cles = motsClesOffre(offre);
  const cv = ' ' + normaliser(texteCv).replace(/\s+/g, ' ') + ' ';
  // tolère le pluriel et les variantes simples (node.js / nodejs)
  const present = (libelle: string) => {
    const k = normaliser(libelle);
    const v = [k, k.replace(/s$/, ''), k.replace(/[.\-\s]/g, ''), k + 's'];
    return v.some((x) => cv.includes(x));
  };
  const presents = cles.filter(present);
  const manquants = cles.filter((k) => !present(k));
  return { score: cles.length ? Math.round((presents.length / cles.length) * 100) : 0, presents, manquants };
}

/** Le CV en texte brut, tel qu'un logiciel de tri le lit (utile aussi pour les formulaires en ligne). */
export function cvEnTexte(p: Profil, accroche: string, poste: string): string {
  const lignes: string[] = [];
  const nom = [p.prenom, p.nom].filter(Boolean).join(' ');
  lignes.push(nom.toUpperCase());
  if (poste || p.titre) lignes.push(poste || p.titre);
  lignes.push([p.email, p.telephone, p.ville, p.linkedin, p.github].filter(Boolean).join(' | '));
  const section = (titre: string, contenu: string[]) => {
    if (!contenu.length) return;
    lignes.push('', titre.toUpperCase(), ...contenu);
  };
  section('Profil', accroche || p.apropos ? [accroche || p.apropos] : []);
  const parcours = (l: Profil['experiences']) =>
    l.filter((x) => x.titre).flatMap((x) => [`${x.titre}${x.lieu ? ' – ' + x.lieu : ''}${x.periode ? ' | ' + x.periode : ''}`, ...(x.description ? puces(x.description).map((d) => '- ' + d) : [])]);
  section('Expérience professionnelle', parcours(p.experiences));
  section('Projets', parcours(p.projets));
  section('Formation', parcours(p.formations));
  section('Compétences', p.competences ? [p.competences] : []);
  section('Langues', p.langues ? [p.langues] : []);
  section('Centres d\'intérêt', p.interets ? [p.interets] : []);
  return lignes.join('\n');
}

/** Découpe une description en puces courtes (une par mission). */
export function puces(description: string): string[] {
  const morceaux = description
    .split(/\n|;|\.\s+|,\s+(?=[a-zà-ÿ]+(?:\s|$))/i)
    .map((s) => s.trim().replace(/\.$/, ''))
    .filter((s) => s.length > 2);
  return morceaux.length > 1 ? morceaux.map((m) => m.charAt(0).toUpperCase() + m.slice(1)) : [description.trim().replace(/\.$/, '')];
}
