import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', title: 'Tableau de bord · Postulo', loadComponent: () => import('./pages/tableau-de-bord').then((m) => m.TableauDeBord) },
  { path: 'candidatures', title: 'Candidatures · Postulo', loadComponent: () => import('./pages/candidatures').then((m) => m.Candidatures) },
  { path: 'entretien', title: 'Simulation d\'entretien · Postulo', loadComponent: () => import('./pages/entretien').then((m) => m.Entretien) },
  { path: 'documents', title: 'CV & lettres · Postulo', loadComponent: () => import('./pages/documents').then((m) => m.Documents) },
  { path: 'profil', title: 'Mon profil · Postulo', loadComponent: () => import('./pages/profil').then((m) => m.ProfilPage) },
  { path: '**', redirectTo: '' },
];
