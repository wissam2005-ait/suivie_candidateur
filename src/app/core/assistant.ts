import { Injectable, inject, signal } from '@angular/core';
import { Profil } from './models';
import { Store } from './store';
import * as horsLigne from './hors-ligne';

export type Tour = { role: 'recruteur' | 'candidat'; texte: string };

export interface EtapeEntretien {
  retour: string | null;
  question: string | null;
  bilan: string | null;
  note: number | null;
}

export interface Cible {
  poste: string;
  entreprise: string;
  notes?: string;
}

/** Résumé texte du profil envoyé à l'IA (on n'envoie ni téléphone ni e-mail). */
export function resumeProfil(p: Profil): string {
  const bloc = (titre: string, l: Profil['formations']) =>
    l.length ? `${titre} :\n` + l.map((x) => `- ${x.titre} (${x.lieu}, ${x.periode}) : ${x.description}`).join('\n') : '';
  return [
    p.prenom && `Prénom : ${p.prenom}`,
    p.titre && `Situation : ${p.titre}`,
    p.apropos && `À propos : ${p.apropos}`,
    p.competences && `Compétences : ${p.competences}`,
    p.langues && `Langues : ${p.langues}`,
    bloc('Formation', p.formations),
    bloc('Expériences', p.experiences),
    bloc('Projets', p.projets),
  ]
    .filter(Boolean)
    .join('\n');
}

@Injectable({ providedIn: 'root' })
export class Assistant {
  private store = inject(Store);

  /** Passe à true dès que l'API répond 503 (pas de clé) ou n'est pas joignable. */
  readonly modeHorsLigne = signal(false);

  private async appeler<T>(corps: object): Promise<T | null> {
    if (this.modeHorsLigne()) return null;
    try {
      const rep = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...corps, profil: resumeProfil(this.store.profil()) }),
      });
      // 503 = pas de clé configurée ; 404/405/501 = pas de fonction serverless (ng serve, hébergement statique)
      if ([404, 405, 501, 503].includes(rep.status)) {
        this.modeHorsLigne.set(true);
        return null;
      }
      const data = await rep.json().catch(() => ({}));
      if (!rep.ok) throw new Error(data.erreur ?? 'Erreur ' + rep.status);
      return data as T;
    } catch (e) {
      if (e instanceof TypeError) {
        // réseau coupé ou "ng serve" sans fonction serverless
        this.modeHorsLigne.set(true);
        return null;
      }
      throw e;
    }
  }

  async etapeEntretien(cible: Cible, historique: Tour[]): Promise<EtapeEntretien> {
    const r = await this.appeler<EtapeEntretien>({ type: 'entretien', ...cible, historique });
    return r ?? horsLigne.etapeEntretien(cible, historique);
  }

  async lettre(cible: Cible, ton: string): Promise<string> {
    const r = await this.appeler<{ texte: string }>({ type: 'lettre', ...cible, ton });
    return r?.texte ?? horsLigne.lettre(this.store.profil(), cible);
  }

  async accroche(cible: Cible): Promise<string> {
    const r = await this.appeler<{ texte: string }>({ type: 'accroche', ...cible });
    return r?.texte ?? horsLigne.accroche(this.store.profil(), cible);
  }
}
