import { Component, ElementRef, computed, effect, input, output, viewChild } from '@angular/core';
import { Profil } from '../../core/models';
import { ModeleDoc } from './cv';

export interface Destinataire {
  entreprise: string;
  service: string;
  adresse: string;
}

/** Lettre de motivation au format A4, avec un en-tête assorti au modèle de CV choisi. */
@Component({
  selector: 'app-lettre',
  template: `
    <article class="page-a4 lettre" [attr.data-modele]="modele()" [style.--c]="couleur()" lang="fr">
      @if (modele() === 'epure') { <div class="barre"></div> }
      @if (modele() === 'moderne') { <div class="bande"></div> }

      <header class="expediteur">
        <div class="nom">{{ nom() }}</div>
        @if (p().titre) { <div class="sous-titre">{{ p().titre }}</div> }
        <div class="coord">
          @for (x of coordonnees(); track x) { <span>{{ x }}</span> }
        </div>
      </header>

      <div class="destinataire">
        <strong>{{ destinataire().entreprise || 'Nom de l\\'entreprise' }}</strong>
        @if (destinataire().service) { <span>{{ destinataire().service }}</span> }
        @for (l of adresse(); track $index) { <span>{{ l }}</span> }
      </div>

      <p class="date">{{ p().ville || '[Ville]' }}, le {{ date }}</p>

      <p class="objet"><span>Objet :</span> {{ objet() || 'Candidature au poste de …' }}</p>

      <div class="corps" #corps contenteditable="true" spellcheck="true" (input)="saisie()" (blur)="saisie()"></div>

      <p class="signature">{{ nom() }}</p>
    </article>
  `,
  styles: `
    :host { display: block; }
    .page-a4 {
      width: 210mm; height: 297mm; overflow: hidden; position: relative; box-sizing: border-box;
      background: #fff; color: #222; padding: 64px 76px;
      font-family: 'Source Serif 4', Georgia, serif; font-size: 13.5px; line-height: 1.62;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    p { margin: 0; }

    .expediteur { margin-bottom: 34px; }
    .nom { font-family: 'Fraunces', Georgia, serif; font-weight: 600; font-size: 24px; color: var(--c); line-height: 1.15; }
    .sous-titre { font-family: 'Inter', sans-serif; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #666; margin-top: 4px; font-weight: 600; }
    .coord { font-family: 'Inter', sans-serif; font-size: 11px; color: #555; margin-top: 8px; display: flex; flex-wrap: wrap; gap: 2px 14px; }

    .destinataire { margin-left: auto; width: 46%; display: flex; flex-direction: column; margin-bottom: 26px; }
    .destinataire strong { font-weight: 600; color: #111; }
    .date { text-align: right; margin-bottom: 26px; color: #444; }
    .objet { font-weight: 600; margin-bottom: 26px; color: #111; }
    .objet span { color: var(--c); }

    .corps { white-space: pre-wrap; text-align: justify; hyphens: auto; outline: none; min-height: 300px; border-radius: 4px; transition: background 0.15s; }
    .corps:hover { background: rgb(0 0 0 / 0.02); }
    .corps:focus { background: rgb(0 0 0 / 0.03); }
    .signature { margin-top: 34px; margin-left: 55%; font-family: 'Fraunces', serif; font-size: 16px; color: #111; }

    /* variantes d'en-tête, assorties aux CV */
    [data-modele='classique'] .expediteur { text-align: center; padding-bottom: 16px; border-bottom: 1.5px solid var(--c); }
    [data-modele='classique'] .coord { justify-content: center; }
    [data-modele='moderne'] { padding-left: 96px; }
    [data-modele='moderne'] .bande { position: absolute; left: 0; top: 0; bottom: 0; width: 22px; background: var(--c); }
    [data-modele='moderne'] .nom { color: #161616; font-size: 28px; }
    [data-modele='moderne'] .sous-titre { color: var(--c); }
    [data-modele='epure'] { padding-top: 0; font-family: 'Inter', sans-serif; font-size: 12.5px; line-height: 1.65; }
    [data-modele='epure'] .barre { height: 10px; background: var(--c); margin: 0 -76px 48px; }
    [data-modele='epure'] .nom { font-family: 'Inter', sans-serif; font-weight: 700; letter-spacing: -0.03em; font-size: 26px; color: #111; }
    [data-modele='epure'] .sous-titre { color: var(--c); letter-spacing: 0; text-transform: none; font-weight: 500; font-size: 12.5px; }
    [data-modele='epure'] .signature { font-family: 'Inter', sans-serif; font-weight: 600; font-size: 14px; }

    [data-modele='ats'] { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #000; }
    [data-modele='ats'] .nom { font-family: Arial, Helvetica, sans-serif; font-weight: 700; color: #000; font-size: 22px; }
    [data-modele='ats'] .sous-titre { color: #000; letter-spacing: 0; text-transform: none; font-size: 13px; }
    [data-modele='ats'] .coord { color: #000; font-size: 12px; }
    [data-modele='ats'] .objet span { color: #000; }
    [data-modele='ats'] .corps { text-align: left; hyphens: manual; }
    [data-modele='ats'] .signature { font-family: Arial, Helvetica, sans-serif; font-weight: 700; font-size: 13px; }

    @media print { .corps:hover, .corps:focus { background: none; } }
  `,
})
export class LettreApercu {
  readonly p = input.required<Profil>();
  readonly modele = input<ModeleDoc>('classique');
  readonly couleur = input('#1f4d43');
  readonly objet = input('');
  readonly corps = input('');
  readonly destinataire = input<Destinataire>({ entreprise: '', service: '', adresse: '' });
  readonly corpsChange = output<string>();

  private zone = viewChild.required<ElementRef<HTMLDivElement>>('corps');
  private dernierTexte = '';

  protected date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  protected nom = computed(() => [this.p().prenom, this.p().nom].filter(Boolean).join(' ') || 'Prénom Nom');
  protected coordonnees = computed(() => [this.p().email, this.p().telephone, this.p().ville].filter(Boolean));
  protected adresse = computed(() => this.destinataire().adresse.split('\n').map((l) => l.trim()).filter(Boolean));

  constructor() {
    // On ne réécrit le contenu que s'il vient de l'extérieur (génération),
    // sinon le curseur sauterait pendant la frappe.
    effect(() => {
      const texte = this.corps();
      const el = this.zone().nativeElement;
      if (texte !== this.dernierTexte) {
        el.innerText = texte;
        this.dernierTexte = texte;
      }
    });
  }

  protected saisie() {
    this.dernierTexte = this.zone().nativeElement.innerText;
    this.corpsChange.emit(this.dernierTexte);
  }
}
