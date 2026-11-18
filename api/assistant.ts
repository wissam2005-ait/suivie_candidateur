import Anthropic from '@anthropic-ai/sdk';

// Fonction serverless Vercel : seul endroit où la clé API est utilisée.
// Sans ANTHROPIC_API_KEY, on répond 503 et le front bascule sur son mode hors-ligne.

const MODELE = 'claude-opus-5-5';
const NB_QUESTIONS = 5;

type Tour = { role: 'recruteur' | 'candidat'; texte: string };

interface Requete {
  type: 'entretien' | 'lettre' | 'accroche';
  profil: string;
  poste: string;
  entreprise: string;
  notes?: string;
  ton?: string;
  historique?: Tour[];
}

const coupe = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

function lireRequete(body: any): Requete | null {
  if (!body || !['entretien', 'lettre', 'accroche'].includes(body.type)) return null;
  const historique = Array.isArray(body.historique)
    ? body.historique.slice(-30).map((t: any) => ({
        role: t?.role === 'candidat' ? 'candidat' : 'recruteur',
        texte: coupe(t?.texte, 3000),
      }))
    : [];
  return {
    type: body.type,
    profil: coupe(body.profil, 6000),
    poste: coupe(body.poste, 200) || 'poste non précisé',
    entreprise: coupe(body.entreprise, 200) || 'une entreprise',
    notes: coupe(body.notes, 1500),
    ton: coupe(body.ton, 50),
    historique,
  };
}

const SCHEMA_ENTRETIEN = {
  type: 'object',
  properties: {
    retour: { type: ['string', 'null'], description: 'Retour sur la dernière réponse du candidat, ou null au début.' },
    question: { type: ['string', 'null'], description: 'Question suivante, ou null si l\'entretien est terminé.' },
    bilan: { type: ['string', 'null'], description: 'Bilan final, seulement à la fin.' },
    note: { type: ['integer', 'null'], description: 'Note sur 10, seulement à la fin.' },
  },
  required: ['retour', 'question', 'bilan', 'note'],
  additionalProperties: false,
};

function construire(r: Requete) {
  const contexte = `Poste visé : ${r.poste}\nEntreprise : ${r.entreprise}\n${r.notes ? `Notes du candidat sur l'offre : ${r.notes}\n` : ''}\nProfil du candidat :\n${r.profil || '(profil non renseigné)'}`;

  if (r.type === 'entretien') {
    const nbQuestions = r.historique!.filter((t) => t.role === 'recruteur').length;
    const transcription = r.historique!.length
      ? r.historique!.map((t) => `${t.role === 'recruteur' ? 'RECRUTEUR' : 'CANDIDAT'} : ${t.texte}`).join('\n\n')
      : '(l\'entretien n\'a pas encore commencé)';
    const fin = nbQuestions >= NB_QUESTIONS;
    return {
      system:
        `Tu joues le rôle d'un recruteur bienveillant mais exigeant qui fait passer un entretien d'embauche à un étudiant (stage, alternance ou premier emploi) en France. ` +
        `Tu poses une seule question à la fois, en français, de façon naturelle, comme à l'oral. Varie les types : présentation, motivation pour l'entreprise, technique liée au poste, mise en situation, question comportementale (méthode STAR). ` +
        `Après chaque réponse, donne un retour court et concret (2 à 4 phrases) : ce qui est réussi, puis ce qu'il faudrait améliorer, avec un exemple de formulation si utile. Tutoie l'étudiant dans les retours, vouvoie-le dans les questions. ` +
        `L'entretien compte ${NB_QUESTIONS} questions au total.`,
      user:
        `${contexte}\n\nTranscription :\n${transcription}\n\n` +
        (fin
          ? `Les ${NB_QUESTIONS} questions ont été posées. Donne le retour sur la dernière réponse, puis un bilan final (points forts, axes de progrès, conseil pour le vrai entretien) et une note sur 10. question = null.`
          : nbQuestions === 0
            ? `Commence l'entretien : retour = null, pose la première question (accueil + présentation). bilan et note = null.`
            : `Donne le retour sur la dernière réponse puis pose la question ${nbQuestions + 1}/${NB_QUESTIONS}. bilan et note = null.`),
      json: true,
      effort: 'low' as const,
    };
  }

  if (r.type === 'lettre') {
    return {
      system:
        `Tu aides un étudiant à rédiger une lettre de motivation en français. La lettre doit sonner humaine et sincère : pas de formules creuses (« dynamique et motivé », « je me permets de »), des phrases simples, des exemples tirés du profil. ` +
        `Structure : vous (l'entreprise) / moi (parcours, compétences prouvées par des exemples) / nous (ce que je peux apporter, disponibilité). 250 à 330 mots. ` +
        `N'invente aucune expérience, aucun chiffre ni aucun diplôme absent du profil. Réponds uniquement avec la lettre (objet, formule d'appel, corps, formule de politesse, signature), sans commentaire.`,
      user: `${contexte}\n\nTon souhaité : ${r.ton || 'professionnel et chaleureux'}.`,
      json: false,
      effort: 'medium' as const,
    };
  }

  return {
    system:
      `Tu rédiges l'accroche (le paragraphe de présentation en haut d'un CV) d'un étudiant, adaptée à une offre précise. 3 phrases maximum, 60 mots maximum, à la première personne, ton direct et concret. ` +
      `N'invente rien qui ne figure pas dans le profil. Réponds uniquement avec l'accroche.`,
    user: contexte,
    json: false,
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
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: p.system,
      messages: [{ role: 'user', content: p.user }],
      output_config: p.json
        ? { effort: p.effort, format: { type: 'json_schema', schema: SCHEMA_ENTRETIEN } }
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

    if (p.json) return res.status(200).json(JSON.parse(texte));
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
