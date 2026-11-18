import { Component, computed, input } from '@angular/core';
import { LigneParcours, Profil } from '../../core/models';
import { puces } from '../../core/ats';

export type ModeleDoc = 'ats' | 'classique' | 'moderne' | 'epure';
export type Densite = 'compacte' | 'normale' | 'aeree';

export const COULEURS = [
  { nom: 'Sapin', valeur: '#1f4d43' },
  { nom: 'Marine', valeur: '#1d3a5f' },
  { nom: 'Bordeaux', valeur: '#7a2638' },
  { nom: 'Ardoise', valeur: '#34404d' },
  { nom: 'Terracotta', valeur: '#a24a2c' },
];

/** Aperçu A4 d'un CV. Le même composant sert à l'écran et à l'impression. */
@Component({
  selector: 'app-cv',
  template: `
    <article class="page-a4 cv" [attr.data-modele]="modele()" [attr.data-densite]="densite()" [style.--c]="couleur()" lang="fr">
      @switch (modele()) {
        <!-- ============ MODERNE : colonne latérale colorée ============ -->
        @case ('moderne') {
          <aside class="cote">
            <div class="photo">
              @if (p().photo) { <img [src]="p().photo" alt="" /> } @else { <span>{{ initiales() }}</span> }
            </div>
            <h3>Contact</h3>
            <ul class="contact">
              @for (x of contacts(); track x.v) { <li><span class="ico">{{ x.ico }}</span>{{ x.v }}</li> }
            </ul>
            @if (competences().length) {
              <h3>Compétences</h3>
              <ul class="puces">
                @for (c of competences(); track c) { <li>{{ c }}</li> }
              </ul>
            }
            @if (p().langues) {
              <h3>Langues</h3>
              <p>{{ p().langues }}</p>
            }
            @if (p().interets) {
              <h3>Centres d'intérêt</h3>
              <p>{{ p().interets }}</p>
            }
          </aside>
          <div class="principal">
            <header>
              <h1>{{ nom() }}</h1>
              <div class="titre">{{ titre() }}</div>
            </header>
            @if (texteAccroche()) { <p class="accroche">{{ texteAccroche() }}</p> }
            @for (s of sections(); track s.titre) {
              <section>
                <h2>{{ s.titre }}</h2>
                <div class="frise">
                  @for (l of s.lignes; track $index) {
                    <div class="ligne">
                      <div class="ligne-tete"><strong>{{ l.titre }}</strong><span class="periode">{{ l.periode }}</span></div>
                      @if (l.lieu) { <div class="lieu">{{ l.lieu }}</div> }
                      @if (l.description) { <p>{{ l.description }}</p> }
                    </div>
                  }
                </div>
              </section>
            }
          </div>
        }

        <!-- ============ ÉPURÉ : intitulés en marge ============ -->
        @case ('epure') {
          <div class="barre"></div>
          <header>
            <div>
              <h1>{{ nom() }}</h1>
              <div class="titre">{{ titre() }}</div>
            </div>
            <ul class="contact">
              @for (x of contacts(); track x.v) { <li>{{ x.v }}</li> }
            </ul>
          </header>
          @if (texteAccroche()) {
            <div class="rang"><h2>Profil</h2><p class="accroche">{{ texteAccroche() }}</p></div>
          }
          @for (s of sections(); track s.titre) {
            <div class="rang">
              <h2>{{ s.titre }}</h2>
              <div>
                @for (l of s.lignes; track $index) {
                  <div class="ligne">
                    <div class="ligne-tete"><strong>{{ l.titre }}</strong><span class="periode">{{ l.periode }}</span></div>
                    @if (l.lieu) { <div class="lieu">{{ l.lieu }}</div> }
                    @if (l.description) { <p>{{ l.description }}</p> }
                  </div>
                }
              </div>
            </div>
          }
          @if (competences().length) {
            <div class="rang"><h2>Compétences</h2><p class="tags">@for (c of competences(); track c) { <span>{{ c }}</span> }</p></div>
          }
          @if (p().langues || p().interets) {
            <div class="rang">
              <h2>Divers</h2>
              <div>
                @if (p().langues) { <p><strong>Langues</strong> · {{ p().langues }}</p> }
                @if (p().interets) { <p><strong>Centres d'intérêt</strong> · {{ p().interets }}</p> }
              </div>
            </div>
          }
        }

        <!-- ============ ATS : texte brut structuré, intitulés standards, aucune mise en forme piégeuse ============ -->
        @case ('ats') {
          <header>
            <h1>{{ nom() }}</h1>
            @if (titre()) { <p class="titre">{{ titre() }}</p> }
            <p class="contact">
              @if (p().email) { E-mail : {{ p().email }} }
              @if (p().telephone) { | Téléphone : {{ p().telephone }} }
              @if (p().ville) { | Ville : {{ p().ville }} }
            </p>
            @if (p().linkedin || p().github) {
              <p class="contact">
                @if (p().linkedin) { LinkedIn : {{ p().linkedin }} }
                @if (p().github) { @if (p().linkedin) { | } Portfolio : {{ p().github }} }
              </p>
            }
          </header>
          @if (texteAccroche()) {
            <section><h2>Profil</h2><p>{{ texteAccroche() }}</p></section>
          }
          @for (s of sectionsAts(); track s.titre) {
            <section>
              <h2>{{ s.titre }}</h2>
              @for (l of s.lignes; track $index) {
                <div class="ligne">
                  <p><strong>{{ l.titre }}</strong>@if (l.lieu) { – {{ l.lieu }} }</p>
                  @if (l.periode) { <p class="periode">{{ l.periode }}</p> }
                  @if (l.description) {
                    <ul class="puces">
                      @for (d of decoupe(l.description); track $index) { <li>{{ d }}</li> }
                    </ul>
                  }
                </div>
              }
            </section>
          }
          @if (competences().length) {
            <section><h2>Compétences</h2><p>{{ competences().join(', ') }}</p></section>
          }
          @if (p().langues) {
            <section><h2>Langues</h2><p>{{ p().langues }}</p></section>
          }
          @if (p().interets) {
            <section><h2>Centres d'intérêt</h2><p>{{ p().interets }}</p></section>
          }
        }

        <!-- ============ CLASSIQUE : une colonne, lisible par les logiciels de tri ============ -->
        @default {
          <header>
            <div class="identite">
              <h1>{{ nom() }}</h1>
              <div class="titre">{{ titre() }}</div>
              <p class="contact">
                @for (x of contacts(); track x.v; let dernier = $last) { {{ x.v }}@if (!dernier) { <span class="sep">·</span> } }
              </p>
            </div>
            @if (p().photo) { <img class="photo" [src]="p().photo" alt="" /> }
          </header>
          @if (texteAccroche()) { <p class="accroche">{{ texteAccroche() }}</p> }
          @for (s of sections(); track s.titre) {
            <section>
              <h2>{{ s.titre }}</h2>
              @for (l of s.lignes; track $index) {
                <div class="ligne">
                  <div class="ligne-tete">
                    <span><strong>{{ l.titre }}</strong>@if (l.lieu) { <span class="lieu"> — {{ l.lieu }}</span> }</span>
                    <span class="periode">{{ l.periode }}</span>
                  </div>
                  @if (l.description) { <p>{{ l.description }}</p> }
                </div>
              }
            </section>
          }
          @if (competences().length || p().langues || p().interets) {
            <section>
              <h2>Compétences & divers</h2>
              <dl>
                @if (competences().length) { <dt>Compétences</dt><dd>{{ competences().join(' · ') }}</dd> }
                @if (p().langues) { <dt>Langues</dt><dd>{{ p().langues }}</dd> }
                @if (p().interets) { <dt>Centres d'intérêt</dt><dd>{{ p().interets }}</dd> }
              </dl>
            </section>
          }
        }
      }
    </article>
  `,
  styles: `
    :host { display: block; }

    /* ---------- base commune ---------- */
    .page-a4 {
      width: 210mm; height: 297mm; overflow: hidden; position: relative;
      background: #fff; color: #222; box-sizing: border-box;
      font-family: 'Inter', system-ui, sans-serif; font-size: var(--fs); line-height: 1.5;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
      hyphens: auto;
    }
    .cv[data-densite='compacte'] { --fs: 11.5px; --esp: 0.7; }
    .cv[data-densite='normale'] { --fs: 12.5px; --esp: 1; }
    .cv[data-densite='aeree'] { --fs: 13.5px; --esp: 1.25; }
    h1, h2, h3, p { margin: 0; }
    strong { font-weight: 600; color: #111; }
    .periode { color: #777; font-size: 0.92em; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .ligne { margin-bottom: calc(12px * var(--esp)); break-inside: avoid; }
    .ligne-tete { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
    .ligne p { margin-top: 2px; color: #333; }
    ul { list-style: none; margin: 0; padding: 0; }

    /* ---------- CLASSIQUE ---------- */
    [data-modele='classique'] { padding: 56px 64px; font-family: 'Source Serif 4', Georgia, serif; font-size: calc(var(--fs) + 0.5px); }
    [data-modele='classique'] header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; padding-bottom: calc(16px * var(--esp)); border-bottom: 1.5px solid var(--c); }
    [data-modele='classique'] h1 { font-family: 'Fraunces', Georgia, serif; font-weight: 600; font-size: 32px; letter-spacing: -0.01em; color: var(--c); line-height: 1.1; }
    [data-modele='classique'] .titre { font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #555; margin-top: 6px; }
    [data-modele='classique'] .contact { font-family: 'Inter', sans-serif; font-size: 11.5px; color: #555; margin-top: 10px; }
    [data-modele='classique'] .sep { margin: 0 7px; color: var(--c); }
    [data-modele='classique'] .photo { width: 92px; height: 92px; border-radius: 6px; object-fit: cover; }
    [data-modele='classique'] .accroche { margin: calc(16px * var(--esp)) 0 0; font-style: italic; color: #444; }
    [data-modele='classique'] section { margin-top: calc(20px * var(--esp)); }
    [data-modele='classique'] h2 { font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--c); margin-bottom: calc(10px * var(--esp)); display: flex; align-items: center; gap: 10px; }
    [data-modele='classique'] h2::after { content: ''; flex: 1; height: 1px; background: #ddd; }
    [data-modele='classique'] .lieu { color: #666; font-style: italic; }
    [data-modele='classique'] dl { display: grid; grid-template-columns: 130px 1fr; gap: 6px 14px; margin: 0; }
    [data-modele='classique'] dt { font-family: 'Inter', sans-serif; font-weight: 600; font-size: 0.88em; color: #444; }
    [data-modele='classique'] dd { margin: 0; }

    /* ---------- MODERNE ---------- */
    [data-modele='moderne'] { display: grid; grid-template-columns: 250px 1fr; }
    [data-modele='moderne'] .cote { background: var(--c); color: rgb(255 255 255 / 0.88); padding: 44px 26px; font-size: 0.94em; }
    [data-modele='moderne'] .photo { width: 120px; height: 120px; border-radius: 50%; margin: 0 auto 26px; background: rgb(255 255 255 / 0.14); display: grid; place-items: center; overflow: hidden; border: 3px solid rgb(255 255 255 / 0.25); }
    [data-modele='moderne'] .photo img { width: 100%; height: 100%; object-fit: cover; }
    [data-modele='moderne'] .photo span { font-family: 'Fraunces', serif; font-size: 40px; color: #fff; font-weight: 600; }
    [data-modele='moderne'] h3 { font-size: 10.5px; letter-spacing: 0.16em; text-transform: uppercase; color: #fff; font-weight: 700; margin: calc(22px * var(--esp)) 0 calc(8px * var(--esp)); padding-bottom: 5px; border-bottom: 1px solid rgb(255 255 255 / 0.25); }
    [data-modele='moderne'] .contact li { display: flex; gap: 8px; margin-bottom: 6px; word-break: break-word; }
    [data-modele='moderne'] .ico { width: 14px; flex-shrink: 0; opacity: 0.7; text-align: center; }
    [data-modele='moderne'] .puces { display: flex; flex-wrap: wrap; gap: 5px; }
    [data-modele='moderne'] .puces li { background: rgb(255 255 255 / 0.14); border-radius: 4px; padding: 2px 8px; }
    [data-modele='moderne'] .principal { padding: 52px 44px 40px; }
    [data-modele='moderne'] h1 { font-family: 'Fraunces', serif; font-weight: 600; font-size: 36px; line-height: 1.05; color: #161616; letter-spacing: -0.015em; }
    [data-modele='moderne'] .titre { color: var(--c); font-weight: 600; font-size: 14px; margin-top: 8px; }
    [data-modele='moderne'] .accroche { margin-top: calc(18px * var(--esp)); color: #444; padding-left: 14px; border-left: 3px solid var(--c); }
    [data-modele='moderne'] section { margin-top: calc(24px * var(--esp)); }
    [data-modele='moderne'] h2 { font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--c); margin-bottom: calc(12px * var(--esp)); }
    [data-modele='moderne'] .frise { border-left: 2px solid #e6e6e6; padding-left: 18px; }
    [data-modele='moderne'] .frise .ligne { position: relative; }
    [data-modele='moderne'] .frise .ligne::before { content: ''; position: absolute; left: -24px; top: 5px; width: 8px; height: 8px; border-radius: 50%; background: #fff; border: 2px solid var(--c); }
    [data-modele='moderne'] .lieu { color: var(--c); font-size: 0.93em; font-weight: 500; }

    /* ---------- ÉPURÉ ---------- */
    [data-modele='epure'] { padding: 0 60px 48px; }
    [data-modele='epure'] .barre { height: 10px; background: var(--c); margin: 0 -60px 44px; }
    [data-modele='epure'] header { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; padding-bottom: calc(22px * var(--esp)); margin-bottom: calc(6px * var(--esp)); border-bottom: 1px solid #e5e5e5; }
    [data-modele='epure'] h1 { font-size: 34px; font-weight: 700; letter-spacing: -0.03em; line-height: 1; color: #111; }
    [data-modele='epure'] .titre { color: var(--c); font-weight: 500; font-size: 14px; margin-top: 8px; }
    [data-modele='epure'] .contact { text-align: right; font-size: 11px; color: #555; line-height: 1.6; }
    [data-modele='epure'] .rang { display: grid; grid-template-columns: 128px 1fr; gap: 18px; padding: calc(14px * var(--esp)) 0; border-bottom: 1px solid #f0f0f0; }
    [data-modele='epure'] .rang:last-child { border-bottom: none; }
    [data-modele='epure'] h2 { font-size: 10.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #999; padding-top: 2px; }
    [data-modele='epure'] .accroche { color: #333; font-size: 1.04em; }
    [data-modele='epure'] .lieu { color: #777; }
    [data-modele='epure'] .ligne:last-child { margin-bottom: 0; }
    [data-modele='epure'] .tags { display: flex; flex-wrap: wrap; gap: 6px; }
    [data-modele='epure'] .tags span { border: 1px solid color-mix(in srgb, var(--c) 35%, white); color: var(--c); border-radius: 99px; padding: 1px 10px; font-size: 0.92em; }
    [data-modele='epure'] .rang p + p { margin-top: 4px; }

    /* ---------- ATS : police standard, noir sur blanc, une seule colonne ---------- */
    [data-modele='ats'] { padding: 54px 62px; font-family: Arial, Helvetica, sans-serif; color: #000; font-size: calc(var(--fs) + 0.5px); line-height: 1.45; hyphens: manual; }
    [data-modele='ats'] h1 { font-size: 24px; font-weight: 700; }
    [data-modele='ats'] .titre { font-size: 14px; font-weight: 700; margin-top: 2px; }
    [data-modele='ats'] .contact { margin-top: 3px; }
    [data-modele='ats'] section { margin-top: calc(16px * var(--esp)); }
    [data-modele='ats'] h2 { font-size: 13px; font-weight: 700; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: calc(8px * var(--esp)); }
    [data-modele='ats'] strong { color: #000; font-weight: 700; }
    [data-modele='ats'] .periode { color: #000; font-style: italic; }
    [data-modele='ats'] .puces { list-style: disc; padding-left: 18px; margin-top: 3px; }
    [data-modele='ats'] .puces li { margin-bottom: 1px; }
  `,
})
export class CvApercu {
  readonly p = input.required<Profil>();
  readonly accroche = input('');
  readonly poste = input('');
  readonly modele = input<ModeleDoc>('classique');
  readonly couleur = input(COULEURS[0].valeur);
  readonly densite = input<Densite>('normale');

  protected nom = computed(() => [this.p().prenom, this.p().nom].filter(Boolean).join(' ') || 'Prénom Nom');
  protected titre = computed(() => this.poste() || this.p().titre);
  protected texteAccroche = computed(() => this.accroche() || this.p().apropos);
  protected initiales = computed(() => ((this.p().prenom[0] ?? '') + (this.p().nom[0] ?? '')).toUpperCase() || '?');
  protected competences = computed(() => this.p().competences.split(',').map((s) => s.trim()).filter(Boolean));

  protected contacts = computed(() => {
    const p = this.p();
    const net = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '');
    return [
      { ico: '✉', v: p.email },
      { ico: '☏', v: p.telephone },
      { ico: '⌂', v: p.ville },
      { ico: 'in', v: net(p.linkedin) },
      { ico: '‹›', v: net(p.github) },
    ].filter((x) => x.v);
  });

  protected decoupe = puces;

  /** Intitulés standards, ceux que les logiciels de tri reconnaissent. */
  protected sectionsAts = computed(() =>
    this.sections().map((s) => ({ ...s, titre: s.titre === 'Expériences' ? 'Expérience professionnelle' : s.titre })),
  );

  protected sections = computed(() => {
    const p = this.p();
    const garde = (l: LigneParcours[]) => l.filter((x) => x.titre || x.description);
    return [
      { titre: 'Expériences', lignes: garde(p.experiences) },
      { titre: 'Projets', lignes: garde(p.projets) },
      { titre: 'Formation', lignes: garde(p.formations) },
    ].filter((s) => s.lignes.length);
  });
}
