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
        <p>Rempli une seule fois, il sert à ton CV, tes lettres, ton pitch et tes entretiens. Tout est enregistré au fil de l'eau.</p>
      </div>
      <span class="etat-sauvegarde">{{ enregistre() ? 'Enregistrement…' : '✓ Enregistré automatiquement' }}</span>
    </div>

    <div class="profil-grille" (input)="autoSauver()" (change)="autoSauver()" (click)="autoSauver()">
      <section class="carte">
        <h2 class="titre-section">Informations</h2>
        <div class="photo-ligne">
          <div class="photo" [attr.data-maj]="photoChangee()">
            @if (p.photo) { <img [src]="p.photo" alt="Ma photo" /> } @else { <span>{{ (p.prenom[0] || '?') + (p.nom[0] || '') }}</span> }
          </div>
          <div>
            <label class="btn btn-petit">
              {{ p.photo ? 'Changer la photo' : 'Ajouter une photo' }}
              <input type="file" accept="image/*" hidden (change)="choisirPhoto($event)" />
            </label>
            @if (p.photo) { <button class="btn btn-petit btn-danger" (click)="p.photo = ''">Retirer</button> }
            <p class="aide">Facultative. Une photo nette, souriante, sur fond neutre. Elle reste sur ton appareil.</p>
          </div>
        </div>
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
          <div class="champ large">
            <label for="interets">Centres d'intérêt</label>
            <input id="interets" [(ngModel)]="p.interets" placeholder="Sport, bénévolat, musique… (ce qui donne envie d'en parler)" />
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

  `,
  styles: `
    .profil-grille { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; align-items: start; }
    @media (max-width: 1000px) { .profil-grille { grid-template-columns: 1fr; } }
    .colonne-droite { display: flex; flex-direction: column; gap: 18px; }
    .titre-section { margin-bottom: 16px; }
    .etat-sauvegarde { font-size: 13px; color: var(--encre-3); }
    .photo-ligne { display: flex; gap: 16px; align-items: center; margin-bottom: 18px; }
    .photo-ligne .btn { margin-right: 6px; }
    .photo-ligne .aide { margin: 6px 0 0; }
    .photo { width: 72px; height: 72px; border-radius: 50%; overflow: hidden; background: var(--vert-clair); display: grid; place-items: center; flex-shrink: 0; }
    .photo img { width: 100%; height: 100%; object-fit: cover; }
    .photo span { font-family: var(--titre); font-size: 24px; color: var(--accent); text-transform: uppercase; }
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
  // force le rafraîchissement de la vue après le chargement asynchrone de la photo
  protected photoChangee = signal(0);

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

  /** Redimensionne la photo (carrée, 320 px) pour qu'elle reste légère dans le stockage du navigateur. */
  protected choisirPhoto(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const fichier = input.files?.[0];
    input.value = '';
    if (!fichier) return;
    const img = new Image();
    img.onload = () => {
      const cote = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 320;
      canvas.getContext('2d')!.drawImage(img, (img.width - cote) / 2, (img.height - cote) / 2, cote, cote, 0, 0, 320, 320);
      this.p.photo = canvas.toDataURL('image/jpeg', 0.85);
      URL.revokeObjectURL(img.src);
      this.photoChangee.set(Date.now());
      this.autoSauver();
    };
    img.src = URL.createObjectURL(fichier);
  }

  private minuteur?: ReturnType<typeof setTimeout>;

  /** Sauvegarde automatique, un court instant après la dernière modification. */
  protected autoSauver() {
    this.enregistre.set(true);
    clearTimeout(this.minuteur);
    this.minuteur = setTimeout(() => {
      this.store.profil.set(structuredClone(this.p));
      this.enregistre.set(false);
    }, 500);
  }
}
