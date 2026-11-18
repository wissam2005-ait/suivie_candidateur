import type { AnalyseReponse, Cible, EtapeEntretien, Tour } from './assistant';
import { Profil } from './models';
import { compterMots, motsParasites } from './oral';

// Mode sans IA : moteur d'entretien à base de règles.
// Il ne vaut pas un vrai modèle, mais il pose des questions adaptées au métier,
// relance quand la réponse est vague et note chaque réponse sur des critères précis.

type Categorie = 'presentation' | 'motivation' | 'technique' | 'comportement' | 'situation' | 'piege' | 'questions';

export interface Question {
  categorie: Categorie;
  texte: string;
  attendu: string;
  conseil: string;
  cles?: RegExp;
}

type Domaine = 'dev' | 'data' | 'reseau' | 'commerce' | 'gestion' | 'general';

function domaine(poste: string): Domaine {
  const p = poste.toLowerCase();
  if (/data|donn[ée]e|analyst|bi\b|machine learning|\bia\b|intelligence/.test(p)) return 'data';
  if (/d[ée]v|web|front|back|full|logiciel|java|python|angular|react|php|mobile|flutter|\.net|application/.test(p)) return 'dev';
  if (/r[ée]seau|support|technicien|syst[èe]me|admin.*sys|cyber|infra|helpdesk|devops/.test(p)) return 'reseau';
  if (/commercial|vente|business|marketing|communication|charg[ée] d|client/.test(p)) return 'commerce';
  if (/comptab|gestion|\brh\b|ressources humaines|assistant|finance|logistique|achat/.test(p)) return 'gestion';
  return 'general';
}

const TECHNIQUE: Record<Domaine, Question[]> = {
  dev: [
    { categorie: 'technique', texte: `Expliquez-moi, simplement, comment fonctionne une application web : que se passe-t-il entre le moment où je tape une adresse et l'affichage de la page ?`, attendu: 'Comprendre le client/serveur, HTTP, le rôle du front et du back, sans jargon inutile.', conseil: 'Déroule les étapes dans l\'ordre (navigateur → requête HTTP → serveur → base de données → réponse → affichage) et donne un exemple tiré d\'un de tes projets.', cles: /http|serveur|navigateur|requ[êe]te|api|base de donn|front|back|dns/i },
    { categorie: 'technique', texte: `Parlez-moi du projet technique dont vous êtes le plus fier. Quelle stack avez-vous utilisée et pourquoi ?`, attendu: 'Un vrai projet, des choix techniques justifiés, ce que tu as personnellement codé.', conseil: 'Présente le besoin, la stack, UNE difficulté technique et comment tu l\'as résolue. Justifie au moins un choix (« j\'ai choisi X parce que… »).', cles: /parce que|car |choisi|angular|react|java|python|sql|node|api|git/i },
    { categorie: 'technique', texte: `Vous avez un bug en production que vous n'arrivez pas à reproduire en local. Comment vous y prenez-vous ?`, attendu: 'Une démarche méthodique : logs, reproduction, isolement, test, correctif, non-régression.', conseil: 'Montre une méthode : lire les logs, comparer les environnements, reproduire, isoler, corriger, ajouter un test. Termine par la communication à l\'équipe.', cles: /log|reprodu|test|debug|environnement|version|isoler|[ée]quipe/i },
    { categorie: 'technique', texte: `Comment travaillez-vous avec Git en équipe ?`, attendu: 'Branches, commits clairs, pull requests, relecture de code, gestion des conflits.', conseil: 'Cite le cycle branche → commits → pull request → relecture → fusion, et raconte un conflit que tu as résolu.', cles: /branche|commit|pull request|merge|conflit|relecture|review/i },
  ],
  data: [
    { categorie: 'technique', texte: `Comment présenteriez-vous un résultat d'analyse à quelqu'un qui n'est pas du tout technique ?`, attendu: 'Savoir vulgariser, choisir la bonne visualisation, aller à la conclusion utile.', conseil: 'Commence par la conclusion, puis un graphique simple, puis la limite de l\'analyse. Donne un exemple réel.', cles: /graphique|visuali|conclusion|simple|tableau de bord|dashboard|m[ée]tier/i },
    { categorie: 'technique', texte: `Vous recevez un jeu de données avec des valeurs manquantes et des doublons. Que faites-vous ?`, attendu: 'Une démarche de nettoyage réfléchie et justifiée.', conseil: 'Explique comment tu détectes, puis tes choix (supprimer, remplacer par la moyenne, signaler) et pourquoi. Cite tes outils.', cles: /doublon|manquant|nettoy|pandas|sql|excel|moyenne|supprim|python/i },
    { categorie: 'technique', texte: `Racontez-moi un projet où vous avez manipulé des données. Qu'avez-vous appris ?`, attendu: 'Un projet concret, des outils cités, un résultat.', conseil: 'Contexte, données utilisées, outils, résultat chiffré, ce que tu ferais mieux aujourd\'hui.', cles: /sql|python|excel|power ?bi|donn[ée]es|r[ée]sultat/i },
  ],
  reseau: [
    { categorie: 'technique', texte: `Un utilisateur vous appelle : « Internet ne marche plus. » Quelles sont vos premières vérifications ?`, attendu: 'Une démarche de diagnostic du plus simple au plus complexe, et de l\'écoute.', conseil: 'Pars du poste (câble, Wi-Fi, IP), puis réseau (ping, passerelle, DNS), puis serveur. Parle aussi de la façon dont tu rassures l\'utilisateur.', cles: /ping|ip|dns|c[âa]ble|wi-?fi|passerelle|red[ée]marr|ipconfig|utilisateur/i },
    { categorie: 'technique', texte: `Quelle différence faites-vous entre un switch et un routeur ?`, attendu: 'Des bases réseau solides, expliquées clairement.', conseil: 'Switch : relie les équipements d\'un même réseau (couche 2, adresses MAC). Routeur : relie des réseaux différents (couche 3, adresses IP). Donne un exemple.', cles: /mac|ip|couche|r[ée]seau local|lan|wan|paquet/i },
    { categorie: 'technique', texte: `Comment documentez-vous une intervention technique ?`, attendu: 'Rigueur, traçabilité, outil de ticketing.', conseil: 'Parle du ticket (problème, diagnostic, solution, temps passé) et de la base de connaissances pour les prochains.', cles: /ticket|glpi|documen|proc[ée]dure|tra[çc]/i },
  ],
  commerce: [
    { categorie: 'technique', texte: `Vendez-moi ce stylo.`, attendu: 'Poser des questions avant de vendre, partir du besoin du client.', conseil: 'Ne décris pas le stylo tout de suite : pose 2 questions sur le besoin (« Quand avez-vous signé un document important pour la dernière fois ? »), puis reformule et conclus.', cles: /\?|besoin|vous|utilis/i },
    { categorie: 'technique', texte: `Comment gérez-vous un client mécontent ?`, attendu: 'Écoute, reformulation, solution, suivi.', conseil: 'Écouter sans couper, reformuler, s\'excuser si besoin, proposer une solution concrète, puis rappeler pour vérifier. Un exemple vécu vaut beaucoup.', cles: /[ée]cout|reformul|solution|calme|rappel|suivi/i },
    { categorie: 'technique', texte: `Comment prépareriez-vous un premier rendez-vous avec un prospect ?`, attendu: 'Préparation, recherche sur le client, objectif clair.', conseil: 'Recherche sur l\'entreprise, objectif du rendez-vous, questions à poser, objections probables, prochaine étape.', cles: /recherche|linkedin|site|objectif|question|besoin|pr[ée]par/i },
  ],
  gestion: [
    { categorie: 'technique', texte: `Comment organisez-vous votre travail quand plusieurs tâches urgentes arrivent en même temps ?`, attendu: 'Méthode de priorisation, communication.', conseil: 'Cite une méthode (urgent/important), explique comment tu préviens ton responsable, donne un exemple.', cles: /priorit|urgent|important|liste|planning|responsable|organis/i },
    { categorie: 'technique', texte: `Quels outils maîtrisez-vous, et comment les avez-vous utilisés ?`, attendu: 'Des outils concrets et des usages réels.', conseil: 'Pour chaque outil : ce que tu as fait avec (ex. « tableau croisé dynamique sur Excel pour suivre un budget »).', cles: /excel|word|sap|erp|outlook|tableau|logiciel/i },
  ],
  general: [
    { categorie: 'technique', texte: `Quelles compétences de votre formation pensez-vous utiliser dès le premier mois dans ce poste ?`, attendu: 'Le lien entre ta formation et le poste.', conseil: 'Cite 2 compétences précises et, pour chacune, où tu l\'as déjà pratiquée.', cles: /comp[ée]tence|formation|projet|stage|cours/i },
    { categorie: 'technique', texte: `Comment vous formez-vous quand vous ne connaissez pas un sujet ?`, attendu: 'Autonomie, méthode d\'apprentissage.', conseil: 'Donne tes sources (documentation, tutoriels, collègues), ta méthode et un exemple récent.', cles: /documentation|tutoriel|cours|vid[ée]o|coll[èe]gue|pratiqu|projet/i },
  ],
};

function banque(c: Cible): Record<Exclude<Categorie, 'technique'>, Question[]> {
  const e = c.entreprise || 'notre entreprise';
  return {
    presentation: [
      { categorie: 'presentation', texte: `Bonjour, merci d'être venu(e). Pour commencer, pouvez-vous vous présenter ?`, attendu: 'Un pitch de 1 à 2 minutes : qui tu es, ce que tu sais faire (avec une preuve), ce que tu cherches.', conseil: 'Structure en 3 temps : présent (formation), passé (une expérience qui prouve une compétence), futur (pourquoi ce poste). Ne récite pas ton CV.', cles: /actuellement|formation|[ée]tudiant|bts|but|licence|master|stage|projet|cherche|alternance/i },
      { categorie: 'presentation', texte: `Bonjour ! Installez-vous. Racontez-moi votre parcours en quelques minutes.`, attendu: 'Un parcours raconté avec un fil conducteur, pas une liste.', conseil: 'Donne un fil rouge (« ce qui m\'a toujours plu, c\'est… »), 2 étapes clés et termine par le poste visé.', cles: /formation|stage|projet|passion|cherche|alternance|exp[ée]rience/i },
    ],
    motivation: [
      { categorie: 'motivation', texte: `Pourquoi avez-vous postulé chez ${e} ?`, attendu: 'Montrer que tu connais l\'entreprise et que ton choix est réfléchi.', conseil: `Cite un élément précis sur ${e} (produit, valeur, actualité, client) et relie-le à ton projet. Évite « c'est une grande entreprise ».`, cles: /produit|valeur|projet|client|actualit[ée]|site|secteur|mission|[ée]quipe/i },
      { categorie: 'motivation', texte: `Qu'est-ce qui vous attire dans ce poste de ${c.poste} ?`, attendu: 'Le lien entre les missions et tes envies/compétences.', conseil: 'Reprends 1 ou 2 missions de l\'offre et dis pourquoi elles te motivent, avec une expérience qui le prouve.', cles: /mission|apprendre|comp[ée]tence|projet|offre|aime|passion/i },
      { categorie: 'motivation', texte: `Que savez-vous de ${e} ?`, attendu: 'Une vraie préparation : activité, clients, actualité.', conseil: 'Activité principale, taille ou implantation, une actualité récente, et ce qui te plaît là-dedans.', cles: /cr[ée][ée]|client|produit|march[ée]|salari[ée]|actualit[ée]|secteur|si[èe]ge/i },
    ],
    comportement: [
      { categorie: 'comportement', texte: `Racontez-moi une situation où vous avez été en désaccord avec quelqu'un de votre équipe. Comment l'avez-vous gérée ?`, attendu: 'Un exemple réel raconté avec la méthode STAR, une issue constructive.', conseil: 'Méthode STAR : Situation, Tâche, Action (ce que TOI tu as fait), Résultat. Montre que tu as écouté l\'autre.', cles: /[ée]cout|discut|compromis|solution|accord|expliqu/i },
      { categorie: 'comportement', texte: `Parlez-moi d'un échec ou d'une erreur que vous avez commise. Qu'en avez-vous retenu ?`, attendu: 'Honnêteté, prise de responsabilité, apprentissage.', conseil: 'Choisis une vraie erreur (pas grave), assume-la, explique ce que tu as corrigé et ce que tu fais différemment depuis.', cles: /appris|retenu|depuis|maintenant|corrig|erreur|le[çc]on/i },
      { categorie: 'comportement', texte: `Racontez-moi une fois où vous avez dû apprendre quelque chose très vite.`, attendu: 'Capacité d\'apprentissage, autonomie, méthode.', conseil: 'STAR : le contexte, ce que tu devais apprendre, comment (sources, méthode), et le résultat concret.', cles: /appris|form[ée]|documentation|tutoriel|r[ée]sultat|r[ée]ussi/i },
    ],
    situation: [
      { categorie: 'situation', texte: `Vous êtes en retard sur une tâche et la date limite est demain. Que faites-vous ?`, attendu: 'Prévenir tôt, prioriser, proposer une solution.', conseil: 'Prévenir ton responsable tout de suite, proposer ce qui peut être livré, demander de l\'aide si besoin. Montre que tu ne caches pas le problème.', cles: /pr[ée]ven|responsable|priorit|solution|aide|communiqu/i },
      { categorie: 'situation', texte: `Votre responsable vous donne une consigne que vous ne comprenez pas bien et il est absent toute la journée. Que faites-vous ?`, attendu: 'Autonomie mais sans prendre de risque inutile.', conseil: 'Reformuler par écrit ce que tu as compris, demander à un collègue, avancer sur la partie claire, et faire le point à son retour.', cles: /coll[èe]gue|reformul|message|mail|demand|avancer/i },
    ],
    piege: [
      { categorie: 'piege', texte: `Quel est votre principal défaut ?`, attendu: 'Un vrai défaut, non rédhibitoire, avec ce que tu fais pour le corriger.', conseil: 'Évite « je suis perfectionniste ». Donne un vrai défaut (ex. difficulté à déléguer), un exemple, et ce que tu mets en place pour t\'améliorer.', cles: /travaill|am[ée]lior|corrig|depuis|maintenant|j'apprends|effort/i },
      { categorie: 'piege', texte: `Où vous voyez-vous dans trois ans ?`, attendu: 'Un projet cohérent avec le poste, de l\'ambition réaliste.', conseil: 'Relie ton projet au poste : monter en compétences sur X, prendre des responsabilités, idéalement dans l\'entreprise.', cles: /comp[ée]tence|responsabilit|[ée]volu|progress|projet|entreprise|[ée]quipe/i },
      { categorie: 'piege', texte: `Pourquoi devrions-nous vous choisir plutôt qu'un autre candidat ?`, attendu: 'Tes 2 ou 3 atouts, prouvés par des faits.', conseil: 'Trois atouts maximum, chacun avec une preuve courte. Pas de comparaison négative avec les autres.', cles: /atout|comp[ée]tence|exp[ée]rience|projet|motiv|preuve|d[ée]j[àa]/i },
    ],
    questions: [
      { categorie: 'questions', texte: `Nous arrivons à la fin. Avez-vous des questions à me poser ?`, attendu: 'Au moins une question pertinente sur le poste, l\'équipe ou la suite.', conseil: 'Prépare 2 questions : sur l\'équipe (« Comment se passe une journée type ? »), sur l\'intégration, ou sur la suite du recrutement. Ne réponds jamais « non ».', cles: /\?|est-ce que|comment|quel|quelle|combien|qui/i },
    ],
  };
}

function hasard<T>(liste: T[]): T {
  return liste[Math.floor(Math.random() * liste.length)];
}

/** Choisit 6 questions variées, dans un ordre réaliste d'entretien. */
export function planEntretien(c: Cible): Question[] {
  const b = banque(c);
  const tech = TECHNIQUE[domaine(c.poste)];
  return [
    hasard(b.presentation),
    hasard(b.motivation),
    hasard(tech),
    hasard(b.comportement),
    hasard([...b.situation, ...b.piege]),
    b.questions[0],
  ];
}

// ---------- Analyse d'une réponse ----------

const EXEMPLE = /(par exemple|lors d'(un|une)|pendant (un|une)|en (bts|stage|cours|alternance)|lors de|pendant (mon|ma|mes)|quand j'|l'ann[ée]e derni[èe]re|en stage|dans le cadre|j'ai (r[ée]alis[ée]|d[ée]velopp[ée]|mis en place|g[ée]r[ée]|cr[ée][ée]|organis[ée]|con[çc]u|particip[ée]|travaill[ée]|appris|r[ée]solu|anim[ée]|vendu|aid[ée]|fait|men[ée]))/i;
const RESULTAT = /(r[ée]sultat|au final|finalement|ce qui a permis|gr[âa]ce [àa]|j'en ai retenu|j'ai appris|depuis|a abouti|on a r[ée]ussi|j'ai r[ée]ussi)/i;
const NEGATIF = /(je ne sais pas|aucune id[ée]e|je sais pas|pas vraiment|je suis nul|j'en sais rien)/i;

export interface Mesures {
  note: number;
  clarte: number;
  exemples: number;
  structure: number;
  posture: number;
  motivation: number | null;
}

export function analyser(q: Question, reponse: string, c: Cible): AnalyseReponse & { mesures: Mesures } {
  const mots = compterMots(reponse);
  const forts: string[] = [];
  const ameliorer: string[] = [];
  const min = q.categorie === 'questions' ? 8 : 40;
  const max = q.categorie === 'presentation' ? 280 : 230;

  // Clarté : longueur adaptée et peu de mots parasites
  let clarte = 7;
  if (mots < min / 2) { clarte = 2; ameliorer.push('Réponse beaucoup trop courte : le recruteur n\'a rien de concret à retenir.'); }
  else if (mots < min) { clarte = 4; ameliorer.push('Développe davantage : vise 1 à 2 minutes à l\'oral.'); }
  else if (mots > max) { clarte = 5; ameliorer.push('Réponse trop longue : va à l\'essentiel, le recruteur risque de décrocher.'); }
  else { clarte = 8; forts.push('Longueur adaptée à l\'oral.'); }
  const parasites = motsParasites(reponse);
  const nbParasites = parasites.reduce((s, p) => s + p.nb, 0);
  if (nbParasites >= 3) { clarte -= 2; ameliorer.push(`Trop de mots parasites (${parasites.map((p) => `« ${p.mot} »`).join(', ')}) : marque plutôt une courte pause.`); }

  // Exemples concrets
  let exemples = 3;
  if (EXEMPLE.test(reponse)) { exemples += 4; forts.push('Tu t\'appuies sur une expérience réelle.'); }
  else if (q.categorie !== 'questions') ameliorer.push('Ajoute un exemple vécu : « Lors de mon stage chez…, j\'ai… ».');
  if (/\d/.test(reponse)) { exemples += 3; forts.push('Les chiffres rendent ta réponse crédible.'); }
  else if (['comportement', 'technique', 'presentation'].includes(q.categorie)) ameliorer.push('Ajoute un chiffre ou un résultat mesurable (délai, nombre d\'utilisateurs, note, chiffre d\'affaires…).');

  // Structure (surtout pour les questions STAR)
  let structure = 5;
  const aResultat = RESULTAT.test(reponse);
  if (aResultat) { structure += 3; forts.push('Tu conclus sur un résultat ou un apprentissage.'); }
  if (/(d'abord|ensuite|puis|enfin|premi[èe]rement|pour commencer)/i.test(reponse)) { structure += 2; forts.push('Réponse bien structurée.'); }
  if ((q.categorie === 'comportement' || q.categorie === 'situation') && !aResultat)
    ameliorer.push('Termine par le résultat (méthode STAR) : qu\'est-ce que ton action a changé ?');

  // Posture
  let posture = 7;
  if (/\bj['e ]|\bje\b|\bmoi\b/i.test(reponse)) posture += 1;
  if (/\bon\b/i.test(reponse) && !/\bj'ai\b/i.test(reponse)) { posture -= 2; ameliorer.push('Parle à la première personne (« j\'ai fait ») pour montrer TON rôle.'); }
  if (NEGATIF.test(reponse)) { posture -= 3; ameliorer.push('Évite « je ne sais pas » : dis plutôt comment tu chercherais la réponse.'); }

  // Motivation et préparation
  let motivation: number | null = null;
  if (q.categorie === 'motivation' || q.categorie === 'presentation') {
    motivation = 5;
    if (c.entreprise && reponse.toLowerCase().includes(c.entreprise.toLowerCase())) { motivation += 3; forts.push(`Tu cites ${c.entreprise}, ça montre que ta candidature est ciblée.`); }
    else if (q.categorie === 'motivation') ameliorer.push(`Cite ${c.entreprise || 'l\'entreprise'} et un élément précis la concernant.`);
    if (/(passion|motiv|envie|j'aime|me pla[iî]t|int[ée]ress)/i.test(reponse)) motivation += 2;
  }

  // Éléments attendus par cette question précise
  if (q.cles) {
    if (q.cles.test(reponse)) { structure += 1; forts.push('Tu réponds bien à ce qui était demandé.'); }
    else ameliorer.push('Tu passes à côté de l\'attente principale : ' + q.attendu.charAt(0).toLowerCase() + q.attendu.slice(1));
  }
  if (q.categorie === 'questions' && /^\s*(non|pas de question|non merci|c'est bon|non,? (c'est|tout est) clair)/i.test(reponse)) {
    posture = 3;
    ameliorer.unshift('Ne réponds jamais « non » : poser une question montre ton intérêt pour le poste.');
  }

  const borne = (n: number) => Math.max(0, Math.min(10, n));
  const m: Mesures = {
    clarte: borne(clarte),
    exemples: borne(q.categorie === 'questions' ? 6 : exemples),
    structure: borne(structure),
    posture: borne(posture),
    motivation: motivation === null ? null : borne(motivation),
    note: 0,
  };
  const valeurs = [m.clarte, m.exemples, m.structure, m.posture, ...(m.motivation === null ? [] : [m.motivation])];
  m.note = Math.round(valeurs.reduce((s, v) => s + v, 0) / valeurs.length);
  if (mots < min / 2) m.note = Math.min(m.note, 3);

  return { note: m.note, forts: [...new Set(forts)].slice(0, 3), ameliorer: [...new Set(ameliorer)].slice(0, 3), attendu: q.attendu, conseil: q.conseil, mesures: m };
}

const TRANSITIONS = ['Très bien, merci.', 'D\'accord.', 'Je vois.', 'Merci pour cette réponse.', 'Entendu.', 'Intéressant.'];
function relance(q: Question, c: Cible): string {
  switch (q.categorie) {
    case 'presentation':
      return 'Pouvez-vous m\'en dire un peu plus ? Qu\'avez-vous fait concrètement pendant votre formation ou vos stages ?';
    case 'motivation':
      return `C'est un peu général. Qu'est-ce qui vous attire précisément chez ${c.entreprise || 'nous'}, par rapport à d'autres entreprises ?`;
    case 'technique':
      return 'Pouvez-vous me donner un exemple concret, tiré d\'un de vos projets ?';
    case 'comportement':
      return hasard(['Concrètement, qu\'avez-vous fait, vous, dans cette situation ?', 'Et quel a été le résultat ? Qu\'en avez-vous retenu ?']);
    default:
      return 'Pouvez-vous développer un peu ?';
  }
}

export interface SessionHorsLigne {
  plan: Question[];
  mesures: Mesures[];
  relanceFaite: boolean;
}

export function nouvelleSession(c: Cible): SessionHorsLigne {
  return { plan: planEntretien(c), mesures: [], relanceFaite: false };
}

/** Une étape : analyse la dernière réponse puis relance, pose la question suivante ou conclut. */
export function etapeEntretien(c: Cible, historique: Tour[], s: SessionHorsLigne): EtapeEntretien {
  const posees = historique.filter((t) => t.role === 'recruteur' && !t.relance).length;
  const derniere = historique.at(-1);

  if (!derniere || posees === 0) {
    const q = s.plan[0];
    return { retour: null, analyse: null, question: q.texte, indice: q.conseil, relance: false, bilan: null, note: null, criteres: null };
  }

  const q = s.plan[posees - 1];
  // on analyse toute la réponse à cette question (y compris après une relance)
  let debut = historique.length - 1;
  while (debut >= 0 && !(historique[debut].role === 'recruteur' && !historique[debut].relance)) debut--;
  const reponse = historique.slice(debut + 1).filter((t) => t.role === 'candidat').map((t) => t.texte).join(' ');
  const a = analyser(q, reponse, c);

  // Relance réaliste : une seule fois par entretien… sauf réponse vraiment vide
  const vague = compterMots(reponse) < 25 || ((q.categorie === 'comportement' || q.categorie === 'technique') && a.mesures.exemples < 5);
  const dejaRelancee = historique.slice(debut + 1).some((t) => t.relance);
  if (vague && !dejaRelancee && (!s.relanceFaite || compterMots(reponse) < 12) && q.categorie !== 'questions') {
    s.relanceFaite = true;
    return { retour: null, analyse: null, question: relance(q, c), indice: q.conseil, relance: true, bilan: null, note: null, criteres: null };
  }

  s.mesures.push(a.mesures);
  const analyse: AnalyseReponse = { note: a.note, forts: a.forts, ameliorer: a.ameliorer, attendu: a.attendu, conseil: a.conseil };

  if (posees >= s.plan.length) return { ...bilan(c, s), analyse, retour: null };

  const suivante = s.plan[posees];
  return {
    retour: null,
    analyse,
    question: `${hasard(TRANSITIONS)} ${suivante.texte}`,
    indice: suivante.conseil,
    relance: false,
    bilan: null,
    note: null,
    criteres: null,
  };
}

function bilan(c: Cible, s: SessionHorsLigne): EtapeEntretien {
  const moy = (f: (m: Mesures) => number | null) => {
    const v = s.mesures.map(f).filter((x): x is number => x !== null);
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : 5;
  };
  const criteres = [
    { nom: 'Clarté et concision', note: moy((m) => m.clarte) },
    { nom: 'Exemples concrets', note: moy((m) => m.exemples) },
    { nom: 'Structure des réponses', note: moy((m) => m.structure) },
    { nom: 'Motivation et préparation', note: moy((m) => m.motivation) },
    { nom: 'Posture et assurance', note: moy((m) => m.posture) },
  ];
  const note = Math.round(moy((m) => m.note));
  const faible = [...criteres].sort((a, b) => a.note - b.note).slice(0, 2).map((x) => x.nom.toLowerCase());
  const fort = [...criteres].sort((a, b) => b.note - a.note)[0].nom.toLowerCase();

  const verdict =
    note >= 8 ? 'Très bon entretien : tu es prêt(e).' :
    note >= 6 ? 'Entretien correct, quelques réglages et ce sera très bien.' :
    note >= 4 ? 'Des bases, mais il faut retravailler tes réponses avant le vrai entretien.' :
    'Il faut s\'entraîner encore : prépare tes exemples à l\'écrit puis refais une simulation.';

  return {
    retour: null,
    analyse: null,
    question: null,
    indice: null,
    relance: false,
    note,
    criteres,
    bilan:
      `${verdict}\n\nPoint fort : ${fort}. À travailler en priorité : ${faible.join(' et ')}.\n\n` +
      `Avant ton entretien${c.entreprise ? ` chez ${c.entreprise}` : ''} : prépare 3 histoires au format STAR (un succès, une difficulté, un travail d'équipe), ` +
      `apprends ton pitch de présentation, note 2 questions à poser au recruteur et renseigne-toi sur une actualité récente de l'entreprise.`,
  };
}

// ---------- Lettre, accroche et pitch ----------

const minuscule = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const competencesDe = (p: Profil, n = 3) => p.competences.split(',').map((s) => s.trim()).filter(Boolean).slice(0, n);

export function lettre(p: Profil, c: Cible): string {
  const exp = p.experiences[0];
  const projet = p.projets[0];
  const comp = competencesDe(p);
  const entreprise = c.entreprise || 'votre entreprise';
  const situation = p.titre ? minuscule(p.titre) : 'étudiant(e)';
  const fin = (t: string) => minuscule(t.trim().replace(/[.\s]+$/, ''));

  const vous = c.notes?.trim()
    ? `Ce qui m'attire chez ${entreprise}, c'est ${fin(c.notes)}. Votre offre de ${c.poste} m'a donc tout de suite parlé.`
    : `Votre offre de ${c.poste} chez ${entreprise} a retenu toute mon attention : [ce qui t'attire précisément chez eux, un produit, un projet ou une valeur].`;

  const preuves: string[] = [];
  if (exp) preuves.push(`Lors de mon ${minuscule(exp.titre)} chez ${exp.lieu.split(',')[0]}, mes missions étaient les suivantes : ${fin(exp.description)}.`);
  if (projet) preuves.push(`J'ai également mené le projet ${projet.titre} : ${fin(projet.description)}.`);
  if (!preuves.length) preuves.push(`[Décris une expérience ou un projet concret, et ce qu'il a apporté.]`);
  const moi = `Actuellement ${situation}, j'ai déjà pu mettre mes compétences en pratique. ${preuves.join(' ')}${comp.length ? ` Ces expériences m'ont permis de consolider ${comp.slice(0, -1).join(', ')}${comp.length > 1 ? ' et ' : ''}${comp.at(-1)}.` : ''}`;

  const nous = `Rejoindre votre équipe serait pour moi l'occasion d'apprendre aux côtés de professionnels expérimentés, tout en apportant rapidement ma rigueur et ma curiosité. Je serais heureux(se) de vous présenter ma motivation lors d'un entretien.`;

  return `Objet : candidature au poste de ${c.poste}${c.entreprise ? ` chez ${c.entreprise}` : ''}

Madame, Monsieur,

${vous}

${moi}

${nous}

Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.`;
}

export function accroche(p: Profil, c: Cible): string {
  const competences = competencesDe(p).join(', ');
  return `${p.titre || 'Étudiant(e)'}, je recherche un poste de ${c.poste}${c.entreprise ? ` chez ${c.entreprise}` : ''}. ${competences ? `À l'aise avec ${competences}, ` : ''}j'aime apprendre vite et livrer du concret.`;
}

export type FormatPitch = 'entretien' | 'salon' | 'telephone' | 'linkedin';

export interface Pitch {
  blocs: { titre: string; texte: string }[];
}

// « au Lycée X », « à l'IUT Y », « à Paris »
function aLieu(lieu: string): string {
  if (/^(lyc[ée]e|coll[èe]ge|cnam|campus)/i.test(lieu)) return 'au ' + lieu;
  if (/^[aeiouyéèh]/i.test(lieu) && /^(iut|[ée]cole|universit|institut|epitech|esiee|efrei|isep)/i.test(lieu)) return "à l'" + lieu;
  return 'à ' + lieu;
}

const sansPoint = (t: string) => t.trim().replace(/[.\s]+$/, '');

export function pitch(p: Profil, c: Cible, format: FormatPitch): Pitch {
  const prenom = p.prenom || '[Prénom]';
  const exp = p.experiences[0];
  const projet = p.projets[0];
  const formation = p.formations[0];
  const comp = competencesDe(p, 3);
  const entreprise = c.entreprise || '';
  const poste = c.poste || '[poste]';
  const situation = minuscule(p.titre || (formation ? `en ${formation.titre}` : 'étudiant(e)'));
  const ecole = formation?.lieu ? ' ' + aLieu(formation.lieu.split(',')[0]) : '';
  const pourquoi = c.notes?.trim()
    ? minuscule(sansPoint(c.notes))
    : `[ce qui t'attire précisément${entreprise ? ` chez ${entreprise}` : ''} : un produit, un projet, une valeur]`;
  const recherche = /altern/i.test(p.apropos + p.titre) ? 'une alternance' : /stage/i.test(p.apropos) ? 'un stage' : 'un poste';

  const preuves: string[] = [];
  if (exp) preuves.push(`Mon expérience la plus concrète, c'est mon ${minuscule(exp.titre)} chez ${exp.lieu.split(',')[0]} : ${minuscule(sansPoint(exp.description))}. [Ajoute le résultat, avec un chiffre si possible.]`);
  if (projet) preuves.push(`J'ai aussi réalisé ${projet.titre}, ${minuscule(projet.lieu || 'un projet')} : ${minuscule(sansPoint(projet.description))}.`);
  if (!preuves.length) preuves.push('[Raconte une expérience ou un projet concret : ce que tu as fait, et le résultat avec un chiffre.]');

  if (format === 'linkedin') {
    return {
      blocs: [
        { titre: 'Accroche', texte: `Bonjour [Prénom du recruteur],\n\nJ'ai vu que ${entreprise || 'votre entreprise'} recherche un(e) ${poste} et je me permets de vous écrire directement.`.replace('je me permets de vous écrire', 'je vous écris') },
        { titre: 'Qui je suis', texte: `Je suis ${situation}${ecole}${comp.length ? `, à l'aise avec ${comp.join(', ')}` : ''}.` },
        { titre: 'Preuve', texte: preuves[0] },
        { titre: 'Demande', texte: `Seriez-vous disponible pour un échange de 10 minutes cette semaine ? Je vous joins mon CV.\n\nBonne journée,\n${prenom}` },
      ],
    };
  }

  const competences = comp.length
    ? `Mes compétences principales, ce sont ${comp.slice(0, 2).join(' et ')}${comp[2] ? `, et je pratique aussi ${comp[2]}` : ''}.`
    : '[Tes 2 ou 3 compétences clés pour ce poste.]';
  const passion = p.apropos ? ` ${sansPoint(p.apropos.split(/(?<=\.)\s/)[0])}.` : '';

  if (format === 'salon') {
    return {
      blocs: [
        { titre: 'Qui je suis', texte: `Bonjour, je m'appelle ${prenom}, je suis ${situation}.` },
        { titre: 'Ce que je sais faire', texte: competences },
        { titre: 'La preuve', texte: preuves[0] },
        { titre: 'Ce que je cherche', texte: `Je cherche ${recherche} de ${poste}${entreprise ? `, et ${entreprise} m'intéresse beaucoup` : ''}.` },
        { titre: 'Conclusion', texte: `Est-ce que vous auriez des opportunités de ce type dans vos équipes ?` },
      ],
    };
  }

  if (format === 'telephone') {
    return {
      blocs: [
        { titre: 'Qui je suis', texte: `Bonjour, ${prenom} ${p.nom}. Je vous appelle au sujet de l'offre de ${poste}${entreprise ? ` chez ${entreprise}` : ''}. Vous avez deux minutes ?`.replace(/\s+/g, ' ') },
        { titre: 'Mon profil', texte: `Je suis ${situation}${ecole}. ${competences}` },
        { titre: 'La preuve', texte: preuves[0] },
        { titre: 'Conclusion', texte: `Je serais ravi(e) de vous en dire plus lors d'un entretien. Quand seriez-vous disponible ?` },
      ],
    };
  }

  return {
    blocs: [
      { titre: 'Qui je suis', texte: `Je m'appelle ${prenom} et je suis ${situation}${ecole}.${passion}` },
      { titre: 'Ce que je sais faire', texte: competences },
      { titre: 'La preuve', texte: preuves.join(' ') },
      { titre: 'Ce que je cherche', texte: `Aujourd'hui, je cherche ${recherche} de ${poste}${entreprise ? ` chez ${entreprise}` : ''}, parce que ${pourquoi}.` },
      { titre: 'Conclusion', texte: `C'est pour ça que votre offre m'a tout de suite parlé : je pense pouvoir apprendre vite à vos côtés et être utile à l'équipe dès les premières semaines.` },
    ],
  };
}
