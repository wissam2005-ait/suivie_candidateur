import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Store } from './core/store';

type Theme = 'auto' | 'light' | 'dark';

function themeSauve(): Theme {
  try {
    const t = localStorage.getItem('postulo.theme');
    return t === 'light' || t === 'dark' ? t : 'auto';
  } catch {
    return 'auto';
  }
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
})
export class App {
  protected store = inject(Store);
  protected menuOuvert = signal(false);
  protected theme = signal<Theme>(themeSauve());

  constructor() {
    effect(() => {
      const t = this.theme();
      const html = document.documentElement;
      if (t === 'auto') delete html.dataset['theme'];
      else html.dataset['theme'] = t;
      try { localStorage.setItem('postulo.theme', t); } catch { /* rien */ }
    });
  }

  protected changerTheme() {
    const ordre: Theme[] = ['auto', 'light', 'dark'];
    this.theme.set(ordre[(ordre.indexOf(this.theme()) + 1) % ordre.length]);
  }

  protected libelleTheme = computed(() => ({ auto: 'Thème : automatique', light: 'Thème : clair', dark: 'Thème : sombre' })[this.theme()]);

  protected liens = [
    { url: '/', label: 'Tableau de bord', icone: 'M3 13h8V3H3zm10 8h8V11h-8zM3 21h8v-6H3zm10-18v6h8V3z' },
    { url: '/candidatures', label: 'Candidatures', icone: 'M4 6h16M4 12h16M4 18h10' },
    { url: '/entretien', label: 'Simulation d\'entretien', icone: 'M21 12a8 8 0 0 1-11.8 7L4 20l1.1-4.6A8 8 0 1 1 21 12z' },
    { url: '/pitch', label: 'Mon pitch', icone: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3' },
    { url: '/documents', label: 'CV & lettres', icone: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6' },
    { url: '/profil', label: 'Mon profil', icone: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9a7 7 0 0 1 14 0' },
  ];
}
