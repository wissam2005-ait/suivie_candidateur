import { Injectable, NgZone, inject, signal } from '@angular/core';

// Outils pour l'entraînement à l'oral : lecture à voix haute et dictée
// (API Web Speech, disponible dans Chrome et Edge).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Reconnaissance = any;

@Injectable({ providedIn: 'root' })
export class Oral {
  private zone = inject(NgZone);
  private reco: Reconnaissance | null = null;

  readonly ecoute = signal(false);
  readonly parle = signal(false);

  readonly dicteeDispo = typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  readonly voixDispo = typeof window !== 'undefined' && 'speechSynthesis' in window;

  lire(texte: string) {
    if (!this.voixDispo) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texte);
    u.lang = 'fr-FR';
    u.rate = 1.02;
    const voix = speechSynthesis.getVoices().find((v) => v.lang.startsWith('fr'));
    if (voix) u.voice = voix;
    u.onstart = () => this.zone.run(() => this.parle.set(true));
    u.onend = u.onerror = () => this.zone.run(() => this.parle.set(false));
    speechSynthesis.speak(u);
  }

  taire() {
    if (this.voixDispo) speechSynthesis.cancel();
    this.parle.set(false);
  }

  /** Démarre la dictée. `surTexte` reçoit le texte reconnu depuis le début de l'écoute. */
  ecouter(surTexte: (texte: string) => void) {
    if (!this.dicteeDispo) return;
    this.arreter();
    this.taire();
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const reco = new Ctor();
    reco.lang = 'fr-FR';
    reco.continuous = true;
    reco.interimResults = true;

    reco.onresult = (e: any) => {
      let texte = '';
      for (let i = 0; i < e.results.length; i++) texte += e.results[i][0].transcript;
      this.zone.run(() => surTexte(texte.trim()));
    };
    reco.onend = () => this.zone.run(() => this.ecoute.set(false));
    reco.onerror = () => this.zone.run(() => this.ecoute.set(false));

    this.reco = reco;
    reco.start();
    this.ecoute.set(true);
  }

  arreter() {
    this.reco?.stop();
    this.reco = null;
    this.ecoute.set(false);
  }
}

// ---------- Analyse d'un texte prononcé ----------

const PARASITES = ['euh', 'heu', 'bah', 'ben', 'du coup', 'voilà', 'en fait', 'genre', 'quoi', 'bref', 'enfin bon', 'tu vois', 'vous voyez'];

export function compterMots(texte: string): number {
  return texte.trim().split(/\s+/).filter(Boolean).length;
}

/** Durée estimée à l'oral, sur une base de 140 mots par minute. */
export function dureeOrale(texte: string): number {
  return Math.round((compterMots(texte) / 140) * 60);
}

export function motsParasites(texte: string): { mot: string; nb: number }[] {
  const t = ' ' + texte.toLowerCase().replace(/[.,;!?…]/g, ' ') + ' ';
  return PARASITES.map((mot) => ({ mot, nb: t.split(' ' + mot + ' ').length - 1 })).filter((x) => x.nb > 0);
}

export function formatDuree(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m} min ${String(r).padStart(2, '0')}` : `${r} s`;
}
