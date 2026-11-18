import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Store } from '../core/store';
import { Assistant, Cible } from '../core/assistant';

type Onglet = 'lettre' | 'cv';

@Component({
  selector: 'app-documents',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="entete no-print">
      <div>
        <h1>CV & lettres</h1>
        <p>Génère une lettre de motivation et un CV adaptés à chaque offre, puis exporte-les en PDF.</p>
      </div>
      <div class="onglets">
        <button [class.actif]="onglet() === 'lettre'" (click)="onglet.set('lettre')">Lettre de motivation</button>
        <button [class.actif]="onglet() === 'cv'" (click)="onglet.set('cv')">CV</button>
      </div>
    </div>

    @if (assistant.modeHorsLigne()) {
      <div class="bandeau no-print">
        <span>Mode hors ligne : les textes sont générés à partir d'un modèle simple. Relis-les et personnalise-les.</span>
      </div>
    }

    @if (!profilRempli()) {
      <div class="bandeau no-print">
        <span>Ton profil est presque vide : <a routerLink="/profil">complète-le</a> pour obtenir des documents vraiment personnalisés.</span>
      </div>
    }

    <div class="docs">
      <aside class="carte reglages no-print">
        <h2>L'offre visée</h2>
        @if (store.candidatures().length) {
          <div class="champ">
            <label for="cand">Une de mes candidatures</label>
            <select id="cand" [ngModel]="idCandidature()" (ngModelChange)="choisir($event)">
              <option value="">— Saisie libre —</option>
              @for (c of store.candidatures(); track c.id) {
                <option [value]="c.id">{{ c.entreprise }} · {{ c.poste }}</option>
              }
            </select>
          </div>
        }
        <div class="champ"><label for="poste">Poste</label><input id="poste" [(ngModel)]="cible.poste" /></div>
        <div class="champ"><label for="ent">Entreprise</label><input id="ent" [(ngModel)]="cible.entreprise" /></div>
        <div class="champ">
          <label for="notes">Ce qui t'attire dans l'offre</label>
          <textarea id="notes" rows="3" [(ngModel)]="cible.notes" placeholder="Missions, valeurs, technos… (optionnel)"></textarea>
        </div>

        @if (onglet() === 'lettre') {
          <div class="champ">
            <label for="ton">Ton</label>
            <select id="ton" [(ngModel)]="ton">
              <option>professionnel et chaleureux</option>
              <option>formel</option>
              <option>direct et enthousiaste</option>
            </select>
          </div>
          <button class="btn btn-principal" (click)="genererLettre()" [disabled]="!cible.poste || chargement()">
            @if (chargement()) { <span class="chargement"></span> }
            {{ lettre() ? 'Régénérer la lettre' : 'Générer la lettre' }}
          </button>
        } @else {
          <button class="btn btn-principal" (click)="genererAccroche()" [disabled]="!cible.poste || chargement()">
            @if (chargement()) { <span class="chargement"></span> }
            Adapter l'accroche à l'offre
          </button>
        }
        @if (erreur()) { <p class="aide" style="color: var(--s-refus)">{{ erreur() }}</p> }
      </aside>

      <section class="apercu">
        @if (onglet() === 'lettre') {
          @if (lettre()) {
            <div class="outils no-print">
              <span class="aide">Tu peux modifier le texte directement.</span>
              <button class="btn btn-petit" (click)="copier()">{{ copie() ? 'Copié ✓' : 'Copier' }}</button>
              <button class="btn btn-petit" (click)="imprimer()">PDF</button>
            </div>
            <div class="carte feuille imprimable">
              <div class="lettre-entete">
                <strong>{{ nomComplet() }}</strong>
                <span>{{ store.profil().email }}{{ store.profil().telephone ? ' · ' + store.profil().telephone : '' }}</span>
                <span>{{ store.profil().ville }}{{ store.profil().ville ? ', le ' : 'Le ' }}{{ dateLongue }}</span>
              </div>
              <textarea class="lettre-texte" [ngModel]="lettre()" (ngModelChange)="lettre.set($event)" aria-label="Lettre de motivation"></textarea>
              <div class="lettre-print">{{ lettre() }}</div>
            </div>
          } @else {
            <div class="carte vide">
              <h2>Ta lettre apparaîtra ici</h2>
              <p>Choisis une offre puis clique sur « Générer la lettre ».<br />L'IA s'appuie sur ton profil et n'invente pas d'expérience.</p>
            </div>
          }
        } @else {
          <div class="outils no-print">
            <span class="aide">Le CV reprend ton profil. Clique sur l'accroche pour la modifier.</span>
            <button class="btn btn-petit" (click)="imprimer()">PDF</button>
          </div>
          <div class="carte feuille cv imprimable">
            <header class="cv-entete">
              <h1>{{ nomComplet() }}</h1>
              <div class="cv-titre">{{ cible.poste || store.profil().titre }}</div>
              <div class="cv-contact">
                @for (x of contacts(); track x) { <span>{{ x }}</span> }
              </div>
            </header>
            <p class="cv-accroche" contenteditable="true" (blur)="accroche.set($any($event.target).innerText)">{{ accroche() || store.profil().apropos }}</p>

            <div class="cv-corps">
              <div>
                @if (store.profil().experiences.length) {
                  <h3>Expériences</h3>
                  @for (l of store.profil().experiences; track $index) {
                    <div class="cv-ligne">
                      <div class="cv-ligne-tete"><strong>{{ l.titre }}</strong><span>{{ l.periode }}</span></div>
                      <div class="cv-lieu">{{ l.lieu }}</div>
                      <p>{{ l.description }}</p>
                    </div>
                  }
                }
                @if (store.profil().projets.length) {
                  <h3>Projets</h3>
                  @for (l of store.profil().projets; track $index) {
                    <div class="cv-ligne">
                      <div class="cv-ligne-tete"><strong>{{ l.titre }}</strong><span>{{ l.periode }}</span></div>
                      <div class="cv-lieu">{{ l.lieu }}</div>
                      <p>{{ l.description }}</p>
                    </div>
                  }
                }
                @if (store.profil().formations.length) {
                  <h3>Formation</h3>
                  @for (l of store.profil().formations; track $index) {
                    <div class="cv-ligne">
                      <div class="cv-ligne-tete"><strong>{{ l.titre }}</strong><span>{{ l.periode }}</span></div>
                      <div class="cv-lieu">{{ l.lieu }}</div>
                      @if (l.description) { <p>{{ l.description }}</p> }
                    </div>
                  }
                }
              </div>
              <aside class="cv-cote">
                @if (competences().length) {
                  <h3>Compétences</h3>
                  <div class="tags">
                    @for (c of competences(); track c) { <span>{{ c }}</span> }
                  </div>
                }
                @if (store.profil().langues) {
                  <h3>Langues</h3>
                  <p>{{ store.profil().langues }}</p>
                }
              </aside>
            </div>
          </div>
        }
      </section>
    </div>
  `,
  styles: `
    .docs { display: grid; grid-template-columns: 300px 1fr; gap: 18px; align-items: start; }
    @media (max-width: 1000px) { .docs { grid-template-columns: 1fr; } }
    .reglages { display: flex; flex-direction: column; gap: 14px; position: sticky; top: 20px; }
    .reglages .btn { justify-content: center; }
    .outils { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .outils .aide { flex: 1; }

    .feuille { padding: 44px 50px; min-height: 600px; }
    @media (max-width: 600px) { .feuille { padding: 24px 18px; } }
    .lettre-entete { display: flex; flex-direction: column; font-size: 14px; color: var(--encre-2); margin-bottom: 26px; }
    .lettre-entete strong { color: var(--encre); font-size: 16px; }
    .lettre-texte { width: 100%; min-height: 560px; border: none; outline: none; resize: vertical; font-family: var(--texte); font-size: 15px; line-height: 1.65; background: transparent; }
    .lettre-print { display: none; white-space: pre-wrap; line-height: 1.6; }

    .cv-entete { border-bottom: 2px solid var(--vert); padding-bottom: 14px; }
    .cv-entete h1 { font-size: 32px; color: var(--vert); }
    .cv-titre { font-weight: 600; color: var(--accent); margin-top: 2px; }
    .cv-contact { display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 13px; color: var(--encre-2); margin-top: 8px; }
    .cv-accroche { margin: 16px 0 6px; color: var(--encre-2); outline: none; border-radius: 6px; padding: 4px 6px; margin-left: -6px; }
    .cv-accroche:hover, .cv-accroche:focus { background: var(--surface-2); }
    .cv-corps { display: grid; grid-template-columns: 1fr 190px; gap: 30px; }
    @media (max-width: 700px) { .cv-corps { grid-template-columns: 1fr; } }
    .cv h3 { font-family: var(--titre); font-size: 15px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--vert); margin: 20px 0 10px; }
    .cv-ligne { margin-bottom: 12px; }
    .cv-ligne-tete { display: flex; justify-content: space-between; gap: 10px; }
    .cv-ligne-tete span { font-size: 13px; color: var(--encre-3); white-space: nowrap; }
    .cv-lieu { font-size: 13.5px; color: var(--accent); }
    .cv-ligne p { margin: 3px 0 0; font-size: 14px; }
    .cv-cote p { font-size: 14px; margin: 0; }
    .tags { display: flex; flex-wrap: wrap; gap: 6px; }
    .tags span { background: var(--vert-clair); color: var(--vert); font-size: 12.5px; padding: 3px 9px; border-radius: 99px; }

    @media print {
      .docs { display: block; }
      .lettre-texte { display: none; }
      .lettre-print { display: block; }
      .feuille { min-height: 0; }
    }
  `,
})
export class Documents {
  protected store = inject(Store);
  protected assistant = inject(Assistant);

  protected onglet = signal<Onglet>('lettre');
  protected idCandidature = signal('');
  protected cible: Cible = { poste: '', entreprise: '', notes: '' };
  protected ton = 'professionnel et chaleureux';
  protected lettre = signal('');
  protected accroche = signal('');
  protected chargement = signal(false);
  protected erreur = signal('');
  protected copie = signal(false);
  protected dateLongue = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  protected nomComplet = computed(() => {
    const p = this.store.profil();
    return [p.prenom, p.nom].filter(Boolean).join(' ') || 'Prénom Nom';
  });

  protected profilRempli = computed(() => {
    const p = this.store.profil();
    return !!(p.prenom && (p.experiences.length || p.projets.length || p.formations.length));
  });

  protected competences = computed(() =>
    this.store.profil().competences.split(',').map((s) => s.trim()).filter(Boolean),
  );

  protected contacts = computed(() => {
    const p = this.store.profil();
    return [p.email, p.telephone, p.ville, p.linkedin, p.github].filter(Boolean);
  });

  constructor() {
    const id = inject(ActivatedRoute).snapshot.queryParamMap.get('id');
    if (id) this.choisir(id);
  }

  protected choisir(id: string) {
    this.idCandidature.set(id);
    const c = this.store.trouver(id);
    this.cible = c ? { poste: c.poste, entreprise: c.entreprise, notes: c.notes } : { poste: '', entreprise: '', notes: '' };
    this.accroche.set('');
  }

  protected genererLettre() {
    return this.executer(async () => this.lettre.set(await this.assistant.lettre(this.cible, this.ton)));
  }

  protected genererAccroche() {
    return this.executer(async () => this.accroche.set(await this.assistant.accroche(this.cible)));
  }

  private async executer(action: () => Promise<void>) {
    this.chargement.set(true);
    this.erreur.set('');
    try {
      await action();
    } catch (e) {
      this.erreur.set(e instanceof Error ? e.message : 'La génération a échoué.');
    } finally {
      this.chargement.set(false);
    }
  }

  protected async copier() {
    await navigator.clipboard.writeText(this.lettre());
    this.copie.set(true);
    setTimeout(() => this.copie.set(false), 1800);
  }

  protected imprimer() {
    window.print();
  }
}
