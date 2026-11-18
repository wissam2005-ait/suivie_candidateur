import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Store } from '../core/store';
import { Assistant, Cible, FormatPitch } from '../core/assistant';
import { Oral, compterMots, dureeOrale, formatDuree, motsParasites } from '../core/oral';

interface InfoFormat {
  id: FormatPitch;
  label: string;
  quand: string;
  cible: [number, number]; // durée visée en secondes (min, max)
  ecrit?: boolean;
}

const FORMATS: InfoFormat[] = [
  { id: 'entretien', label: '« Présentez-vous »', quand: 'La première question de presque tous les entretiens.', cible: [60, 100] },
  { id: 'salon', label: 'Salon / forum', quand: 'Quand tu abordes un recruteur sur un stand : 30 secondes pour donner envie.', cible: [25, 45] },
  { id: 'telephone', label: 'Appel recruteur', quand: 'Pour relancer une candidature ou proposer une candidature spontanée au téléphone.', cible: [35, 60] },
  { id: 'linkedin', label: 'Message LinkedIn', quand: 'Pour contacter directement un recruteur ou un responsable d\'équipe.', cible: [0, 0], ecrit: true },
];

interface Resultat {
  duree: number;
  mots: number;
  debit: number;
  parasites: { mot: string; nb: number }[];
  oublis: string[];
  couverture: number;
}

// mots trop courants pour servir de repères
const VIDES = new Set(['aujourd', 'parce', 'depuis', 'pendant', 'comme', 'aussi', 'votre', 'notre', 'cette', 'entre', 'avoir', 'faire', 'suis', 'dans', 'avec', 'pour', 'mais', 'tout', 'très', 'plus', 'bonjour', 'monsieur', 'madame', 'vous', 'nous']);

@Component({
  selector: 'app-pitch',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="entete">
      <div>
        <h1>Mon pitch</h1>
        <p>Le discours qui te présente aux recruteurs : clair, concret, prêt à être dit à l'oral.</p>
      </div>
    </div>

    <div class="formats">
      @for (f of formats; track f.id) {
        <button class="format" [class.actif]="format() === f.id" (click)="changerFormat(f.id)">
          <strong>{{ f.label }}</strong>
          <span>{{ f.ecrit ? 'Écrit' : (f.cible[0] + '–' + f.cible[1] + ' s') }}</span>
        </button>
      }
    </div>
    <p class="aide quand">{{ info().quand }}</p>

    @if (assistant.modeHorsLigne()) {
      <div class="bandeau">
        <span>Mode sans IA : le pitch est construit à partir de ton profil. Remplace les passages entre [crochets] et mets-le à ta façon.</span>
      </div>
    }

    <div class="pitch-grille">
      <aside class="carte reglages">
        <h2>Pour qui ?</h2>
        @if (store.candidatures().length) {
          <div class="champ">
            <label for="cand">Une de mes candidatures</label>
            <select id="cand" [ngModel]="idCandidature()" (ngModelChange)="choisir($event)">
              <option value="">— Pitch général —</option>
              @for (c of store.candidatures(); track c.id) {
                <option [value]="c.id">{{ c.entreprise }} · {{ c.poste }}</option>
              }
            </select>
          </div>
        }
        <div class="champ"><label for="poste">Poste visé</label><input id="poste" [(ngModel)]="cible.poste" placeholder="ex. Développeur web en alternance" /></div>
        <div class="champ"><label for="ent">Entreprise (optionnel)</label><input id="ent" [(ngModel)]="cible.entreprise" /></div>
        <div class="champ">
          <label for="notes">Pourquoi eux ? (optionnel)</label>
          <textarea id="notes" rows="2" [(ngModel)]="cible.notes" placeholder="Ce qui t'attire : produit, valeurs, projets…"></textarea>
        </div>
        <button class="btn btn-principal" (click)="generer()" [disabled]="!cible.poste || chargement()">
          @if (chargement()) { <span class="chargement"></span> }
          {{ blocs().length ? 'Régénérer le pitch' : 'Générer mon pitch' }}
        </button>
        @if (!store.profil().prenom) {
          <p class="aide">Remplis d'abord <a routerLink="/profil">ton profil</a> : le pitch s'appuie dessus.</p>
        }
        @if (erreur()) { <p class="aide" style="color: var(--s-refus)">{{ erreur() }}</p> }

        <div class="regles">
          <h3>Les règles d'un bon pitch</h3>
          <ul>
            <li>Une idée par phrase, des phrases courtes.</li>
            <li>Une preuve concrète vaut mieux que trois qualités.</li>
            <li>Un chiffre marque les esprits.</li>
            <li>Termine par une question ou une demande claire.</li>
            <li>Ne l'apprends pas par cœur mot à mot : retiens les blocs.</li>
          </ul>
        </div>
      </aside>

      <section>
        @if (!blocs().length) {
          <div class="carte vide">
            <h2>Ton pitch apparaîtra ici</h2>
            <p>Il est découpé en blocs (qui je suis, ce que je sais faire, la preuve…) pour être facile à retenir et à modifier.</p>
          </div>
        } @else if (!entrainement()) {
          <div class="carte">
            <div class="mesures">
              <span><b>{{ mots() }}</b> mots</span>
              @if (!info().ecrit) {
                <span [class.ok]="dureeOk()" [class.ko]="!dureeOk()">≈ <b>{{ duree(dureeEstimee()) }}</b> à l'oral (cible {{ info().cible[0] }}–{{ info().cible[1] }} s)</span>
              }
              <span class="espace"></span>
              <button class="btn btn-petit" (click)="copier()">{{ copie() ? 'Copié ✓' : 'Copier' }}</button>
              @if (!info().ecrit) {
                @if (oral.voixDispo) {
                  <button class="btn btn-petit" (click)="oral.parle() ? oral.taire() : oral.lire(texteComplet())">{{ oral.parle() ? 'Stop' : 'Écouter' }}</button>
                }
                <button class="btn btn-petit btn-principal" (click)="commencerEntrainement()">S'entraîner à l'oral</button>
              }
            </div>

            @for (b of blocs(); track $index; let i = $index) {
              <div class="bloc">
                <span class="bloc-num">{{ i + 1 }}</span>
                <div class="bloc-corps">
                  <span class="bloc-titre">{{ b.titre }}</span>
                  <textarea [ngModel]="b.texte" (ngModelChange)="modifier(i, $event)" [rows]="lignes(b.texte)"></textarea>
                </div>
              </div>
            }

            <h3 style="margin: 18px 0 8px">Vérifications</h3>
            <ul class="checklist">
              @for (v of verifications(); track v.label) {
                <li [class.ok]="v.ok">{{ v.label }}</li>
              }
            </ul>
          </div>
        } @else {
          <div class="carte entrainement">
            <div class="mesures">
              <strong>Entraînement</strong>
              <span class="espace"></span>
              <label class="interrupteur-simple">
                <input type="checkbox" [(ngModel)]="masquer" /> Cacher le texte
              </label>
              <button class="btn btn-petit" (click)="quitterEntrainement()">Retour au texte</button>
            </div>

            <div class="prompteur" [class.flou]="masquer && enCours()">
              @for (b of blocs(); track $index) {
                <p><span class="bloc-titre">{{ b.titre }}</span>{{ b.texte }}</p>
              }
            </div>

            <div class="controle">
              <div class="grand-chrono" [class.ko]="secondes() > info().cible[1]">{{ duree(secondes()) }}</div>
              @if (!enCours()) {
                <button class="btn btn-principal" (click)="demarrer()">
                  <svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
                  {{ resultat() ? 'Recommencer' : 'Démarrer' }}
                </button>
              } @else {
                <button class="btn btn-danger" (click)="terminer()">Terminer</button>
              }
              @if (!oral.dicteeDispo) {
                <p class="aide">Ton navigateur ne gère pas la dictée : le chrono fonctionne, mais pas l'analyse de ce que tu dis. Utilise Chrome ou Edge.</p>
              }
            </div>

            @if (enCours() && transcription()) {
              <p class="transcription">{{ transcription() }}</p>
            }

            @if (resultat(); as r) {
              <div class="resultats">
                <div class="res" [class.ok]="r.duree >= info().cible[0] && r.duree <= info().cible[1]">
                  <b>{{ duree(r.duree) }}</b><span>durée (cible {{ info().cible[0] }}–{{ info().cible[1] }} s)</span>
                </div>
                @if (r.mots) {
                  <div class="res" [class.ok]="r.debit >= 110 && r.debit <= 170">
                    <b>{{ r.debit }}</b><span>mots / minute (idéal : 120–160)</span>
                  </div>
                  <div class="res" [class.ok]="!r.parasites.length">
                    <b>{{ nbParasites(r) }}</b><span>mots parasites</span>
                  </div>
                  <div class="res" [class.ok]="r.couverture >= 70">
                    <b>{{ r.couverture }} %</b><span>des idées clés dites</span>
                  </div>
                }
              </div>
              <ul class="conseils">
                @for (c of conseils(r); track $index) { <li>{{ c }}</li> }
              </ul>
            }
          </div>
        }
      </section>
    </div>
  `,
  styles: `
    .formats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    @media (max-width: 800px) { .formats { grid-template-columns: 1fr 1fr; } }
    .format { text-align: left; border: 1px solid var(--bord); background: var(--surface); border-radius: 12px; padding: 12px 14px; cursor: pointer; display: flex; flex-direction: column; gap: 2px; transition: border-color 0.15s, box-shadow 0.15s; }
    .format span { font-size: 12.5px; color: var(--encre-3); }
    .format:hover { border-color: var(--bord-fort); }
    .format.actif { border-color: var(--vert); box-shadow: 0 0 0 1px var(--vert); background: var(--vert-clair); }
    .quand { margin: 10px 0 18px; }

    .pitch-grille { display: grid; grid-template-columns: 300px 1fr; gap: 18px; align-items: start; }
    @media (max-width: 1000px) { .pitch-grille { grid-template-columns: 1fr; } }
    .reglages { display: flex; flex-direction: column; gap: 14px; }
    .reglages .btn { justify-content: center; }
    .regles { border-top: 1px solid var(--bord); padding-top: 14px; }
    .regles ul { margin: 8px 0 0; padding-left: 18px; font-size: 13.5px; color: var(--encre-2); display: flex; flex-direction: column; gap: 4px; }

    .mesures { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; font-size: 14px; color: var(--encre-2); margin-bottom: 16px; }
    .mesures .espace { flex: 1; }
    .mesures .ok { color: var(--s-offre); }
    .mesures .ko { color: var(--s-relancee); }

    .bloc { display: flex; gap: 12px; margin-bottom: 12px; }
    .bloc-num { width: 26px; height: 26px; flex-shrink: 0; border-radius: 50%; background: var(--vert); color: var(--or); display: grid; place-items: center; font-size: 13px; font-weight: 600; margin-top: 2px; }
    .bloc-corps { flex: 1; }
    .bloc-titre { display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent); margin-bottom: 4px; }
    .bloc textarea { width: 100%; border: 1px solid transparent; background: var(--surface-2); border-radius: 9px; padding: 9px 11px; font-size: 15px; line-height: 1.55; resize: vertical; outline: none; }
    .bloc textarea:focus { border-color: var(--accent); background: var(--surface); }

    .checklist { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; font-size: 13.5px; color: var(--encre-2); }
    @media (max-width: 700px) { .checklist { grid-template-columns: 1fr; } }
    .checklist li { padding-left: 22px; position: relative; }
    .checklist li::before { content: '○'; position: absolute; left: 2px; color: var(--encre-3); }
    .checklist li.ok { color: var(--encre); }
    .checklist li.ok::before { content: '✓'; color: var(--s-offre); font-weight: 700; }

    .prompteur { font-size: 19px; line-height: 1.7; background: var(--surface-2); border-radius: 12px; padding: 20px 24px; transition: filter 0.3s; }
    .prompteur p { margin: 0 0 12px; }
    .prompteur.flou { filter: blur(7px); user-select: none; }
    .interrupteur-simple { display: flex; gap: 6px; align-items: center; font-size: 13.5px; cursor: pointer; }
    .controle { display: flex; align-items: center; gap: 16px; margin: 18px 0 8px; flex-wrap: wrap; }
    .grand-chrono { font-family: var(--titre); font-size: 40px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--vert); min-width: 130px; }
    .grand-chrono.ko { color: var(--s-refus); }
    .transcription { color: var(--encre-2); font-style: italic; font-size: 14px; }

    .resultats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 12px; }
    @media (max-width: 800px) { .resultats { grid-template-columns: 1fr 1fr; } }
    .res { border: 1px solid var(--avert-bord); background: var(--avert-fond); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; }
    .res.ok { border-color: var(--ok-bord); background: var(--ok-fond); }
    .res b { font-family: var(--titre); font-size: 24px; }
    .res span { font-size: 12.5px; color: var(--encre-2); }
    .conseils { margin: 14px 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; }
  `,
})
export class PitchPage implements OnDestroy {
  protected store = inject(Store);
  protected assistant = inject(Assistant);
  protected oral = inject(Oral);

  protected formats = FORMATS;
  protected format = signal<FormatPitch>('entretien');
  protected info = computed(() => FORMATS.find((f) => f.id === this.format())!);
  protected idCandidature = signal('');
  protected cible: Cible = { poste: '', entreprise: '', notes: '' };
  protected blocs = signal<{ titre: string; texte: string }[]>([]);
  protected chargement = signal(false);
  protected erreur = signal('');
  protected copie = signal(false);
  protected duree = formatDuree;

  protected entrainement = signal(false);
  protected enCours = signal(false);
  protected secondes = signal(0);
  protected transcription = signal('');
  protected resultat = signal<Resultat | null>(null);
  protected masquer = false;
  private minuteur?: ReturnType<typeof setInterval>;

  protected texteComplet = computed(() => this.blocs().map((b) => b.texte).join('\n\n'));
  protected mots = computed(() => compterMots(this.texteComplet()));
  protected dureeEstimee = computed(() => dureeOrale(this.texteComplet()));
  protected dureeOk = computed(() => {
    const [min, max] = this.info().cible;
    return this.dureeEstimee() >= min && this.dureeEstimee() <= max;
  });

  protected verifications = computed(() => {
    const t = this.texteComplet();
    const dernier = this.blocs().at(-1)?.texte ?? '';
    const v = [
      { label: 'Une preuve concrète (expérience ou projet)', ok: /(stage|projet|j'ai (r[ée]alis|d[ée]velopp|mis en place|g[ée]r|cr[ée]|men|organis))/i.test(t) },
      { label: 'Au moins un chiffre', ok: /\d/.test(t.replace(/\[[^\]]*\]/g, '')) },
      { label: 'Le poste visé est mentionné', ok: !!this.cible.poste && t.toLowerCase().includes(this.cible.poste.toLowerCase().split(' ')[0]) },
      ...(this.format() === 'entretien' ? [] : [{ label: 'Se termine par une question ou une demande', ok: /\?|disponible|rencontrer|[ée]changer|entretien/i.test(dernier) }]),
      { label: 'Aucun passage [à compléter]', ok: !/\[[^\]]+\]/.test(t) },
      { label: 'Pas de formule creuse', ok: !/(dynamique et motiv|je me permets|force de proposition|polyvalent)/i.test(t) },
    ];
    if (this.cible.entreprise) v.splice(3, 0, { label: `${this.cible.entreprise} est citée`, ok: t.toLowerCase().includes(this.cible.entreprise.toLowerCase()) });
    if (!this.info().ecrit) v.push({ label: 'Durée adaptée au format', ok: this.dureeOk() });
    return v;
  });

  constructor() {
    const id = inject(ActivatedRoute).snapshot.queryParamMap.get('id');
    if (id) this.choisir(id);
    this.charger();
  }

  ngOnDestroy() {
    this.oral.arreter();
    this.oral.taire();
    clearInterval(this.minuteur);
  }

  protected changerFormat(f: FormatPitch) {
    this.quitterEntrainement();
    this.format.set(f);
    this.charger();
  }

  private charger() {
    const sauve = this.store.pitchs()[this.format()];
    this.blocs.set(sauve ? sauve.blocs : []);
    if (sauve && !this.cible.poste) this.cible = { poste: sauve.poste, entreprise: sauve.entreprise, notes: '' };
  }

  private sauver() {
    this.store.sauverPitch({
      format: this.format(),
      poste: this.cible.poste,
      entreprise: this.cible.entreprise,
      blocs: this.blocs(),
      majLe: new Date().toISOString(),
    });
  }

  protected choisir(id: string) {
    this.idCandidature.set(id);
    const c = this.store.trouver(id);
    this.cible = c ? { poste: c.poste, entreprise: c.entreprise, notes: '' } : { poste: '', entreprise: '', notes: '' };
  }

  protected async generer() {
    this.chargement.set(true);
    this.erreur.set('');
    try {
      const p = await this.assistant.pitch(this.cible, this.format());
      this.blocs.set(p.blocs);
      this.sauver();
    } catch (e) {
      this.erreur.set(e instanceof Error ? e.message : 'La génération a échoué.');
    } finally {
      this.chargement.set(false);
    }
  }

  protected modifier(i: number, texte: string) {
    this.blocs.update((l) => l.map((b, j) => (j === i ? { ...b, texte } : b)));
    this.sauver();
  }

  protected lignes(t: string) {
    return Math.max(2, Math.ceil(t.length / 70));
  }

  protected async copier() {
    await navigator.clipboard.writeText(this.texteComplet());
    this.copie.set(true);
    setTimeout(() => this.copie.set(false), 1800);
  }

  // ---------- Entraînement ----------

  protected commencerEntrainement() {
    this.oral.taire();
    this.resultat.set(null);
    this.secondes.set(0);
    this.entrainement.set(true);
  }

  protected quitterEntrainement() {
    this.oral.arreter();
    clearInterval(this.minuteur);
    this.enCours.set(false);
    this.entrainement.set(false);
  }

  protected demarrer() {
    this.resultat.set(null);
    this.transcription.set('');
    this.secondes.set(0);
    const debut = Date.now();
    this.minuteur = setInterval(() => this.secondes.set(Math.round((Date.now() - debut) / 1000)), 250);
    this.enCours.set(true);
    this.oral.ecouter((t) => this.transcription.set(t));
  }

  protected terminer() {
    clearInterval(this.minuteur);
    this.oral.arreter();
    this.enCours.set(false);

    const dit = this.transcription();
    const duree = this.secondes();
    const mots = compterMots(dit);
    const cles = this.motsCles();
    const normal = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const ditN = normal(dit);
    const oublis = cles.filter((m) => !ditN.includes(normal(m)));

    this.resultat.set({
      duree,
      mots,
      debit: duree ? Math.round((mots / duree) * 60) : 0,
      parasites: motsParasites(dit),
      oublis,
      couverture: cles.length ? Math.round(((cles.length - oublis.length) / cles.length) * 100) : 100,
    });
  }

  /** Les mots importants du pitch : noms propres, chiffres, mots longs. */
  private motsCles(): string[] {
    const mots = this.texteComplet()
      .replace(/\[[^\]]*\]/g, '')
      .split(/[\s,.;:!?«»()'’"/–-]+/)
      .filter((m) => /\d/.test(m) || m.length >= 7 || /^[A-ZÉ][a-zé]{3,}/.test(m))
      .filter((m) => !VIDES.has(m.toLowerCase()));
    return [...new Set(mots)].slice(0, 14);
  }

  protected nbParasites(r: Resultat) {
    return r.parasites.reduce((s, p) => s + p.nb, 0);
  }

  protected conseils(r: Resultat): string[] {
    const [min, max] = this.info().cible;
    const c: string[] = [];
    if (!r.mots) c.push('Je n\'ai rien entendu : vérifie que le micro est autorisé dans ton navigateur (icône à gauche de l\'adresse).');
    if (r.duree < min) c.push(`Trop court de ${min - r.duree} s : développe ta preuve concrète, c'est elle qui convainc.`);
    if (r.duree > max) c.push(`Trop long de ${r.duree - max} s : coupe une phrase par bloc, le recruteur doit retenir 2 ou 3 idées, pas 10.`);
    if (r.mots && r.debit > 170) c.push('Tu parles trop vite : respire entre les blocs, ça te donne l\'air plus sûr de toi.');
    if (r.mots && r.debit < 110) c.push('Débit un peu lent : connais mieux l\'enchaînement des blocs pour être plus fluide.');
    if (r.parasites.length) c.push(`Mots parasites : ${r.parasites.map((p) => `« ${p.mot} » ×${p.nb}`).join(', ')}. Remplace-les par un silence d'une seconde.`);
    if (r.oublis.length) c.push(`Idées oubliées : ${r.oublis.slice(0, 6).join(', ')}.`);
    if (!c.length) c.push('Excellent ! Refais-le en cachant le texte, puis devant quelqu\'un.');
    else if (!this.masquer) c.push('Quand tu te sens à l\'aise, active « Cacher le texte » pour t\'entraîner sans support.');
    return c;
  }
}
