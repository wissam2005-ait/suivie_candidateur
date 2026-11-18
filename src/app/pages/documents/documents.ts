import { Component, ElementRef, OnDestroy, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Store } from '../../core/store';
import { Assistant, Cible } from '../../core/assistant';
import { compterMots } from '../../core/oral';
import { COULEURS, CvApercu, Densite, ModeleDoc } from './cv';
import { Destinataire, LettreApercu } from './lettre';

type Onglet = 'cv' | 'lettre';

interface Reglages {
  modele: ModeleDoc;
  couleur: string;
  densite: Densite;
}

interface Brouillon {
  objet: string;
  corps: string;
  destinataire: Destinataire;
}

const CLE_REGLAGES = 'postulo.documents.v1';
const CLE_LETTRE = 'postulo.lettre.v1';

function lire<T>(cle: string, defaut: T): T {
  try {
    const v = localStorage.getItem(cle);
    return v ? { ...defaut, ...JSON.parse(v) } : defaut;
  } catch {
    return defaut;
  }
}

function ecrire(cle: string, v: unknown) {
  try { localStorage.setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ }
}

@Component({
  selector: 'app-documents',
  imports: [FormsModule, RouterLink, CvApercu, LettreApercu],
  template: `
    <div class="entete no-print">
      <div>
        <h1>CV & lettres</h1>
        <p>Choisis un modèle, adapte-le à l'offre, télécharge un PDF propre en un clic.</p>
      </div>
      <div class="actions">
        <div class="onglets">
          <button [class.actif]="onglet() === 'cv'" (click)="onglet.set('cv')">CV</button>
          <button [class.actif]="onglet() === 'lettre'" (click)="onglet.set('lettre')">Lettre de motivation</button>
        </div>
        <button class="btn btn-principal" (click)="imprimer()">
          <svg viewBox="0 0 24 24"><path d="M12 3v12m0 0-5-5m5 5 5-5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
          Télécharger en PDF
        </button>
      </div>
    </div>

    @if (!profilRempli()) {
      <div class="bandeau no-print">
        <span>Ton profil est presque vide : <a routerLink="/profil">complète-le</a> (expériences, compétences…) pour obtenir de vrais documents.</span>
      </div>
    }

    <div class="docs">
      <aside class="controles no-print">
        <!-- 1. l'offre -->
        <section class="carte bloc-reglage">
          <h2><span class="num">1</span> L'offre visée</h2>
          @if (store.candidatures().length) {
            <div class="champ">
              <label for="cand">Une de mes candidatures</label>
              <select id="cand" [ngModel]="idCandidature()" (ngModelChange)="choisir($event)">
                <option value="">— Document général —</option>
                @for (c of store.candidatures(); track c.id) {
                  <option [value]="c.id">{{ c.entreprise }} · {{ c.poste }}</option>
                }
              </select>
            </div>
          }
          <div class="champ"><label for="poste">Poste</label><input id="poste" [(ngModel)]="cible.poste" placeholder="ex. Développeur web en alternance" /></div>
          <div class="champ"><label for="ent">Entreprise</label><input id="ent" [(ngModel)]="cible.entreprise" (ngModelChange)="majDestinataire()" /></div>

          @if (onglet() === 'lettre') {
            <div class="champ">
              <label for="notes">Ce qui t'attire chez eux</label>
              <textarea id="notes" rows="2" [(ngModel)]="cible.notes" placeholder="Un produit, un projet, une valeur… (optionnel mais conseillé)"></textarea>
            </div>
            <div class="champ">
              <label for="ton">Ton</label>
              <select id="ton" [(ngModel)]="ton">
                <option>professionnel et chaleureux</option>
                <option>formel</option>
                <option>direct et enthousiaste</option>
              </select>
            </div>
            <details class="plus">
              <summary>Destinataire (service, adresse)</summary>
              <div class="champ"><label for="svc">Service</label><input id="svc" [ngModel]="brouillon().destinataire.service" (ngModelChange)="majBrouillon({ destinataire: { service: $event } })" /></div>
              <div class="champ">
                <label for="adr">Adresse</label>
                <textarea id="adr" rows="2" [ngModel]="brouillon().destinataire.adresse" (ngModelChange)="majBrouillon({ destinataire: { adresse: $event } })" placeholder="12 rue …&#10;75000 Paris"></textarea>
              </div>
            </details>
            <button class="btn btn-principal large" (click)="genererLettre()" [disabled]="!cible.poste || chargement()">
              @if (chargement()) { <span class="chargement"></span> }
              {{ brouillon().corps ? 'Régénérer la lettre' : 'Rédiger la lettre' }}
            </button>
          } @else {
            <button class="btn large" (click)="genererAccroche()" [disabled]="!cible.poste || chargement()">
              @if (chargement()) { <span class="chargement"></span> }
              Adapter l'accroche à cette offre
            </button>
          }
          @if (erreur()) { <p class="aide erreur">{{ erreur() }}</p> }
        </section>

        <!-- 2. l'apparence -->
        <section class="carte bloc-reglage">
          <h2><span class="num">2</span> Apparence</h2>
          <div class="modeles">
            @for (m of modeles; track m.id) {
              <button class="modele" [class.actif]="reglages().modele === m.id" (click)="regler({ modele: m.id })" [title]="m.aide">
                <span class="vignette" [attr.data-v]="m.id" [style.--c]="reglages().couleur">
                  <i></i><i></i><i></i><i></i>
                </span>
                <span>{{ m.nom }}</span>
              </button>
            }
          </div>
          <p class="aide">{{ modeleActif().aide }}</p>

          <div class="champ">
            <label>Couleur</label>
            <div class="couleurs">
              @for (c of couleurs; track c.valeur) {
                <button class="pastille-couleur" [style.background]="c.valeur" [class.actif]="reglages().couleur === c.valeur"
                        (click)="regler({ couleur: c.valeur })" [attr.aria-label]="c.nom" [title]="c.nom"></button>
              }
            </div>
          </div>

          @if (onglet() === 'cv') {
            <div class="champ">
              <label>Densité</label>
              <div class="onglets petit">
                <button [class.actif]="reglages().densite === 'compacte'" (click)="regler({ densite: 'compacte' })">Compacte</button>
                <button [class.actif]="reglages().densite === 'normale'" (click)="regler({ densite: 'normale' })">Normale</button>
                <button [class.actif]="reglages().densite === 'aeree'" (click)="regler({ densite: 'aeree' })">Aérée</button>
              </div>
            </div>
          }
        </section>

        <!-- 3. vérifications -->
        <section class="carte bloc-reglage">
          <h2><span class="num">3</span> Avant d'envoyer</h2>
          <ul class="checklist">
            @for (v of verifications(); track v.label) {
              <li [class.ok]="v.ok">
                {{ v.label }}
                @if (!v.ok && v.aide) { <small>{{ v.aide }}</small> }
              </li>
            }
          </ul>
        </section>
      </aside>

      <section class="apercu" #zoneApercu>
        @if (deborde()) {
          <div class="alerte-page no-print">
            Le document dépasse une page.
            @if (onglet() === 'cv') {
              @if (reglages().densite !== 'compacte') { <button class="lien" (click)="regler({ densite: 'compacte' })">Passer en densité compacte</button> }
              @else { Raccourcis les descriptions dans ton profil. }
            } @else { Raccourcis un paragraphe. }
          </div>
        }
        <div class="cadre" [style.zoom]="echelle()">
          <div class="feuille" #feuille>
            @if (onglet() === 'cv') {
              <app-cv [p]="store.profil()" [accroche]="accroche()" [poste]="cible.poste"
                      [modele]="reglages().modele" [couleur]="reglages().couleur" [densite]="reglages().densite" />
            } @else {
              <app-lettre [p]="store.profil()" [modele]="reglages().modele" [couleur]="reglages().couleur"
                          [objet]="brouillon().objet" [corps]="brouillon().corps" [destinataire]="brouillon().destinataire"
                          (corpsChange)="majBrouillon({ corps: $event })" />
            }
          </div>
        </div>
        @if (onglet() === 'lettre') {
          <p class="aide no-print centre">
            @if (brouillon().corps) { Clique dans la lettre pour la modifier directement · {{ mots() }} mots }
            @else { Choisis une offre puis clique sur « Rédiger la lettre ». }
          </p>
        }
      </section>
    </div>
  `,
  styles: `
    .docs { display: grid; grid-template-columns: 320px 1fr; gap: 22px; align-items: start; }
    @media (max-width: 1050px) { .docs { grid-template-columns: 1fr; } }

    .controles { display: flex; flex-direction: column; gap: 14px; position: sticky; top: 20px; max-height: calc(100vh - 40px); overflow-y: auto; padding-bottom: 4px; }
    @media (max-width: 1050px) { .controles { position: static; max-height: none; } }
    .bloc-reglage { display: flex; flex-direction: column; gap: 12px; padding: 18px; }
    .bloc-reglage h2 { font-size: 16px; display: flex; align-items: center; gap: 9px; }
    .num { width: 22px; height: 22px; border-radius: 50%; background: var(--vert); color: var(--or); font-family: var(--texte); font-size: 12px; display: grid; place-items: center; }
    .large { justify-content: center; }
    .erreur { color: var(--s-refus); }
    .plus summary { cursor: pointer; font-size: 13.5px; font-weight: 500; color: var(--accent); margin-bottom: 8px; }
    .plus .champ { margin-bottom: 10px; }

    .modeles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .modele { border: 1px solid var(--bord); background: var(--surface); border-radius: 10px; padding: 8px 6px 7px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 500; color: var(--encre-2); }
    .modele.actif { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); color: var(--encre); }
    .vignette { width: 52px; height: 70px; background: #fff; border: 1px solid #ddd; border-radius: 3px; position: relative; overflow: hidden; display: block; }
    .vignette i { position: absolute; display: block; background: #d8d8d8; border-radius: 1px; }
    .vignette[data-v='classique'] i:nth-child(1) { left: 8px; right: 8px; top: 7px; height: 5px; background: var(--c); }
    .vignette[data-v='classique'] i:nth-child(2) { left: 8px; right: 8px; top: 16px; height: 1px; background: var(--c); }
    .vignette[data-v='classique'] i:nth-child(3) { left: 8px; right: 14px; top: 22px; height: 18px; background: repeating-linear-gradient(#d8d8d8 0 2px, transparent 2px 5px); }
    .vignette[data-v='classique'] i:nth-child(4) { left: 8px; right: 10px; top: 45px; height: 18px; background: repeating-linear-gradient(#d8d8d8 0 2px, transparent 2px 5px); }
    .vignette[data-v='moderne'] i:nth-child(1) { left: 0; top: 0; bottom: 0; width: 17px; background: var(--c); }
    .vignette[data-v='moderne'] i:nth-child(2) { left: 22px; right: 6px; top: 8px; height: 5px; background: #555; }
    .vignette[data-v='moderne'] i:nth-child(3) { left: 22px; right: 8px; top: 19px; height: 20px; background: repeating-linear-gradient(#d8d8d8 0 2px, transparent 2px 5px); }
    .vignette[data-v='moderne'] i:nth-child(4) { left: 22px; right: 6px; top: 44px; height: 20px; background: repeating-linear-gradient(#d8d8d8 0 2px, transparent 2px 5px); }
    .vignette[data-v='epure'] i:nth-child(1) { left: 0; right: 0; top: 0; height: 4px; background: var(--c); }
    .vignette[data-v='epure'] i:nth-child(2) { left: 7px; width: 24px; top: 10px; height: 5px; background: #333; }
    .vignette[data-v='epure'] i:nth-child(3) { left: 7px; width: 10px; top: 24px; bottom: 8px; background: repeating-linear-gradient(#e2e2e2 0 2px, transparent 2px 12px); }
    .vignette[data-v='epure'] i:nth-child(4) { left: 21px; right: 6px; top: 24px; bottom: 8px; background: repeating-linear-gradient(#d8d8d8 0 2px, transparent 2px 5px); }

    .couleurs { display: flex; gap: 8px; }
    .pastille-couleur { width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--surface); box-shadow: 0 0 0 1px var(--bord); cursor: pointer; }
    .pastille-couleur.actif { box-shadow: 0 0 0 2px var(--encre); }
    .onglets.petit { display: flex; }
    .onglets.petit button { flex: 1; padding: 6px 8px; font-size: 13px; }

    .checklist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 7px; font-size: 13.5px; color: var(--encre-2); }
    .checklist li { padding-left: 24px; position: relative; }
    .checklist li::before { content: ''; position: absolute; left: 2px; top: 3px; width: 13px; height: 13px; border-radius: 50%; border: 1.5px solid var(--encre-3); }
    .checklist li.ok { color: var(--encre); }
    .checklist li.ok::before { border-color: var(--s-offre); background: var(--s-offre); box-shadow: inset 0 0 0 2.5px var(--surface); }
    .checklist small { display: block; color: var(--encre-3); font-size: 12.5px; }

    .apercu { min-width: 0; }
    .cadre { width: 210mm; margin: 0 auto; }
    .feuille { box-shadow: 0 2px 6px rgb(0 0 0 / 0.06), 0 18px 50px rgb(0 0 0 / 0.12); border-radius: 2px; overflow: hidden; }
    .alerte-page { background: var(--avert-fond); border: 1px solid var(--avert-bord); color: var(--avert-texte); border-radius: 10px; padding: 9px 14px; font-size: 13.5px; margin-bottom: 12px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .lien { background: none; border: none; padding: 0; color: var(--accent); font-weight: 600; cursor: pointer; text-decoration: underline; }
    .centre { text-align: center; margin-top: 12px; }

    @media print {
      .docs { display: block; }
      .apercu { min-width: 0; }
      .cadre { zoom: 1 !important; width: 210mm; }
      .feuille { box-shadow: none; border-radius: 0; height: 297mm; overflow: hidden; }
    }
  `,
})
export class Documents implements OnDestroy {
  protected store = inject(Store);
  protected assistant = inject(Assistant);
  private zoneApercu = viewChild<ElementRef<HTMLElement>>('zoneApercu');
  private feuille = viewChild<ElementRef<HTMLElement>>('feuille');

  protected couleurs = COULEURS;
  protected modeles: { id: ModeleDoc; nom: string; aide: string }[] = [
    { id: 'classique', nom: 'Classique', aide: 'Une colonne sobre, idéale pour les grandes entreprises : bien lue par les logiciels de tri de CV.' },
    { id: 'moderne', nom: 'Moderne', aide: 'Colonne colorée avec photo, compétences et contact : parfait pour le numérique et les start-up.' },
    { id: 'epure', nom: 'Épuré', aide: 'Beaucoup d\'air et des intitulés en marge : élégant et très lisible.' },
  ];

  protected onglet = signal<Onglet>('cv');
  protected reglages = signal<Reglages>(lire(CLE_REGLAGES, { modele: 'classique', couleur: COULEURS[0].valeur, densite: 'normale' }));
  protected brouillon = signal<Brouillon>(lire(CLE_LETTRE, { objet: '', corps: '', destinataire: { entreprise: '', service: 'Service recrutement', adresse: '' } }));
  protected modeleActif = computed(() => this.modeles.find((m) => m.id === this.reglages().modele)!);

  protected idCandidature = signal('');
  protected cible: Cible = { poste: '', entreprise: '', notes: '' };
  protected ton = 'professionnel et chaleureux';
  protected accroche = signal('');
  protected chargement = signal(false);
  protected erreur = signal('');
  protected echelle = signal(1);
  protected deborde = signal(false);

  protected mots = computed(() => compterMots(this.brouillon().corps));

  protected profilRempli = computed(() => {
    const p = this.store.profil();
    return !!(p.prenom && (p.experiences.length || p.projets.length || p.formations.length));
  });

  protected verifications = computed(() => {
    const p = this.store.profil();
    const page = { label: 'Tient sur une seule page', ok: !this.deborde(), aide: 'Un recruteur passe environ 30 secondes sur un CV.' };
    if (this.onglet() === 'cv') {
      const nbComp = p.competences.split(',').filter((s) => s.trim()).length;
      return [
        page,
        { label: 'Accroche adaptée au poste', ok: !!(this.accroche() || p.apropos), aide: 'Clique sur « Adapter l\'accroche à cette offre ».' },
        { label: 'Une expérience ou un projet décrit', ok: [...p.experiences, ...p.projets].some((x) => x.description.length > 20), aide: 'Ajoute ce que tu as fait, avec un résultat.' },
        { label: 'Au moins 5 compétences', ok: nbComp >= 5, aide: `Tu en as ${nbComp}. Reprends les mots-clés de l'offre.` },
        { label: 'E-mail et téléphone', ok: !!(p.email && p.telephone), aide: 'À compléter dans ton profil.' },
        { label: 'LinkedIn ou portfolio', ok: !!(p.linkedin || p.github), aide: 'Un lien vers tes projets fait la différence.' },
      ];
    }
    const b = this.brouillon();
    const n = this.mots();
    return [
      page,
      { label: 'Objet précis', ok: b.objet.length > 10, aide: '' },
      { label: 'Entre 200 et 380 mots', ok: n >= 200 && n <= 380, aide: n ? `Actuellement ${n} mots.` : '' },
      { label: `L'entreprise est citée`, ok: !!this.cible.entreprise && b.corps.toLowerCase().includes(this.cible.entreprise.toLowerCase()), aide: 'Montre que la lettre est écrite pour eux.' },
      { label: 'Aucun passage [à compléter]', ok: !!b.corps && !/\[[^\]]+\]/.test(b.corps), aide: '' },
      { label: 'Pas de formule creuse', ok: !/(dynamique et motiv|je me permets|force de proposition|n'h[ée]sitez pas)/i.test(b.corps), aide: '« Dynamique et motivé », « je me permets »…' },
    ];
  });

  private observateur?: ResizeObserver;

  constructor() {
    const id = inject(ActivatedRoute).snapshot.queryParamMap.get('id');
    if (id) this.choisir(id);

    effect(() => ecrire(CLE_REGLAGES, this.reglages()));
    effect(() => ecrire(CLE_LETTRE, this.brouillon()));

    // échelle de l'aperçu : la page A4 fait 794 px de large
    effect(() => {
      const zone = this.zoneApercu()?.nativeElement;
      if (!zone || this.observateur) return;
      this.observateur = new ResizeObserver(([e]) => this.echelle.set(Math.min(1, e.contentRect.width / 794)));
      this.observateur.observe(zone);
    });

    // détecte si le contenu dépasse une page A4
    effect(() => {
      this.onglet(); this.reglages(); this.brouillon(); this.accroche(); this.store.profil();
      setTimeout(() => {
        const page = this.feuille()?.nativeElement.querySelector('.page-a4') as HTMLElement | null;
        if (!page) return;
        this.deborde.set(page.scrollHeight > page.clientHeight + 1);
      }, 60);
    });
  }

  ngOnDestroy() {
    this.observateur?.disconnect();
  }

  protected regler(r: Partial<Reglages>) {
    this.reglages.update((x) => ({ ...x, ...r }));
  }

  protected majBrouillon(b: { objet?: string; corps?: string; destinataire?: Partial<Destinataire> }) {
    this.brouillon.update((x) => ({
      ...x,
      ...(b.objet !== undefined ? { objet: b.objet } : {}),
      ...(b.corps !== undefined ? { corps: b.corps } : {}),
      destinataire: { ...x.destinataire, ...(b.destinataire ?? {}) },
    }));
  }

  protected majDestinataire() {
    this.majBrouillon({ destinataire: { entreprise: this.cible.entreprise } });
  }

  protected choisir(id: string) {
    this.idCandidature.set(id);
    const c = this.store.trouver(id);
    this.cible = c ? { poste: c.poste, entreprise: c.entreprise, notes: '' } : { poste: '', entreprise: '', notes: '' };
    this.accroche.set('');
    this.majDestinataire();
  }

  protected async genererLettre() {
    await this.executer(async () => {
      const texte = await this.assistant.lettre(this.cible, this.ton);
      this.majBrouillon({ ...decouperLettre(texte, this.store.profil()), destinataire: { entreprise: this.cible.entreprise } });
    });
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

  protected imprimer() {
    const p = this.store.profil();
    const nom = [p.prenom, p.nom].filter(Boolean).join(' ');
    const titreAvant = document.title;
    // le titre de la page devient le nom du fichier PDF proposé
    document.title = `${this.onglet() === 'cv' ? 'CV' : 'Lettre de motivation'}${nom ? ' - ' + nom : ''}${this.cible.entreprise ? ' - ' + this.cible.entreprise : ''}`;
    window.print();
    document.title = titreAvant;
  }
}

/** Sépare l'objet, le corps et la signature d'une lettre générée. */
function decouperLettre(texte: string, p: { prenom: string; nom: string }): { objet: string; corps: string } {
  let lignes = texte.trim().split('\n');
  let objet = '';
  const i = lignes.findIndex((l) => /^\s*objet\s*:/i.test(l));
  if (i !== -1 && i < 3) {
    objet = lignes[i].replace(/^\s*objet\s*:\s*/i, '').trim();
    lignes = lignes.slice(i + 1);
  }
  const nom = [p.prenom, p.nom].filter(Boolean).join(' ').toLowerCase();
  while (lignes.length && (!lignes.at(-1)!.trim() || (nom && lignes.at(-1)!.trim().toLowerCase() === nom))) lignes.pop();
  return { objet, corps: lignes.join('\n').trim() };
}
