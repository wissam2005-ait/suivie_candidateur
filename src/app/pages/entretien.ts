import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Store } from '../core/store';
import { Assistant, Cible, Tour } from '../core/assistant';

interface Message {
  role: 'recruteur' | 'candidat' | 'retour' | 'bilan';
  texte: string;
  note?: number | null;
}

@Component({
  selector: 'app-entretien',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="entete">
      <div>
        <h1>Simulation d'entretien</h1>
        <p>Un recruteur virtuel te pose 5 questions et commente chacune de tes réponses.</p>
      </div>
      @if (demarre()) {
        <button class="btn" (click)="recommencer()">Recommencer</button>
      }
    </div>

    @if (assistant.modeHorsLigne()) {
      <div class="bandeau">
        <svg viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
        <span>Mode hors ligne : l'IA n'est pas joignable, les questions viennent d'une banque prédéfinie et les retours sont plus simples.</span>
      </div>
    }

    @if (!demarre()) {
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
          <div class="champ"><label for="poste">Poste</label><input id="poste" [(ngModel)]="cible.poste" placeholder="ex. Développeur front-end" /></div>
          <div class="champ"><label for="ent">Entreprise</label><input id="ent" [(ngModel)]="cible.entreprise" placeholder="ex. Doctolib" /></div>
        </div>
        @if (!store.profil().prenom) {
          <p class="aide">Conseil : remplis <a routerLink="/profil">ton profil</a> pour que les questions s'appuient sur ton parcours.</p>
        }
        <button class="btn btn-principal" (click)="demarrer()" [disabled]="!cible.poste || chargement()">
          @if (chargement()) { <span class="chargement"></span> }
          Commencer l'entretien
        </button>
        @if (erreur()) { <p class="aide" style="color: var(--s-refus); margin: 0">{{ erreur() }}</p> }
      </div>
    } @else {
      <div class="carte chat">
        <div class="chat-entete">
          <div class="avatar">R</div>
          <div>
            <strong>Recruteur · {{ cible.entreprise || 'Entreprise' }}</strong>
            <div class="sous">{{ cible.poste }} · question {{ numero() }}/5</div>
          </div>
          <div class="progression"><div [style.width.%]="(numero() / 5) * 100"></div></div>
        </div>

        <div class="messages" #fil>
          @for (m of messages(); track $index) {
            @switch (m.role) {
              @case ('recruteur') { <div class="bulle recruteur">{{ m.texte }}</div> }
              @case ('candidat') { <div class="bulle candidat">{{ m.texte }}</div> }
              @case ('retour') {
                <div class="retour">
                  <span class="retour-titre">Retour du coach</span>
                  {{ m.texte }}
                </div>
              }
              @case ('bilan') {
                <div class="bilan">
                  <div class="note">{{ m.note ?? '–' }}<small>/10</small></div>
                  <div>
                    <strong>Bilan de l'entretien</strong>
                    <p>{{ m.texte }}</p>
                  </div>
                </div>
              }
            }
          }
          @if (chargement()) {
            <div class="bulle recruteur ecrit"><span></span><span></span><span></span></div>
          }
        </div>

        @if (!termine()) {
          <form class="saisie" (ngSubmit)="repondre()">
            <textarea name="reponse" [(ngModel)]="reponse" rows="3" placeholder="Ta réponse… (Ctrl + Entrée pour envoyer)"
                      (keydown.control.enter)="repondre()" (keydown.meta.enter)="repondre()" [disabled]="chargement()"></textarea>
            <button class="btn btn-principal" type="submit" [disabled]="!reponse.trim() || chargement()">Envoyer</button>
          </form>
        } @else {
          <div class="saisie fin">
            <button class="btn btn-principal" (click)="recommencer()">Refaire un entretien</button>
          </div>
        }
      </div>
      @if (erreur()) { <p class="aide" style="color: var(--s-refus)">{{ erreur() }}</p> }
    }
  `,
  styles: `
    .config { max-width: 620px; display: flex; flex-direction: column; gap: 16px; }
    .config .btn { align-self: flex-start; }

    .chat { padding: 0; display: flex; flex-direction: column; height: calc(100vh - 210px); min-height: 480px; overflow: hidden; }
    .chat-entete { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--bord); position: relative; }
    .avatar { width: 38px; height: 38px; border-radius: 50%; background: var(--vert); color: var(--or); display: grid; place-items: center; font-family: var(--titre); font-weight: 600; }
    .progression { position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; }
    .progression div { height: 100%; background: var(--or); transition: width 0.4s; }

    .messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px; background: var(--surface-2); }
    .bulle { max-width: 78%; padding: 11px 15px; border-radius: 14px; white-space: pre-wrap; }
    .recruteur { background: var(--surface); border: 1px solid var(--bord); border-bottom-left-radius: 4px; align-self: flex-start; }
    .candidat { background: var(--vert); color: #fff; border-bottom-right-radius: 4px; align-self: flex-end; }
    .retour { align-self: stretch; background: #fdf6e3; border: 1px dashed #e4cf8f; border-radius: 10px; padding: 10px 14px; font-size: 14px; color: #5c4a14; }
    .retour-titre { display: block; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 3px; }
    .bilan { display: flex; gap: 18px; align-items: center; background: var(--vert); color: #e6efeb; border-radius: 12px; padding: 18px 20px; }
    .bilan p { margin: 4px 0 0; white-space: pre-wrap; }
    .note { font-family: var(--titre); font-size: 44px; color: var(--or); font-weight: 600; line-height: 1; }
    .note small { font-size: 18px; color: #bcd0c8; }

    .ecrit { display: flex; gap: 4px; }
    .ecrit span { width: 7px; height: 7px; background: var(--encre-3); border-radius: 50%; animation: saut 1s infinite; }
    .ecrit span:nth-child(2) { animation-delay: 0.15s; }
    .ecrit span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes saut { 50% { transform: translateY(-4px); opacity: 0.5; } }

    .saisie { display: flex; gap: 10px; padding: 14px; border-top: 1px solid var(--bord); align-items: flex-end; }
    .saisie textarea { flex: 1; border: 1px solid var(--bord); border-radius: 10px; padding: 10px 12px; resize: none; outline: none; }
    .saisie textarea:focus { border-color: var(--accent); }
    .saisie.fin { justify-content: center; }
    @media (max-width: 600px) { .bulle { max-width: 92%; } }
  `,
})
export class Entretien {
  protected store = inject(Store);
  protected assistant = inject(Assistant);
  private fil = viewChild<ElementRef<HTMLElement>>('fil');

  protected cible: Cible = { poste: '', entreprise: '' };
  protected idCandidature = signal('');
  protected messages = signal<Message[]>([]);
  protected chargement = signal(false);
  protected termine = signal(false);
  protected erreur = signal('');
  protected reponse = '';

  protected demarre = computed(() => this.messages().length > 0);
  protected numero = computed(() => this.messages().filter((m) => m.role === 'recruteur').length);

  constructor() {
    const id = inject(ActivatedRoute).snapshot.queryParamMap.get('id');
    if (id) this.choisir(id);
  }

  protected choisir(id: string) {
    this.idCandidature.set(id);
    const c = this.store.trouver(id);
    this.cible = c ? { poste: c.poste, entreprise: c.entreprise, notes: c.notes } : { poste: '', entreprise: '' };
  }

  protected demarrer() {
    this.suite();
  }

  protected repondre() {
    const texte = this.reponse.trim();
    if (!texte || this.chargement()) return;
    this.messages.update((m) => [...m, { role: 'candidat', texte }]);
    this.reponse = '';
    this.suite();
  }

  protected recommencer() {
    this.messages.set([]);
    this.termine.set(false);
    this.erreur.set('');
  }

  private async suite() {
    this.chargement.set(true);
    this.erreur.set('');
    this.defiler();

    // l'API n'a besoin que des questions et des réponses, pas des retours
    const historique: Tour[] = this.messages()
      .filter((m) => m.role === 'recruteur' || m.role === 'candidat')
      .map((m) => ({ role: m.role as Tour['role'], texte: m.texte }));

    try {
      const etape = await this.assistant.etapeEntretien(this.cible, historique);
      const nouveaux: Message[] = [];
      if (etape.retour) nouveaux.push({ role: 'retour', texte: etape.retour });
      if (etape.question) nouveaux.push({ role: 'recruteur', texte: etape.question });
      if (etape.bilan || !etape.question) {
        nouveaux.push({ role: 'bilan', texte: etape.bilan ?? 'Entretien terminé.', note: etape.note });
        this.termine.set(true);
      }
      this.messages.update((m) => [...m, ...nouveaux]);
    } catch (e) {
      this.erreur.set(e instanceof Error ? e.message : 'Une erreur est survenue, réessaie.');
    } finally {
      this.chargement.set(false);
      this.defiler();
    }
  }

  private defiler() {
    setTimeout(() => {
      const el = this.fil()?.nativeElement;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }
}
