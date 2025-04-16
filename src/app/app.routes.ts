import { Routes } from '@angular/router';
import { storageGuard } from './guards/storage-guard';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./home/home.component').then((m) => m.HomeComponent),
    canActivate: [storageGuard]
  },
  {
    path: 'storage-select',
    loadComponent: () => import('./storage-select/storage-select.component').then((m) => m.StorageSelectComponent),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  }
];
