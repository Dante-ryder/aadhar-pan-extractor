import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import {ToastrService} from "ngx-toastr";

export interface ToastInfo {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastSubject = new Subject<ToastInfo>();
  toast$ = this.toastSubject.asObservable();

  constructor(private toastrService: ToastrService) {}

  showSuccess(message: string, duration: number = 3000): void {
    this.toastrService.success(message);
    console.log('SUCCESS:', message); // Also log to console for fallback
  }

  showError(message: string, duration: number = 3000): void {
    this.toastrService.error(message);
    console.error('ERROR:', message); // Also log to console for fallback
  }

  showInfo(message: string, duration: number = 3000): void {
    this.toastrService.info(message);
    console.info('INFO:', message); // Also log to console for fallback
  }

  showWarning(message: string, duration: number = 3000): void {
    this.toastrService.warning(message);
    console.warn('WARNING:', message); // Also log to console for fallback
  }

  private show(message: string, type: 'success' | 'error' | 'info' | 'warning', duration: number): void {
    // Forward to the appropriate toastr method based on type
    switch(type) {
      case 'success':
        this.toastrService.success(message);
        break;
      case 'error':
        this.toastrService.error(message);
        break;
      case 'info':
        this.toastrService.info(message);
        break;
      case 'warning':
        this.toastrService.warning(message);
        break;
    }
  }
}
