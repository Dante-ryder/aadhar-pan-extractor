import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { ToastService, ToastInfo } from '../../services/toast.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-toast',
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class ToastComponent implements OnInit, OnDestroy {
  toasts: ToastInfo[] = [];
  private subscription = new Subscription();

  constructor(private toastService: ToastService) {}

  ngOnInit(): void {
    this.subscription.add(
      this.toastService.toast$.subscribe(toast => {
        this.toasts.push(toast);
        
        // Auto-remove toast after specified duration
        setTimeout(() => {
          this.removeToast(toast);
        }, toast.duration || 3000);
      })
    );
  }

  removeToast(toast: ToastInfo): void {
    this.toasts = this.toasts.filter(t => t !== toast);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
