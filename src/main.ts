import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { AppComponent } from './app/app.component';

const routes = [
  {
    path: '',
    loadComponent: () => import('./app/storage-select/storage-select.component').then(m => m.StorageSelectComponent)
  },
  {
    path: 'home',
    loadComponent: () => import('./app/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'history',
    loadComponent: () => import('./app/history/history.component').then(m => m.HistoryComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient()
  ]
}).catch(err => console.error(err));
