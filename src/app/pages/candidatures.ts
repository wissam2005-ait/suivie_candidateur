import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Store, nouvelId } from '../core/store';
import { Candidature, CONTRATS, SOURCES, STATUTS, Statut, labelStatut } from '../core/models';
import { aujourdhui, ajouterJours, formatCourt } from '../core/dates';
import { depuisCsv, telecharger, versCsv } from '../core/csv';

type Vue = 'liste' | 'tableau';

function vueSauvee(): Vue {
  try {
    return localStorage.getItem('postulo.vue') === 'tableau' ? 'tableau' : 'liste';
  } catch {
    return 'liste';
  }
}

function vierge(): Candidature {
  const maintenant = new Date().toISOString();
  return {
    id: nouvelId(),
    entreprise: '',
    poste: '',
    contrat: 'Alternance',
    lieu: '',
    source: 'LinkedIn',
    lien: '',
    contact: '',
    statut: 'envoyee',
    dateCandidature: aujourdhui(),
    dateRelance: '',
    dateEntretien: '',
    notes: '',
    creeLe: maintenant,
    majLe: maintenant,
  };
}

@Component({
  selector: 'app-candidatures',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="entete">
      <div>
        <h1>Candidatures</h1>
        <p>{{ store.candidatures().length }} au total · {{ store.aRelancer().length }} à relancer</p>
      </div>
      <div class="actions">
        <label class="btn">
          <svg viewBox="0 0 24 24"><path d="M12 15V3m0 0L7 8m5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></svg>
          Importer
          <input type="file" accept=".csv,text/csv" hidden (change)="importer($event)" />
        </label>
        <button class="btn" (click)="exporter()" [disabled]="!store.candidatures().length">
          <svg viewBox="0 0 24 24"><path d="M12 3v12m0 0-5-5m5 5 5-5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></svg>
          Exporter
        </button>
        <button class="btn btn-principal" (click)="ouvrir()">
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
          Ajouter
        </button>
      </div>
    </div>

    <div class="barre-outils">
      <div class="recherche">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input type="search" placeholder="Rechercher une entreprise, un poste…" [ngModel]="recherche()" (ngModelChange)="recherche.set($event)" />
      </div>
      <select class="filtre" [ngModel]="filtre()" (ngModelChange)="filtre.set($event)" aria-label="Filtrer par statut">
        <option value="">Tous les statuts</option>
        <option value="relance">À relancer</option>
        @for (s of statuts; track s.id) {
          <option [value]="s.id">{{ s.label }}</option>
        }
      </select>
      <div class="onglets">
        <button [class.actif]="vue() === 'liste'" (click)="vue.set('liste')">Liste</button>
        <button [class.actif]="vue() === 'tableau'" (click)="vue.set('tableau')">Tableau</button>
      </div>
    </div>

    @if (!store.candidatures().length) {
      <div class="carte vide">
        <h2>Ton suivi est vide</h2>
        <p>
          Tu as déjà un fichier Excel ? Enregistre-le en <strong>CSV</strong> (Fichier → Enregistrer sous → CSV)<br />
          puis clique sur « Importer ». Les colonnes Entreprise, Poste, Statut, Date… sont reconnues automatiquement.
        </p>
        <div class="actions">
          <button class="btn btn-principal" (click)="ouvrir()">Ajouter une candidature</button>
          <button class="btn" (click)="store.chargerExemples()">Charger des exemples</button>
        </div>
      </div>
    } @else if (vue() === 'liste') {
      <div class="carte" style="padding: 6px 8px">
        <div class="tableau-wrap">
          <table>
            <thead>
              <tr>
                <th>Entreprise</th>
                <th>Contrat</th>
                <th>Statut</th>
                <th>Envoyée le</th>
                <th>Prochaine étape</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (c of filtrees(); track c.id) {
                <tr (click)="ouvrir(c)">
                  <td>
                    <div class="entreprise">{{ c.entreprise }}</div>
                    <div class="sous">{{ c.poste }}{{ c.lieu ? ' · ' + c.lieu : '' }}</div>
                  </td>
                  <td>{{ c.contrat }}</td>
                  <td><span class="statut" [attr.data-s]="c.statut">{{ label(c.statut) }}</span></td>
                  <td>{{ court(c.dateCandidature) }}</td>
                  <td class="sous">{{ prochaineEtape(c) }}</td>
                  <td style="text-align: right">
                    @if (c.lien) {
                      <a class="btn-icone" [href]="c.lien" target="_blank" rel="noopener" (click)="$event.stopPropagation()" title="Voir l'offre">
                        <svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
                      </a>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="aide" style="text-align: center; padding: 30px">Aucun résultat pour ces filtres.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    } @else {
      <div class="kanban">
        @for (col of colonnes(); track col.id) {
          <div class="colonne" [attr.data-s]="col.id" [class.survol]="survol() === col.id"
               (dragover)="$event.preventDefault(); survol.set(col.id)" (dragleave)="survol.set(null)" (drop)="deposer(col.id)">
            <div class="colonne-titre">
              <span class="statut" [attr.data-s]="col.id">{{ col.label }}</span>
              <span class="aide">{{ col.items.length }}</span>
            </div>
            @for (c of col.items; track c.id) {
              <div class="fiche" draggable="true" (dragstart)="glisse = c.id" (click)="ouvrir(c)">
                <div class="entreprise">{{ c.entreprise }}</div>
                <div class="sous">{{ c.poste }}</div>
                <div class="fiche-pied">
                  <span>{{ c.contrat }}</span>
                  <span>{{ court(c.dateCandidature) }}</span>
                </div>
              </div>
            }
          </div>
        }
      </div>
      <p class="aide" style="margin-top: 10px">Astuce : fais glisser une fiche d'une colonne à l'autre pour changer son statut.</p>
    }

    @if (edition(); as e) {
      <div class="modale-fond" (click)="fermer()">
        <form class="modale" (click)="$event.stopPropagation()" (ngSubmit)="enregistrer()" #f="ngForm">
          <div class="modale-entete">
            <h2>{{ estNouvelle() ? 'Nouvelle candidature' : e.entreprise }}</h2>
            <button type="button" class="btn-icone" (click)="fermer()" aria-label="Fermer">
              <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>

          <div class="form-grille">
            <div class="champ">
              <label for="entreprise">Entreprise *</label>
              <input id="entreprise" name="entreprise" [(ngModel)]="e.entreprise" required autofocus />
            </div>
            <div class="champ">
              <label for="poste">Poste *</label>
              <input id="poste" name="poste" [(ngModel)]="e.poste" required placeholder="ex. Développeur web" />
            </div>
            <div class="champ">
              <label for="contrat">Type de contrat</label>
              <select id="contrat" name="contrat" [(ngModel)]="e.contrat">
                @for (t of contrats; track t) { <option [value]="t">{{ t }}</option> }
              </select>
            </div>
            <div class="champ">
              <label for="statut">Statut</label>
              <select id="statut" name="statut" [(ngModel)]="e.statut">
                @for (s of statuts; track s.id) { <option [value]="s.id">{{ s.label }}</option> }
              </select>
            </div>
            <div class="champ">
              <label for="lieu">Lieu</label>
              <input id="lieu" name="lieu" [(ngModel)]="e.lieu" placeholder="Ville ou télétravail" />
            </div>
            <div class="champ">
              <label for="source">Trouvée via</label>
              <select id="source" name="source" [(ngModel)]="e.source">
                @for (s of sources; track s) { <option [value]="s">{{ s }}</option> }
              </select>
            </div>
            <div class="champ">
              <label for="dateCandidature">Date de candidature</label>
              <input id="dateCandidature" type="date" name="dateCandidature" [(ngModel)]="e.dateCandidature" />
            </div>
            <div class="champ">
              <label for="dateRelance">Date de relance</label>
              <input id="dateRelance" type="date" name="dateRelance" [(ngModel)]="e.dateRelance" />
            </div>
            <div class="champ">
              <label for="dateEntretien">Date d'entretien</label>
              <input id="dateEntretien" type="date" name="dateEntretien" [(ngModel)]="e.dateEntretien" />
            </div>
            <div class="champ">
              <label for="contact">Contact</label>
              <input id="contact" name="contact" [(ngModel)]="e.contact" placeholder="Nom, e-mail du recruteur…" />
            </div>
            <div class="champ large">
              <label for="lien">Lien de l'offre</label>
              <input id="lien" type="url" name="lien" [(ngModel)]="e.lien" placeholder="https://" />
            </div>
            <div class="champ large">
              <label for="notes">Notes</label>
              <textarea id="notes" name="notes" rows="4" [(ngModel)]="e.notes" placeholder="Ce qui t'a plu dans l'offre, questions à poser, retour d'entretien…"></textarea>
            </div>
          </div>

          @if (!estNouvelle()) {
            <div class="raccourcis">
              <a class="btn btn-petit" routerLink="/entretien" [queryParams]="{ id: e.id }">Préparer l'entretien</a>
              <a class="btn btn-petit" routerLink="/documents" [queryParams]="{ id: e.id }">Lettre & CV pour cette offre</a>
            </div>
          }

          <div class="modale-pied">
            @if (!estNouvelle()) {
              <button type="button" class="btn btn-danger" (click)="supprimer(e)">Supprimer</button>
            }
            <span class="espace"></span>
            <button type="button" class="btn" (click)="fermer()">Annuler</button>
            <button type="submit" class="btn btn-principal" [disabled]="f.invalid">Enregistrer</button>
          </div>
        </form>
      </div>
    }

    @if (message()) {
      <div class="toast">{{ message() }}</div>
    }
  `,
  styles: `
    .barre-outils { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
    .recherche { flex: 1; min-width: 220px; position: relative; }
    .recherche svg { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--encre-3); }
    .recherche input { padding-left: 36px; }
    select.filtre { width: auto; }

    .kanban { display: grid; grid-template-columns: repeat(6, minmax(190px, 1fr)); gap: 12px; overflow-x: auto; padding-bottom: 6px; }
    .colonne { background: var(--fond-3); border-radius: var(--rayon); padding: 10px; min-height: 300px; transition: background 0.15s; }
    .colonne.survol { background: color-mix(in srgb, var(--c) 14%, var(--fond-3)); }
    .colonne-titre { display: flex; justify-content: space-between; align-items: center; margin: 2px 2px 10px; }
    .fiche { background: var(--surface); border: 1px solid var(--bord); border-left: 3px solid var(--c); border-radius: 9px; padding: 10px 11px; margin-bottom: 8px; cursor: grab; font-size: 14px; }
    .fiche:hover { box-shadow: var(--ombre); }
    .fiche .sous { font-size: 12.5px; }
    .fiche-pied { display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px; color: var(--encre-3); }

    .raccourcis { display: flex; gap: 8px; margin-top: 18px; flex-wrap: wrap; }
  `,
})
export class Candidatures {
  protected store = inject(Store);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected statuts = STATUTS;
  protected contrats = CONTRATS;
  protected sources = SOURCES;
  protected label = labelStatut;
  protected court = formatCourt;

  protected recherche = signal('');
  protected filtre = signal<string>('');
  protected vue = signal<Vue>(vueSauvee());
  protected edition = signal<Candidature | null>(null);
  protected estNouvelle = signal(false);
  protected survol = signal<Statut | null>(null);
  protected message = signal('');
  protected glisse: string | null = null;

  protected filtrees = computed(() => {
    const q = this.recherche().toLowerCase().trim();
    const f = this.filtre();
    const relances = new Set(this.store.aRelancer().map((c) => c.id));
    return this.store
      .candidatures()
      .filter((c) => !f || (f === 'relance' ? relances.has(c.id) : c.statut === f))
      .filter((c) => !q || `${c.entreprise} ${c.poste} ${c.lieu} ${c.notes}`.toLowerCase().includes(q))
      .sort((a, b) => b.dateCandidature.localeCompare(a.dateCandidature));
  });

  protected colonnes = computed(() =>
    STATUTS.map((s) => ({ ...s, items: this.filtrees().filter((c) => c.statut === s.id) })),
  );

  constructor() {
    // mémorise la vue choisie (liste ou tableau)
    effect(() => {
      try { localStorage.setItem('postulo.vue', this.vue()); } catch {}
    });

    const params = this.route.snapshot.queryParamMap;
    if (params.get('nouvelle')) this.ouvrir();
    if (params.get('filtre')) this.filtre.set(params.get('filtre')!);
    const id = params.get('id');
    if (id) {
      const c = this.store.trouver(id);
      if (c) this.ouvrir(c);
    }
  }

  protected ouvrir(c?: Candidature) {
    this.estNouvelle.set(!c);
    // on travaille sur une copie pour pouvoir annuler
    this.edition.set(c ? { ...c } : vierge());
  }

  protected fermer() {
    this.edition.set(null);
    if (this.route.snapshot.queryParamMap.keys.length) {
      this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
  }

  protected enregistrer() {
    const e = this.edition();
    if (!e) return;
    if (e.statut === 'envoyee' && !e.dateRelance && this.estNouvelle()) {
      e.dateRelance = ajouterJours(e.dateCandidature, 7);
    }
    this.store.enregistrer(e);
    this.notifier(this.estNouvelle() ? 'Candidature ajoutée' : 'Modifications enregistrées');
    this.fermer();
  }

  protected supprimer(c: Candidature) {
    if (!confirm(`Supprimer la candidature chez ${c.entreprise} ?`)) return;
    this.store.supprimer(c.id);
    this.notifier('Candidature supprimée');
    this.fermer();
  }

  protected deposer(statut: Statut) {
    this.survol.set(null);
    if (this.glisse) this.store.changerStatut(this.glisse, statut);
    this.glisse = null;
  }

  protected prochaineEtape(c: Candidature): string {
    const auj = aujourdhui();
    if (c.dateEntretien && c.dateEntretien >= auj) return 'Entretien le ' + formatCourt(c.dateEntretien);
    if (c.statut === 'a_envoyer') return 'À envoyer';
    if (c.statut === 'offre') return 'Répondre à l\'offre';
    if (c.statut === 'refus') return '—';
    if (c.dateRelance) return (c.dateRelance <= auj ? 'Relancer (depuis le ' : 'Relancer le ') + formatCourt(c.dateRelance) + (c.dateRelance <= auj ? ')' : '');
    return 'En attente de réponse';
  }

  protected exporter() {
    telecharger(`candidatures-${aujourdhui()}.csv`, versCsv(this.store.candidatures()));
  }

  protected async importer(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const fichier = input.files?.[0];
    input.value = '';
    if (!fichier) return;
    try {
      const liste = depuisCsv(await fichier.text());
      if (!liste.length) {
        this.notifier('Aucune ligne trouvée dans ce fichier');
        return;
      }
      this.store.importer(liste);
      this.notifier(`${liste.length} candidature${liste.length > 1 ? 's' : ''} importée${liste.length > 1 ? 's' : ''}`);
    } catch (e) {
      this.notifier(e instanceof Error ? e.message : 'Fichier illisible');
    }
  }

  private notifier(texte: string) {
    this.message.set(texte);
    setTimeout(() => this.message.set(''), 2600);
  }
}
