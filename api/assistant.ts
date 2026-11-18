import Anthropic from '@anthropic-ai/sdk';

// Fonction serverless Vercel : seul endroit où la clé API est utilisée.
// Sans ANTHROPIC_API_KEY, on répond 503 et le front bascule sur son mode hors-ligne.

const MODELE = 'claude-opus-5-5';
const NB_QUESTIONS = 6;

type Tour = { role: 'recruteur' | 'candidat'; texte: string; relance?: boolean };

interface Requete {
  type: 'entretien' | 'lettre' | 'accroche' | 'pitch';
  format?: string;
  profil: string;
  poste: string;
  entreprise: string;
  notes?: string;
  ton?: string;
  historique?: Tour[];
}

const coupe = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

function lireRequete(body: any): Requete | null {
  if (!body || !['entretien', 'lettre', 'accroche', 'pitch'].includes(body.type)) return null;
  const historique = Array.isArray(body.historique)
    ? body.historique.slice(-30).map((t: any) => ({
        role: t?.role === 'candidat' ? 'candidat' : 'recruteur',
        texte: coupe(t?.texte, 3000),
        relance: t?.relance === true,
      }))
    : [];
  return {
    type: body.type,
    profil: coupe(body.profil, 6000),
    poste: coupe(body.poste, 200) || 'poste non précisé',
    entreprise: coupe(body.entreprise, 200) || 'une entreprise',
    notes: coupe(body.notes, 1500),
    ton: coupe(body.ton, 50),
    format: ['entretien', 'salon', 'telephone', 'linkedin'].includes(body.format) ? body.format : 'entretien',
    historique,
  };
}

const nullable = (type: string) => ({ type: [type, 'null'] });

const SCHEMA_ENTRETIEN = {
  type: 'object',
  properties: {
    analyse: {
      type: ['object', 'null'],
      description: 'Analyse de la dernière réponse du candidat (null au tout début ou si tu relances).',
      properties: {
        note: { type: 'integer', description: 'Note de la réponse sur 10' },
        forts: { type: 'array', items: { type: 'string' }, description: '1 à 3 points réussis, concrets' },
        ameliorer: { type: 'array', items: { type: 'string' }, description: '1 à 3 améliorations concrètes, avec une formulation proposée si utile' },
        attendu: { type: 'string', description: 'Ce que le recruteur cherchait à évaluer avec cette question' },
      },
      required: ['note', 'forts', 'ameliorer', 'attendu'],
      additionalProperties: false,
    },
    question: { ...nullable('string'), description: 'Ta prochaine prise de parole de recruteur (question ou relance), null si l\'entretien est terminé.' },
    relance: { type: 'boolean', description: 'true si la question est une relance sur la même question.' },
    indice: { ...nullable('string'), description: 'Conseil court pour bien répondre à la question posée.' },
    bilan: { ...nullable('string'), description: 'Bilan final, seulement à la fin.' },
    note: { ...nullable('integer'), description: 'Note globale sur 10, seulement à la fin.' },
    criteres: {
      type: ['array', 'null'],
      description: 'Seulement à la fin : notes sur 10 pour Clarté et concision, Exemples concrets, Structure des réponses, Motivation et préparation, Posture et assurance.',
      items: {
        type: 'object',
        properties: { nom: { type: 'string' }, note: { type: 'number' } },
        required: ['nom', 'note'],
        additionalProperties: false,
      },
    },
  },
  required: ['analyse', 'question', 'relance', 'indice', 'bilan', 'note', 'criteres'],
  additionalProperties: false,
};

const SCHEMA_PITCH = {
  type: 'object',
  properties: {
    blocs: {
      type: 'array',
      items: {
        type: 'object',
        properties: { titre: { type: 'string' }, texte: { type: 'string' } },
        required: ['titre', 'texte'],
        additionalProperties: false,
      },
    },
  },
  required: ['blocs'],
  additionalProperties: false,
};

const FORMATS: Record<string, string> = {
  entretien: 'réponse à « Présentez-vous » en début d\'entretien, 1 minute à 1 minute 30 à l\'oral (150 à 200 mots)',
  salon: 'pitch d\'ascenseur pour un salon ou un forum entreprises, 30 secondes à l\'oral (70 à 90 mots), qui se termine par une question au recruteur',
  telephone: 'appel téléphonique à un recruteur pour relancer ou proposer sa candidature, 45 secondes (100 à 120 mots), qui se termine par une demande de rendez-vous',
  linkedin: 'message écrit à un recruteur sur LinkedIn, 80 à 120 mots, poli et direct, qui se termine par une demande d\'échange',
};

function construire(r: Requete) {
  const contexte = `Poste visé : ${r.poste}\nEntreprise : ${r.entreprise}\n${r.notes ? `Notes du candidat sur l'offre : ${r.notes}\n` : ''}\nProfil du candidat :\n${r.profil || '(profil non renseigné)'}`;

  if (r.type === 'entretien') {
    const h = r.historique!;
    const nbQuestions = h.filter((t) => t.role === 'recruteur' && !t.relance).length;
    const transcription = h.length
      ? h.map((t) => `${t.role === 'recruteur' ? (t.relance ? 'RECRUTEUR (relance)' : 'RECRUTEUR') : 'CANDIDAT'} : ${t.texte}`).join('\n\n')
      : '(l\'entretien n\'a pas encore commencé)';
    const derniereEstRelance = [...h].reverse().find((t) => t.role === 'recruteur')?.relance === true;
    const fin = nbQuestions >= NB_QUESTIONS;

    let consigne: string;
    if (nbQuestions === 0) {
      consigne = `Commence l'entretien : accueille le candidat en une phrase et demande-lui de se présenter. analyse, bilan, note et criteres = null, relance = false.`;
    } else if (fin) {
      consigne =
        `Les ${NB_QUESTIONS} questions ont été posées. Analyse la dernière réponse, puis donne le bilan final : verdict en une phrase, points forts, ` +
        `2 axes de progrès prioritaires et un plan de préparation concret pour le vrai entretien. Remplis note et criteres. question = null.`;
    } else {
      consigne =
        `Analyse la dernière réponse du candidat (toute sa réponse depuis ta dernière question, relance comprise). ` +
        (derniereEstRelance
          ? `Tu as déjà relancé : passe à la question ${nbQuestions + 1}/${NB_QUESTIONS} (relance = false).`
          : `Si la réponse est vraiment vague, trop courte ou sans exemple, tu PEUX relancer une fois comme le ferait un vrai recruteur (« Concrètement, qu'avez-vous fait ? », « Quel a été le résultat ? ») : dans ce cas analyse = null et relance = true. ` +
            `Sinon pose la question ${nbQuestions + 1}/${NB_QUESTIONS} (relance = false), précédée d'une courte transition naturelle.`) +
        ` bilan, note et criteres = null.`;
    }

    return {
      system:
        `Tu es un recruteur expérimenté qui fait passer un vrai entretien d'embauche à un étudiant (stage, alternance ou premier emploi) en France, pour le poste et l'entreprise indiqués. ` +
        `Tu restes dans ton rôle : ton naturel, vouvoiement, une seule question à la fois, comme à l'oral. Tes questions s'appuient sur le profil et les réponses précédentes du candidat (rebondis sur ce qu'il a dit). ` +
        `Déroulé sur ${NB_QUESTIONS} questions : 1) présentation, 2) motivation pour l'entreprise et le poste, 3) une question technique ou métier précise liée au poste, ` +
        `4) une question comportementale (méthode STAR), 5) une mise en situation ou une question piège classique (défaut, pourquoi vous, dans 3 ans…), 6) « Avez-vous des questions ? ». ` +
        `L'analyse est écrite par un coach bienveillant mais franc qui tutoie l'étudiant : points précis tirés de sa réponse, jamais génériques. Sois exigeant sur les exemples concrets, les résultats chiffrés et la structure. ` +
        `Les notes sont honnêtes : une réponse vague ou trop courte ne dépasse pas 4/10. L'indice donne en une ou deux phrases la méthode pour bien répondre à la question que tu viens de poser.`,
      user: `${contexte}\n\nTranscription :\n${transcription}\n\n${consigne}`,
      schema: SCHEMA_ENTRETIEN,
      effort: 'medium' as const,
    };
  }

  if (r.type === 'pitch') {
    return {
      system:
        `Tu aides un étudiant à préparer son pitch professionnel, celui qu'il dira aux recruteurs. Format : ${FORMATS[r.format!]}. ` +
        `Découpe le pitch en blocs courts avec un titre chacun (par exemple : Qui je suis, Ce que je sais faire, La preuve, Ce que je cherche, Conclusion). ` +
        `Style oral, naturel, phrases courtes, à la première personne, sans formules creuses. Mets une preuve concrète tirée du profil (expérience ou projet, avec un résultat). ` +
        `Adapte au poste et à l'entreprise visés. N'invente aucune expérience, aucun chiffre ni diplôme absent du profil : si une information manque, mets un repère entre crochets, par exemple [chiffre].`,
      user: contexte,
      schema: SCHEMA_PITCH,
      effort: 'medium' as const,
    };
  }

  if (r.type === 'lettre') {
    return {
      system:
        `Tu aides un étudiant à rédiger une lettre de motivation en français. La lettre doit sonner humaine et sincère : pas de formules creuses (« dynamique et motivé », « je me permets de »), des phrases simples, des exemples tirés du profil. ` +
        `Structure : vous (l'entreprise) / moi (parcours, compétences prouvées par des exemples) / nous (ce que je peux apporter, disponibilité). 250 à 330 mots. ` +
        `N'invente aucune expérience, aucun chiffre ni aucun diplôme absent du profil. Réponds uniquement avec la lettre (objet, formule d'appel, corps, formule de politesse, signature), sans commentaire.`,
      user: `${contexte}\n\nTon souhaité : ${r.ton || 'professionnel et chaleureux'}.`,
      schema: null,
      effort: 'medium' as const,
    };
  }

  return {
    system:
      `Tu rédiges l'accroche (le paragraphe de présentation en haut d'un CV) d'un étudiant, adaptée à une offre précise. 3 phrases maximum, 60 mots maximum, à la première personne, ton direct et concret. ` +
      `N'invente rien qui ne figure pas dans le profil. Réponds uniquement avec l'accroche.`,
    user: contexte,
    schema: null,
    effort: 'low' as const,
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erreur: 'Méthode non autorisée' });
  }
  if (!process.env['ANTHROPIC_API_KEY']) {
    return res.status(503).json({ erreur: 'Assistant IA non configuré' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  const r = lireRequete(body);
  if (!r) return res.status(400).json({ erreur: 'Requête invalide' });

  const p = construire(r);
  const client = new Anthropic();

  try {
    const reponse = await client.beta.messages.create({
      model: MODELE,
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: p.system,
      messages: [{ role: 'user', content: p.user }],
      output_config: p.schema
        ? { effort: p.effort, format: { type: 'json_schema', schema: p.schema } }
        : { effort: p.effort },
    });

    if (reponse.stop_reason === 'refusal') {
      return res.status(422).json({ erreur: 'L\'assistant n\'a pas pu traiter cette demande.' });
    }

    const texte = reponse.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('')
      .trim();

    if (p.schema) return res.status(200).json(JSON.parse(texte));
    return res.status(200).json({ texte });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ erreur: 'Trop de demandes, réessaie dans une minute.' });
    }
    if (e instanceof Anthropic.APIError) {
      console.error('Erreur API Anthropic', e.status);
      return res.status(502).json({ erreur: 'Le service IA ne répond pas.' });
    }
    console.error('Erreur assistant', e);
    return res.status(500).json({ erreur: 'Erreur interne' });
  }
}
