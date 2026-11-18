import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Store } from '../core/store';
import { LigneParcours, Profil } from '../core/models';

type Section = 'formations' | 'experiences' | 'projets';

@Component({
  selector: 'app-profil',
  imports: [FormsModule],
  template: `
    <div class="entete">
      <div>
        <h1>Mon profil</h1>
        <p>Rempli une seule fois, il sert à générer ton CV, tes lettres et à personnaliser les entretiens.</p>
      </div>
      <div class="actions">
        <button class="btn btn-principal" (click)="enregistrer()">Enregistrer</button>
      </div>
    </div>

    <div class="profil-grille">
      <section class="carte">
        <h2 class="titre-section">Informations</h2>
        <div class="form-grille">
          <div class="champ"><label for="prenom">Prénom</label><input id="prenom" [(ngModel)]="p.prenom" /></div>
          <div class="champ"><label for="nom">Nom</label><input id="nom" [(ngModel)]="p.nom" /></div>
          <div class="champ large">
            <label for="titre">Situation actuelle</label>
            <input id="titre" [(ngModel)]="p.titre" placeholder="ex. Étudiant en 2e année de BUT Informatique" />
          </div>
          <div class="champ"><label for="email">E-mail</label><input id="email" type="email" [(ngModel)]="p.email" /></div>
          <div class="champ"><label for="tel">Téléphone</label><input id="tel" [(ngModel)]="p.telephone" /></div>
          <div class="champ"><label for="ville">Ville</label><input id="ville" [(ngModel)]="p.ville" /></div>
          <div class="champ"><label for="linkedin">LinkedIn</label><input id="linkedin" [(ngModel)]="p.linkedin" /></div>
          <div class="champ large"><label for="github">GitHub / portfolio</label><input id="github" [(ngModel)]="p.github" /></div>
          <div class="champ large">
            <label for="apropos">En quelques mots</label>
            <textarea id="apropos" rows="3" [(ngModel)]="p.apropos" placeholder="Ce que tu cherches, ce qui te motive…"></textarea>
          </div>
          <div class="champ large">
            <label for="competences">Compétences</label>
            <input id="competences" [(ngModel)]="p.competences" placeholder="Séparées par des virgules : Angular, Java, SQL…" />
          </div>
          <div class="champ large">
            <label for="langues">Langues</label>
            <input id="langues" [(ngModel)]="p.langues" placeholder="Français (natif), Anglais (B2)" />
          </div>
        </div>
      </section>

      <div class="colonne-droite">
        @for (s of sections; track s.cle) {
          <section class="carte">
            <div class="carte-titre">
              <h2>{{ s.titre }}</h2>
              <button class="btn btn-petit" (click)="ajouter(s.cle)">+ Ajouter</button>
            </div>
            @for (l of p[s.cle]; track $index; let i = $index) {
              <div class="bloc">
                <div class="form-grille">
                  <div class="champ large">
                    <label>{{ s.libelleTitre }}</label>
                    <input [(ngModel)]="l.titre" [placeholder]="s.exemple" />
                  </div>
                  <div class="champ"><label>{{ s.libelleLieu }}</label><input [(ngModel)]="l.lieu" /></div>
                  <div class="champ"><label>Période</label><input [(ngModel)]="l.periode" placeholder="2025 – 2027" /></div>
                  <div class="champ large">
                    <label>Description</label>
                    <textarea rows="2" [(ngModel)]="l.description"></textarea>
                  </div>
                </div>
                <button class="btn-icone retirer" (click)="retirer(s.cle, i)" aria-label="Retirer">
                  <svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
                </button>
              </div>
            } @empty {
              <p class="aide">Rien pour l'instant.</p>
            }
          </section>
        }
      </div>
    </div>

    @if (enregistre()) {
      <div class="toast">Profil enregistré</div>
    }
  `,
  styles: `
    .profil-grille { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; align-items: start; }
    @media (max-width: 1000px) { .profil-grille { grid-template-columns: 1fr; } }
    .colonne-droite { display: flex; flex-direction: column; gap: 18px; }
    .titre-section { margin-bottom: 16px; }
    .bloc { position: relative; padding: 14px; background: var(--surface-2); border: 1px solid var(--bord); border-radius: 10px; margin-bottom: 10px; }
    .bloc .form-grille { padding-right: 28px; }
    .retirer { position: absolute; top: 8px; right: 6px; }
  `,
})
export class ProfilPage {
  private store = inject(Store);
  // copie profonde : on n'écrit dans le store qu'au clic sur "Enregistrer"
  protected p: Profil = structuredClone(this.store.profil());
  protected enregistre = signal(false);

  protected sections: { cle: Section; titre: string; libelleTitre: string; libelleLieu: string; exemple: string }[] = [
    { cle: 'formations', titre: 'Formation', libelleTitre: 'Diplôme', libelleLieu: 'Établissement', exemple: 'BTS SIO option SLAM' },
    { cle: 'experiences', titre: 'Expériences', libelleTitre: 'Poste', libelleLieu: 'Entreprise', exemple: 'Stage développeur web' },
    { cle: 'projets', titre: 'Projets', libelleTitre: 'Nom du projet', libelleLieu: 'Contexte', exemple: 'Application de gestion de stock' },
  ];

  protected ajouter(cle: Section) {
    const ligne: LigneParcours = { titre: '', lieu: '', periode: '', description: '' };
    this.p[cle].push(ligne);
  }

  protected retirer(cle: Section, i: number) {
    this.p[cle].splice(i, 1);
  }

  protected enregistrer() {
    this.store.profil.set(structuredClone(this.p));
    this.enregistre.set(true);
    setTimeout(() => this.enregistre.set(false), 2200);
  }
}
