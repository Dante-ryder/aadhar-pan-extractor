import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const storageGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  
  // Check if the CSV directory/file handle is stored in localStorage
  const storageInfo = localStorage.getItem('csvDirHandle');
  
  if (!storageInfo) {
    // Redirect to storage selection if no storage is set
    router.navigate(['/storage-select']);
    return false;
  }
  
  return true;
};
