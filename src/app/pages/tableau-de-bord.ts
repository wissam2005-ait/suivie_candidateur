import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '../core/store';
import { STATUTS } from '../core/models';
import { aujourdhui, ajouterJours, ecartJours, formatCourt, toIso } from '../core/dates';

@Component({
  selector: 'app-tableau-de-bord',
  imports: [RouterLink],
  template: `
    <div class="entete">
      <div>
        <h1>{{ salutation() }}</h1>
        <p>{{ dateDuJour }} · voici où en sont tes candidatures.</p>
      </div>
      <div class="actions">
        <a routerLink="/candidatures" [queryParams]="{ nouvelle: 1 }" class="btn btn-principal">
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
          Nouvelle candidature
        </a>
      </div>
    </div>

    @if (!store.candidatures().length) {
      <div class="carte vide">
        <h2>Aucune candidature pour l'instant</h2>
        <p>Ajoute ta première candidature, importe ton fichier Excel, ou charge des exemples pour découvrir l'outil.</p>
        <div class="actions">
          <a routerLink="/candidatures" [queryParams]="{ nouvelle: 1 }" class="btn btn-principal">Ajouter une candidature</a>
          <a routerLink="/candidatures" class="btn">Importer un fichier</a>
          <button class="btn" (click)="store.chargerExemples()">Charger des exemples</button>
        </div>
      </div>
    } @else {
      <section class="kpis">
        <div class="carte kpi">
          <span class="kpi-label">Candidatures envoyées</span>
          <strong>{{ stats().envoyees }}</strong>
          <span class="kpi-sous">{{ stats().cetteSemaine }} cette semaine</span>
        </div>
        <div class="carte kpi">
          <span class="kpi-label">Taux de réponse</span>
          <strong>{{ stats().tauxReponse }}<small>%</small></strong>
          <span class="kpi-sous">{{ stats().reponses }} réponse{{ stats().reponses > 1 ? 's' : '' }} reçue{{ stats().reponses > 1 ? 's' : '' }}</span>
        </div>
        <div class="carte kpi">
          <span class="kpi-label">Entretiens obtenus</span>
          <strong>{{ stats().entretiens }}</strong>
          <span class="kpi-sous">{{ store.prochainsEntretiens().length }} à venir</span>
        </div>
        <div class="carte kpi kpi-or">
          <span class="kpi-label">Offres</span>
          <strong>{{ stats().offres }}</strong>
          <span class="kpi-sous">{{ stats().refus }} refus, ça arrive à tout le monde</span>
        </div>
      </section>

      <div class="grille grille-3-1">
        <section class="carte">
          <div class="carte-titre">
            <h2>Activité des 8 dernières semaines</h2>
          </div>
          <div class="histo">
            @for (s of semaines(); track s.debut) {
              <div class="histo-col" [title]="s.nb + ' candidature(s) semaine du ' + s.label">
                <span class="histo-nb">{{ s.nb || '' }}</span>
                <div class="histo-barre" [style.height.%]="(s.nb / maxSemaine()) * 100"></div>
                <span class="histo-label">{{ s.label }}</span>
              </div>
            }
          </div>
        </section>

        <section class="carte">
          <div class="carte-titre"><h2>Répartition</h2></div>
          <div class="repartition">
            @for (r of repartition(); track r.id) {
              <div class="rep-ligne" [attr.data-s]="r.id">
                <span class="rep-label">{{ r.label }}</span>
                <div class="rep-piste"><div class="rep-barre" [style.width.%]="r.pct"></div></div>
                <span class="rep-nb">{{ r.nb }}</span>
              </div>
            }
          </div>
        </section>
      </div>

      <div class="grille grille-2" style="margin-top: 18px">
        <section class="carte">
          <div class="carte-titre">
            <h2>À relancer</h2>
            <a routerLink="/candidatures" [queryParams]="{ filtre: 'relance' }">Tout voir</a>
          </div>
          @for (c of store.aRelancer().slice(0, 5); track c.id) {
            <div class="ligne-liste">
              <div>
                <div class="entreprise">{{ c.entreprise }}</div>
                <div class="sous">{{ c.poste }} · envoyée il y a {{ depuis(c.dateCandidature) }} j</div>
              </div>
              <button class="btn btn-petit" (click)="store.changerStatut(c.id, 'relancee')">Marquer relancée</button>
            </div>
          } @empty {
            <p class="aide">Rien à relancer. Une candidature sans réponse depuis 7 jours apparaîtra ici.</p>
          }
        </section>

        <section class="carte">
          <div class="carte-titre"><h2>Prochains entretiens</h2></div>
          @for (c of store.prochainsEntretiens().slice(0, 5); track c.id) {
            <div class="ligne-liste">
              <div class="date-bloc">
                <span>{{ jourMois(c.dateEntretien)[0] }}</span>
                <small>{{ jourMois(c.dateEntretien)[1] }}</small>
              </div>
              <div style="flex: 1">
                <div class="entreprise">{{ c.entreprise }}</div>
                <div class="sous">{{ c.poste }}{{ c.contact ? ' · avec ' + c.contact : '' }}</div>
              </div>
              <a class="btn btn-petit" routerLink="/entretien" [queryParams]="{ id: c.id }">S'entraîner</a>
            </div>
          } @empty {
            <p class="aide">Pas d'entretien prévu. Ajoute une date d'entretien sur une candidature pour la voir ici.</p>
          }
        </section>
      </div>
    }
  `,
  styles: `
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 18px; }
    @media (max-width: 900px) { .kpis { grid-template-columns: 1fr 1fr; } }
    .kpi { display: flex; flex-direction: column; gap: 4px; }
    .kpi-label { font-size: 13px; color: var(--encre-2); font-weight: 500; }
    .kpi strong { font-family: var(--titre); font-size: 36px; font-weight: 600; line-height: 1.1; }
    .kpi strong small { font-size: 20px; margin-left: 2px; }
    .kpi-sous { font-size: 12.5px; color: var(--encre-3); }
    .kpi-or { background: var(--vert); border-color: var(--vert); color: #fff; }
    .kpi-or .kpi-label { color: #bcd0c8; }
    .kpi-or strong { color: var(--or); }
    .kpi-or .kpi-sous { color: #8fa69d; }

    .histo { display: flex; align-items: flex-end; gap: 10px; height: 190px; padding-top: 10px; }
    .histo-col { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 6px; }
    .histo-barre { width: 100%; max-width: 42px; min-height: 3px; background: var(--accent); border-radius: 6px 6px 2px 2px; transition: height 0.4s; }
    .histo-col:last-child .histo-barre { background: var(--or); }
    .histo-nb { font-size: 12.5px; font-weight: 600; color: var(--encre-2); }
    .histo-label { font-size: 11.5px; color: var(--encre-3); white-space: nowrap; }

    .repartition { display: flex; flex-direction: column; gap: 12px; }
    .rep-ligne { display: grid; grid-template-columns: 78px 1fr 24px; align-items: center; gap: 10px; font-size: 13.5px; }
    .rep-label { color: var(--encre-2); }
    .rep-piste { height: 8px; background: var(--fond); border-radius: 99px; overflow: hidden; }
    .rep-barre { height: 100%; background: var(--c); border-radius: 99px; transition: width 0.4s; }
    .rep-nb { text-align: right; font-weight: 600; }

    .ligne-liste { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 0; border-bottom: 1px solid #f0ece5; }
    .ligne-liste:last-child { border-bottom: none; }
    .date-bloc { width: 46px; text-align: center; background: var(--vert-clair); border-radius: 8px; padding: 5px 0; line-height: 1.1; }
    .date-bloc span { display: block; font-family: var(--titre); font-size: 19px; font-weight: 600; color: var(--vert); }
    .date-bloc small { font-size: 11px; color: var(--accent); text-transform: uppercase; }
  `,
})
export class TableauDeBord {
  protected store = inject(Store);
  protected dateDuJour = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  protected salutation = computed(() => {
    const prenom = this.store.profil().prenom;
    const h = new Date().getHours();
    const mot = h < 18 ? 'Bonjour' : 'Bonsoir';
    return prenom ? `${mot} ${prenom}` : mot;
  });

  protected stats = computed(() => {
    const liste = this.store.candidatures();
    const envoyees = liste.filter((c) => c.statut !== 'a_envoyer');
    const reponses = envoyees.filter((c) => ['entretien', 'offre', 'refus'].includes(c.statut)).length;
    const ilYa7j = ajouterJours(aujourdhui(), -7);
    return {
      envoyees: envoyees.length,
      cetteSemaine: envoyees.filter((c) => c.dateCandidature > ilYa7j).length,
      reponses,
      tauxReponse: envoyees.length ? Math.round((reponses / envoyees.length) * 100) : 0,
      entretiens: liste.filter((c) => c.statut === 'entretien' || c.statut === 'offre' || c.dateEntretien).length,
      offres: liste.filter((c) => c.statut === 'offre').length,
      refus: liste.filter((c) => c.statut === 'refus').length,
    };
  });

  protected repartition = computed(() => {
    const liste = this.store.candidatures();
    const max = Math.max(1, ...STATUTS.map((s) => liste.filter((c) => c.statut === s.id).length));
    return STATUTS.map((s) => {
      const nb = liste.filter((c) => c.statut === s.id).length;
      return { ...s, nb, pct: (nb / max) * 100 };
    });
  });

  // candidatures regroupées par semaine (lundi -> dimanche)
  protected semaines = computed(() => {
    const auj = new Date();
    const lundi = new Date(auj);
    lundi.setDate(auj.getDate() - ((auj.getDay() + 6) % 7));
    const debutCourant = toIso(lundi);

    return Array.from({ length: 8 }, (_, i) => {
      const debut = ajouterJours(debutCourant, -7 * (7 - i));
      const fin = ajouterJours(debut, 7);
      const nb = this.store.candidatures().filter((c) => c.dateCandidature >= debut && c.dateCandidature < fin).length;
      return { debut, nb, label: i === 7 ? 'cette sem.' : formatCourt(debut) };
    });
  });

  protected maxSemaine = computed(() => Math.max(1, ...this.semaines().map((s) => s.nb)));

  protected depuis(date: string) {
    return ecartJours(date, aujourdhui());
  }

  protected jourMois(iso: string): [string, string] {
    const d = new Date(iso + 'T12:00:00');
    return [String(d.getDate()), d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')];
  }

}
