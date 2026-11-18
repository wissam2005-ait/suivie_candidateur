import { Component, ElementRef, OnDestroy, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Store } from '../core/store';
import { AnalyseReponse, Assistant, Cible, Tour } from '../core/assistant';
import { Oral, formatDuree } from '../core/oral';
import { aujourdhui, formatCourt } from '../core/dates';

const NB_QUESTIONS = 6;

interface Message {
  role: 'recruteur' | 'candidat' | 'analyse' | 'bilan';
  texte: string;
  relance?: boolean;
  analyse?: AnalyseReponse;
  duree?: number;
  note?: number | null;
  criteres?: { nom: string; note: number }[] | null;
}

@Component({
  selector: 'app-entretien',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="entete">
      <div>
        <h1>Simulation d'entretien</h1>
        <p>Un recruteur te fait passer un entretien complet : {{ nbQuestions }} questions, des relances, une note pour chaque réponse.</p>
      </div>
      @if (demarre()) {
        <button class="btn" (click)="recommencer()">Recommencer</button>
      }
    </div>

    @if (assistant.modeHorsLigne()) {
      <div class="bandeau">
        <svg viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
        <span>
          Mode sans IA : questions adaptées au métier et analyse automatique de tes réponses.
          Pour un recruteur qui rebondit vraiment sur tes réponses, ajoute la clé <code>ANTHROPIC_API_KEY</code> dans Vercel.
        </span>
      </div>
    }

    @if (!demarre()) {
      <div class="config-grille">
        <div class="carte config">
          <h2>Pour quel poste veux-tu t'entraîner ?</h2>
          @if (store.candidatures().length) {
            <div class="champ">
              <label for="cand">Choisir une de mes candidatures</label>
              <select id="cand" [ngModel]="idCandidature()" (ngModelChange)="choisir($event)">
                <option value="">— Saisie libre —</option>
                @for (c of store.candidatures(); track c.id) {
                  <option [value]="c.id">{{ c.entreprise }} · {{ c.poste }}</option>
                }
              </select>
            </div>
          }
          <div class="form-grille">
            <div class="champ"><label for="poste">Poste</label><input id="poste" [(ngModel)]="cible.poste" placeholder="ex. Développeur web" /></div>
            <div class="champ"><label for="ent">Entreprise</label><input id="ent" [(ngModel)]="cible.entreprise" placeholder="ex. Thales" /></div>
          </div>

          <div class="options">
            @if (oral.voixDispo) {
              <label class="interrupteur">
                <input type="checkbox" [(ngModel)]="voix" />
                <span></span> Le recruteur lit les questions à voix haute
              </label>
            }
            @if (oral.dicteeDispo) {
              <label class="interrupteur">
                <input type="checkbox" [(ngModel)]="dictee" />
                <span></span> Répondre à l'oral (micro)
              </label>
            }
            <label class="interrupteur">
              <input type="checkbox" [(ngModel)]="aide" />
              <span></span> Afficher un conseil sous chaque question
            </label>
          </div>

          @if (!store.profil().prenom) {
            <p class="aide">Conseil : remplis <a routerLink="/profil">ton profil</a> pour que l'entretien s'appuie sur ton parcours.</p>
          }
          <button class="btn btn-principal" (click)="demarrer()" [disabled]="!cible.poste || chargement()">
            @if (chargement()) { <span class="chargement"></span> }
            Commencer l'entretien
          </button>
          @if (erreur()) { <p class="aide" style="color: var(--s-refus); margin: 0">{{ erreur() }}</p> }
        </div>

        <div class="carte">
          <h2 style="margin-bottom: 14px">Comment ça se passe</h2>
          <ol class="etapes">
            <li><strong>Présentation</strong> : ton pitch. Prépare-le dans <a routerLink="/pitch">Mon pitch</a>.</li>
            <li><strong>Motivation</strong> : pourquoi cette entreprise, pourquoi ce poste.</li>
            <li><strong>Question métier</strong> adaptée au poste.</li>
            <li><strong>Question comportementale</strong> : réponds avec la méthode STAR.</li>
            <li><strong>Question piège</strong> ou mise en situation.</li>
            <li><strong>« Avez-vous des questions ? »</strong></li>
          </ol>
          <p class="aide">Si ta réponse est vague, le recruteur relance, comme en vrai. Chaque réponse est notée sur 10.</p>

          @if (store.simulations().length) {
            <h3 style="margin: 18px 0 8px">Tes dernières simulations</h3>
            @for (s of store.simulations().slice(0, 5); track $index) {
              <div class="histo-ligne">
                <span class="sous">{{ court(s.date) }} · {{ s.entreprise || s.poste }}</span>
                <span class="mini-note" [class.bon]="s.note >= 7" [class.moyen]="s.note >= 5 && s.note < 7">{{ s.note }}/10</span>
              </div>
            }
          }
        </div>
      </div>
    } @else {
      <div class="carte chat">
        <div class="chat-entete">
          <div class="avatar" [class.parle]="oral.parle()">R</div>
          <div style="flex: 1">
            <strong>Recruteur · {{ cible.entreprise || 'Entreprise' }}</strong>
            <div class="sous">{{ cible.poste }} · question {{ numero() }}/{{ nbQuestions }}</div>
          </div>
          @if (oral.voixDispo) {
            <button class="btn-icone" (click)="voix = !voix; voix ? relire() : oral.taire()" [title]="voix ? 'Couper la voix' : 'Activer la voix'">
              @if (voix) {
                <svg viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /></svg>
              } @else {
                <svg viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6" /></svg>
              }
            </button>
          }
          <div class="progression"><div [style.width.%]="(numero() / nbQuestions) * 100"></div></div>
        </div>

        <div class="messages" #fil>
          @for (m of messages(); track $index) {
            @switch (m.role) {
              @case ('recruteur') {
                <div class="bulle recruteur" [class.relance]="m.relance">
                  @if (m.relance) { <span class="etiquette">Relance</span> }
                  {{ m.texte }}
                </div>
              }
              @case ('candidat') {
                <div class="bulle candidat">
                  {{ m.texte }}
                  @if (m.duree) { <span class="duree">{{ duree(m.duree) }}</span> }
                </div>
              }
              @case ('analyse') {
                <div class="analyse">
                  <div class="analyse-tete">
                    <span class="retour-titre">Retour du coach</span>
                    <span class="mini-note" [class.bon]="m.analyse!.note >= 7" [class.moyen]="m.analyse!.note >= 5 && m.analyse!.note < 7">{{ m.analyse!.note }}/10</span>
                  </div>
                  @if (m.analyse!.forts.length) {
                    <ul class="forts">
                      @for (f of m.analyse!.forts; track $index) { <li>{{ f }}</li> }
                    </ul>
                  }
                  @if (m.analyse!.ameliorer.length) {
                    <ul class="ameliorer">
                      @for (f of m.analyse!.ameliorer; track $index) { <li>{{ f }}</li> }
                    </ul>
                  }
                  @if (m.analyse!.attendu) {
                    <details>
                      <summary>Ce que le recruteur voulait savoir</summary>
                      <p>{{ m.analyse!.attendu }}</p>
                      @if (m.analyse!.conseil) { <p><strong>Méthode :</strong> {{ m.analyse!.conseil }}</p> }
                    </details>
                  }
                </div>
              }
              @case ('bilan') {
                <div class="bilan">
                  <div class="bilan-tete">
                    <div class="note">{{ m.note ?? '–' }}<small>/10</small></div>
                    <strong>Bilan de l'entretien</strong>
                  </div>
                  @if (m.criteres?.length) {
                    <div class="criteres">
                      @for (c of m.criteres; track c.nom) {
                        <div class="critere">
                          <span>{{ c.nom }}</span>
                          <div class="piste"><div [style.width.%]="c.note * 10"></div></div>
                          <b>{{ c.note }}</b>
                        </div>
                      }
                    </div>
                  }
                  <p>{{ m.texte }}</p>
                </div>
              }
            }
          }
          @if (chargement()) {
            <div class="bulle recruteur ecrit"><span></span><span></span><span></span></div>
          }
        </div>

        @if (!termine()) {
          @if (aide && indice() && !chargement()) {
            <div class="indice">
              <svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.5 1 2.5h6c0-1 .4-1.9 1-2.5A6 6 0 0 0 12 3z" /></svg>
              {{ indice() }}
            </div>
          }
          <form class="saisie" (ngSubmit)="repondre()">
            <div class="zone">
              <textarea name="reponse" [(ngModel)]="reponse" rows="3"
                        [placeholder]="oral.ecoute() ? 'Je t\\'écoute… parle normalement, comme en entretien.' : 'Ta réponse… (Ctrl + Entrée pour envoyer)'"
                        (keydown.control.enter)="repondre()" (keydown.meta.enter)="repondre()" [disabled]="chargement()"></textarea>
              <span class="chrono" [class.long]="secondes() > 150">{{ duree(secondes()) }}</span>
            </div>
            @if (oral.dicteeDispo) {
              <button type="button" class="btn micro" [class.actif]="oral.ecoute()" (click)="basculerMicro()" [disabled]="chargement()" [title]="oral.ecoute() ? 'Arrêter le micro' : 'Répondre à l\\'oral'">
                <svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
              </button>
            }
            <button class="btn btn-principal" type="submit" [disabled]="!reponse.trim() || chargement()">Envoyer</button>
          </form>
        } @else {
          <div class="saisie fin">
            <button class="btn btn-principal" (click)="recommencer()">Refaire un entretien</button>
            <a class="btn" routerLink="/pitch">Travailler mon pitch</a>
          </div>
        }
      </div>
      @if (erreur()) { <p class="aide" style="color: var(--s-refus)">{{ erreur() }}</p> }
    }
  `,
  styles: `
    .config-grille { display: grid; grid-template-columns: 1.2fr 1fr; gap: 18px; align-items: start; }
    @media (max-width: 1000px) { .config-grille { grid-template-columns: 1fr; } }
    .config { display: flex; flex-direction: column; gap: 16px; }
    .config .btn { align-self: flex-start; }
    .options { display: flex; flex-direction: column; gap: 10px; }
    .interrupteur { display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px; }
    .interrupteur input { display: none; }
    .interrupteur span { width: 34px; height: 20px; background: var(--interrupteur); border-radius: 99px; position: relative; transition: background 0.15s; flex-shrink: 0; }
    .interrupteur span::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; background: #fff; border-radius: 50%; transition: transform 0.15s; }
    .interrupteur input:checked + span { background: var(--accent); }
    .interrupteur input:checked + span::after { transform: translateX(14px); }
    .etapes { margin: 0 0 12px; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; font-size: 14px; color: var(--encre-2); }
    .histo-ligne { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--ligne); }
    .mini-note { font-weight: 600; font-size: 13px; padding: 2px 8px; border-radius: 99px; background: var(--ko-fond); color: var(--ko-texte); }
    .mini-note.moyen { background: var(--moyen-fond); color: var(--moyen-texte); }
    .mini-note.bon { background: var(--ok-fond); color: var(--ok-texte); }

    .chat { padding: 0; display: flex; flex-direction: column; height: calc(100vh - 200px); min-height: 520px; overflow: hidden; }
    .chat-entete { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--bord); position: relative; }
    .avatar { width: 38px; height: 38px; border-radius: 50%; background: var(--vert); color: var(--or); display: grid; place-items: center; font-family: var(--titre); font-weight: 600; transition: box-shadow 0.2s; }
    .avatar.parle { box-shadow: 0 0 0 4px rgb(243 201 105 / 0.45); animation: pulse 1.2s infinite; }
    @keyframes pulse { 50% { box-shadow: 0 0 0 7px rgb(243 201 105 / 0.15); } }
    .progression { position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; }
    .progression div { height: 100%; background: var(--or); transition: width 0.4s; }

    .messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px; background: var(--surface-2); }
    .bulle { max-width: 78%; padding: 11px 15px; border-radius: 14px; white-space: pre-wrap; position: relative; }
    .recruteur { background: var(--surface); border: 1px solid var(--bord); border-bottom-left-radius: 4px; align-self: flex-start; }
    .recruteur.relance { border-color: var(--avert-bord); }
    .etiquette { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--moyen-texte); margin-bottom: 2px; }
    .candidat { background: var(--vert); color: #fff; border-bottom-right-radius: 4px; align-self: flex-end; }
    .duree { display: block; font-size: 11.5px; color: #9fb8af; margin-top: 4px; text-align: right; }

    .analyse { align-self: stretch; background: var(--surface); border: 1px solid var(--bord); border-left: 3px solid var(--or); border-radius: 10px; padding: 12px 16px; font-size: 14px; }
    .analyse-tete { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .retour-titre { font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--encre-2); }
    .analyse ul { margin: 4px 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 3px; }
    .analyse li { padding-left: 22px; position: relative; }
    .forts li::before { content: '✓'; position: absolute; left: 4px; color: var(--s-offre); font-weight: 700; }
    .ameliorer li::before { content: '→'; position: absolute; left: 3px; color: var(--s-relancee); font-weight: 700; }
    details { margin-top: 8px; color: var(--encre-2); }
    summary { cursor: pointer; font-size: 13px; font-weight: 500; color: var(--accent); }
    details p { margin: 6px 0 0; }

    .bilan { background: var(--vert); color: #e6efeb; border-radius: 12px; padding: 20px 22px; }
    .bilan-tete { display: flex; align-items: center; gap: 16px; margin-bottom: 14px; }
    .bilan-tete strong { font-family: var(--titre); font-size: 19px; color: #fff; }
    .bilan p { margin: 14px 0 0; white-space: pre-wrap; }
    .note { font-family: var(--titre); font-size: 44px; color: var(--or); font-weight: 600; line-height: 1; }
    .note small { font-size: 18px; color: #bcd0c8; }
    .criteres { display: flex; flex-direction: column; gap: 8px; }
    .critere { display: grid; grid-template-columns: 190px 1fr 30px; gap: 10px; align-items: center; font-size: 13.5px; }
    .critere .piste { height: 7px; background: rgb(255 255 255 / 0.12); border-radius: 99px; overflow: hidden; }
    .critere .piste div { height: 100%; background: var(--or); border-radius: 99px; }
    .critere b { text-align: right; color: #fff; }
    @media (max-width: 600px) { .critere { grid-template-columns: 1fr 60px 26px; } }

    .ecrit { display: flex; gap: 4px; }
    .ecrit span { width: 7px; height: 7px; background: var(--encre-3); border-radius: 50%; animation: saut 1s infinite; }
    .ecrit span:nth-child(2) { animation-delay: 0.15s; }
    .ecrit span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes saut { 50% { transform: translateY(-4px); opacity: 0.5; } }

    .indice { display: flex; gap: 8px; align-items: flex-start; padding: 10px 16px; background: var(--avert-fond); border-top: 1px solid var(--avert-bord); font-size: 13.5px; color: var(--avert-texte); }
    .saisie { display: flex; gap: 10px; padding: 14px; border-top: 1px solid var(--bord); align-items: flex-end; }
    .zone { flex: 1; position: relative; }
    .zone textarea { width: 100%; border: 1px solid var(--bord); border-radius: 10px; padding: 10px 12px 22px; resize: none; outline: none; }
    .zone textarea:focus { border-color: var(--accent); }
    .chrono { position: absolute; right: 10px; bottom: 8px; font-size: 12px; color: var(--encre-3); font-variant-numeric: tabular-nums; }
    .chrono.long { color: var(--s-refus); }
    .micro { padding: 9px 11px; }
    .micro.actif { background: var(--s-refus); border-color: var(--s-refus); color: #fff; animation: pulse-micro 1.2s infinite; }
    @keyframes pulse-micro { 50% { box-shadow: 0 0 0 5px rgb(194 82 63 / 0.2); } }
    .saisie.fin { justify-content: center; }
    code { background: var(--fond-3); padding: 1px 5px; border-radius: 4px; font-size: 12.5px; }
    @media (max-width: 600px) { .bulle { max-width: 92%; } }
  `,
})
export class Entretien implements OnDestroy {
  protected store = inject(Store);
  protected assistant = inject(Assistant);
  protected oral = inject(Oral);
  private fil = viewChild<ElementRef<HTMLElement>>('fil');

  protected nbQuestions = NB_QUESTIONS;
  protected cible: Cible = { poste: '', entreprise: '' };
  protected idCandidature = signal('');
  protected messages = signal<Message[]>([]);
  protected chargement = signal(false);
  protected termine = signal(false);
  protected erreur = signal('');
  protected indice = signal<string | null>(null);
  protected secondes = signal(0);
  protected reponse = '';
  protected voix = this.oral.voixDispo;
  protected dictee = this.oral.dicteeDispo;
  protected aide = true;
  protected duree = formatDuree;
  protected court = formatCourt;

  private minuteur?: ReturnType<typeof setInterval>;
  private debutReponse = 0;

  protected demarre = computed(() => this.messages().length > 0);
  protected numero = computed(() => Math.min(NB_QUESTIONS, this.messages().filter((m) => m.role === 'recruteur' && !m.relance).length));

  constructor() {
    const id = inject(ActivatedRoute).snapshot.queryParamMap.get('id');
    if (id) this.choisir(id);
  }

  ngOnDestroy() {
    this.oral.arreter();
    this.oral.taire();
    clearInterval(this.minuteur);
  }

  protected choisir(id: string) {
    this.idCandidature.set(id);
    const c = this.store.trouver(id);
    this.cible = c ? { poste: c.poste, entreprise: c.entreprise, notes: c.notes } : { poste: '', entreprise: '' };
  }

  protected demarrer() {
    this.suite();
  }

  protected basculerMicro() {
    if (this.oral.ecoute()) {
      this.oral.arreter();
      return;
    }
    const avant = this.reponse ? this.reponse.trim() + ' ' : '';
    this.oral.ecouter((texte) => (this.reponse = avant + texte));
  }

  protected relire() {
    const derniere = [...this.messages()].reverse().find((m) => m.role === 'recruteur');
    if (derniere) this.oral.lire(derniere.texte);
  }

  protected repondre() {
    const texte = this.reponse.trim();
    if (!texte || this.chargement()) return;
    this.oral.arreter();
    const duree = this.secondes();
    this.messages.update((m) => [...m, { role: 'candidat', texte, duree }]);
    this.reponse = '';
    this.suite();
  }

  protected recommencer() {
    this.oral.arreter();
    this.oral.taire();
    clearInterval(this.minuteur);
    this.messages.set([]);
    this.termine.set(false);
    this.erreur.set('');
    this.indice.set(null);
  }

  private async suite() {
    this.chargement.set(true);
    this.erreur.set('');
    clearInterval(this.minuteur);
    this.defiler();

    const historique: Tour[] = this.messages()
      .filter((m) => m.role === 'recruteur' || m.role === 'candidat')
      .map((m) => ({ role: m.role as Tour['role'], texte: m.texte, relance: m.relance }));

    try {
      const etape = await this.assistant.etapeEntretien(this.cible, historique);
      const nouveaux: Message[] = [];
      if (etape.analyse) nouveaux.push({ role: 'analyse', texte: '', analyse: etape.analyse });
      else if (etape.retour) nouveaux.push({ role: 'analyse', texte: '', analyse: { note: 0, forts: [], ameliorer: [etape.retour] } });
      if (etape.question) nouveaux.push({ role: 'recruteur', texte: etape.question, relance: etape.relance });

      if (etape.bilan || !etape.question) {
        nouveaux.push({ role: 'bilan', texte: etape.bilan ?? 'Entretien terminé.', note: etape.note, criteres: etape.criteres });
        this.termine.set(true);
        if (etape.note !== null) {
          this.store.ajouterSimulation({ date: aujourdhui(), poste: this.cible.poste, entreprise: this.cible.entreprise, note: etape.note });
        }
      }
      this.messages.update((m) => [...m, ...nouveaux]);
      this.indice.set(etape.indice);

      if (etape.question) {
        if (this.voix) this.oral.lire(etape.question);
        this.lancerChrono();
      }
    } catch (e) {
      this.erreur.set(e instanceof Error ? e.message : 'Une erreur est survenue, réessaie.');
    } finally {
      this.chargement.set(false);
      this.defiler();
    }
  }

  private lancerChrono() {
    this.debutReponse = Date.now();
    this.secondes.set(0);
    this.minuteur = setInterval(() => this.secondes.set(Math.round((Date.now() - this.debutReponse) / 1000)), 1000);
  }

  private defiler() {
    setTimeout(() => {
      const el = this.fil()?.nativeElement;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }
}
