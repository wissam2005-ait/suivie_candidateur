import { Injectable, computed, effect, signal } from '@angular/core';
import { Candidature, Profil, profilVide } from './models';
import { aujourdhui, ecartJours } from './dates';
import { exemplesCandidatures, exempleProfil } from './exemples';

const CLE_CANDIDATURES = 'postulo.candidatures.v1';
const CLE_PROFIL = 'postulo.profil.v1';

// Délai (en jours) au bout duquel on conseille de relancer une candidature sans réponse
export const DELAI_RELANCE = 7;

function lire<T>(cle: string, defaut: T): T {
  try {
    const brut = localStorage.getItem(cle);
    return brut ? (JSON.parse(brut) as T) : defaut;
  } catch {
    return defaut;
  }
}

function ecrire(cle: string, valeur: unknown) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    // stockage plein ou navigation privée : on ne bloque pas l'appli
  }
}

export function nouvelId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * Toutes les données vivent dans le navigateur de l'étudiant (localStorage).
 * Pas de compte, pas de serveur : ses candidatures restent chez lui.
 */
@Injectable({ providedIn: 'root' })
export class Store {
  readonly candidatures = signal<Candidature[]>(lire(CLE_CANDIDATURES, []));
  readonly profil = signal<Profil>({ ...profilVide(), ...lire<Partial<Profil>>(CLE_PROFIL, {}) });

  readonly aRelancer = computed(() => {
    const auj = aujourdhui();
    return this.candidatures()
      .filter((c) => {
        if (c.statut === 'envoyee') {
          return c.dateRelance ? c.dateRelance <= auj : ecartJours(c.dateCandidature, auj) >= DELAI_RELANCE;
        }
        return c.statut === 'relancee' && !!c.dateRelance && c.dateRelance <= auj;
      })
      .sort((a, b) => a.dateCandidature.localeCompare(b.dateCandidature));
  });

  readonly prochainsEntretiens = computed(() => {
    const auj = aujourdhui();
    return this.candidatures()
      .filter((c) => c.dateEntretien && c.dateEntretien >= auj)
      .sort((a, b) => a.dateEntretien.localeCompare(b.dateEntretien));
  });

  constructor() {
    effect(() => ecrire(CLE_CANDIDATURES, this.candidatures()));
    effect(() => ecrire(CLE_PROFIL, this.profil()));
  }

  trouver(id: string) {
    return this.candidatures().find((c) => c.id === id);
  }

  enregistrer(c: Candidature) {
    const maj = { ...c, majLe: new Date().toISOString() };
    this.candidatures.update((liste) =>
      liste.some((x) => x.id === c.id) ? liste.map((x) => (x.id === c.id ? maj : x)) : [maj, ...liste],
    );
  }

  changerStatut(id: string, statut: Candidature['statut']) {
    const c = this.trouver(id);
    if (!c || c.statut === statut) return;
    const modif: Candidature = { ...c, statut };
    if (statut === 'relancee' && !c.dateRelance) modif.dateRelance = aujourdhui();
    this.enregistrer(modif);
  }

  supprimer(id: string) {
    this.candidatures.update((liste) => liste.filter((c) => c.id !== id));
  }

  importer(liste: Candidature[]) {
    this.candidatures.update((actuelles) => [...liste, ...actuelles]);
  }

  chargerExemples() {
    this.candidatures.set(exemplesCandidatures());
    if (!this.profil().prenom) this.profil.set(exempleProfil());
  }

  toutEffacer() {
    this.candidatures.set([]);
  }
}
