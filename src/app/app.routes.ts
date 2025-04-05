import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./home/home.component').then((m) => m.HomeComponent)
  },
  // Redirect all unmatched routes to home page
  { path: '**', redirectTo: '' }
];
