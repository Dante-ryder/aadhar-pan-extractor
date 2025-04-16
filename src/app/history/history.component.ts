import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';

interface Extraction {
  _id: string;
  documentType: 'aadhaar' | 'pan';
  name: string;
  extractedData: any;
  timestamp: string;
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.css']
})
export class HistoryComponent implements OnInit {
  extractions: Extraction[] = [];
  loading = true;
  error = '';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadExtractions();
  }

  loadExtractions() {
    this.loading = true;
    this.http.get<Extraction[]>('http://localhost:3000/api/extractions')
      .subscribe({
        next: (data) => {
          this.extractions = data;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error fetching extractions:', error);
          this.error = 'Failed to load history. Please try again later.';
          this.loading = false;
        }
      });
  }

  downloadCSV() {
    window.location.href = 'http://localhost:3000/api/extractions/download';
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString();
  }
}
