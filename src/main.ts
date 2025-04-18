import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { AppComponent } from './app/app.component';
import { provideToastr } from 'ngx-toastr';

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
    provideHttpClient(),
    provideAnimations(), // Required for ngx-toastr animations
    provideToastr({      // Add ToastrModule configuration
      timeOut: 3000,
      positionClass: 'toast-top-right',
      preventDuplicates: true,
      closeButton: true,
      toastClass: 'ngx-toastr toast-animation', // Apply custom animation class
      progressBar: true,                        // Show progress bar
      maxOpened: 5                             // Maximum toasts at once
    })
  ]
}).catch(err => console.error(err));
